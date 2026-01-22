-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view transfers" ON public.bar_to_bar_transfers;

-- Create a new permissive SELECT policy that allows all reads
-- Since this is transfer history, it's okay for all staff to view
CREATE POLICY "Anyone can view transfers" 
ON public.bar_to_bar_transfers 
FOR SELECT 
USING (true);