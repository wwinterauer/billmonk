UPDATE public.receipts
SET is_duplicate = false, duplicate_score = null, duplicate_checked_at = now()
WHERE is_duplicate = true AND duplicate_of IS NULL;