-- Migration: enhance_email_accounts_for_imap

-- Tracking des letzten synchronisierten E-Mails (UID)
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS last_synced_uid TEXT;

-- Filter: Nur bestimmte Absender
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS sender_filter TEXT[];

-- Filter: Betreff muss Keywords enthalten
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS subject_keywords TEXT[];

-- Zeitstempel für letzten Sync-Versuch (zusätzlich zu last_sync_at)
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS last_sync_attempt TIMESTAMPTZ;

-- Sync-Status Constraint aktualisieren (last_sync_status existiert bereits)
-- Erst prüfen ob constraint existiert, dann hinzufügen
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_accounts_sync_status_check'
  ) THEN 
    ALTER TABLE email_accounts 
    ADD CONSTRAINT email_accounts_sync_status_check 
    CHECK (last_sync_status IN ('pending', 'idle', 'running', 'syncing', 'success', 'partial', 'error'));
  END IF; 
END $$;

-- Index für schnelle Status-Abfragen
CREATE INDEX IF NOT EXISTS idx_email_accounts_sync_status 
ON email_accounts(last_sync_status) 
WHERE last_sync_status IN ('running', 'syncing');

-- Kommentare für Dokumentation
COMMENT ON COLUMN email_accounts.last_synced_uid IS 'UID der zuletzt synchronisierten E-Mail für inkrementelle Syncs';
COMMENT ON COLUMN email_accounts.sender_filter IS 'Optional: Array von E-Mail-Adressen die akzeptiert werden';
COMMENT ON COLUMN email_accounts.subject_keywords IS 'Optional: Array von Keywords die im Betreff vorkommen müssen';