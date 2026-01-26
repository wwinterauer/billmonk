-- Add duplicate detection columns to receipts table
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES receipts(id);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS duplicate_score INTEGER;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS duplicate_checked_at TIMESTAMP WITH TIME ZONE;

-- Index for fast hash lookup
CREATE INDEX IF NOT EXISTS idx_receipts_file_hash ON receipts (user_id, file_hash) WHERE file_hash IS NOT NULL;

-- Index for duplicate queries
CREATE INDEX IF NOT EXISTS idx_receipts_duplicates ON receipts (user_id, is_duplicate) WHERE is_duplicate = true;