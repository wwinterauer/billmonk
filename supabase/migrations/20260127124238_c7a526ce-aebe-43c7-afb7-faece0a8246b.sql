-- Neue Felder für Receipt-Herkunft
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload' 
CHECK (source IN ('upload', 'email_webhook', 'email_imap', 'cloud', 'api'));

ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS email_attachment_id UUID REFERENCES email_attachments(id) ON DELETE SET NULL;

-- Indexes für effiziente Abfragen
CREATE INDEX IF NOT EXISTS idx_receipts_source ON receipts(source);
CREATE INDEX IF NOT EXISTS idx_receipts_email_attachment ON receipts(email_attachment_id) WHERE email_attachment_id IS NOT NULL;

-- Kommentar für Dokumentation
COMMENT ON COLUMN receipts.source IS 'Herkunft des Belegs: upload, email_webhook, email_imap, cloud, api';
COMMENT ON COLUMN receipts.email_attachment_id IS 'Verknüpfung zum E-Mail-Anhang bei E-Mail-Importen';