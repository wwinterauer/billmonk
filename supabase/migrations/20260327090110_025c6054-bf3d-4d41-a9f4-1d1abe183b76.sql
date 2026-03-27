
-- Recurring expenses detection table
CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  average_amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  last_seen_date date,
  next_expected_date date,
  confidence numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'detected',
  is_user_confirmed boolean NOT NULL DEFAULT false,
  notes text,
  matched_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring expenses" ON public.recurring_expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring expenses" ON public.recurring_expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring expenses" ON public.recurring_expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring expenses" ON public.recurring_expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Linking table for individual receipts matched to recurring patterns
CREATE TABLE public.recurring_expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_expense_id uuid NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  matched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recurring_expense_id, expense_id)
);

ALTER TABLE public.recurring_expense_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring expense entries" ON public.recurring_expense_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.recurring_expenses re WHERE re.id = recurring_expense_id AND re.user_id = auth.uid()));
CREATE POLICY "Users can insert own recurring expense entries" ON public.recurring_expense_entries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.recurring_expenses re WHERE re.id = recurring_expense_id AND re.user_id = auth.uid()));
CREATE POLICY "Users can delete own recurring expense entries" ON public.recurring_expense_entries FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.recurring_expenses re WHERE re.id = recurring_expense_id AND re.user_id = auth.uid()));
