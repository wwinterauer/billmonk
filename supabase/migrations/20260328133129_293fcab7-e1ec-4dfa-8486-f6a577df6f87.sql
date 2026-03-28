
-- 1. Create receipt_split_lines table
CREATE TABLE public.receipt_split_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  description text,
  category text,
  amount_gross numeric NOT NULL DEFAULT 0,
  amount_net numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  vat_amount numeric NOT NULL DEFAULT 0,
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.receipt_split_lines ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Users can view own split lines" ON public.receipt_split_lines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own split lines" ON public.receipt_split_lines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own split lines" ON public.receipt_split_lines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own split lines" ON public.receipt_split_lines FOR DELETE USING (auth.uid() = user_id);

-- 4. Add is_split_booking to receipts
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS is_split_booking boolean NOT NULL DEFAULT false;

-- 5. Add split_booking_enabled to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS split_booking_enabled boolean NOT NULL DEFAULT false;

-- 6. Index for fast lookup
CREATE INDEX idx_receipt_split_lines_receipt_id ON public.receipt_split_lines(receipt_id);
CREATE INDEX idx_receipt_split_lines_user_id ON public.receipt_split_lines(user_id);
