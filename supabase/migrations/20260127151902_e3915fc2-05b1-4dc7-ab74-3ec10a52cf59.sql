-- Erweitere den source Constraint um 'share'
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_source_check;
ALTER TABLE receipts ADD CONSTRAINT receipts_source_check 
CHECK (source IN ('upload', 'email_webhook', 'email_imap', 'cloud', 'api', 'camera', 'share'));