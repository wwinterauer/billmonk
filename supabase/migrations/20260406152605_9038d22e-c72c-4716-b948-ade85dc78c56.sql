
-- 1. Create beta_applications table
CREATE TABLE public.beta_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  street TEXT,
  zip TEXT,
  city TEXT,
  country TEXT DEFAULT 'AT',
  organization_type TEXT NOT NULL DEFAULT 'privat',
  organization_name TEXT,
  intended_plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  beta_code_id UUID REFERENCES public.beta_codes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_applications ENABLE ROW LEVEL SECURITY;

-- User can read own applications
CREATE POLICY "Users can read own applications"
  ON public.beta_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert own applications
CREATE POLICY "Users can insert own applications"
  ON public.beta_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins full access
CREATE POLICY "Admins can manage applications"
  ON public.beta_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Extend beta_codes
ALTER TABLE public.beta_codes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_email TEXT,
  ADD COLUMN IF NOT EXISTS beta_application_id UUID REFERENCES public.beta_applications(id);

-- 3. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS beta_expires_at TIMESTAMPTZ;
