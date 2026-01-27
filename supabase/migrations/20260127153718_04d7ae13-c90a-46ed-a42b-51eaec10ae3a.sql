-- Add 'not_a_receipt' to valid status values
-- Note: There's no existing constraint, so we just need to ensure the column accepts the new value
-- The status column is a text field that accepts any value

-- Optional: Add a comment to document valid statuses
COMMENT ON COLUMN receipts.status IS 'Valid values: pending, processing, review, approved, rejected, error, not_a_receipt';