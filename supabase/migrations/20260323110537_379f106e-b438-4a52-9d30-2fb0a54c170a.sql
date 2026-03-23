
-- Add images column to faqs
ALTER TABLE public.faqs ADD COLUMN images text[] DEFAULT '{}';

-- Create storage bucket for FAQ images
INSERT INTO storage.buckets (id, name, public) VALUES ('faq-images', 'faq-images', true);

-- Allow authenticated users to read FAQ images
CREATE POLICY "Anyone can read faq images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'faq-images');

-- Admins can upload FAQ images
CREATE POLICY "Admins can upload faq images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'faq-images' AND public.has_role(auth.uid(), 'admin'));

-- Admins can delete FAQ images
CREATE POLICY "Admins can delete faq images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'faq-images' AND public.has_role(auth.uid(), 'admin'));
