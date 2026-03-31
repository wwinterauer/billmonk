
-- Create prompt_versions table
CREATE TABLE public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  name text NOT NULL,
  system_prompt text NOT NULL,
  user_prompt_template text NOT NULL,
  expenses_only_prompt_template text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

-- SELECT for all authenticated users
CREATE POLICY "Authenticated users can read prompt versions"
ON public.prompt_versions
FOR SELECT
TO authenticated
USING (true);

-- INSERT/UPDATE/DELETE for admins only
CREATE POLICY "Admins can insert prompt versions"
ON public.prompt_versions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update prompt versions"
ON public.prompt_versions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete prompt versions"
ON public.prompt_versions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add prompt_version column to receipts
ALTER TABLE public.receipts ADD COLUMN prompt_version text DEFAULT 'v1';
