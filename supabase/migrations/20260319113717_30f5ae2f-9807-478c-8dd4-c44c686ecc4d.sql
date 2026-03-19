
-- 1. Create item_groups table
CREATE TABLE public.item_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.item_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own item_groups" ON public.item_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own item_groups" ON public.item_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own item_groups" ON public.item_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own item_groups" ON public.item_groups FOR DELETE USING (auth.uid() = user_id);

-- 2. Extend invoice_items
ALTER TABLE public.invoice_items ADD COLUMN icon text;
ALTER TABLE public.invoice_items ADD COLUMN image_path text;
ALTER TABLE public.invoice_items ADD COLUMN item_group_id uuid REFERENCES public.item_groups(id) ON DELETE SET NULL;

-- 3. Extend invoice_line_items
ALTER TABLE public.invoice_line_items ADD COLUMN image_path text;

-- 4. Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public) VALUES ('item-images', 'item-images', false);

-- 5. Storage RLS policies
CREATE POLICY "Users can upload item images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own item images" ON storage.objects FOR SELECT USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own item images" ON storage.objects FOR DELETE USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own item images" ON storage.objects FOR UPDATE USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
