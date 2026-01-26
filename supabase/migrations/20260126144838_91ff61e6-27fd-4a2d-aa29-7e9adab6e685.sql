-- Add custom_filename column to receipts table
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS custom_filename TEXT;