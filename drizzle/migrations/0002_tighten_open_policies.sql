DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Signed-in users insert own page views" ON public.page_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated can read learning settings" ON public.platform_learning_settings;
DROP POLICY IF EXISTS "Authenticated users can read prompt versions" ON public.prompt_versions;
CREATE POLICY "Admins can read prompt versions" ON public.prompt_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read faq images" ON storage.objects;
CREATE POLICY "Admins can list faq images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'faq-images' AND public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Users can list own avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND owner_id = (select auth.uid()::text));