-- Create restaurant settings table
CREATE TABLE public.restaurant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Cherry Dining',
  tagline text DEFAULT '& Lounge',
  address text DEFAULT '123 Restaurant Street',
  city text DEFAULT 'Lagos',
  country text DEFAULT 'Nigeria',
  phone text DEFAULT '+234 800 000 0000',
  email text,
  logo_url text,
  currency text DEFAULT 'NGN',
  timezone text DEFAULT 'Africa/Lagos',
  receipt_footer text DEFAULT 'Thank you for dining with us!',
  receipt_show_logo boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Only admins and managers can view settings
CREATE POLICY "Staff can view settings"
ON public.restaurant_settings
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'cashier') OR
  has_role(auth.uid(), 'bar_staff') OR
  has_role(auth.uid(), 'kitchen_staff')
);

-- Only super_admin and manager can update settings
CREATE POLICY "Admins can update settings"
ON public.restaurant_settings
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'manager'));

-- Only super_admin can insert settings
CREATE POLICY "Super admin can insert settings"
ON public.restaurant_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Insert default settings row
INSERT INTO public.restaurant_settings (name, tagline, address, city, country, phone) 
VALUES ('Cherry Dining', '& Lounge', '123 Restaurant Street', 'Lagos', 'Nigeria', '+234 800 000 0000');