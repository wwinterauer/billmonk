
-- New table for live bank connections (GoCardless)
CREATE TABLE public.bank_connections_live (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'gocardless',
  institution_id text,
  institution_name text,
  institution_logo text,
  requisition_id text,
  account_id text,
  iban text,
  status text NOT NULL DEFAULT 'pending',
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bank_connections_live ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own live bank connections"
  ON public.bank_connections_live FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own live bank connections"
  ON public.bank_connections_live FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own live bank connections"
  ON public.bank_connections_live FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own live bank connections"
  ON public.bank_connections_live FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Extend bank_transactions with source, external_id, invoice_id
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'csv',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Unique index for deduplication of live transactions
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_external_id
  ON public.bank_transactions (user_id, external_id)
  WHERE external_id IS NOT NULL;
