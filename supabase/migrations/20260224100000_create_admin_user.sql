-- Create Admin Account
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard -> SQL Editor)

-- Step 1: Create the admin user (this creates the auth user)
-- Replace the email and password with your desired credentials
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Create user in auth.users via Supabase Auth API is recommended
  -- But we can insert a role for an existing user
  
  -- First, check if the admin email already exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@digitalcasefiles.com';
  
  IF new_user_id IS NOT NULL THEN
    -- User exists, just add admin role if not already present
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role added to existing user: %', new_user_id;
  ELSE
    RAISE NOTICE 'User does not exist. Please create the user first via signup or Supabase Auth dashboard.';
  END IF;
END $$;

-- Alternative: If you know the user_id, run this directly:
-- INSERT INTO public.user_roles (user_id, role) VALUES ('YOUR-USER-UUID-HERE', 'admin');
