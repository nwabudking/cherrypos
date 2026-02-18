
-- Add staff_user_id column to orders to track which local staff user created the order
ALTER TABLE public.orders ADD COLUMN staff_user_id uuid REFERENCES public.staff_users(id);

-- Create index for efficient staff_user_id queries
CREATE INDEX idx_orders_staff_user_id ON public.orders(staff_user_id);
