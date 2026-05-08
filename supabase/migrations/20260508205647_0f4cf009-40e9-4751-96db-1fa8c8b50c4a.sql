
-- Reprocess the two existing bank imports with current keywords (ignore + vendor mappings)
DO $$
DECLARE
  v_batches uuid[] := ARRAY['578cb0ae-2248-4167-b617-493d597e2547'::uuid, 'f7ef710e-5582-4b04-bc4e-915aec7fde23'::uuid];
  v_user_id uuid;
BEGIN
  -- Resolve user_id from one of the batches
  SELECT user_id INTO v_user_id FROM public.bank_imports WHERE id = v_batches[1];

  -- 1. Delete receipts linked to transactions that now match an ignore keyword
  DELETE FROM public.receipts r
  USING public.bank_transactions bt, public.bank_import_keywords k
  WHERE bt.import_batch_id = ANY(v_batches)
    AND k.user_id = v_user_id
    AND k.is_ignore = true
    AND k.is_active = true
    AND lower(bt.description) LIKE '%' || lower(k.keyword) || '%'
    AND (r.bank_transaction_id = bt.id OR r.bank_transaction_reference = bt.description)
    AND r.user_id = v_user_id;

  -- 2. Delete the ignored bank_transactions themselves
  DELETE FROM public.bank_transactions bt
  USING public.bank_import_keywords k
  WHERE bt.import_batch_id = ANY(v_batches)
    AND k.user_id = v_user_id
    AND k.is_ignore = true
    AND k.is_active = true
    AND lower(bt.description) LIKE '%' || lower(k.keyword) || '%';

  -- 3. Create receipts for unmatched expense transactions matching non-ignore keywords
  INSERT INTO public.receipts (
    user_id, vendor, vendor_id, description, amount_gross, receipt_date,
    category, tax_type, vat_rate, status, source, is_no_receipt_entry,
    bank_import_keyword_id, bank_transaction_reference, bank_transaction_id, notes
  )
  SELECT
    v_user_id,
    COALESCE(v.display_name, k.keyword),
    k.vendor_id,
    COALESCE(k.description_template, bt.description),
    bt.amount,
    bt.transaction_date,
    k.category,
    k.tax_type,
    COALESCE(k.tax_rate, 0),
    'approved',
    'bank_import',
    true,
    k.id,
    bt.description,
    bt.id,
    'Automatisch erstellt aus Bankbuchung - Keine Rechnung vorhanden'
  FROM public.bank_transactions bt
  JOIN LATERAL (
    SELECT k2.* FROM public.bank_import_keywords k2
    WHERE k2.user_id = v_user_id
      AND k2.is_active = true
      AND k2.is_ignore = false
      AND lower(bt.description) LIKE '%' || lower(k2.keyword) || '%'
    ORDER BY length(k2.keyword) DESC
    LIMIT 1
  ) k ON true
  LEFT JOIN public.vendors v ON v.id = k.vendor_id
  WHERE bt.import_batch_id = ANY(v_batches)
    AND bt.is_expense = true
    AND bt.receipt_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.receipts r2
      WHERE r2.bank_transaction_id = bt.id AND r2.user_id = v_user_id
    );

  -- 4. Mark transactions as matched where a receipt now exists
  UPDATE public.bank_transactions bt
  SET status = 'matched'
  WHERE bt.import_batch_id = ANY(v_batches)
    AND EXISTS (
      SELECT 1 FROM public.receipts r WHERE r.bank_transaction_id = bt.id
    );

  -- 5. Refresh import batch counters
  UPDATE public.bank_imports bi
  SET imported_rows = (
        SELECT count(*) FROM public.bank_transactions WHERE import_batch_id = bi.id
      ),
      skipped_rows = bi.total_rows - (
        SELECT count(*) FROM public.bank_transactions WHERE import_batch_id = bi.id
      )
  WHERE bi.id = ANY(v_batches);
END $$;
