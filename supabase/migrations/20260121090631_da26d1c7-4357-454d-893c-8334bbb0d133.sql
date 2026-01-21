-- Add waitstaff to RLS policies for bar inventory viewing
DROP POLICY IF EXISTS "Staff can view bar inventory" ON public.bar_inventory;
CREATE POLICY "Staff can view bar inventory" ON public.bar_inventory
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'store_admin'::app_role) OR 
  has_role(auth.uid(), 'store_user'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

-- Add waitstaff to bars viewing policy
DROP POLICY IF EXISTS "Staff can view bars" ON public.bars;
CREATE POLICY "Staff can view bars" ON public.bars
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'store_admin'::app_role) OR 
  has_role(auth.uid(), 'store_user'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

-- Add waitstaff to cashier bar assignments viewing policy
DROP POLICY IF EXISTS "Staff can view assignments" ON public.cashier_bar_assignments;
CREATE POLICY "Staff can view assignments" ON public.cashier_bar_assignments
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

-- Add waitstaff to inventory items viewing policy
DROP POLICY IF EXISTS "Staff can view inventory" ON public.inventory_items;
CREATE POLICY "Staff can view inventory" ON public.inventory_items
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'inventory_officer'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR 
  has_role(auth.uid(), 'kitchen_staff'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

-- Add waitstaff to orders policies
DROP POLICY IF EXISTS "Staff can create orders" ON public.orders;
CREATE POLICY "Staff can create orders" ON public.orders
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders" ON public.orders
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR 
  has_role(auth.uid(), 'kitchen_staff'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders" ON public.orders
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR 
  has_role(auth.uid(), 'kitchen_staff'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

-- Add waitstaff to order items policies
DROP POLICY IF EXISTS "Staff can manage order items" ON public.order_items;
CREATE POLICY "Staff can manage order items" ON public.order_items
FOR ALL USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

DROP POLICY IF EXISTS "Staff can view order items" ON public.order_items;
CREATE POLICY "Staff can view order items" ON public.order_items
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR 
  has_role(auth.uid(), 'kitchen_staff'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

-- Add waitstaff to payments policy
DROP POLICY IF EXISTS "Staff can create payments" ON public.payments;
CREATE POLICY "Staff can create payments" ON public.payments
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
CREATE POLICY "Staff can view payments" ON public.payments
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'accountant'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

-- Add waitstaff to restaurant settings viewing
DROP POLICY IF EXISTS "Staff can view settings" ON public.restaurant_settings;
CREATE POLICY "Staff can view settings" ON public.restaurant_settings
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'bar_staff'::app_role) OR 
  has_role(auth.uid(), 'kitchen_staff'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);

-- Add waitstaff to audit logs creation
DROP POLICY IF EXISTS "Staff can create audit logs" ON public.audit_logs;
CREATE POLICY "Staff can create audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'store_admin'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR
  has_role(auth.uid(), 'waitstaff'::app_role)
);