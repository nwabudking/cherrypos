-- Add inventory_item_id to menu_items to link with inventory
ALTER TABLE public.menu_items 
ADD COLUMN inventory_item_id uuid REFERENCES public.inventory_items(id);

-- Add track_inventory flag to control if item should check stock
ALTER TABLE public.menu_items 
ADD COLUMN track_inventory boolean DEFAULT false;

-- Create index for faster lookups
CREATE INDEX idx_menu_items_inventory ON public.menu_items(inventory_item_id) WHERE inventory_item_id IS NOT NULL;

-- Create a function to automatically update menu item availability based on stock
CREATE OR REPLACE FUNCTION public.update_menu_availability_on_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update menu items linked to this inventory item
  UPDATE public.menu_items
  SET is_available = CASE 
    WHEN NEW.current_stock <= 0 THEN false 
    ELSE true 
  END
  WHERE inventory_item_id = NEW.id 
    AND track_inventory = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update availability
CREATE TRIGGER trigger_update_menu_availability
AFTER UPDATE OF current_stock ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_menu_availability_on_stock_change();