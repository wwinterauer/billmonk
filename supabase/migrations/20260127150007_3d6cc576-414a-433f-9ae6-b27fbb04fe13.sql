-- Alten Constraint entfernen (falls vorhanden)
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_source_check;

-- Neuen Constraint mit 'camera' hinzufügen
ALTER TABLE receipts ADD CONSTRAINT receipts_source_check 
CHECK (source IN ('upload', 'email_webhook', 'email_imap', 'cloud', 'api', 'camera'));