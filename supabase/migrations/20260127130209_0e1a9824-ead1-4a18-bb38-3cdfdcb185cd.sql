-- Add OAuth support to email_accounts

-- OAuth Token Felder
ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS oauth_provider TEXT;

ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS oauth_access_token TEXT;

ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT;

ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS oauth_token_expires_at TIMESTAMPTZ;

ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS oauth_scope TEXT;

-- Constraint für Provider
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_accounts_oauth_provider_check'
  ) THEN 
    ALTER TABLE email_accounts 
    ADD CONSTRAINT email_accounts_oauth_provider_check 
    CHECK (oauth_provider IN ('gmail', 'microsoft', NULL));
  END IF;
END $$;

-- Index für Token-Refresh (finde Accounts mit ablaufenden Tokens)
CREATE INDEX IF NOT EXISTS idx_email_accounts_token_expiry 
ON email_accounts(oauth_token_expires_at) 
WHERE oauth_token_expires_at IS NOT NULL;

-- Temporäre OAuth States für CSRF-Schutz
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  state_token TEXT NOT NULL UNIQUE,
  redirect_after TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

-- Auto-Cleanup Index für abgelaufene States
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- RLS
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own oauth states" 
ON oauth_states 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);