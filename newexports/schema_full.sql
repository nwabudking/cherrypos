-- ============================================
-- Cherry Dining POS - Complete Database Schema
-- Supabase-compatible - Schema Only (NO DATA)
-- Updated: 2026-02-10
-- ============================================
-- 
-- This file contains the complete database schema for the
-- Cherry Dining & Lounge POS System. It can be used to
-- recreate the backend on a fresh Supabase or PostgreSQL instance.
--
-- Usage:
--   1. Create a new Supabase project or PostgreSQL database
--   2. Run this script to create all schema objects
--   3. Create the auth trigger separately (see note below)
--
-- Note: The trigger on auth.users must be created separately
-- after running this script, as auth schema is managed by Supabase.
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ============================================
-- CUSTOM TYPES
-- ============================================

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
-- TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'cashier'::app_role,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- Staff users table (local authentication)
CREATE TABLE public.staff_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'cashier'::app_role,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Restaurant settings table
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

-- Suppliers table
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

-- Inventory items table
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

-- Menu categories table
CREATE TABLE public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Menu items table
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

-- Bars table
CREATE TABLE public.bars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Bar inventory table
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

-- Cashier bar assignments table
CREATE TABLE public.cashier_bar_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  staff_user_id UUID REFERENCES public.staff_users(id),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  assigned_by UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Orders table
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
  receipt_printed BOOLEAN NOT NULL DEFAULT false,
  receipt_printed_at TIMESTAMP WITH TIME ZONE,
  receipt_printed_by TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Order items table
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

-- Payments table
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

-- Stock movements table
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

-- Inventory transfers table (store to bar)
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

-- Bar to bar transfers table
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

-- Audit logs table
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

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_bar_inventory_expiry ON public.bar_inventory (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX idx_bar_inventory_bar_item ON public.bar_inventory (bar_id, inventory_item_id);
CREATE INDEX idx_inventory_items_expiry ON public.inventory_items (expiry_date) WHERE (expiry_date IS NOT NULL);
CREATE INDEX idx_inventory_items_category ON public.inventory_items (category);
CREATE INDEX idx_inventory_items_supplier ON public.inventory_items (supplier_id);
CREATE INDEX idx_menu_items_inventory ON public.menu_items (inventory_item_id) WHERE (inventory_item_id IS NOT NULL);
CREATE INDEX idx_menu_items_category ON public.menu_items (category_id);
CREATE INDEX idx_bar_to_bar_transfers_source ON public.bar_to_bar_transfers (source_bar_id);
CREATE INDEX idx_bar_to_bar_transfers_destination ON public.bar_to_bar_transfers (destination_bar_id);
CREATE INDEX idx_bar_to_bar_transfers_status ON public.bar_to_bar_transfers (status);
CREATE INDEX idx_bar_to_bar_transfers_pending ON public.bar_to_bar_transfers (status, created_at) WHERE (status = 'pending');
CREATE INDEX idx_inventory_transfers_destination ON public.inventory_transfers (destination_bar_id);
CREATE INDEX idx_inventory_transfers_item ON public.inventory_transfers (inventory_item_id);
CREATE INDEX idx_orders_created_at ON public.orders (created_at);
CREATE INDEX idx_orders_status ON public.orders (status);
CREATE INDEX idx_orders_bar ON public.orders (bar_id);
CREATE INDEX idx_orders_receipt_printed ON public.orders (receipt_printed);
CREATE INDEX idx_order_items_order ON public.order_items (order_id);
CREATE INDEX idx_order_items_menu_item ON public.order_items (menu_item_id);
CREATE INDEX idx_payments_order ON public.payments (order_id);
CREATE INDEX idx_stock_movements_item ON public.stock_movements (inventory_item_id);
CREATE INDEX idx_stock_movements_created ON public.stock_movements (created_at);
CREATE INDEX idx_cashier_assignments_user ON public.cashier_bar_assignments (user_id);
CREATE INDEX idx_cashier_assignments_staff ON public.cashier_bar_assignments (staff_user_id);
CREATE INDEX idx_cashier_assignments_bar ON public.cashier_bar_assignments (bar_id);
CREATE INDEX idx_staff_users_username ON public.staff_users (username);
CREATE INDEX idx_staff_users_role ON public.staff_users (role);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at);
CREATE INDEX idx_audit_logs_performed_by ON public.audit_logs (performed_by);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Check if local staff has role
CREATE OR REPLACE FUNCTION public.staff_has_role(p_staff_id UUID, p_role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_users WHERE id = p_staff_id AND role = p_role AND is_active = true);
$$;

-- Generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE today_date TEXT; order_count INTEGER; new_order_number TEXT;
BEGIN
  today_date := to_char(NOW(), 'YYMMDD');
  SELECT COUNT(*) + 1 INTO order_count FROM public.orders WHERE created_at::date = CURRENT_DATE;
  new_order_number := 'ORD-' || today_date || '-' || LPAD(order_count::TEXT, 4, '0');
  RETURN new_order_number;
END; $$;

-- Check bar stock
CREATE OR REPLACE FUNCTION public.check_bar_stock(p_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT current_stock >= p_quantity FROM public.bar_inventory WHERE bar_id = p_bar_id AND inventory_item_id = p_inventory_item_id), false);
$$;

-- Deduct bar inventory
CREATE OR REPLACE FUNCTION public.deduct_bar_inventory(p_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_current_stock NUMERIC;
BEGIN
  SELECT current_stock INTO v_current_stock FROM public.bar_inventory WHERE bar_id = p_bar_id AND inventory_item_id = p_inventory_item_id;
  IF v_current_stock IS NULL OR v_current_stock < p_quantity THEN RETURN false; END IF;
  UPDATE public.bar_inventory SET current_stock = current_stock - p_quantity WHERE bar_id = p_bar_id AND inventory_item_id = p_inventory_item_id;
  RETURN true;
END; $$;

-- Restore bar inventory on void
CREATE OR REPLACE FUNCTION public.restore_bar_inventory_on_void(p_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level)
  VALUES (p_bar_id, p_inventory_item_id, p_quantity, 5)
  ON CONFLICT (bar_id, inventory_item_id) DO UPDATE SET current_stock = bar_inventory.current_stock + p_quantity, updated_at = now();
  RETURN true;
END; $$;

-- Transfer store to bar
CREATE OR REPLACE FUNCTION public.transfer_store_to_bar(p_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_store_stock NUMERIC; v_transfer_id UUID; v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'super_admin'::app_role) OR has_role(v_user_id, 'manager'::app_role) OR has_role(v_user_id, 'store_admin'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT current_stock INTO v_store_stock FROM public.inventory_items WHERE id = p_inventory_item_id;
  IF v_store_stock IS NULL THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF v_store_stock < p_quantity THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
  UPDATE public.inventory_items SET current_stock = current_stock - p_quantity WHERE id = p_inventory_item_id;
  INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock)
  VALUES (p_bar_id, p_inventory_item_id, p_quantity)
  ON CONFLICT (bar_id, inventory_item_id) DO UPDATE SET current_stock = bar_inventory.current_stock + p_quantity;
  INSERT INTO public.inventory_transfers (source_type, destination_bar_id, inventory_item_id, quantity, status, notes, transferred_by, completed_at)
  VALUES ('store', p_bar_id, p_inventory_item_id, p_quantity, 'completed', p_notes, v_user_id, now())
  RETURNING id INTO v_transfer_id;
  INSERT INTO public.audit_logs (action_type, entity_type, entity_id, new_data, performed_by)
  VALUES ('transfer', 'inventory', p_inventory_item_id,
    jsonb_build_object('transfer_id', v_transfer_id, 'bar_id', p_bar_id, 'quantity', p_quantity, 'previous_store_stock', v_store_stock, 'new_store_stock', v_store_stock - p_quantity),
    v_user_id);
  RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id, 'message', 'Transfer completed successfully');
