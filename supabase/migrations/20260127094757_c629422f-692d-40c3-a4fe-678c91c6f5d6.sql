-- Create table for email import connections (unique email per user)
CREATE TABLE public.email_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    import_email TEXT NOT NULL UNIQUE,
    import_token TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_import_at TIMESTAMP WITH TIME ZONE,
    import_count INTEGER DEFAULT 0,
    UNIQUE(user_id)
);

-- Create table for email import logs
CREATE TABLE public.email_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_connection_id UUID NOT NULL REFERENCES public.email_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    from_address TEXT,
    subject TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'pending',
    attachments_count INTEGER DEFAULT 0,
    processed_receipts INTEGER DEFAULT 0,
    error_message TEXT,
    raw_data JSONB
);

-- Enable RLS
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_imports ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_connections
CREATE POLICY "Users can view own email connections"
ON public.email_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email connections"
ON public.email_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email connections"
ON public.email_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email connections"
ON public.email_connections FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for email_imports
CREATE POLICY "Users can view own email imports"
ON public.email_imports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email imports"
ON public.email_imports FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_email_connections_updated_at
BEFORE UPDATE ON public.email_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();