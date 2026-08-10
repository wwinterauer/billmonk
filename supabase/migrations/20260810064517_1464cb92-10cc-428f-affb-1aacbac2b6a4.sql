-- 1) profiles: harden privileged-column trigger (previous role check could be NULL and silently allow)
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
BEGIN
  -- No end-user JWT context (service role / internal triggers / cron): allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.is_beta_user IS DISTINCT FROM OLD.is_beta_user
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_end_date IS DISTINCT FROM OLD.subscription_end_date
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_product_id IS DISTINCT FROM OLD.stripe_product_id
     OR NEW.receipt_credit IS DISTINCT FROM OLD.receipt_credit
     OR NEW.document_credit IS DISTINCT FROM OLD.document_credit
     OR NEW.beta_expires_at IS DISTINCT FROM OLD.beta_expires_at
     OR NEW.monthly_receipt_count IS DISTINCT FROM OLD.monthly_receipt_count
     OR NEW.monthly_document_count IS DISTINCT FROM OLD.monthly_document_count
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile columns'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- redeem_beta_code sets privileged columns itself; keep it working by marking the session
CREATE OR REPLACE FUNCTION public.redeem_beta_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    PERFORM set_config('app.privileged_profile_update', 'on', true);
    UPDATE public.profiles
    SET is_beta_user = true,
        plan = 'business',
        subscription_status = 'active',
        beta_expires_at = now() + interval '180 days'
    WHERE id = v_user_id;
    PERFORM set_config('app.privileged_profile_update', 'off', true);
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$function$;

-- teach the guard about that escape hatch
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(current_setting('app.privileged_profile_update', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.is_beta_user IS DISTINCT FROM OLD.is_beta_user
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_end_date IS DISTINCT FROM OLD.subscription_end_date
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_product_id IS DISTINCT FROM OLD.stripe_product_id
     OR NEW.receipt_credit IS DISTINCT FROM OLD.receipt_credit
     OR NEW.document_credit IS DISTINCT FROM OLD.document_credit
     OR NEW.beta_expires_at IS DISTINCT FROM OLD.beta_expires_at
     OR NEW.monthly_receipt_count IS DISTINCT FROM OLD.monthly_receipt_count
     OR NEW.monthly_document_count IS DISTINCT FROM OLD.monthly_document_count
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile columns'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- also add an explicit WITH CHECK on the profiles UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2) categories: drop the policy allowing edits of shared system rows
DROP POLICY IF EXISTS "Users can toggle system category visibility" ON public.categories;

-- 3) cross-user foreign key linkage checks
DROP POLICY IF EXISTS "Users can insert own bank transactions" ON public.bank_transactions;
CREATE POLICY "Users can insert own bank transactions"
ON public.bank_transactions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (receipt_id IS NULL OR EXISTS (
    SELECT 1 FROM public.receipts r WHERE r.id = receipt_id AND r.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Users can update own bank transactions" ON public.bank_transactions;
CREATE POLICY "Users can update own bank transactions"
ON public.bank_transactions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (receipt_id IS NULL OR EXISTS (
    SELECT 1 FROM public.receipts r WHERE r.id = receipt_id AND r.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Users can insert own receipts" ON public.receipts;
CREATE POLICY "Users can insert own receipts"
ON public.receipts FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (bank_transaction_id IS NULL OR EXISTS (
    SELECT 1 FROM public.bank_transactions bt WHERE bt.id = bank_transaction_id AND bt.user_id = auth.uid()
  ))
  AND (vendor_id IS NULL OR EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Users can update own receipts" ON public.receipts;
CREATE POLICY "Users can update own receipts"
ON public.receipts FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (bank_transaction_id IS NULL OR EXISTS (
    SELECT 1 FROM public.bank_transactions bt WHERE bt.id = bank_transaction_id AND bt.user_id = auth.uid()
  ))
  AND (vendor_id IS NULL OR EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()
  ))
);

-- 4) hide credential columns from client roles (column-level SELECT grants)
REVOKE SELECT ON public.email_accounts FROM anon, authenticated;
GRANT SELECT (
  id, user_id, email_address, display_name, imap_host, imap_port, imap_username,
  imap_use_ssl, inbox_folder, processed_folder, sync_interval, is_active,
  last_sync_at, last_sync_status, last_sync_error, total_imported, created_at,
  updated_at, provider, last_synced_uid, sender_filter, subject_keywords,
  last_sync_attempt, oauth_provider, oauth_token_expires_at, oauth_scope
) ON public.email_accounts TO authenticated;

REVOKE SELECT ON public.cloud_connections FROM anon, authenticated;
GRANT SELECT (
  id, user_id, provider, folder_path, is_active, last_sync, created_at, display_name,
  oauth_token_expires_at, backup_enabled, backup_folder_id, backup_folder_path,
  backup_schedule_type, backup_weekday, backup_day_of_month, backup_time,
  backup_template_id, backup_include_files, backup_file_prefix, backup_status_filter,
  next_backup_at, last_backup_at, last_backup_count, last_backup_error, updated_at,
  backup_include_excel, backup_include_csv, backup_zip_pattern, backup_folder_structure,
  backup_include_invoices
) ON public.cloud_connections TO authenticated;

GRANT ALL ON public.email_accounts TO service_role;
GRANT ALL ON public.cloud_connections TO service_role;

-- 5) revoke EXECUTE on internal SECURITY DEFINER routines from client roles
REVOKE ALL ON FUNCTION public.create_default_bank_keywords() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_document_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_receipt_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_new_registration() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_plan_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_receipt_upload() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_privileged_profile_updates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_welcome_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_monthly_credits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_vendor_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_checklist(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_beta_code(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_vendor_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_checklist(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_beta_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;