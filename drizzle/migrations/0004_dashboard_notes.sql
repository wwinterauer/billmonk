CREATE TABLE public.dashboard_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow',
  is_done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_notes TO authenticated;
GRANT ALL ON public.dashboard_notes TO service_role;
ALTER TABLE public.dashboard_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes select" ON public.dashboard_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notes insert" ON public.dashboard_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes update" ON public.dashboard_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes delete" ON public.dashboard_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER dashboard_notes_updated_at BEFORE UPDATE ON public.dashboard_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();