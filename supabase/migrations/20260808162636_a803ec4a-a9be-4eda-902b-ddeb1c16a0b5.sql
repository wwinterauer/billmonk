CREATE TABLE public.upload_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  expected_count integer NOT NULL DEFAULT 0 CHECK (expected_count >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
  uploaded_count integer NOT NULL DEFAULT 0 CHECK (uploaded_count >= 0),
  duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  pending_count integer NOT NULL DEFAULT 0 CHECK (pending_count >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_runs TO authenticated;
GRANT ALL ON public.upload_runs TO service_role;
ALTER TABLE public.upload_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own upload runs" ON public.upload_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own upload runs" ON public.upload_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own upload runs" ON public.upload_runs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own upload runs" ON public.upload_runs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.upload_file_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.upload_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  mime_type text,
  file_hash text,
  ordinal integer NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  phase text NOT NULL DEFAULT 'selected',
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'uploaded', 'duplicate', 'rejected', 'failed')),
  reason_code text,
  error_message text,
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, ordinal)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_file_events TO authenticated;
GRANT ALL ON public.upload_file_events TO service_role;
ALTER TABLE public.upload_file_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own upload file events" ON public.upload_file_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own upload file events" ON public.upload_file_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.upload_runs r WHERE r.id = run_id AND r.user_id = auth.uid()));
CREATE POLICY "Users can update own upload file events" ON public.upload_file_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own upload file events" ON public.upload_file_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX upload_runs_user_created_idx ON public.upload_runs(user_id, created_at DESC);
CREATE INDEX upload_file_events_run_idx ON public.upload_file_events(run_id, ordinal);
CREATE INDEX upload_file_events_user_hash_idx ON public.upload_file_events(user_id, file_hash) WHERE file_hash IS NOT NULL;

CREATE TRIGGER update_upload_runs_updated_at BEFORE UPDATE ON public.upload_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_upload_file_events_updated_at BEFORE UPDATE ON public.upload_file_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();