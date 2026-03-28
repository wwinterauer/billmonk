
-- Community patterns table
CREATE TABLE public.community_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL DEFAULT 'vendor_category',
  vendor_name_normalized text,
  keyword text,
  suggested_category text NOT NULL,
  suggested_vat_rate numeric,
  country text,
  contributor_count integer NOT NULL DEFAULT 1,
  total_confirmations integer NOT NULL DEFAULT 1,
  is_verified boolean NOT NULL DEFAULT false,
  is_rejected boolean NOT NULL DEFAULT false,
  admin_reviewed boolean NOT NULL DEFAULT false,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.community_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage community patterns" ON public.community_patterns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage community patterns" ON public.community_patterns
  FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can read verified patterns" ON public.community_patterns
  FOR SELECT TO authenticated
  USING (is_verified = true);

-- Community contributions table
CREATE TABLE public.community_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pattern_id uuid NOT NULL REFERENCES public.community_patterns(id) ON DELETE CASCADE,
  contributed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pattern_id)
);

ALTER TABLE public.community_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for contributions" ON public.community_contributions
  FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin can read contributions" ON public.community_contributions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Platform learning settings
CREATE TABLE public.platform_learning_settings (
  id integer PRIMARY KEY DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  verification_threshold integer NOT NULL DEFAULT 3,
  auto_verify boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.platform_learning_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage learning settings" ON public.platform_learning_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read learning settings" ON public.platform_learning_settings
  FOR SELECT TO authenticated
  USING (true);

-- Insert default settings row
INSERT INTO public.platform_learning_settings (id, is_active, verification_threshold, auto_verify)
VALUES (1, true, 3, true);

-- Add community_opt_out to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS community_opt_out boolean NOT NULL DEFAULT false;

-- Index for fast lookups
CREATE INDEX idx_community_patterns_verified ON public.community_patterns(is_verified, country);
CREATE INDEX idx_community_patterns_vendor ON public.community_patterns(vendor_name_normalized);
