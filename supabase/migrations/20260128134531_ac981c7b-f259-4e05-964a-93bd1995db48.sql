-- Drop old constraint and recreate with extended status values
ALTER TABLE public.receipts 
DROP CONSTRAINT IF EXISTS receipts_status_check;

ALTER TABLE public.receipts 
ADD CONSTRAINT receipts_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'processing'::text, 
  'review'::text, 
  'approved'::text, 
  'rejected'::text,
  'duplicate'::text,
  'not_a_receipt'::text,
  'error'::text
]));