-- Add column to track which fields were manually modified by user
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_modified_fields TEXT[] DEFAULT '{}';