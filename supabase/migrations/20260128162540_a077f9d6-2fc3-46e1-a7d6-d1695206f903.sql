-- Neue Felder für PDF-Splitting
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS page_count INTEGER;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS split_suggestion JSONB;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS split_from_receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS original_pages INTEGER[];

-- Index für Split-Beziehungen
CREATE INDEX IF NOT EXISTS idx_receipts_split_from ON receipts(split_from_receipt_id) WHERE split_from_receipt_id IS NOT NULL;