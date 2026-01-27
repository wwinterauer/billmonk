-- Add provider field to email_accounts
ALTER TABLE public.email_accounts 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'imap' 
CHECK (provider IN ('gmail', 'microsoft', 'icloud', 'imap'));