-- Neue Spalte für IMAP-Account-Referenz hinzufügen
ALTER TABLE public.email_attachments 
ADD COLUMN email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL;

-- Index für schnelle Abfragen
CREATE INDEX idx_email_attachments_email_account_id 
ON public.email_attachments(email_account_id);

-- Kommentar zur Erklärung
COMMENT ON COLUMN public.email_attachments.email_account_id IS 'Referenz auf email_accounts für IMAP/OAuth-Importe (alternativ zu email_connection_id für Webhook-Importe)';