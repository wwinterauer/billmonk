-- 1. PROFILES: Restrict all policies to authenticated role only
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- 2. CATEGORIES: Restrict to authenticated only
DROP POLICY IF EXISTS "Users can view system and own categories" ON public.categories;
CREATE POLICY "Users can view system and own categories" ON public.categories
  FOR SELECT TO authenticated USING ((is_system = true) OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) AND (is_system = false));

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE TO authenticated USING ((auth.uid() = user_id) AND (is_system = false));

DROP POLICY IF EXISTS "Users can delete categories" ON public.categories;
CREATE POLICY "Users can delete categories" ON public.categories
  FOR DELETE TO authenticated USING ((user_id = auth.uid()) AND (is_system = false));

-- 3. EMAIL_IMPORTS: Add missing INSERT and UPDATE policies
CREATE POLICY "Users can insert own email imports" ON public.email_imports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email imports" ON public.email_imports
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own email imports" ON public.email_imports;
CREATE POLICY "Users can view own email imports" ON public.email_imports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own email imports" ON public.email_imports;
CREATE POLICY "Users can delete own email imports" ON public.email_imports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. EMAIL_ACCOUNTS: Restrict to authenticated
DROP POLICY IF EXISTS "Users can view own email accounts" ON public.email_accounts;
CREATE POLICY "Users can view own email accounts" ON public.email_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own email accounts" ON public.email_accounts;
CREATE POLICY "Users can insert own email accounts" ON public.email_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own email accounts" ON public.email_accounts;
CREATE POLICY "Users can update own email accounts" ON public.email_accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own email accounts" ON public.email_accounts;
CREATE POLICY "Users can delete own email accounts" ON public.email_accounts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);