-- Create table for IMAP email accounts
CREATE TABLE public.email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    display_name TEXT,
    
    -- IMAP settings
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_username TEXT NOT NULL,
    imap_password_encrypted TEXT NOT NULL,
    imap_use_ssl BOOLEAN DEFAULT true,
    
    -- Folder settings
    inbox_folder TEXT DEFAULT 'INBOX',
    processed_folder TEXT DEFAULT 'Processed',
    
    -- Sync settings
    sync_interval TEXT NOT NULL DEFAULT 'manual' CHECK (sync_interval IN ('5min', '15min', '30min', '1hour', 'manual')),
    is_active BOOLEAN DEFAULT true,
    
    -- Status tracking
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status TEXT DEFAULT 'pending',
    last_sync_error TEXT,
    total_imported INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    UNIQUE(user_id, email_address)
);

-- Enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own email accounts"
ON public.email_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email accounts"
ON public.email_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email accounts"
ON public.email_accounts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email accounts"
ON public.email_accounts FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_email_accounts_updated_at
BEFORE UPDATE ON public.email_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();