
-- Create menu categories table
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create menu items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'takeaway', 'delivery', 'bar_only')),
  table_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'mobile_money')),
  amount DECIMAL(10,2) NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Menu categories policies (public read, staff write)
CREATE POLICY "Anyone can view active categories" ON public.menu_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Staff can manage categories" ON public.menu_categories
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager')
  );

-- Menu items policies (public read, staff write)
CREATE POLICY "Anyone can view active items" ON public.menu_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "Staff can manage items" ON public.menu_items
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager')
  );

-- Orders policies (authenticated users can create, staff can view all)
CREATE POLICY "Staff can view all orders" ON public.orders
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'cashier') OR
    has_role(auth.uid(), 'bar_staff') OR
    has_role(auth.uid(), 'kitchen_staff')
  );

CREATE POLICY "Staff can create orders" ON public.orders
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'cashier') OR
    has_role(auth.uid(), 'bar_staff')
  );

CREATE POLICY "Staff can update orders" ON public.orders
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'cashier') OR
    has_role(auth.uid(), 'bar_staff') OR
    has_role(auth.uid(), 'kitchen_staff')
  );

-- Order items policies
CREATE POLICY "Staff can view order items" ON public.order_items
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'cashier') OR
    has_role(auth.uid(), 'bar_staff') OR
    has_role(auth.uid(), 'kitchen_staff')
  );

CREATE POLICY "Staff can manage order items" ON public.order_items
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'cashier') OR
    has_role(auth.uid(), 'bar_staff')
  );

-- Payments policies
CREATE POLICY "Staff can view payments" ON public.payments
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'cashier') OR
    has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Staff can create payments" ON public.payments
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'cashier')
  );

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  today_date TEXT;
  order_count INTEGER;
  new_order_number TEXT;
BEGIN
  today_date := to_char(NOW(), 'YYMMDD');
  
  SELECT COUNT(*) + 1 INTO order_count
  FROM public.orders
  WHERE created_at::date = CURRENT_DATE;
  
  new_order_number := 'ORD-' || today_date || '-' || LPAD(order_count::TEXT, 4, '0');
  
  RETURN new_order_number;
END;
$$;

-- Insert sample categories
INSERT INTO public.menu_categories (name, sort_order) VALUES
  ('Starters', 1),
  ('Main Course', 2),
  ('Grills', 3),
  ('Sides', 4),
  ('Drinks', 5),
  ('Cocktails', 6),
  ('Wines', 7),
  ('Desserts', 8);

-- Insert sample menu items
INSERT INTO public.menu_items (category_id, name, description, price, cost_price) VALUES
  ((SELECT id FROM public.menu_categories WHERE name = 'Starters'), 'Pepper Soup', 'Spicy goat meat pepper soup', 3500.00, 1500.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Starters'), 'Spring Rolls', 'Crispy vegetable spring rolls (6 pcs)', 2500.00, 800.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Starters'), 'Suya Skewers', 'Grilled beef suya (4 sticks)', 4000.00, 1800.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Main Course'), 'Jollof Rice & Chicken', 'Nigerian jollof rice with grilled chicken', 5500.00, 2200.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Main Course'), 'Pounded Yam & Egusi', 'With assorted meat', 6500.00, 2800.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Main Course'), 'Fried Rice & Beef', 'Special fried rice with beef stew', 5000.00, 2000.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Grills'), 'Grilled Tilapia', 'Whole grilled tilapia with pepper sauce', 8500.00, 4000.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Grills'), 'BBQ Chicken', 'Half chicken marinated and grilled', 6000.00, 2500.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Grills'), 'Mixed Grill Platter', 'Beef, chicken, and sausage', 12000.00, 5500.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Sides'), 'Plantain', 'Fried ripe plantain', 1500.00, 400.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Sides'), 'Coleslaw', 'Fresh vegetable coleslaw', 1000.00, 300.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Drinks'), 'Chapman', 'Classic Nigerian Chapman', 2500.00, 600.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Drinks'), 'Fresh Juice', 'Orange, pineapple, or watermelon', 2000.00, 500.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Drinks'), 'Soft Drinks', 'Coke, Fanta, Sprite', 800.00, 300.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Cocktails'), 'Mojito', 'Classic rum mojito', 4500.00, 1200.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Cocktails'), 'Pina Colada', 'Creamy coconut cocktail', 5000.00, 1400.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Wines'), 'House Red Wine', 'Glass of red wine', 3500.00, 1000.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Wines'), 'House White Wine', 'Glass of white wine', 3500.00, 1000.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Desserts'), 'Ice Cream', 'Three scoops with toppings', 2500.00, 700.00),
  ((SELECT id FROM public.menu_categories WHERE name = 'Desserts'), 'Cake Slice', 'Chocolate or vanilla', 2000.00, 600.00);
