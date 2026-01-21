-- ============================================
-- Cherry Dining POS - Table Definitions
-- Supabase-compatible - Schema Only
-- ============================================

-- Custom enum type for app roles
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'manager',
  'cashier',
  'bar_staff',
  'kitchen_staff',
  'inventory_officer',
  'accountant',
  'store_user',
  'store_admin',
  'waitstaff'
);

-- ============================================
-- Profiles table (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- User roles table
-- ============================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'cashier'::app_role,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- ============================================
-- Restaurant settings table
-- ============================================
CREATE TABLE public.restaurant_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Cherry Dining'::text,
  tagline TEXT DEFAULT '& Lounge'::text,
  address TEXT DEFAULT '123 Restaurant Street'::text,
  city TEXT DEFAULT 'Lagos'::text,
  country TEXT DEFAULT 'Nigeria'::text,
  phone TEXT DEFAULT '+234 800 000 0000'::text,
  email TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'NGN'::text,
  timezone TEXT DEFAULT 'Africa/Lagos'::text,
  receipt_width TEXT DEFAULT '80mm'::text,
  receipt_footer TEXT DEFAULT 'Thank you for dining with us!'::text,
  receipt_show_logo BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Suppliers table
-- ============================================
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Inventory items table
-- ============================================
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs'::text,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  min_stock_level NUMERIC NOT NULL DEFAULT 10,
  cost_per_unit NUMERIC,
  selling_price NUMERIC,
  supplier TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Menu categories table
-- ============================================
CREATE TABLE public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Menu items table
-- ============================================
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  cost_price NUMERIC,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  image_url TEXT,
  track_inventory BOOLEAN DEFAULT false,
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  is_active BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Bars table
-- ============================================
CREATE TABLE public.bars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Bar inventory table
-- ============================================
CREATE TABLE public.bar_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  min_stock_level NUMERIC NOT NULL DEFAULT 5,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT bar_inventory_bar_id_inventory_item_id_key UNIQUE (bar_id, inventory_item_id)
);

-- ============================================
-- Cashier bar assignments table
-- ============================================
CREATE TABLE public.cashier_bar_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  assigned_by UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT cashier_bar_assignments_user_id_bar_id_key UNIQUE (user_id, bar_id)
);

-- ============================================
-- Orders table
-- ============================================
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  order_type TEXT NOT NULL,
  table_number TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  service_charge NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  notes TEXT,
  bar_id UUID REFERENCES public.bars(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Order items table
-- ============================================
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Payments table
-- ============================================
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  payment_method TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed'::text,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Stock movements table
-- ============================================
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity NUMERIC NOT NULL,
  movement_type TEXT NOT NULL,
  previous_stock NUMERIC NOT NULL,
  new_stock NUMERIC NOT NULL,
  notes TEXT,
  reference TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Inventory transfers table (store to bar)
-- ============================================
CREATE TABLE public.inventory_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL DEFAULT 'store'::text,
  source_bar_id UUID REFERENCES public.bars(id),
  destination_bar_id UUID NOT NULL REFERENCES public.bars(id),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'::text,
  notes TEXT,
  transferred_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- Bar to bar transfers table
-- ============================================
CREATE TABLE public.bar_to_bar_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  destination_bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  requested_by UUID,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT bar_to_bar_transfers_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'completed'::text]))
);

-- ============================================
-- Audit logs table
-- ============================================
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  original_data JSONB,
  new_data JSONB,
  reason TEXT,
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
