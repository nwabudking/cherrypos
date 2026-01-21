-- ============================================
-- Cherry Dining POS - Function Definitions
-- Supabase-compatible - Schema Only
-- ============================================

-- ============================================
-- Utility Functions
-- ============================================

-- Update updated_at column trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- Role and Permission Functions
-- ============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- ============================================
-- Order Functions
-- ============================================

-- Generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  today_date TEXT;
  order_count INTEGER;
  new_order_number TEXT;
BEGIN
  today_date := to_char(NOW(), 'YYMMDD');
  
  SELECT COUNT(*) + 1 INTO order_count
  FROM public.orders
  WHERE created_at::date = CURRENT_DATE;
  
  new_order_number := 'ORD-' || today_date || '-' || LPAD(order_count::TEXT, 4, '0');
  
  RETURN new_order_number;
END;
$$;

-- ============================================
-- Inventory Functions
-- ============================================

-- Check bar stock availability
CREATE OR REPLACE FUNCTION public.check_bar_stock(p_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT current_stock >= p_quantity
     FROM public.bar_inventory
     WHERE bar_id = p_bar_id AND inventory_item_id = p_inventory_item_id),
    false
  );
$$;

-- Deduct bar inventory
CREATE OR REPLACE FUNCTION public.deduct_bar_inventory(p_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_stock NUMERIC;
BEGIN
  SELECT current_stock INTO v_current_stock
  FROM public.bar_inventory
  WHERE bar_id = p_bar_id AND inventory_item_id = p_inventory_item_id;
  
  IF v_current_stock IS NULL OR v_current_stock < p_quantity THEN
    RETURN false;
  END IF;
  
  UPDATE public.bar_inventory
  SET current_stock = current_stock - p_quantity
  WHERE bar_id = p_bar_id AND inventory_item_id = p_inventory_item_id;
  
  RETURN true;
END;
$$;

-- Restore bar inventory on void
CREATE OR REPLACE FUNCTION public.restore_bar_inventory_on_void(p_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
  VALUES (p_bar_id, p_inventory_item_id, p_quantity, 5)
  ON CONFLICT (bar_id, inventory_item_id)
  DO UPDATE SET 
    current_stock = bar_inventory.current_stock + p_quantity,
    updated_at = now();
  
  RETURN true;
END;
$$;

-- ============================================
-- Transfer Functions
-- ============================================

-- Transfer from store to bar
CREATE OR REPLACE FUNCTION public.transfer_store_to_bar(p_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_stock NUMERIC;
  v_transfer_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF NOT (has_role(v_user_id, 'super_admin'::app_role) OR has_role(v_user_id, 'manager'::app_role) OR has_role(v_user_id, 'store_admin'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only store admins can transfer inventory';
  END IF;
  
  SELECT current_stock INTO v_store_stock
  FROM public.inventory_items
  WHERE id = p_inventory_item_id;
  
  IF v_store_stock IS NULL THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;
  
  IF v_store_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient store stock. Available: %, Requested: %', v_store_stock, p_quantity;
  END IF;
  
  UPDATE public.inventory_items
  SET current_stock = current_stock - p_quantity
  WHERE id = p_inventory_item_id;
  
  INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock)
  VALUES (p_bar_id, p_inventory_item_id, p_quantity)
  ON CONFLICT (bar_id, inventory_item_id)
  DO UPDATE SET current_stock = bar_inventory.current_stock + p_quantity;
  
  INSERT INTO public.inventory_transfers (
    source_type, destination_bar_id, inventory_item_id, 
    quantity, status, notes, transferred_by, completed_at
  )
  VALUES (
    'store', p_bar_id, p_inventory_item_id,
    p_quantity, 'completed', p_notes, v_user_id, now()
  )
  RETURNING id INTO v_transfer_id;
  
  INSERT INTO public.audit_logs (
    action_type, entity_type, entity_id, 
    new_data, performed_by
  )
  VALUES (
    'transfer', 'inventory', p_inventory_item_id,
    jsonb_build_object(
      'transfer_id', v_transfer_id,
      'bar_id', p_bar_id,
      'quantity', p_quantity,
      'previous_store_stock', v_store_stock,
      'new_store_stock', v_store_stock - p_quantity
    ),
    v_user_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'message', 'Transfer completed successfully'
  );
END;
$$;

-- Create bar to bar transfer
CREATE OR REPLACE FUNCTION public.create_bar_to_bar_transfer(
  p_source_bar_id UUID, 
  p_destination_bar_id UUID, 
  p_inventory_item_id UUID, 
  p_quantity NUMERIC, 
  p_notes TEXT DEFAULT NULL, 
  p_admin_complete BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_current_stock NUMERIC;
  v_transfer_id UUID;
  v_is_admin BOOLEAN;
  v_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_source_bar_id = p_destination_bar_id THEN
    RAISE EXCEPTION 'Source and destination bars must be different';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;

  v_is_admin := (
    has_role(v_user_id, 'super_admin'::app_role)
    OR has_role(v_user_id, 'manager'::app_role)
    OR has_role(v_user_id, 'store_admin'::app_role)
  );

  IF NOT v_is_admin THEN
    IF has_role(v_user_id, 'cashier'::app_role) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.cashier_bar_assignments cba
        WHERE cba.user_id = v_user_id
          AND cba.bar_id = p_source_bar_id
          AND COALESCE(cba.is_active, true) = true
      ) THEN
        RAISE EXCEPTION 'Unauthorized: not assigned to the source bar';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT bi.current_stock
  INTO v_current_stock
  FROM public.bar_inventory bi
  WHERE bi.bar_id = p_source_bar_id
    AND bi.inventory_item_id = p_inventory_item_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Item not found in source bar inventory';
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, p_quantity;
  END IF;

  UPDATE public.bar_inventory
  SET current_stock = current_stock - p_quantity,
      updated_at = now()
  WHERE bar_id = p_source_bar_id
    AND inventory_item_id = p_inventory_item_id;

  IF p_admin_complete THEN
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
    VALUES (p_destination_bar_id, p_inventory_item_id, p_quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id)
    DO UPDATE SET
      current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock,
      updated_at = now();

    v_status := 'completed';

    INSERT INTO public.bar_to_bar_transfers (
      source_bar_id,
      destination_bar_id,
      inventory_item_id,
      quantity,
      notes,
      status,
      requested_by,
      approved_by,
      completed_at,
      updated_at
    )
    VALUES (
      p_source_bar_id,
      p_destination_bar_id,
      p_inventory_item_id,
      p_quantity,
      p_notes,
      v_status,
      v_user_id,
      v_user_id,
      now(),
      now()
    )
    RETURNING id INTO v_transfer_id;
  ELSE
    v_status := 'pending';

    INSERT INTO public.bar_to_bar_transfers (
      source_bar_id,
      destination_bar_id,
      inventory_item_id,
      quantity,
      notes,
      status,
      requested_by,
      updated_at
    )
    VALUES (
      p_source_bar_id,
      p_destination_bar_id,
      p_inventory_item_id,
      p_quantity,
      p_notes,
      v_status,
      v_user_id,
      now()
    )
    RETURNING id INTO v_transfer_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'status', v_status,
    'source_bar_id', p_source_bar_id,
    'destination_bar_id', p_destination_bar_id,
    'inventory_item_id', p_inventory_item_id,
    'previous_source_stock', v_current_stock,
    'new_source_stock', v_current_stock - p_quantity
  );
END;
$$;

-- Respond to bar to bar transfer
CREATE OR REPLACE FUNCTION public.respond_bar_to_bar_transfer(p_transfer_id UUID, p_response TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_transfer public.bar_to_bar_transfers%ROWTYPE;
  v_is_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_response NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid response: %', p_response;
  END IF;

  SELECT *
  INTO v_transfer
  FROM public.bar_to_bar_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Transfer already processed',
      'status', v_transfer.status,
      'transfer_id', v_transfer.id,
      'source_bar_id', v_transfer.source_bar_id,
      'destination_bar_id', v_transfer.destination_bar_id,
      'inventory_item_id', v_transfer.inventory_item_id
    );
  END IF;

  v_is_admin := (
    has_role(v_user_id, 'super_admin'::app_role)
    OR has_role(v_user_id, 'manager'::app_role)
    OR has_role(v_user_id, 'store_admin'::app_role)
  );

  IF NOT v_is_admin THEN
    IF has_role(v_user_id, 'cashier'::app_role) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.cashier_bar_assignments cba
        WHERE cba.user_id = v_user_id
          AND cba.bar_id = v_transfer.destination_bar_id
          AND COALESCE(cba.is_active, true) = true
      ) THEN
        RAISE EXCEPTION 'Unauthorized: not assigned to the destination bar';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  IF p_response = 'accepted' THEN
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
    VALUES (v_transfer.destination_bar_id, v_transfer.inventory_item_id, v_transfer.quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id)
    DO UPDATE SET
      current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock,
      updated_at = now();

    UPDATE public.bar_to_bar_transfers
    SET status = 'completed',
        approved_by = v_user_id,
        completed_at = now(),
        updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object(
      'success', true,
      'transfer_id', v_transfer.id,
      'status', 'completed',
      'source_bar_id', v_transfer.source_bar_id,
      'destination_bar_id', v_transfer.destination_bar_id,
      'inventory_item_id', v_transfer.inventory_item_id
    );
  ELSE
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
    VALUES (v_transfer.source_bar_id, v_transfer.inventory_item_id, v_transfer.quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id)
    DO UPDATE SET
      current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock,
      updated_at = now();

    UPDATE public.bar_to_bar_transfers
    SET status = 'rejected',
        approved_by = v_user_id,
        completed_at = now(),
        updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object(
      'success', true,
      'transfer_id', v_transfer.id,
      'status', 'rejected',
      'source_bar_id', v_transfer.source_bar_id,
      'destination_bar_id', v_transfer.destination_bar_id,
      'inventory_item_id', v_transfer.inventory_item_id
    );
  END IF;
END;
$$;

-- ============================================
-- Price Sync Functions
-- ============================================

-- Sync inventory prices to menu items
CREATE OR REPLACE FUNCTION public.sync_inventory_to_menu_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.menu_items
  SET 
    cost_price = NEW.cost_per_unit,
    price = COALESCE(NEW.selling_price, price),
    updated_at = now()
  WHERE inventory_item_id = NEW.id
    AND (cost_price IS DISTINCT FROM NEW.cost_per_unit 
         OR (NEW.selling_price IS NOT NULL AND price IS DISTINCT FROM NEW.selling_price));
  
  RETURN NEW;
END;
$$;

-- Sync menu prices to inventory
CREATE OR REPLACE FUNCTION public.sync_menu_to_inventory_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    UPDATE public.inventory_items
    SET 
      cost_per_unit = NEW.cost_price,
      selling_price = NEW.price,
      updated_at = now()
    WHERE id = NEW.inventory_item_id
      AND (cost_per_unit IS DISTINCT FROM NEW.cost_price 
           OR selling_price IS DISTINCT FROM NEW.price);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update menu availability based on stock
CREATE OR REPLACE FUNCTION public.update_menu_availability_on_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.menu_items
  SET is_available = CASE 
    WHEN NEW.current_stock <= 0 THEN false 
    ELSE true 
  END
  WHERE inventory_item_id = NEW.id 
    AND track_inventory = true;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- Auth Functions (for Supabase Auth integration)
-- ============================================

-- Handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cashier');
  
  RETURN NEW;
END;
$$;
