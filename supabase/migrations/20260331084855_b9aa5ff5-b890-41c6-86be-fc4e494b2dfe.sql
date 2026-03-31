ALTER TABLE public.receipt_split_lines 
  ADD COLUMN IF NOT EXISTS tax_type text DEFAULT null,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT null;