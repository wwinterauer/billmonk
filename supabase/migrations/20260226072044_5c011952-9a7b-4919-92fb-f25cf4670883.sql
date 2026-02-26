
-- Revoke full SELECT and grant only non-sensitive columns for email_accounts
REVOKE SELECT ON TABLE public.email_accounts FROM authenticated;
GRANT SELECT (
  id, user_id, email_address, display_name, imap_host, imap_port, imap_use_ssl, imap_username,
  inbox_folder, processed_folder, sync_interval, is_active,
  last_sync_at, last_sync_attempt, last_sync_status, last_sync_error, last_synced_uid,
  total_imported, created_at, updated_at, provider, oauth_provider, oauth_scope,
  sender_filter, subject_keywords
) ON public.email_accounts TO authenticated;

-- Keep INSERT/UPDATE/DELETE unchanged (they need full access for writing tokens)
-- The RLS policies still enforce user_id ownership

-- Revoke full SELECT and grant only non-sensitive columns for cloud_connections
REVOKE SELECT ON TABLE public.cloud_connections FROM authenticated;
GRANT SELECT (
  id, user_id, provider, display_name, is_active, last_sync, created_at, updated_at,
  backup_enabled, backup_schedule_type, backup_weekday, backup_day_of_month,
  backup_time, backup_template_id, backup_include_files, backup_include_excel,
  backup_include_csv, backup_status_filter, backup_folder_id, backup_folder_path,
  backup_zip_pattern, backup_folder_structure, backup_file_prefix,
  next_backup_at, last_backup_at, last_backup_count, last_backup_error,
  folder_path
) ON public.cloud_connections TO authenticated;
