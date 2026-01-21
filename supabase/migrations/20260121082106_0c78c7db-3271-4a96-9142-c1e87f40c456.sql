-- Create function to restore bar inventory on order void
CREATE OR REPLACE FUNCTION public.restore_bar_inventory_on_void(
  p_bar_id uuid,
  p_inventory_item_id uuid,
  p_quantity numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Upsert: insert if not exists, increment if exists
  INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
  VALUES (p_bar_id, p_inventory_item_id, p_quantity, 5)
  ON CONFLICT (bar_id, inventory_item_id)
  DO UPDATE SET 
    current_stock = bar_inventory.current_stock + p_quantity,
    updated_at = now();
  
  RETURN true;
END;
$$;