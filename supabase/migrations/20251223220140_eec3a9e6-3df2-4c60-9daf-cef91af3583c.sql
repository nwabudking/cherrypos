-- Create inventory items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  min_stock_level NUMERIC NOT NULL DEFAULT 10,
  cost_per_unit NUMERIC,
  supplier TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create stock movements table for tracking history
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity NUMERIC NOT NULL,
  previous_stock NUMERIC NOT NULL,
  new_stock NUMERIC NOT NULL,
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_items
CREATE POLICY "Staff can view inventory" 
ON public.inventory_items 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'inventory_officer') OR
  has_role(auth.uid(), 'bar_staff') OR
  has_role(auth.uid(), 'kitchen_staff')
);

CREATE POLICY "Managers and inventory officers can manage inventory" 
ON public.inventory_items 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'inventory_officer')
);

-- RLS policies for stock_movements
CREATE POLICY "Staff can view stock movements" 
ON public.stock_movements 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'inventory_officer')
);

CREATE POLICY "Managers and inventory officers can create movements" 
ON public.stock_movements 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'inventory_officer')
);