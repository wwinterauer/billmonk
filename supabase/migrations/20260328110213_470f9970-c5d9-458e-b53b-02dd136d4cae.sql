-- Allow authenticated users to update is_hidden on system categories
CREATE POLICY "Users can toggle system category visibility"
ON public.categories
FOR UPDATE
TO authenticated
USING (is_system = true)
WITH CHECK (is_system = true);