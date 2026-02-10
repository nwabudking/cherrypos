-- ============================================
-- Cherry Dining POS - Row Level Security Policies
-- Supabase-compatible - Schema Only
-- Updated: 2026-02-10
-- ============================================

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_to_bar_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_bar_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Audit Logs Policies
-- ============================================

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Staff can create audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'store_admin'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR
    has_role(auth.uid(), 'waitstaff'::app_role)
  );

-- ============================================
-- Bar Inventory Policies
-- ============================================

CREATE POLICY "Anyone can view bar inventory" ON public.bar_inventory
  FOR SELECT USING (is_active = true);

CREATE POLICY "Store staff can manage bar inventory" ON public.bar_inventory
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'store_admin'::app_role)
  );

-- ============================================
-- Bar to Bar Transfers Policies
-- ============================================

CREATE POLICY "Anyone can view transfers" ON public.bar_to_bar_transfers
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own transfers" ON public.bar_to_bar_transfers
  FOR INSERT WITH CHECK (
    (auth.uid() = requested_by) AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR 
      has_role(auth.uid(), 'manager'::app_role) OR 
      has_role(auth.uid(), 'store_admin'::app_role) OR 
      (has_role(auth.uid(), 'cashier'::app_role) AND EXISTS (
        SELECT 1 FROM cashier_bar_assignments cba
        WHERE cba.user_id = auth.uid() 
          AND cba.bar_id = bar_to_bar_transfers.source_bar_id 
          AND COALESCE(cba.is_active, true) = true
      ))
    )
  );

CREATE POLICY "Admins or destination cashiers can update transfers" ON public.bar_to_bar_transfers
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'store_admin'::app_role) OR 
    (has_role(auth.uid(), 'cashier'::app_role) AND EXISTS (
      SELECT 1 FROM cashier_bar_assignments cba
      WHERE cba.user_id = auth.uid() 
        AND cba.bar_id = bar_to_bar_transfers.destination_bar_id 
        AND COALESCE(cba.is_active, true) = true
    ))
  ) WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'store_admin'::app_role) OR 
    (has_role(auth.uid(), 'cashier'::app_role) AND EXISTS (
      SELECT 1 FROM cashier_bar_assignments cba
      WHERE cba.user_id = auth.uid() 
        AND cba.bar_id = bar_to_bar_transfers.destination_bar_id 
        AND COALESCE(cba.is_active, true) = true
    ))
  );

-- ============================================
-- Bars Policies
-- ============================================

CREATE POLICY "Anyone can view active bars" ON public.bars
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage bars" ON public.bars
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- ============================================
-- Cashier Bar Assignments Policies
-- ============================================

CREATE POLICY "Authenticated staff can view assignments" ON public.cashier_bar_assignments
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'bar_staff'::app_role) OR
    has_role(auth.uid(), 'waitstaff'::app_role)
  );

CREATE POLICY "Local staff can view own assignment" ON public.cashier_bar_assignments
  FOR SELECT USING (staff_user_id IS NOT NULL);

CREATE POLICY "Admins can manage assignments" ON public.cashier_bar_assignments
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- ============================================
-- Inventory Items Policies
-- ============================================

CREATE POLICY "Anyone can view active inventory" ON public.inventory_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "Managers and inventory officers can manage inventory" ON public.inventory_items
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'inventory_officer'::app_role)
  );

-- ============================================
-- Inventory Transfers Policies
-- ============================================

CREATE POLICY "Staff can view transfers" ON public.inventory_transfers
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'store_admin'::app_role) OR 
    has_role(auth.uid(), 'store_user'::app_role)
  );

CREATE POLICY "Store admins can create transfers" ON public.inventory_transfers
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'store_admin'::app_role)
  );

-- ============================================
-- Menu Categories Policies
-- ============================================

CREATE POLICY "Anyone can view active categories" ON public.menu_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Staff can manage categories" ON public.menu_categories
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- ============================================
-- Menu Items Policies
-- ============================================

CREATE POLICY "Anyone can view active items" ON public.menu_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "Staff can manage items" ON public.menu_items
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- ============================================
-- Order Items Policies
-- ============================================

CREATE POLICY "Anyone can view order items" ON public.order_items
  FOR SELECT USING (true);

CREATE POLICY "Can create order items for valid orders" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id)
  );

CREATE POLICY "Can update order items for valid orders" ON public.order_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id)
  );

-- ============================================
-- Orders Policies
-- ============================================

CREATE POLICY "Staff can view orders" ON public.orders
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'bar_staff'::app_role) OR 
    has_role(auth.uid(), 'kitchen_staff'::app_role) OR
    has_role(auth.uid(), 'waitstaff'::app_role) OR
    (bar_id IS NOT NULL)
  );

CREATE POLICY "Staff can create orders" ON public.orders
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'bar_staff'::app_role) OR
    has_role(auth.uid(), 'waitstaff'::app_role) OR
    (bar_id IS NOT NULL)
  );

CREATE POLICY "Staff can update orders" ON public.orders
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'bar_staff'::app_role) OR 
    has_role(auth.uid(), 'kitchen_staff'::app_role) OR
    has_role(auth.uid(), 'waitstaff'::app_role) OR
    (bar_id IS NOT NULL)
  );

-- ============================================
-- Payments Policies
-- ============================================

CREATE POLICY "Anyone can view payments" ON public.payments
  FOR SELECT USING (true);

CREATE POLICY "Can create payments for valid orders" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id)
  );

-- ============================================
-- Profiles Policies
-- ============================================

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- Restaurant Settings Policies
-- ============================================

CREATE POLICY "Anyone can view settings" ON public.restaurant_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update settings" ON public.restaurant_settings
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Super admin can insert settings" ON public.restaurant_settings
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- Staff Users Policies
-- ============================================

CREATE POLICY "Admins can manage staff users" ON public.staff_users
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Staff can view own record" ON public.staff_users
  FOR SELECT USING (
    (id)::text = current_setting('app.current_staff_id'::text, true)
  );

-- ============================================
-- Stock Movements Policies
-- ============================================

CREATE POLICY "Staff can view stock movements" ON public.stock_movements
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'inventory_officer'::app_role)
  );

CREATE POLICY "Managers and inventory officers can create movements" ON public.stock_movements
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'inventory_officer'::app_role)
  );

-- ============================================
-- Suppliers Policies
-- ============================================

CREATE POLICY "Staff can view suppliers" ON public.suppliers
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'inventory_officer'::app_role)
  );

CREATE POLICY "Managers and inventory officers can manage suppliers" ON public.suppliers
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'inventory_officer'::app_role)
  );

-- ============================================
-- User Roles Policies
-- ============================================

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (has_role(auth.uid(), 'super_admin'::app_role));
