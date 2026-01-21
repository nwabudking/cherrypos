-- ============================================
-- Cherry Dining POS - Trigger Definitions
-- Supabase-compatible - Schema Only
-- ============================================

-- ============================================
-- Updated At Triggers
-- ============================================

CREATE TRIGGER update_bar_inventory_updated_at 
  BEFORE UPDATE ON public.bar_inventory 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bar_to_bar_transfers_updated_at 
  BEFORE UPDATE ON public.bar_to_bar_transfers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bars_updated_at 
  BEFORE UPDATE ON public.bars 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cashier_bar_assignments_updated_at 
  BEFORE UPDATE ON public.cashier_bar_assignments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at 
  BEFORE UPDATE ON public.suppliers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Price Sync Triggers
-- ============================================

-- Sync inventory prices to linked menu items
CREATE TRIGGER sync_inventory_prices_to_menu 
  AFTER UPDATE OF cost_per_unit, selling_price ON public.inventory_items 
  FOR EACH ROW EXECUTE FUNCTION sync_inventory_to_menu_prices();

-- Sync menu prices to linked inventory items
CREATE TRIGGER sync_menu_prices_to_inventory 
  AFTER UPDATE OF cost_price, price ON public.menu_items 
  FOR EACH ROW EXECUTE FUNCTION sync_menu_to_inventory_prices();

-- Sync prices when menu item is linked to inventory
CREATE TRIGGER sync_menu_prices_on_link 
  AFTER INSERT OR UPDATE OF inventory_item_id ON public.menu_items 
  FOR EACH ROW 
  WHEN (NEW.inventory_item_id IS NOT NULL) 
  EXECUTE FUNCTION sync_menu_to_inventory_prices();

-- ============================================
-- Stock Availability Triggers
-- ============================================

-- Update menu item availability when stock changes
CREATE TRIGGER trigger_update_menu_availability 
  AFTER UPDATE OF current_stock ON public.inventory_items 
  FOR EACH ROW EXECUTE FUNCTION update_menu_availability_on_stock_change();

-- ============================================
-- Auth Triggers (for Supabase - create on auth.users)
-- ============================================
-- Note: This trigger should be created on auth.users table
-- CREATE TRIGGER on_auth_user_created 
--   AFTER INSERT ON auth.users 
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
