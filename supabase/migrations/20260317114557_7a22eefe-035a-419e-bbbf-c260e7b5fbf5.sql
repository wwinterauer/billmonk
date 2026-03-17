-- Phase 1a: Extend profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS street text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS zip text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS city text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'AT',
  ADD COLUMN IF NOT EXISTS phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS uid_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_credit integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_view_plan text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_end_date timestamp with time zone DEFAULT NULL;

-- Phase 1b: user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS: Users can view own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Phase 1d: Rollover function
CREATE OR REPLACE FUNCTION public.reset_monthly_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET
    receipt_credit = COALESCE(receipt_credit, 0) + GREATEST(0,
      CASE COALESCE(plan, 'free')
        WHEN 'starter' THEN 30
        WHEN 'pro' THEN 100
        WHEN 'business' THEN 250
        ELSE 10
      END - COALESCE(monthly_receipt_count, 0)
    ),
    monthly_receipt_count = 0;
END;
$$;