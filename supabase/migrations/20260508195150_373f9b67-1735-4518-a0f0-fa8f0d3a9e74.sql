ALTER TABLE public.bank_import_keywords
  ADD COLUMN IF NOT EXISTS tax_type text,
  ADD COLUMN IF NOT EXISTS vendor_id uuid;