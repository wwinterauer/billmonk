
CREATE TABLE public.invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  reminder_level INT NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders" ON public.invoice_reminders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reminders" ON public.invoice_reminders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.invoice_settings
  ADD COLUMN IF NOT EXISTS reminder_stage_1_days INT DEFAULT 7,
  ADD COLUMN IF NOT EXISTS reminder_stage_2_days INT DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reminder_stage_3_days INT DEFAULT 14,
  ADD COLUMN IF NOT EXISTS overdue_email_notify BOOLEAN DEFAULT false;
