-- ============================================
-- Cherry Dining POS - Index Definitions
-- Supabase-compatible - Schema Only
-- Updated: 2026-01-22
-- ============================================

-- Bar inventory indexes
CREATE INDEX IF NOT EXISTS idx_bar_inventory_expiry ON public.bar_inventory (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_bar_inventory_bar_item ON public.bar_inventory (bar_id, inventory_item_id);

-- Inventory items indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiry ON public.inventory_items (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items (category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier ON public.inventory_items (supplier_id);

-- Menu items indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_inventory ON public.menu_items (inventory_item_id) WHERE (inventory_item_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items (category_id);

-- Bar to bar transfers indexes
CREATE INDEX IF NOT EXISTS idx_bar_to_bar_transfers_source ON public.bar_to_bar_transfers (source_bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_to_bar_transfers_destination ON public.bar_to_bar_transfers (destination_bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_to_bar_transfers_status ON public.bar_to_bar_transfers (status);
CREATE INDEX IF NOT EXISTS idx_bar_to_bar_transfers_pending ON public.bar_to_bar_transfers (status, created_at) WHERE (status = 'pending');

-- Inventory transfers indexes
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_destination ON public.inventory_transfers (destination_bar_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_item ON public.inventory_transfers (inventory_item_id);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_bar ON public.orders (bar_id);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON public.order_items (menu_item_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments (order_id);

-- Stock movements indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements (created_at);

-- Cashier bar assignments indexes
CREATE INDEX IF NOT EXISTS idx_cashier_assignments_user ON public.cashier_bar_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_cashier_assignments_staff ON public.cashier_bar_assignments (staff_user_id);
CREATE INDEX IF NOT EXISTS idx_cashier_assignments_bar ON public.cashier_bar_assignments (bar_id);

-- Staff users indexes
CREATE INDEX IF NOT EXISTS idx_staff_users_username ON public.staff_users (username);
CREATE INDEX IF NOT EXISTS idx_staff_users_role ON public.staff_users (role);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs (performed_by);
