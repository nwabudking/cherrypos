-- Add receipt_width column to restaurant_settings
ALTER TABLE public.restaurant_settings 
ADD COLUMN receipt_width text DEFAULT '80mm';

-- Add waitstaff role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waitstaff';