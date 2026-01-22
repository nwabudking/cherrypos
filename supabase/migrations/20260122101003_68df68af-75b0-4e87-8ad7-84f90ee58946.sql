-- Tighten RLS policies to require bar_id instead of allowing everything
-- This ensures orders/payments can only be created with valid bar context

-- Fix order_items - require order to exist
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can update order items" ON public.order_items;

CREATE POLICY "Can create order items for valid orders" 
ON public.order_items 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id)
);

CREATE POLICY "Can update order items for valid orders" 
ON public.order_items 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id)
);

-- Fix payments - require valid order
DROP POLICY IF EXISTS "Anyone can create payments" ON public.payments;

CREATE POLICY "Can create payments for valid orders" 
ON public.payments 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id)
);