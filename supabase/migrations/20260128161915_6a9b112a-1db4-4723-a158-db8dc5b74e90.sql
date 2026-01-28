-- Erweitere vendor_learning um MwSt-Tracking
ALTER TABLE vendor_learning 
ADD COLUMN IF NOT EXISTS default_vat_rate DECIMAL(5,2);

ALTER TABLE vendor_learning 
ADD COLUMN IF NOT EXISTS vat_rate_confidence INTEGER DEFAULT 0;

ALTER TABLE vendor_learning 
ADD COLUMN IF NOT EXISTS vat_rate_corrections INTEGER DEFAULT 0;

-- Tabelle für mehrere MwSt-Sätze pro Vendor (z.B. Supermarkt hat 10% und 20%)
CREATE TABLE IF NOT EXISTS vendor_vat_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_learning_id UUID REFERENCES vendor_learning(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL,
  frequency INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_learning_id, vat_rate)
);

-- RLS für vendor_vat_rates
ALTER TABLE vendor_vat_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vat rates" 
ON vendor_vat_rates FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vat rates" 
ON vendor_vat_rates FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vat rates" 
ON vendor_vat_rates FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vat rates" 
ON vendor_vat_rates FOR DELETE 
USING (auth.uid() = user_id);

-- Füge vat_rate_source zu receipts hinzu
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS vat_rate_source TEXT DEFAULT 'ai';

-- Index für schnellere Lookups
CREATE INDEX IF NOT EXISTS idx_vendor_vat_rates_vendor_learning 
ON vendor_vat_rates(vendor_learning_id);

CREATE INDEX IF NOT EXISTS idx_vendor_learning_vat_rate 
ON vendor_learning(vendor_id, default_vat_rate) 
WHERE is_active = true;