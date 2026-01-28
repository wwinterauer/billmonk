-- Flag für gemischte Steuersätze
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS is_mixed_tax_rate BOOLEAN DEFAULT false;

-- Detail-Info zu den einzelnen Steuersätzen speichern
-- Format: [{"rate": 10, "net_amount": 50.00, "tax_amount": 5.00, "description": "Lebensmittel"}]
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS tax_rate_details JSONB;