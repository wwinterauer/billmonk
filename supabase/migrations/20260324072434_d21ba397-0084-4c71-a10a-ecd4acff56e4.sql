
-- Add images column to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN images TEXT[] DEFAULT '{}'::TEXT[];

-- Create storage bucket for support images
INSERT INTO storage.buckets (id, name, public) VALUES ('support-images', 'support-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload to their own folder
CREATE POLICY "Users can upload support images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can view their own images
CREATE POLICY "Users can view own support images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'support-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Admins can view all support images
CREATE POLICY "Admins can view all support images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'support-images' AND public.has_role(auth.uid(), 'admin'));
