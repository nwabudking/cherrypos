-- Create function for staff to change their own password (requires current password verification)
CREATE OR REPLACE FUNCTION public.staff_change_own_password(
  p_staff_id uuid,
  p_current_password text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_current_hash text;
BEGIN
  -- Get current password hash
  SELECT password_hash INTO v_current_hash
  FROM public.staff_users
  WHERE id = p_staff_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff user not found or inactive';
  END IF;

  -- Verify current password
  IF v_current_hash != extensions.crypt(p_current_password, v_current_hash) THEN
    RAISE EXCEPTION 'Current password is incorrect';
  END IF;

  -- Update to new password
  UPDATE public.staff_users
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = p_staff_id;

  RETURN true;
END;
$function$;