END; $$;

-- Create bar to bar transfer (supports Supabase auth + local staff via p_staff_user_id)
CREATE OR REPLACE FUNCTION public.create_bar_to_bar_transfer(
  p_source_bar_id UUID, p_destination_bar_id UUID, p_inventory_item_id UUID, p_quantity NUMERIC,
  p_notes TEXT DEFAULT NULL, p_admin_complete BOOLEAN DEFAULT false, p_staff_user_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id UUID; v_current_stock NUMERIC; v_transfer_id UUID;
  v_is_admin BOOLEAN; v_status TEXT; v_is_local_staff BOOLEAN := false; v_staff_role app_role;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF p_staff_user_id IS NOT NULL THEN
      SELECT role INTO v_staff_role FROM public.staff_users WHERE id = p_staff_user_id AND is_active = true;
      IF v_staff_role IS NULL THEN RAISE EXCEPTION 'Unauthorized: Invalid or inactive staff user'; END IF;
      v_is_local_staff := true; v_user_id := p_staff_user_id;
    ELSE RAISE EXCEPTION 'Unauthorized: No user context'; END IF;
  END IF;
  IF p_source_bar_id = p_destination_bar_id THEN RAISE EXCEPTION 'Source and destination bars must be different'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than 0'; END IF;
  IF v_is_local_staff THEN v_is_admin := v_staff_role IN ('super_admin', 'manager', 'store_admin');
  ELSE v_is_admin := (has_role(v_user_id, 'super_admin'::app_role) OR has_role(v_user_id, 'manager'::app_role) OR has_role(v_user_id, 'store_admin'::app_role)); END IF;
  IF NOT v_is_admin THEN
    IF v_is_local_staff THEN
      IF v_staff_role IN ('cashier', 'waitstaff') THEN
        IF NOT EXISTS (SELECT 1 FROM public.cashier_bar_assignments cba WHERE cba.staff_user_id = v_user_id AND cba.bar_id = p_source_bar_id AND COALESCE(cba.is_active, true) = true) THEN
          RAISE EXCEPTION 'Unauthorized: not assigned to the source bar'; END IF;
      ELSE RAISE EXCEPTION 'Unauthorized: role not permitted'; END IF;
    ELSE
      IF has_role(v_user_id, 'cashier'::app_role) OR has_role(v_user_id, 'waitstaff'::app_role) THEN
        IF NOT EXISTS (SELECT 1 FROM public.cashier_bar_assignments cba WHERE cba.user_id = v_user_id AND cba.bar_id = p_source_bar_id AND COALESCE(cba.is_active, true) = true) THEN
          RAISE EXCEPTION 'Unauthorized: not assigned to the source bar'; END IF;
      ELSE RAISE EXCEPTION 'Unauthorized'; END IF;
    END IF;
  END IF;
  SELECT bi.current_stock INTO v_current_stock FROM public.bar_inventory bi WHERE bi.bar_id = p_source_bar_id AND bi.inventory_item_id = p_inventory_item_id FOR UPDATE;
  IF v_current_stock IS NULL THEN RAISE EXCEPTION 'Item not found in source bar inventory'; END IF;
  IF v_current_stock < p_quantity THEN RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, p_quantity; END IF;
  UPDATE public.bar_inventory SET current_stock = current_stock - p_quantity, updated_at = now() WHERE bar_id = p_source_bar_id AND inventory_item_id = p_inventory_item_id;
  IF p_admin_complete AND v_is_admin THEN
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level) VALUES (p_destination_bar_id, p_inventory_item_id, p_quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id) DO UPDATE SET current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock, updated_at = now();
    v_status := 'completed';
    INSERT INTO public.bar_to_bar_transfers (source_bar_id, destination_bar_id, inventory_item_id, quantity, notes, status, requested_by, approved_by, completed_at, updated_at)
    VALUES (p_source_bar_id, p_destination_bar_id, p_inventory_item_id, p_quantity, p_notes, v_status, v_user_id, v_user_id, now(), now()) RETURNING id INTO v_transfer_id;
  ELSE
    v_status := 'pending';
    INSERT INTO public.bar_to_bar_transfers (source_bar_id, destination_bar_id, inventory_item_id, quantity, notes, status, requested_by, updated_at)
    VALUES (p_source_bar_id, p_destination_bar_id, p_inventory_item_id, p_quantity, p_notes, v_status, v_user_id, now()) RETURNING id INTO v_transfer_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id, 'status', v_status, 'source_bar_id', p_source_bar_id, 'destination_bar_id', p_destination_bar_id, 'inventory_item_id', p_inventory_item_id, 'previous_source_stock', v_current_stock, 'new_source_stock', v_current_stock - p_quantity);
