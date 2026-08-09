ALTER TABLE public.receipts
DROP CONSTRAINT IF EXISTS receipts_split_from_receipt_id_fkey;

ALTER TABLE public.receipts
ADD CONSTRAINT receipts_split_from_receipt_id_fkey
FOREIGN KEY (split_from_receipt_id)
REFERENCES public.receipts(id)
ON DELETE SET NULL;