CREATE TABLE public.recurring_suggestion_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pattern_key text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_suggestion_dismissals TO authenticated;
GRANT ALL ON public.recurring_suggestion_dismissals TO service_role;
ALTER TABLE public.recurring_suggestion_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own dismissals select" ON public.recurring_suggestion_dismissals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own dismissals insert" ON public.recurring_suggestion_dismissals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own dismissals update" ON public.recurring_suggestion_dismissals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own dismissals delete" ON public.recurring_suggestion_dismissals FOR DELETE TO authenticated USING (auth.uid() = user_id);