END; $$;

-- Respond to bar to bar transfer (supports Supabase auth + local staff via p_staff_user_id)
CREATE OR REPLACE FUNCTION public.respond_bar_to_bar_transfer(p_transfer_id UUID, p_response TEXT, p_staff_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id UUID; v_transfer public.bar_to_bar_transfers%ROWTYPE;
  v_is_admin BOOLEAN; v_is_local_staff BOOLEAN := false; v_staff_role app_role;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF p_staff_user_id IS NOT NULL THEN
      SELECT role INTO v_staff_role FROM public.staff_users WHERE id = p_staff_user_id AND is_active = true;
      IF v_staff_role IS NULL THEN RAISE EXCEPTION 'Unauthorized: Invalid or inactive staff user'; END IF;
      v_is_local_staff := true; v_user_id := p_staff_user_id;
    ELSE RAISE EXCEPTION 'Unauthorized: No user context'; END IF;
  END IF;
  IF p_response NOT IN ('accepted', 'rejected') THEN RAISE EXCEPTION 'Invalid response: %', p_response; END IF;
  SELECT * INTO v_transfer FROM public.bar_to_bar_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_transfer.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transfer already processed', 'status', v_transfer.status, 'transfer_id', v_transfer.id, 'source_bar_id', v_transfer.source_bar_id, 'destination_bar_id', v_transfer.destination_bar_id, 'inventory_item_id', v_transfer.inventory_item_id);
  END IF;
  IF v_is_local_staff THEN v_is_admin := v_staff_role IN ('super_admin', 'manager', 'store_admin');
  ELSE v_is_admin := (has_role(v_user_id, 'super_admin'::app_role) OR has_role(v_user_id, 'manager'::app_role) OR has_role(v_user_id, 'store_admin'::app_role)); END IF;
  IF NOT v_is_admin THEN
    IF v_is_local_staff THEN
      IF v_staff_role IN ('cashier', 'waitstaff') THEN
        IF NOT EXISTS (SELECT 1 FROM public.cashier_bar_assignments cba WHERE cba.staff_user_id = v_user_id AND cba.bar_id = v_transfer.destination_bar_id AND COALESCE(cba.is_active, true) = true) THEN
          RAISE EXCEPTION 'Unauthorized: not assigned to the destination bar'; END IF;
      ELSE RAISE EXCEPTION 'Unauthorized: role not permitted'; END IF;
    ELSE
      IF has_role(v_user_id, 'cashier'::app_role) OR has_role(v_user_id, 'waitstaff'::app_role) THEN
        IF NOT EXISTS (SELECT 1 FROM public.cashier_bar_assignments cba WHERE cba.user_id = v_user_id AND cba.bar_id = v_transfer.destination_bar_id AND COALESCE(cba.is_active, true) = true) THEN
          RAISE EXCEPTION 'Unauthorized: not assigned to the destination bar'; END IF;
      ELSE RAISE EXCEPTION 'Unauthorized'; END IF;
    END IF;
  END IF;
  IF p_response = 'accepted' THEN
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level) VALUES (v_transfer.destination_bar_id, v_transfer.inventory_item_id, v_transfer.quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id) DO UPDATE SET current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock, updated_at = now();
    UPDATE public.bar_to_bar_transfers SET status = 'completed', approved_by = v_user_id, completed_at = now(), updated_at = now() WHERE id = p_transfer_id;
    RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer.id, 'status', 'completed', 'source_bar_id', v_transfer.source_bar_id, 'destination_bar_id', v_transfer.destination_bar_id, 'inventory_item_id', v_transfer.inventory_item_id);
  ELSE
    INSERT INTO public.bar_inventory (bar_id, inventory_item_id, current_stock, min_stock_level) VALUES (v_transfer.source_bar_id, v_transfer.inventory_item_id, v_transfer.quantity, 5)
    ON CONFLICT (bar_id, inventory_item_id) DO UPDATE SET current_stock = public.bar_inventory.current_stock + EXCLUDED.current_stock, updated_at = now();
    UPDATE public.bar_to_bar_transfers SET status = 'rejected', approved_by = v_user_id, completed_at = now(), updated_at = now() WHERE id = p_transfer_id;
    RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer.id, 'status', 'rejected', 'source_bar_id', v_transfer.source_bar_id, 'destination_bar_id', v_transfer.destination_bar_id, 'inventory_item_id', v_transfer.inventory_item_id);
  END IF;
