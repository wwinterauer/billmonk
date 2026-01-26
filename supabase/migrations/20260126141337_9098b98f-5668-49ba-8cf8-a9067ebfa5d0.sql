-- Add invoice_number column to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS invoice_number TEXT;