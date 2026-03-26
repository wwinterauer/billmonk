
CREATE TABLE public.beta_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  used_count integer NOT NULL DEFAULT 0,
  max_uses integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can manage beta codes
CREATE POLICY "Admins can manage beta codes"
  ON public.beta_codes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone can read active codes for validation (anon needed for beta gate)
CREATE POLICY "Anyone can validate beta codes"
  ON public.beta_codes
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