END; $$;

-- Create staff user
CREATE OR REPLACE FUNCTION public.create_staff_user(p_username TEXT, p_password TEXT, p_full_name TEXT, p_email TEXT DEFAULT NULL, p_role app_role DEFAULT 'cashier'::app_role)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v_user_id UUID; v_new_staff_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT (public.has_role(v_user_id, 'super_admin'::public.app_role) OR public.has_role(v_user_id, 'manager'::public.app_role)) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_users WHERE username = LOWER(p_username)) THEN RAISE EXCEPTION 'Username already exists'; END IF;
  INSERT INTO public.staff_users (username, password_hash, full_name, email, role, created_by)
  VALUES (LOWER(p_username), extensions.crypt(p_password, extensions.gen_salt('bf'::text)), p_full_name, p_email, p_role, v_user_id)
  RETURNING id INTO v_new_staff_id;
  RETURN v_new_staff_id;
END; $$;

-- Verify staff password
CREATE OR REPLACE FUNCTION public.verify_staff_password(p_username TEXT, p_password TEXT)
RETURNS TABLE(staff_id UUID, staff_name TEXT, staff_role app_role, staff_email TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v_staff public.staff_users%ROWTYPE;
BEGIN
  SELECT * INTO v_staff FROM public.staff_users WHERE username = LOWER(p_username) AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_staff.password_hash = extensions.crypt(p_password, v_staff.password_hash) THEN
    UPDATE public.staff_users SET last_login_at = now() WHERE id = v_staff.id;
    RETURN QUERY SELECT v_staff.id, v_staff.full_name, v_staff.role, v_staff.email;
  END IF;
  RETURN;
END; $$;

-- Update staff password (admin)
CREATE OR REPLACE FUNCTION public.update_staff_password(p_staff_id UUID, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT (public.has_role(v_user_id, 'super_admin'::public.app_role) OR public.has_role(v_user_id, 'manager'::public.app_role)) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.staff_users SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'::text)), updated_at = now() WHERE id = p_staff_id;
  RETURN FOUND;
END; $$;

-- Staff change own password
CREATE OR REPLACE FUNCTION public.staff_change_own_password(p_staff_id UUID, p_current_password TEXT, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v_current_hash TEXT;
BEGIN
  SELECT password_hash INTO v_current_hash FROM public.staff_users WHERE id = p_staff_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff user not found or inactive'; END IF;
  IF v_current_hash != extensions.crypt(p_current_password, v_current_hash) THEN RAISE EXCEPTION 'Current password is incorrect'; END IF;
  UPDATE public.staff_users SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now() WHERE id = p_staff_id;
  RETURN true;
END; $$;

-- Sync inventory to menu prices
CREATE OR REPLACE FUNCTION public.sync_inventory_to_menu_prices()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.menu_items SET cost_price = NEW.cost_per_unit, price = COALESCE(NEW.selling_price, price), updated_at = now()
  WHERE inventory_item_id = NEW.id AND (cost_price IS DISTINCT FROM NEW.cost_per_unit OR (NEW.selling_price IS NOT NULL AND price IS DISTINCT FROM NEW.selling_price));
  RETURN NEW;
END; $$;

-- Sync menu to inventory prices
CREATE OR REPLACE FUNCTION public.sync_menu_to_inventory_prices()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    UPDATE public.inventory_items SET cost_per_unit = NEW.cost_price, selling_price = NEW.price, updated_at = now()
    WHERE id = NEW.inventory_item_id AND (cost_per_unit IS DISTINCT FROM NEW.cost_price OR selling_price IS DISTINCT FROM NEW.price);
  END IF;
  RETURN NEW;
END; $$;

-- Update menu availability on stock change
CREATE OR REPLACE FUNCTION public.update_menu_availability_on_stock_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.menu_items SET is_available = CASE WHEN NEW.current_stock <= 0 THEN false ELSE true END
  WHERE inventory_item_id = NEW.id AND track_inventory = true;
  RETURN NEW;
END; $$;

-- Handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier');
  RETURN NEW;
END; $$;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_bar_inventory_updated_at BEFORE UPDATE ON public.bar_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bar_to_bar_transfers_updated_at BEFORE UPDATE ON public.bar_to_bar_transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bars_updated_at BEFORE UPDATE ON public.bars FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cashier_bar_assignments_updated_at BEFORE UPDATE ON public.cashier_bar_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_users_updated_at BEFORE UPDATE ON public.staff_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_restaurant_settings_updated_at BEFORE UPDATE ON public.restaurant_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER sync_inventory_prices_to_menu AFTER UPDATE OF cost_per_unit, selling_price ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION sync_inventory_to_menu_prices();
CREATE TRIGGER sync_menu_prices_to_inventory AFTER UPDATE OF cost_price, price ON public.menu_items FOR EACH ROW EXECUTE FUNCTION sync_menu_to_inventory_prices();
CREATE TRIGGER sync_menu_prices_on_link AFTER INSERT OR UPDATE OF inventory_item_id ON public.menu_items FOR EACH ROW WHEN (NEW.inventory_item_id IS NOT NULL) EXECUTE FUNCTION sync_menu_to_inventory_prices();
CREATE TRIGGER trigger_update_menu_availability AFTER UPDATE OF current_stock ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION update_menu_availability_on_stock_change();

-- Auth trigger (run manually after import):
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ENABLE RLS
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
-- RLS POLICIES
-- ============================================

-- Audit Logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Staff can create audit logs" ON public.audit_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'store_admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waitstaff'::app_role));

-- Bar Inventory
CREATE POLICY "Anyone can view bar inventory" ON public.bar_inventory FOR SELECT USING (is_active = true);
CREATE POLICY "Store staff can manage bar inventory" ON public.bar_inventory FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'store_admin'::app_role));

-- Bar to Bar Transfers
CREATE POLICY "Anyone can view transfers" ON public.bar_to_bar_transfers FOR SELECT USING (true);
CREATE POLICY "Users can create their own transfers" ON public.bar_to_bar_transfers FOR INSERT WITH CHECK ((auth.uid() = requested_by) AND (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'store_admin'::app_role) OR (has_role(auth.uid(), 'cashier'::app_role) AND EXISTS (SELECT 1 FROM cashier_bar_assignments cba WHERE cba.user_id = auth.uid() AND cba.bar_id = bar_to_bar_transfers.source_bar_id AND COALESCE(cba.is_active, true) = true))));
CREATE POLICY "Admins or destination cashiers can update transfers" ON public.bar_to_bar_transfers FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'store_admin'::app_role) OR (has_role(auth.uid(), 'cashier'::app_role) AND EXISTS (SELECT 1 FROM cashier_bar_assignments cba WHERE cba.user_id = auth.uid() AND cba.bar_id = bar_to_bar_transfers.destination_bar_id AND COALESCE(cba.is_active, true) = true))) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'store_admin'::app_role) OR (has_role(auth.uid(), 'cashier'::app_role) AND EXISTS (SELECT 1 FROM cashier_bar_assignments cba WHERE cba.user_id = auth.uid() AND cba.bar_id = bar_to_bar_transfers.destination_bar_id AND COALESCE(cba.is_active, true) = true)));

