ALTER TABLE public.receipts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;