
-- Allow admins to see ALL announcements (including inactive)
CREATE POLICY "Admins can view all announcements"
ON public.announcements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