-- Bars
CREATE POLICY "Anyone can view active bars" ON public.bars FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage bars" ON public.bars FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Cashier Bar Assignments
CREATE POLICY "Authenticated staff can view assignments" ON public.cashier_bar_assignments FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'bar_staff'::app_role) OR has_role(auth.uid(), 'waitstaff'::app_role));
CREATE POLICY "Local staff can view own assignment" ON public.cashier_bar_assignments FOR SELECT USING (staff_user_id IS NOT NULL);
CREATE POLICY "Admins can manage assignments" ON public.cashier_bar_assignments FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Inventory Items
CREATE POLICY "Anyone can view active inventory" ON public.inventory_items FOR SELECT USING (is_active = true);
CREATE POLICY "Managers and inventory officers can manage inventory" ON public.inventory_items FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'inventory_officer'::app_role));

-- Inventory Transfers
CREATE POLICY "Staff can view transfers" ON public.inventory_transfers FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'store_admin'::app_role) OR has_role(auth.uid(), 'store_user'::app_role));
CREATE POLICY "Store admins can create transfers" ON public.inventory_transfers FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'store_admin'::app_role));

-- Menu Categories
CREATE POLICY "Anyone can view active categories" ON public.menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Staff can manage categories" ON public.menu_categories FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Menu Items
CREATE POLICY "Anyone can view active items" ON public.menu_items FOR SELECT USING (is_active = true);
CREATE POLICY "Staff can manage items" ON public.menu_items FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Order Items
CREATE POLICY "Anyone can view order items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Can create order items for valid orders" ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id));
CREATE POLICY "Can update order items for valid orders" ON public.order_items FOR UPDATE USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id));

