-- Custom Auth System (No Supabase Auth)
-- This replaces Supabase Auth with a simple email/password system

-- Enable pgcrypto extension in extensions schema (Supabase standard)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Drop existing triggers that reference auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_role();

-- Drop existing RLS policies on user_roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;

-- Drop existing RLS policies on teams
DROP POLICY IF EXISTS "Teams can read own data" ON public.teams;
DROP POLICY IF EXISTS "Teams can update own data" ON public.teams;
DROP POLICY IF EXISTS "Teams can insert own data" ON public.teams;
DROP POLICY IF EXISTS "Admins can read all teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can update all teams" ON public.teams;

-- Drop existing RLS policies on game_progress
DROP POLICY IF EXISTS "Teams can read own progress" ON public.game_progress;
DROP POLICY IF EXISTS "Teams can insert own progress" ON public.game_progress;
DROP POLICY IF EXISTS "Teams can update own progress" ON public.game_progress;
DROP POLICY IF EXISTS "Admins can read all progress" ON public.game_progress;
DROP POLICY IF EXISTS "Admins can update all progress" ON public.game_progress;

-- Drop existing RLS policies on levels that depend on has_role
DROP POLICY IF EXISTS "Admins can insert levels" ON public.levels;
DROP POLICY IF EXISTS "Admins can update levels" ON public.levels;
DROP POLICY IF EXISTS "Admins can delete levels" ON public.levels;
DROP POLICY IF EXISTS "Authenticated users can read levels" ON public.levels;

-- Drop existing RLS policies on broadcasts that depend on has_role
DROP POLICY IF EXISTS "Admins can manage broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "Anyone authenticated can read broadcasts" ON public.broadcasts;

-- Drop existing storage policies that depend on has_role
DROP POLICY IF EXISTS "Admins can upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update evidence" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete evidence" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload narration" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update narration" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete narration" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read narration" ON storage.objects;

-- Now we can safely drop the has_role function
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role);

-- Create custom users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'team',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop old user_roles table (we're moving role to users table)
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Update teams table to reference public.users instead of auth.users
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_user_id_fkey;
ALTER TABLE public.teams 
  ADD CONSTRAINT teams_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Function to register a new user
CREATE OR REPLACE FUNCTION public.register_user(
  p_email TEXT,
  p_password TEXT,
  p_team_name TEXT,
  p_college_name TEXT,
  p_phone_number TEXT,
  p_member_names TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE email = lower(p_email)) THEN
    RETURN json_build_object('success', false, 'error', 'Email already registered');
  END IF;
  
  -- Check if team name already exists
  IF EXISTS (SELECT 1 FROM public.teams WHERE team_name = p_team_name) THEN
    RETURN json_build_object('success', false, 'error', 'Team name already taken');
  END IF;
  
  -- Create user with hashed password
  INSERT INTO public.users (email, password_hash, role)
  VALUES (lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')), 'team')
  RETURNING id INTO new_user_id;
  
  -- Create team record
  INSERT INTO public.teams (user_id, team_name, email, college_name, phone_number, member_names)
  VALUES (new_user_id, p_team_name, lower(p_email), p_college_name, p_phone_number, p_member_names);
  
  -- Return user data
  SELECT json_build_object(
    'success', true,
    'user', json_build_object(
      'id', u.id,
      'email', u.email,
      'role', u.role
    )
  ) INTO result
  FROM public.users u WHERE u.id = new_user_id;
  
  RETURN result;
END;
$$;

-- Function to login
CREATE OR REPLACE FUNCTION public.login_user(p_email TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_user RECORD;
  team_data RECORD;
  result JSON;
BEGIN
  -- Find user and verify password
  SELECT * INTO found_user
  FROM public.users
  WHERE email = lower(p_email)
    AND password_hash = extensions.crypt(p_password, password_hash);
  
  IF found_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid email or password');
  END IF;
  
  -- Get team data if exists
  SELECT * INTO team_data FROM public.teams WHERE user_id = found_user.id;
  
  -- Return user and team data
  RETURN json_build_object(
    'success', true,
    'user', json_build_object(
      'id', found_user.id,
      'email', found_user.email,
      'role', found_user.role
    ),
    'team', CASE WHEN team_data IS NOT NULL THEN
      json_build_object(
        'id', team_data.id,
        'team_name', team_data.team_name,
        'college_name', team_data.college_name,
        'phone_number', team_data.phone_number,
        'member_names', team_data.member_names,
        'highest_unlocked_level', team_data.highest_unlocked_level,
        'start_time', team_data.start_time,
        'finish_time', team_data.finish_time
      )
    ELSE NULL END
  );
END;
$$;

-- Function to create admin user
CREATE OR REPLACE FUNCTION public.create_admin_user(p_email TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE email = lower(p_email)) THEN
    -- Update existing user to admin
    UPDATE public.users SET role = 'admin' WHERE email = lower(p_email);
    RETURN json_build_object('success', true, 'message', 'User upgraded to admin');
  END IF;
  
  -- Create admin user
  INSERT INTO public.users (email, password_hash, role)
  VALUES (lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')), 'admin')
  RETURNING id INTO new_user_id;
  
  RETURN json_build_object('success', true, 'user_id', new_user_id);
END;
$$;

-- Disable RLS for simplicity (since we're handling auth in functions)
-- In production, you'd want proper RLS with a custom auth header approach
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access to call our auth functions
CREATE POLICY "Allow anonymous to call functions" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Public read teams" ON public.teams
  FOR SELECT USING (true);

CREATE POLICY "Public write teams" ON public.teams
  FOR ALL USING (true);

CREATE POLICY "Public read progress" ON public.game_progress
  FOR SELECT USING (true);

CREATE POLICY "Public write progress" ON public.game_progress
  FOR ALL USING (true);

CREATE POLICY "Public read levels" ON public.levels
  FOR SELECT USING (true);

CREATE POLICY "Public write levels" ON public.levels
  FOR ALL USING (true);

CREATE POLICY "Public read broadcasts" ON public.broadcasts
  FOR SELECT USING (true);

CREATE POLICY "Public write broadcasts" ON public.broadcasts
  FOR ALL USING (true);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.register_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_user TO anon, authenticated;

-- Storage policies (public access since we're not using Supabase Auth)
CREATE POLICY "Public read evidence" ON storage.objects
  FOR SELECT USING (bucket_id = 'evidence');

CREATE POLICY "Public write evidence" ON storage.objects
  FOR ALL USING (bucket_id = 'evidence');

CREATE POLICY "Public read narration" ON storage.objects
  FOR SELECT USING (bucket_id = 'narration');

CREATE POLICY "Public write narration" ON storage.objects
  FOR ALL USING (bucket_id = 'narration');

-- Create initial admin user (test@gmail.com / 12345678)
SELECT public.create_admin_user('test@gmail.com', '12345678');
