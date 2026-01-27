-- Create table for individual email attachments tracking
CREATE TABLE public.email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_connection_id UUID NOT NULL REFERENCES public.email_connections(id) ON DELETE CASCADE,
    email_import_id UUID REFERENCES public.email_imports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Email info
    email_message_id TEXT,
    email_subject TEXT,
    email_from TEXT,
    email_received_at TIMESTAMPTZ,
    
    -- Attachment info
    attachment_filename TEXT NOT NULL,
    attachment_content_type TEXT,
    attachment_size INTEGER,
    
    -- Processing status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'imported', 'skipped', 'error', 'duplicate')),
    error_message TEXT,
    
    -- Link to created receipt
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
    
    -- Duplicate detection
    file_hash TEXT,
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES public.email_attachments(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    
    -- Storage path
    storage_path TEXT
);

-- Enable RLS
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own email attachments"
ON public.email_attachments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email attachments"
ON public.email_attachments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email attachments"
ON public.email_attachments FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_email_attachments_user_status ON public.email_attachments(user_id, status);
CREATE INDEX idx_email_attachments_connection ON public.email_attachments(email_connection_id);
CREATE INDEX idx_email_attachments_hash ON public.email_attachments(file_hash) WHERE file_hash IS NOT NULL;