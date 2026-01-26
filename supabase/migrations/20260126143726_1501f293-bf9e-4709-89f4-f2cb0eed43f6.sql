-- Add ai_processed_at timestamp to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.receipts.ai_processed_at IS 'Timestamp when AI last processed this receipt';