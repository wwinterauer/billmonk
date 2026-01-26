-- Add vendor_brand field to receipts table for brand/trade name
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS vendor_brand TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.receipts.vendor_brand IS 'Brand/trade name if different from legal company name (vendor)';