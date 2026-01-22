-- Fix local staff password hashing in SECURITY DEFINER functions when pgcrypto is installed in the "extensions" schema
-- (gen_salt/crypt aren't found when search_path is only 'public').

CREATE OR REPLACE FUNCTION public.verify_staff_password(p_username text, p_password text)
RETURNS TABLE(staff_id uuid, staff_name text, staff_role app_role, staff_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $$
DECLARE
  v_staff public.staff_users%ROWTYPE;
BEGIN
  SELECT * INTO v_staff
  FROM public.staff_users
  WHERE username = LOWER(p_username) AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Verify password using pgcrypto
  IF v_staff.password_hash = extensions.crypt(p_password, v_staff.password_hash) THEN
    UPDATE public.staff_users SET last_login_at = now() WHERE id = v_staff.id;
    RETURN QUERY SELECT v_staff.id, v_staff.full_name, v_staff.role, v_staff.email;
  END IF;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_staff_user(
  p_username text,
  p_password text,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_role app_role DEFAULT 'cashier'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $$
DECLARE
  v_user_id uuid;
  v_new_staff_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF NOT (has_role(v_user_id, 'super_admin'::app_role) OR has_role(v_user_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can create staff users';
  END IF;

  IF EXISTS (SELECT 1 FROM public.staff_users WHERE username = LOWER(p_username)) THEN
    RAISE EXCEPTION 'Username already exists';
  END IF;

  INSERT INTO public.staff_users (username, password_hash, full_name, email, role, created_by)
  VALUES (
    LOWER(p_username),
    extensions.crypt(p_password, extensions.gen_salt('bf'::text)),
    p_full_name,
    p_email,
    p_role,
    v_user_id
  )
  RETURNING id INTO v_new_staff_id;

  RETURN v_new_staff_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_staff_password(p_staff_id uuid, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF NOT (has_role(v_user_id, 'super_admin'::app_role) OR has_role(v_user_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.staff_users
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'::text)),
      updated_at = now()
  WHERE id = p_staff_id;

  RETURN FOUND;
END;
$$;

-- Allow cashier_bar_assignments to reference either auth users (user_id) or local staff (staff_user_id)
-- by making user_id nullable so staff assignments don't violate the auth.users FK.
ALTER TABLE public.cashier_bar_assignments
  ALTER COLUMN user_id DROP NOT NULL;
