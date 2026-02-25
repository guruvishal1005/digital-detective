
-- Roles enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'team');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles: users can read their own, admins can read all
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  team_name TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  college_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  member_names TEXT[] NOT NULL DEFAULT '{}',
  highest_unlocked_level INTEGER NOT NULL DEFAULT 1,
  start_time TIMESTAMPTZ,
  finish_time TIMESTAMPTZ,
  current_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Teams RLS
CREATE POLICY "Teams can read own data" ON public.teams
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Teams can update own data" ON public.teams
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teams can insert own data" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all teams" ON public.teams
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all teams" ON public.teams
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Levels table (admin-managed)
CREATE TABLE public.levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number INTEGER NOT NULL UNIQUE CHECK (level_number >= 1 AND level_number <= 5),
  story_text TEXT NOT NULL DEFAULT '',
  story_audio_url TEXT,
  zip_file_url TEXT,
  answer_key TEXT NOT NULL DEFAULT '',
  hint_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read levels
CREATE POLICY "Authenticated users can read levels" ON public.levels
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can modify levels
CREATE POLICY "Admins can insert levels" ON public.levels
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update levels" ON public.levels
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete levels" ON public.levels
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Game progress table
CREATE TABLE public.game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  level_number INTEGER NOT NULL CHECK (level_number >= 1 AND level_number <= 5),
  attempts INTEGER NOT NULL DEFAULT 0,
  hint_taken BOOLEAN NOT NULL DEFAULT false,
  hint_available_at TIMESTAMPTZ,
  first_entered_at TIMESTAMPTZ,
  solved_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, level_number)
);
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

-- Game progress RLS
CREATE POLICY "Teams can read own progress" ON public.game_progress
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()));

CREATE POLICY "Teams can insert own progress" ON public.game_progress
  FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()));

CREATE POLICY "Teams can update own progress" ON public.game_progress
  FOR UPDATE TO authenticated
  USING (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()));

CREATE POLICY "Admins can read all progress" ON public.game_progress
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all progress" ON public.game_progress
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Broadcasts table
CREATE TABLE public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read broadcasts" ON public.broadcasts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage broadcasts" ON public.broadcasts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed the 5 levels
INSERT INTO public.levels (level_number, story_text, answer_key, hint_text) VALUES
  (1, 'The case begins with a mysterious email found on the victim''s laptop. The sender used a pseudonym, but digital traces never truly disappear...', 'placeholder1', 'Check the email headers carefully.'),
  (2, 'A deleted file has been recovered from the hard drive. The metadata tells a story the suspect tried to hide...', 'placeholder2', 'Look at the file timestamps.'),
  (3, 'Network logs reveal an unusual connection at 3:47 AM. Someone accessed the server from an unexpected location...', 'placeholder3', 'Trace the IP address origin.'),
  (4, 'A encrypted message was intercepted. The cipher is old but effective. The key lies in what you''ve already found...', 'placeholder4', 'Use findings from previous levels.'),
  (5, 'All evidence points to one conclusion. Cross-reference your findings to identify the culprit and unlock the final truth...', 'placeholder5', 'Combine all gathered evidence.');

-- Trigger to auto-create team role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'team');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Enable realtime for monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;

-- Storage buckets for evidence and narration
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence', 'evidence', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('narration', 'narration', false);

-- Storage policies: authenticated users can read, admins can upload
CREATE POLICY "Authenticated can read evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidence');

CREATE POLICY "Admins can upload evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update evidence" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete evidence" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read narration" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'narration');

CREATE POLICY "Admins can upload narration" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'narration' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update narration" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'narration' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete narration" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'narration' AND public.has_role(auth.uid(), 'admin'));

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_levels_updated_at
  BEFORE UPDATE ON public.levels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
