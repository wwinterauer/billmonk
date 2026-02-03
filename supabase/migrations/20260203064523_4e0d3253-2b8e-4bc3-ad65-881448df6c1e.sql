-- email_connection_id auf nullable setzen für IMAP-Imports
-- IMAP verwendet email_account_id, Webhook verwendet email_connection_id
ALTER TABLE public.email_attachments 
ALTER COLUMN email_connection_id DROP NOT NULL;

-- Kommentar zur Erklärung
COMMENT ON COLUMN public.email_attachments.email_connection_id IS 'Referenz auf email_connections für Webhook-Importe (NULL bei IMAP/OAuth-Imports)';