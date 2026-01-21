-- ============================================
-- Cherry Dining POS - Index Definitions
-- Supabase-compatible - Schema Only
-- ============================================

-- Bar inventory indexes
CREATE INDEX idx_bar_inventory_expiry ON public.bar_inventory (expiry_date) WHERE (expiry_date IS NOT NULL);

-- Inventory items indexes
CREATE INDEX idx_inventory_items_expiry ON public.inventory_items (expiry_date) WHERE (expiry_date IS NOT NULL);

-- Menu items indexes
CREATE INDEX idx_menu_items_inventory ON public.menu_items (inventory_item_id) WHERE (inventory_item_id IS NOT NULL);

-- Bar to bar transfers indexes
CREATE INDEX idx_bar_to_bar_transfers_source ON public.bar_to_bar_transfers (source_bar_id);
CREATE INDEX idx_bar_to_bar_transfers_destination ON public.bar_to_bar_transfers (destination_bar_id);
CREATE INDEX idx_bar_to_bar_transfers_status ON public.bar_to_bar_transfers (status);
