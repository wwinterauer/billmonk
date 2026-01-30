-- Create tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 50),
  color TEXT NOT NULL DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create receipt_tags junction table
CREATE TABLE public.receipt_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (receipt_id, tag_id)
);

-- Enable RLS on both tables
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags table
CREATE POLICY "Users can view own tags"
  ON public.tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags"
  ON public.tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
  ON public.tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
  ON public.tags FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for receipt_tags table (via join with receipts)
CREATE POLICY "Users can view own receipt tags"
  ON public.receipt_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts 
      WHERE receipts.id = receipt_tags.receipt_id 
      AND receipts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own receipt tags"
  ON public.receipt_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipts 
      WHERE receipts.id = receipt_tags.receipt_id 
      AND receipts.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.tags 
      WHERE tags.id = receipt_tags.tag_id 
      AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own receipt tags"
  ON public.receipt_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts 
      WHERE receipts.id = receipt_tags.receipt_id 
      AND receipts.user_id = auth.uid()
    )
  );

-- Indexes for tags table
CREATE INDEX idx_tags_user_id ON public.tags(user_id);
CREATE INDEX idx_tags_user_active ON public.tags(user_id, is_active);

-- Indexes for receipt_tags table
CREATE INDEX idx_receipt_tags_receipt_id ON public.receipt_tags(receipt_id);
CREATE INDEX idx_receipt_tags_tag_id ON public.receipt_tags(tag_id);

-- Trigger for updated_at on tags
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();