-- ============================================
-- Cherry Dining POS - Trigger Definitions
-- Supabase-compatible - Schema Only
-- Updated: 2026-01-22
-- ============================================

-- ============================================
-- Updated At Triggers
-- ============================================

DROP TRIGGER IF EXISTS update_bar_inventory_updated_at ON public.bar_inventory;
CREATE TRIGGER update_bar_inventory_updated_at 
  BEFORE UPDATE ON public.bar_inventory 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bar_to_bar_transfers_updated_at ON public.bar_to_bar_transfers;
CREATE TRIGGER update_bar_to_bar_transfers_updated_at 
  BEFORE UPDATE ON public.bar_to_bar_transfers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bars_updated_at ON public.bars;
CREATE TRIGGER update_bars_updated_at 
  BEFORE UPDATE ON public.bars 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cashier_bar_assignments_updated_at ON public.cashier_bar_assignments;
CREATE TRIGGER update_cashier_bar_assignments_updated_at 
  BEFORE UPDATE ON public.cashier_bar_assignments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at 
  BEFORE UPDATE ON public.suppliers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_users_updated_at ON public.staff_users;
CREATE TRIGGER update_staff_users_updated_at 
  BEFORE UPDATE ON public.staff_users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER update_inventory_items_updated_at 
  BEFORE UPDATE ON public.inventory_items 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER update_menu_items_updated_at 
  BEFORE UPDATE ON public.menu_items 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON public.orders 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_restaurant_settings_updated_at ON public.restaurant_settings;
CREATE TRIGGER update_restaurant_settings_updated_at 
  BEFORE UPDATE ON public.restaurant_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Price Sync Triggers
-- ============================================

-- Sync inventory prices to linked menu items
DROP TRIGGER IF EXISTS sync_inventory_prices_to_menu ON public.inventory_items;
CREATE TRIGGER sync_inventory_prices_to_menu 
  AFTER UPDATE OF cost_per_unit, selling_price ON public.inventory_items 
  FOR EACH ROW EXECUTE FUNCTION sync_inventory_to_menu_prices();

-- Sync menu prices to linked inventory items
DROP TRIGGER IF EXISTS sync_menu_prices_to_inventory ON public.menu_items;
CREATE TRIGGER sync_menu_prices_to_inventory 
  AFTER UPDATE OF cost_price, price ON public.menu_items 
  FOR EACH ROW EXECUTE FUNCTION sync_menu_to_inventory_prices();

-- Sync prices when menu item is linked to inventory
DROP TRIGGER IF EXISTS sync_menu_prices_on_link ON public.menu_items;
CREATE TRIGGER sync_menu_prices_on_link 
  AFTER INSERT OR UPDATE OF inventory_item_id ON public.menu_items 
  FOR EACH ROW 
  WHEN (NEW.inventory_item_id IS NOT NULL) 
  EXECUTE FUNCTION sync_menu_to_inventory_prices();

-- ============================================
-- Stock Availability Triggers
-- ============================================

-- Update menu item availability when stock changes
DROP TRIGGER IF EXISTS trigger_update_menu_availability ON public.inventory_items;
CREATE TRIGGER trigger_update_menu_availability 
  AFTER UPDATE OF current_stock ON public.inventory_items 
  FOR EACH ROW EXECUTE FUNCTION update_menu_availability_on_stock_change();

-- ============================================
-- Auth Triggers (for Supabase - create on auth.users)
-- ============================================
-- Note: This trigger should be created on auth.users table after schema import
-- Run this manually in Supabase SQL editor:
--
-- CREATE TRIGGER on_auth_user_created 
--   AFTER INSERT ON auth.users 
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
