-- Add CHECK constraint for last_sync_status
ALTER TABLE public.email_accounts 
DROP CONSTRAINT IF EXISTS email_accounts_last_sync_status_check;

ALTER TABLE public.email_accounts 
ADD CONSTRAINT email_accounts_last_sync_status_check 
CHECK (last_sync_status IN ('pending', 'running', 'success', 'error', 'partial'));