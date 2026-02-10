-- ============================================
-- Cherry Dining POS - Function Definitions
-- Supabase-compatible - Schema Only
-- Updated: 2026-02-10
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

-- Check if user has a specific role (Supabase auth users)
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

-- Check if local staff user has a specific role
CREATE OR REPLACE FUNCTION public.staff_has_role(p_staff_id UUID, p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE id = p_staff_id AND role = p_role AND is_active = true
  );
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

-- Create bar to bar transfer (supports both Supabase auth and local staff)
CREATE OR REPLACE FUNCTION public.create_bar_to_bar_transfer(
  p_source_bar_id UUID, 
  p_destination_bar_id UUID, 
  p_inventory_item_id UUID, 
  p_quantity NUMERIC, 
  p_notes TEXT DEFAULT NULL, 
  p_admin_complete BOOLEAN DEFAULT false,
  p_staff_user_id UUID DEFAULT NULL
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
  v_is_local_staff BOOLEAN := false;
  v_staff_role app_role;
BEGIN
  -- Determine user context: either Supabase auth or local staff
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    IF p_staff_user_id IS NOT NULL THEN
      SELECT role INTO v_staff_role
      FROM public.staff_users
      WHERE id = p_staff_user_id AND is_active = true;
      
      IF v_staff_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid or inactive staff user';
      END IF;
      
      v_is_local_staff := true;
      v_user_id := p_staff_user_id;
    ELSE
      RAISE EXCEPTION 'Unauthorized: No user context';
    END IF;
  END IF;

  IF p_source_bar_id = p_destination_bar_id THEN
    RAISE EXCEPTION 'Source and destination bars must be different';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;

  -- Check admin status based on auth type
  IF v_is_local_staff THEN
    v_is_admin := v_staff_role IN ('super_admin', 'manager', 'store_admin');
  ELSE
    v_is_admin := (
      has_role(v_user_id, 'super_admin'::app_role)
      OR has_role(v_user_id, 'manager'::app_role)
      OR has_role(v_user_id, 'store_admin'::app_role)
    );
  END IF;

  -- Check authorization for non-admins
  IF NOT v_is_admin THEN
    IF v_is_local_staff THEN
      IF v_staff_role = 'cashier' OR v_staff_role = 'waitstaff' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.cashier_bar_assignments cba
          WHERE cba.staff_user_id = v_user_id
            AND cba.bar_id = p_source_bar_id
            AND COALESCE(cba.is_active, true) = true
        ) THEN
          RAISE EXCEPTION 'Unauthorized: not assigned to the source bar';
        END IF;
      ELSE
        RAISE EXCEPTION 'Unauthorized: role not permitted';
      END IF;
    ELSE
      IF has_role(v_user_id, 'cashier'::app_role) OR has_role(v_user_id, 'waitstaff'::app_role) THEN
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
  END IF;

  -- Get and lock source inventory
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

  -- Deduct from source bar
  UPDATE public.bar_inventory
  SET current_stock = current_stock - p_quantity,
      updated_at = now()
  WHERE bar_id = p_source_bar_id
    AND inventory_item_id = p_inventory_item_id;

  -- Handle admin immediate completion vs pending request
  IF p_admin_complete AND v_is_admin THEN
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
    VALUES (p_destination_bar_id, p_inventory_item_id, p_quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id)
    DO UPDATE SET
      current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock,
      updated_at = now();

    v_status := 'completed';

    INSERT INTO public.bar_to_bar_transfers (
      source_bar_id, destination_bar_id, inventory_item_id, quantity,
      notes, status, requested_by, approved_by, completed_at, updated_at
    )
    VALUES (
      p_source_bar_id, p_destination_bar_id, p_inventory_item_id, p_quantity,
      p_notes, v_status, v_user_id, v_user_id, now(), now()
    )
    RETURNING id INTO v_transfer_id;
  ELSE
    v_status := 'pending';

    INSERT INTO public.bar_to_bar_transfers (
      source_bar_id, destination_bar_id, inventory_item_id, quantity,
      notes, status, requested_by, updated_at
    )
    VALUES (
      p_source_bar_id, p_destination_bar_id, p_inventory_item_id, p_quantity,
      p_notes, v_status, v_user_id, now()
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

-- Respond to bar to bar transfer (supports both Supabase auth and local staff)
CREATE OR REPLACE FUNCTION public.respond_bar_to_bar_transfer(
  p_transfer_id UUID, 
  p_response TEXT,
  p_staff_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_transfer public.bar_to_bar_transfers%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_local_staff BOOLEAN := false;
  v_staff_role app_role;
BEGIN
  -- Determine user context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    IF p_staff_user_id IS NOT NULL THEN
      SELECT role INTO v_staff_role
      FROM public.staff_users
      WHERE id = p_staff_user_id AND is_active = true;
      
      IF v_staff_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid or inactive staff user';
      END IF;
      
      v_is_local_staff := true;
      v_user_id := p_staff_user_id;
    ELSE
      RAISE EXCEPTION 'Unauthorized: No user context';
    END IF;
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

  -- Check admin status
  IF v_is_local_staff THEN
    v_is_admin := v_staff_role IN ('super_admin', 'manager', 'store_admin');
  ELSE
    v_is_admin := (
      has_role(v_user_id, 'super_admin'::app_role)
      OR has_role(v_user_id, 'manager'::app_role)
      OR has_role(v_user_id, 'store_admin'::app_role)
    );
  END IF;

  -- Check authorization for non-admins
  IF NOT v_is_admin THEN
    IF v_is_local_staff THEN
      IF v_staff_role = 'cashier' OR v_staff_role = 'waitstaff' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.cashier_bar_assignments cba
          WHERE cba.staff_user_id = v_user_id
            AND cba.bar_id = v_transfer.destination_bar_id
            AND COALESCE(cba.is_active, true) = true
        ) THEN
          RAISE EXCEPTION 'Unauthorized: not assigned to the destination bar';
        END IF;
      ELSE
        RAISE EXCEPTION 'Unauthorized: role not permitted';
      END IF;
    ELSE
      IF has_role(v_user_id, 'cashier'::app_role) OR has_role(v_user_id, 'waitstaff'::app_role) THEN
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
    -- Return stock to source bar on rejection
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
-- Staff User Functions (Local Authentication)
-- ============================================

-- Create staff user
CREATE OR REPLACE FUNCTION public.create_staff_user(
  p_username TEXT, 
  p_password TEXT, 
  p_full_name TEXT, 
  p_email TEXT DEFAULT NULL, 
  p_role app_role DEFAULT 'cashier'::app_role
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_new_staff_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF NOT (public.has_role(v_user_id, 'super_admin'::public.app_role) OR public.has_role(v_user_id, 'manager'::public.app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can create staff users';
  END IF;

  IF EXISTS (SELECT 1 FROM public.staff_users WHERE username = LOWER(p_username)) THEN
    RAISE EXCEPTION 'Username already exists';
  END IF;

  INSERT INTO public.staff_users (username, password_hash, full_name, email, role, created_by)
  VALUES (
    LOWER(p_username),
    extensions.crypt(p_password, extensions.gen_salt('bf'::text)),
    p_full_name,
    p_email,
    p_role,
    v_user_id
  )
  RETURNING id INTO v_new_staff_id;

  RETURN v_new_staff_id;
END;
$$;

-- Verify staff password (login)
CREATE OR REPLACE FUNCTION public.verify_staff_password(p_username TEXT, p_password TEXT)
RETURNS TABLE(staff_id UUID, staff_name TEXT, staff_role app_role, staff_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_staff public.staff_users%ROWTYPE;
BEGIN
  SELECT * INTO v_staff
  FROM public.staff_users
  WHERE username = LOWER(p_username) AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_staff.password_hash = extensions.crypt(p_password, v_staff.password_hash) THEN
    UPDATE public.staff_users SET last_login_at = now() WHERE id = v_staff.id;
    RETURN QUERY SELECT v_staff.id, v_staff.full_name, v_staff.role, v_staff.email;
  END IF;

  RETURN;
END;
$$;

-- Update staff password (admin action)
CREATE OR REPLACE FUNCTION public.update_staff_password(p_staff_id UUID, p_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF NOT (public.has_role(v_user_id, 'super_admin'::public.app_role) OR public.has_role(v_user_id, 'manager'::public.app_role)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.staff_users
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'::text)),
      updated_at = now()
  WHERE id = p_staff_id;

  RETURN FOUND;
END;
$$;

-- Staff change own password
CREATE OR REPLACE FUNCTION public.staff_change_own_password(p_staff_id UUID, p_current_password TEXT, p_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_current_hash TEXT;
BEGIN
  SELECT password_hash INTO v_current_hash
  FROM public.staff_users
  WHERE id = p_staff_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff user not found or inactive';
  END IF;

  IF v_current_hash != extensions.crypt(p_current_password, v_current_hash) THEN
    RAISE EXCEPTION 'Current password is incorrect';
  END IF;

  UPDATE public.staff_users
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = p_staff_id;

  RETURN true;
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

-- Sync menu prices to inventory items
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

-- Update menu availability on stock change
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
-- Auth Functions
-- ============================================

-- Handle new user signup (creates profile + assigns default role)
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
