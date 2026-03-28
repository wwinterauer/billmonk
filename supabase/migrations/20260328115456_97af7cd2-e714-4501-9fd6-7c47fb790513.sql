
CREATE TABLE public.category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  category_name text NOT NULL,
  match_count integer DEFAULT 1,
  source text DEFAULT 'correction',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, keyword)
);

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own category rules" ON public.category_rules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own category rules" ON public.category_rules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category rules" ON public.category_rules
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category rules" ON public.category_rules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
