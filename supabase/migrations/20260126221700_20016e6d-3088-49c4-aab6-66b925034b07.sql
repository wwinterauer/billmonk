-- Table 1: vendor_learning (Learning data per vendor)
CREATE TABLE public.vendor_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  
  -- Learning status
  is_active BOOLEAN DEFAULT true,
  learning_level INTEGER DEFAULT 0,  -- 0=new, 1=learning, 2=trained, 3=reliable
  total_corrections INTEGER DEFAULT 0,
  successful_predictions INTEGER DEFAULT 0,
  confidence_boost INTEGER DEFAULT 0,  -- 0-25% additional confidence
  
  -- Learned field patterns (JSON)
  field_patterns JSONB DEFAULT '{}',
  
  -- Layout hints (for manual training, optional)
  layout_hints JSONB DEFAULT '{}',
  
  -- Statistics
  last_correction_at TIMESTAMP WITH TIME ZONE,
  last_successful_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, vendor_id)
);

-- Enable RLS
ALTER TABLE public.vendor_learning ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own learning data" ON public.vendor_learning
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own learning data" ON public.vendor_learning
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own learning data" ON public.vendor_learning
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own learning data" ON public.vendor_learning
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_vendor_learning_vendor ON public.vendor_learning (vendor_id);
CREATE INDEX idx_vendor_learning_user ON public.vendor_learning (user_id);
CREATE INDEX idx_vendor_learning_level ON public.vendor_learning (learning_level);

-- Trigger for updated_at
CREATE TRIGGER update_vendor_learning_updated_at
  BEFORE UPDATE ON public.vendor_learning
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table 2: field_corrections (Individual corrections)
CREATE TABLE public.field_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vendor_learning_id UUID REFERENCES public.vendor_learning(id) ON DELETE CASCADE NOT NULL,
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  
  -- Correction details
  field_name TEXT NOT NULL,  -- 'invoice_number', 'amount_gross', etc.
  detected_value TEXT,       -- What the AI detected
  corrected_value TEXT NOT NULL,  -- What the user corrected to
  
  -- Context (for pattern recognition)
  surrounding_text TEXT,     -- Text around the value (optional)
  
  -- Meta
  was_helpful BOOLEAN,       -- Was the correction later marked as helpful?
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.field_corrections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own corrections" ON public.field_corrections
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own corrections" ON public.field_corrections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own corrections" ON public.field_corrections
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own corrections" ON public.field_corrections
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for analysis
CREATE INDEX idx_field_corrections_vendor_learning ON public.field_corrections (vendor_learning_id);
CREATE INDEX idx_field_corrections_field ON public.field_corrections (field_name);
CREATE INDEX idx_field_corrections_created ON public.field_corrections (created_at DESC);
CREATE INDEX idx_field_corrections_receipt ON public.field_corrections (receipt_id);

-- Extend vendors table
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS learning_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS learning_level INTEGER DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS correction_count INTEGER DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS prediction_accuracy INTEGER;