
-- 1) Link bank_transactions.receipt_id back to the receipt that references them
UPDATE public.bank_transactions bt
SET receipt_id = r.id
FROM public.receipts r
WHERE r.bank_transaction_id = bt.id
  AND bt.receipt_id IS NULL
  AND r.is_no_receipt_entry = true;

-- 2) Expand description on existing no-receipt entries with the original bank tx text
UPDATE public.receipts r
SET description = r.description || ' – ' || bt.description
FROM public.bank_transactions bt
WHERE r.bank_transaction_id = bt.id
  AND r.is_no_receipt_entry = true
  AND bt.description IS NOT NULL
  AND position(bt.description in COALESCE(r.description, '')) = 0;

-- 3) Clear duplicate flags on no-receipt entries; with the expanded descriptions they are no longer duplicates
UPDATE public.receipts
SET is_duplicate = false, duplicate_of = NULL, duplicate_score = NULL
WHERE is_no_receipt_entry = true
  AND is_duplicate = true;
