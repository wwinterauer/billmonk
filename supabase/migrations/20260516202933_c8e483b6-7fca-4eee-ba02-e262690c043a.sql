ALTER TABLE public.receipts DROP CONSTRAINT receipts_source_check;
ALTER TABLE public.receipts ADD CONSTRAINT receipts_source_check
  CHECK (source = ANY (ARRAY[
    'upload','email_webhook','email_imap','cloud','api',
    'camera','share','split','bank_import','manual'
  ]));