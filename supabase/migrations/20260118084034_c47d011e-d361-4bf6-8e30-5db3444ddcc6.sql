-- Bar-to-bar transfers: perform inventory updates server-side so cashiers can transfer without needing direct UPDATE permission on bar_inventory

CREATE OR REPLACE FUNCTION public.create_bar_to_bar_transfer(
  p_source_bar_id uuid,
  p_destination_bar_id uuid,
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL,
  p_admin_complete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_current_stock numeric;
  v_transfer_id uuid;
  v_is_admin boolean;
  v_status text;
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

  -- Cashiers can only transfer from their assigned bar
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

  IF p_admin_complete THEN
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


CREATE OR REPLACE FUNCTION public.respond_bar_to_bar_transfer(
  p_transfer_id uuid,
  p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_transfer public.bar_to_bar_transfers%ROWTYPE;
  v_is_admin boolean;
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

  -- Receiving cashier must be assigned to destination bar
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
    -- Add to destination bar
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
    -- Return stock to source bar
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