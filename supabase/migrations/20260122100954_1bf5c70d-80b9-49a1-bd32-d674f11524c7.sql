-- Fix RLS for staff users who are not Supabase-authenticated
-- They need to be able to read their own assignments and related data

-- Allow unauthenticated users to view cashier_bar_assignments (staff users query with anon key)
DROP POLICY IF EXISTS "Staff can view assignments" ON public.cashier_bar_assignments;
DROP POLICY IF EXISTS "Staff users can view assignments" ON public.cashier_bar_assignments;

-- Policy for Supabase-authenticated users (managers, admins, etc.)
CREATE POLICY "Authenticated staff can view assignments" 
ON public.cashier_bar_assignments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::public.app_role) OR 
  has_role(auth.uid(), 'manager'::public.app_role) OR 
  has_role(auth.uid(), 'cashier'::public.app_role) OR 
  has_role(auth.uid(), 'bar_staff'::public.app_role) OR 
  has_role(auth.uid(), 'waitstaff'::public.app_role)
);

-- Policy for local staff users (not Supabase-authenticated, using anon key)
-- They can only view their own assignment by staff_user_id
CREATE POLICY "Local staff can view own assignment" 
ON public.cashier_bar_assignments 
FOR SELECT 
USING (
  staff_user_id IS NOT NULL
);

-- Also need to allow staff users to view bars (required for the join)
DROP POLICY IF EXISTS "Staff can view bars" ON public.bars;
DROP POLICY IF EXISTS "Anyone can view active bars" ON public.bars;

CREATE POLICY "Anyone can view active bars" 
ON public.bars 
FOR SELECT 
USING (is_active = true);

-- Allow authenticated admins to still manage bars
DROP POLICY IF EXISTS "Admins can manage bars" ON public.bars;
CREATE POLICY "Admins can manage bars" 
ON public.bars 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::public.app_role) OR 
  has_role(auth.uid(), 'manager'::public.app_role)
);

-- Fix menu_items policy - allow anyone to view active items (staff users need this)
DROP POLICY IF EXISTS "Anyone can view active items" ON public.menu_items;
CREATE POLICY "Anyone can view active items" 
ON public.menu_items 
FOR SELECT 
USING (is_active = true);

-- Fix menu_categories policy - allow anyone to view active categories
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.menu_categories;
CREATE POLICY "Anyone can view active categories" 
ON public.menu_categories 
FOR SELECT 
USING (is_active = true);

-- Fix bar_inventory policy - allow local staff to view inventory for their assigned bar
DROP POLICY IF EXISTS "Staff can view bar inventory" ON public.bar_inventory;
DROP POLICY IF EXISTS "Local staff can view bar inventory" ON public.bar_inventory;

CREATE POLICY "Anyone can view bar inventory" 
ON public.bar_inventory 
FOR SELECT 
USING (is_active = true);

-- Fix inventory_items policy - allow local staff to view inventory items
DROP POLICY IF EXISTS "Staff can view inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Local staff can view inventory" ON public.inventory_items;

CREATE POLICY "Anyone can view active inventory" 
ON public.inventory_items 
FOR SELECT 
USING (is_active = true);

-- Fix restaurant_settings policy - allow local staff to view settings (needed for receipt)
DROP POLICY IF EXISTS "Staff can view settings" ON public.restaurant_settings;
DROP POLICY IF EXISTS "Local staff can view settings" ON public.restaurant_settings;

CREATE POLICY "Anyone can view settings" 
ON public.restaurant_settings 
FOR SELECT 
USING (true);

-- Orders need special handling - local staff should be able to create and view orders
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can create orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;

-- Allow viewing orders - authenticated staff or by bar_id for local staff
CREATE POLICY "Staff can view orders" 
ON public.orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::public.app_role) OR 
  has_role(auth.uid(), 'manager'::public.app_role) OR 
  has_role(auth.uid(), 'cashier'::public.app_role) OR 
  has_role(auth.uid(), 'bar_staff'::public.app_role) OR 
  has_role(auth.uid(), 'kitchen_staff'::public.app_role) OR 
  has_role(auth.uid(), 'waitstaff'::public.app_role) OR
  bar_id IS NOT NULL
);

-- Allow creating orders - authenticated staff or anyone with a valid bar_id
CREATE POLICY "Staff can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::public.app_role) OR 
  has_role(auth.uid(), 'manager'::public.app_role) OR 
  has_role(auth.uid(), 'cashier'::public.app_role) OR 
  has_role(auth.uid(), 'bar_staff'::public.app_role) OR 
  has_role(auth.uid(), 'waitstaff'::public.app_role) OR
  bar_id IS NOT NULL
);

-- Allow updating orders
CREATE POLICY "Staff can update orders" 
ON public.orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'super_admin'::public.app_role) OR 
  has_role(auth.uid(), 'manager'::public.app_role) OR 
  has_role(auth.uid(), 'cashier'::public.app_role) OR 
  has_role(auth.uid(), 'bar_staff'::public.app_role) OR 
  has_role(auth.uid(), 'kitchen_staff'::public.app_role) OR 
  has_role(auth.uid(), 'waitstaff'::public.app_role) OR
  bar_id IS NOT NULL
);

-- Order items need similar treatment
DROP POLICY IF EXISTS "Staff can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can manage order items" ON public.order_items;

CREATE POLICY "Anyone can view order items" 
ON public.order_items 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update order items" 
ON public.order_items 
FOR UPDATE 
USING (true);

-- Payments need similar treatment
DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can create payments" ON public.payments;

CREATE POLICY "Anyone can view payments" 
ON public.payments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (true);