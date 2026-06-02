
-- 1. Block self-elevation on profiles (BEFORE UPDATE trigger)
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  caller_role text;
BEGIN
  -- Allow when there is no auth context (service role / triggers without JWT)
  caller_role := current_setting('request.jwt.claim.role', true);
  IF caller_role IS NULL OR caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow admins
  IF auth.uid() IS NOT NULL THEN
    SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
    IF is_admin THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Block any attempt to change privileged columns
  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.is_beta_user IS DISTINCT FROM OLD.is_beta_user
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.receipt_credit IS DISTINCT FROM OLD.receipt_credit
     OR NEW.document_credit IS DISTINCT FROM OLD.document_credit
     OR NEW.beta_expires_at IS DISTINCT FROM OLD.beta_expires_at
     OR NEW.admin_view_plan IS DISTINCT FROM OLD.admin_view_plan
     OR NEW.monthly_receipt_count IS DISTINCT FROM OLD.monthly_receipt_count
     OR NEW.monthly_document_count IS DISTINCT FROM OLD.monthly_document_count
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile columns'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privileged_profile_updates ON public.profiles;
CREATE TRIGGER trg_prevent_privileged_profile_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privileged_profile_updates();

-- 2. Beta codes lockdown: drop public SELECT, add validation RPC
DROP POLICY IF EXISTS "Anyone can validate beta codes" ON public.beta_codes;

CREATE OR REPLACE FUNCTION public.redeem_beta_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code beta_codes%ROWTYPE;
  v_user_id uuid;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_code');
  END IF;

  SELECT * INTO v_code
  FROM public.beta_codes
  WHERE code = trim(_code) AND is_active = true
  LIMIT 1;

  IF v_code.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_code');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'exhausted');
  END IF;

  UPDATE public.beta_codes
  SET used_count = used_count + 1
  WHERE id = v_code.id;

  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    -- Trigger is SECURITY DEFINER but this update runs under definer too,
    -- so we set fields directly. The trigger above bails out when admin
    -- or service_role — for normal users we still want this to succeed
    -- because the redemption itself is authorized by the valid code.
    -- We bypass the trigger by temporarily disabling session_replication_role.
    PERFORM set_config('session_replication_role', 'replica', true);
    UPDATE public.profiles
    SET is_beta_user = true,
        plan = 'business',
        subscription_status = 'active',
        beta_expires_at = now() + interval '180 days'
    WHERE id = v_user_id;
    PERFORM set_config('session_replication_role', 'origin', true);
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_beta_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_beta_code(text) TO anon, authenticated;

-- 3. Fix mutable search_path on pgmq helper functions
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
