-- Tighten bar_to_bar_transfers RLS to avoid overly-permissive INSERT/UPDATE policies

ALTER TABLE public.bar_to_bar_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can create transfers" ON public.bar_to_bar_transfers;
DROP POLICY IF EXISTS "Authenticated users can update transfers" ON public.bar_to_bar_transfers;

-- Allow creating a transfer only for yourself, and (if cashier) only from your assigned bar
CREATE POLICY "Users can create their own transfers"
ON public.bar_to_bar_transfers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = requested_by
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'store_admin'::app_role)
    OR (
      has_role(auth.uid(), 'cashier'::app_role)
      AND EXISTS (
        SELECT 1
        FROM public.cashier_bar_assignments cba
        WHERE cba.user_id = auth.uid()
          AND cba.bar_id = source_bar_id
          AND COALESCE(cba.is_active, true) = true
      )
    )
  )
);

-- Allow updates only by admins, or by a cashier assigned to the destination bar (for accept/reject)
CREATE POLICY "Admins or destination cashiers can update transfers"
ON public.bar_to_bar_transfers
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'store_admin'::app_role)
  OR (
    has_role(auth.uid(), 'cashier'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.cashier_bar_assignments cba
      WHERE cba.user_id = auth.uid()
        AND cba.bar_id = destination_bar_id
        AND COALESCE(cba.is_active, true) = true
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'store_admin'::app_role)
  OR (
    has_role(auth.uid(), 'cashier'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.cashier_bar_assignments cba
      WHERE cba.user_id = auth.uid()
        AND cba.bar_id = destination_bar_id
        AND COALESCE(cba.is_active, true) = true
    )
  )
);
