-- Add composite index for better query performance on email attachments
CREATE INDEX IF NOT EXISTS idx_email_attachments_connection_date 
ON public.email_attachments(email_connection_id, created_at DESC);

-- Add similar index for email_imports
CREATE INDEX IF NOT EXISTS idx_email_imports_connection_date 
ON public.email_imports(email_connection_id, received_at DESC);