-- Orders
CREATE POLICY "Staff can view orders" ON public.orders FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'bar_staff'::app_role) OR has_role(auth.uid(), 'kitchen_staff'::app_role) OR has_role(auth.uid(), 'waitstaff'::app_role) OR (bar_id IS NOT NULL));
CREATE POLICY "Staff can create orders" ON public.orders FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'bar_staff'::app_role) OR has_role(auth.uid(), 'waitstaff'::app_role) OR (bar_id IS NOT NULL));
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'bar_staff'::app_role) OR has_role(auth.uid(), 'kitchen_staff'::app_role) OR has_role(auth.uid(), 'waitstaff'::app_role) OR (bar_id IS NOT NULL));

-- Payments
CREATE POLICY "Anyone can view payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Can create payments for valid orders" ON public.payments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id));

-- Profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Restaurant Settings
CREATE POLICY "Anyone can view settings" ON public.restaurant_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON public.restaurant_settings FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Super admin can insert settings" ON public.restaurant_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Staff Users
CREATE POLICY "Admins can manage staff users" ON public.staff_users FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Staff can view own record" ON public.staff_users FOR SELECT USING ((id)::text = current_setting('app.current_staff_id'::text, true));

-- Stock Movements
CREATE POLICY "Staff can view stock movements" ON public.stock_movements FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'inventory_officer'::app_role));
CREATE POLICY "Managers and inventory officers can create movements" ON public.stock_movements FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'inventory_officer'::app_role));

-- Suppliers
CREATE POLICY "Staff can view suppliers" ON public.suppliers FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'inventory_officer'::app_role));
CREATE POLICY "Managers and inventory officers can manage suppliers" ON public.suppliers FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'inventory_officer'::app_role));

-- User Roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- GRANTS
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
