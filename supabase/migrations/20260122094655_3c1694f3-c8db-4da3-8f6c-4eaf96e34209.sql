-- Enable pgcrypto extension (required for password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a test staff user (cashier1 / 123456)
INSERT INTO public.staff_users (username, password_hash, full_name, email, role)
VALUES (
  'cashier1',
  crypt('123456', gen_salt('bf')),
  'Test Cashier',
  'cashier1@test.com',
  'cashier'
) ON CONFLICT (username) DO NOTHING;

-- Update verify_staff_password to be more robust
CREATE OR REPLACE FUNCTION public.verify_staff_password(p_username text, p_password text)
RETURNS TABLE(staff_id uuid, staff_name text, staff_role app_role, staff_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Verify password using pgcrypto crypt
  IF v_staff.password_hash = crypt(p_password, v_staff.password_hash) THEN
    -- Update last login
    UPDATE public.staff_users SET last_login_at = now() WHERE id = v_staff.id;
    
    RETURN QUERY SELECT v_staff.id, v_staff.full_name, v_staff.role, v_staff.email;
  END IF;
  
  RETURN;
END;
$$;

-- Update create_staff_user to be more robust
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
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_new_staff_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Only admins can create staff
  IF NOT (has_role(v_user_id, 'super_admin'::app_role) OR has_role(v_user_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can create staff users';
  END IF;
  
  -- Check if username exists
  IF EXISTS (SELECT 1 FROM public.staff_users WHERE username = LOWER(p_username)) THEN
    RAISE EXCEPTION 'Username already exists';
  END IF;
  
  -- Create staff user with hashed password
  INSERT INTO public.staff_users (username, password_hash, full_name, email, role, created_by)
  VALUES (
    LOWER(p_username),
    crypt(p_password, gen_salt('bf')),
    p_full_name,
    p_email,
    p_role,
    v_user_id
  )
  RETURNING id INTO v_new_staff_id;
  
  RETURN v_new_staff_id;
END;
$$;

-- Update update_staff_password to be more robust  
CREATE OR REPLACE FUNCTION public.update_staff_password(p_staff_id uuid, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Only admins can reset passwords
  IF NOT (has_role(v_user_id, 'super_admin'::app_role) OR has_role(v_user_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  UPDATE public.staff_users
  SET password_hash = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_staff_id;
  
  RETURN FOUND;
END;
$$;