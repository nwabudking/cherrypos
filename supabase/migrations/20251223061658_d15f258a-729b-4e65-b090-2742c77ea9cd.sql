
-- Fix the generate_order_number function search path
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
