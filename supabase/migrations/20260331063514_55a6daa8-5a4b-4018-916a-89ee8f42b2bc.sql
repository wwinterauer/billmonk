
-- A/B Test tables for prompt comparison
CREATE TABLE public.ab_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prompt_version_a text NOT NULL DEFAULT 'v1',
  prompt_version_b text NOT NULL DEFAULT 'v2',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  results_summary jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.ab_test_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES public.ab_test_runs(id) ON DELETE CASCADE,
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  original_data jsonb,
  result_a jsonb,
  result_b jsonb,
  field_scores jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ab_test_field_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES public.ab_test_runs(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  version_a_correct integer NOT NULL DEFAULT 0,
  version_a_total integer NOT NULL DEFAULT 0,
  version_b_correct integer NOT NULL DEFAULT 0,
  version_b_total integer NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.ab_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_field_accuracy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ab_test_runs" ON public.ab_test_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ab_test_items" ON public.ab_test_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ab_test_field_accuracy" ON public.ab_test_field_accuracy FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_ab_test_items_run ON public.ab_test_items(test_run_id);
CREATE INDEX idx_ab_test_field_accuracy_run ON public.ab_test_field_accuracy(test_run_id);
