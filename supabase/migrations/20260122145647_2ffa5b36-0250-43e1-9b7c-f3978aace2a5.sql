-- Drop existing functions first
DROP FUNCTION IF EXISTS public.create_bar_to_bar_transfer(uuid, uuid, uuid, numeric, text, boolean);
DROP FUNCTION IF EXISTS public.create_bar_to_bar_transfer(uuid, uuid, uuid, numeric, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.respond_bar_to_bar_transfer(uuid, text);
DROP FUNCTION IF EXISTS public.respond_bar_to_bar_transfer(uuid, text, uuid);

-- Create bar to bar transfer with optional staff_user_id for local staff auth
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
  
  -- If no Supabase auth, check for local staff
  IF v_user_id IS NULL THEN
    IF p_staff_user_id IS NOT NULL THEN
      -- Verify the staff user exists and is active
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
      -- For local staff, check staff_user_id assignment
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
      -- For Supabase auth users, check user_id assignment
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

-- Respond to bar to bar transfer with optional staff_user_id for local staff auth
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
  -- Determine user context: either Supabase auth or local staff
  v_user_id := auth.uid();
  
  -- If no Supabase auth, check for local staff
  IF v_user_id IS NULL THEN
    IF p_staff_user_id IS NOT NULL THEN
      -- Verify the staff user exists and is active
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
      -- For local staff, check staff_user_id assignment to destination bar
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
      -- For Supabase auth users
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