-- Drop existing delete policy
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

-- Create new delete policy that allows deleting:
-- 1. Own custom categories (user_id = auth.uid() AND is_system = false)
-- 2. System categories (is_system = true) - all authenticated users can delete these
CREATE POLICY "Users can delete categories" 
ON public.categories 
FOR DELETE 
TO authenticated
USING (
  (user_id = auth.uid() AND is_system = false) 
  OR is_system = true
);