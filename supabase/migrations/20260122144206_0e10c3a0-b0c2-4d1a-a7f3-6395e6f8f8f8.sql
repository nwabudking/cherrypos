
-- Drop and recreate the function to support both Supabase auth users and local staff users
CREATE OR REPLACE FUNCTION public.create_bar_to_bar_transfer(
  p_source_bar_id uuid, 
  p_destination_bar_id uuid, 
  p_inventory_item_id uuid, 
  p_quantity numeric, 
  p_notes text DEFAULT NULL::text, 
  p_admin_complete boolean DEFAULT false,
  p_staff_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_current_stock numeric;
  v_transfer_id uuid;
  v_is_admin boolean;
  v_is_staff_admin boolean;
  v_status text;
  v_requester_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if it's a local staff user or Supabase auth user
  IF v_user_id IS NULL AND p_staff_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No user context';
  END IF;

  IF p_source_bar_id = p_destination_bar_id THEN
    RAISE EXCEPTION 'Source and destination bars must be different';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;

  -- Check admin status for Supabase auth users
  v_is_admin := COALESCE(
    has_role(v_user_id, 'super_admin'::public.app_role)
    OR has_role(v_user_id, 'manager'::public.app_role)
    OR has_role(v_user_id, 'store_admin'::public.app_role),
    false
  );

  -- Check admin status for local staff users
  v_is_staff_admin := COALESCE(
    staff_has_role(p_staff_user_id, 'super_admin'::public.app_role)
    OR staff_has_role(p_staff_user_id, 'manager'::public.app_role)
    OR staff_has_role(p_staff_user_id, 'store_admin'::public.app_role),
    false
  );

  -- For local staff (cashiers/waitstaff), verify bar assignment
  IF p_staff_user_id IS NOT NULL AND NOT v_is_staff_admin THEN
    -- Check if staff has cashier or waitstaff role
    IF staff_has_role(p_staff_user_id, 'cashier'::public.app_role) 
       OR staff_has_role(p_staff_user_id, 'waitstaff'::public.app_role) THEN
      -- Verify they are assigned to the source bar
      IF NOT EXISTS (
        SELECT 1
        FROM public.cashier_bar_assignments cba
        WHERE cba.staff_user_id = p_staff_user_id
          AND cba.bar_id = p_source_bar_id
          AND COALESCE(cba.is_active, true) = true
      ) THEN
        RAISE EXCEPTION 'Unauthorized: Not assigned to the source bar';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unauthorized: Invalid staff role for transfers';
    END IF;
  END IF;

  -- For Supabase auth users (non-admin), verify bar assignment
  IF v_user_id IS NOT NULL AND NOT v_is_admin THEN
    IF has_role(v_user_id, 'cashier'::public.app_role) OR has_role(v_user_id, 'waitstaff'::public.app_role) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.cashier_bar_assignments cba
        WHERE cba.user_id = v_user_id
          AND cba.bar_id = p_source_bar_id
          AND COALESCE(cba.is_active, true) = true
      ) THEN
        RAISE EXCEPTION 'Unauthorized: Not assigned to the source bar';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Lock the source inventory row and validate stock
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

  -- Deduct from source bar immediately
  UPDATE public.bar_inventory
  SET current_stock = current_stock - p_quantity,
      updated_at = now()
  WHERE bar_id = p_source_bar_id
    AND inventory_item_id = p_inventory_item_id;

  -- Determine who is the requester
  v_requester_id := COALESCE(v_user_id, p_staff_user_id);

  IF p_admin_complete OR v_is_admin OR v_is_staff_admin THEN
    -- Admin immediate completion: add to destination
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
      v_requester_id,
      v_requester_id,
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
      v_requester_id,
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
$function$;

-- Also update respond function for local staff
CREATE OR REPLACE FUNCTION public.respond_bar_to_bar_transfer(
  p_transfer_id uuid, 
  p_response text,
  p_staff_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_transfer public.bar_to_bar_transfers%ROWTYPE;
  v_is_admin boolean;
  v_is_staff_admin boolean;
  v_responder_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL AND p_staff_user_id IS NULL THEN
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

  v_is_admin := COALESCE(
    has_role(v_user_id, 'super_admin'::public.app_role)
    OR has_role(v_user_id, 'manager'::public.app_role)
    OR has_role(v_user_id, 'store_admin'::public.app_role),
    false
  );

  v_is_staff_admin := COALESCE(
    staff_has_role(p_staff_user_id, 'super_admin'::public.app_role)
    OR staff_has_role(p_staff_user_id, 'manager'::public.app_role)
    OR staff_has_role(p_staff_user_id, 'store_admin'::public.app_role),
    false
  );

  -- For local staff, verify they are assigned to destination bar
  IF p_staff_user_id IS NOT NULL AND NOT v_is_staff_admin THEN
    IF staff_has_role(p_staff_user_id, 'cashier'::public.app_role) 
       OR staff_has_role(p_staff_user_id, 'waitstaff'::public.app_role) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.cashier_bar_assignments cba
        WHERE cba.staff_user_id = p_staff_user_id
          AND cba.bar_id = v_transfer.destination_bar_id
          AND COALESCE(cba.is_active, true) = true
      ) THEN
        RAISE EXCEPTION 'Unauthorized: Not assigned to the destination bar';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- For Supabase auth users, verify assignment
  IF v_user_id IS NOT NULL AND NOT v_is_admin THEN
    IF has_role(v_user_id, 'cashier'::public.app_role) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.cashier_bar_assignments cba
        WHERE cba.user_id = v_user_id
          AND cba.bar_id = v_transfer.destination_bar_id
          AND COALESCE(cba.is_active, true) = true
      ) THEN
        RAISE EXCEPTION 'Unauthorized: Not assigned to the destination bar';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  v_responder_id := COALESCE(v_user_id, p_staff_user_id);

  IF p_response = 'accepted' THEN
    -- Add to destination bar
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
    VALUES (v_transfer.destination_bar_id, v_transfer.inventory_item_id, v_transfer.quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id)
    DO UPDATE SET
      current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock,
      updated_at = now();

    UPDATE public.bar_to_bar_transfers
    SET status = 'completed',
        approved_by = v_responder_id,
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
    -- Return stock to source bar
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
    VALUES (v_transfer.source_bar_id, v_transfer.inventory_item_id, v_transfer.quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id)
    DO UPDATE SET
      current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock,
      updated_at = now();

    UPDATE public.bar_to_bar_transfers
    SET status = 'rejected',
        approved_by = v_responder_id,
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
$function$;
