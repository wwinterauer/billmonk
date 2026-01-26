-- 1. Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Namen
  display_name TEXT NOT NULL,
  legal_name TEXT,
  detected_names TEXT[] DEFAULT '{}',
  
  -- Standards
  default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  default_vat_rate DECIMAL(4,2),
  
  -- Zusätzliche Infos
  notes TEXT,
  website TEXT,
  
  -- Statistik
  receipt_count INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, display_name)
);

-- 2. Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can view own vendors" 
ON vendors FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vendors" 
ON vendors FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vendors" 
ON vendors FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vendors" 
ON vendors FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Indexes for search
CREATE INDEX idx_vendors_detected_names ON vendors USING GIN (detected_names);
CREATE INDEX idx_vendors_display_name ON vendors (user_id, display_name);
CREATE INDEX idx_vendors_user_id ON vendors (user_id);

-- 5. Add vendor_id to receipts table
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_vendor_id ON receipts (vendor_id);

-- 6. Trigger for updated_at
CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();