
-- =====================================================
-- BillMonk Database Schema Setup
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
    monthly_receipt_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.profiles
    FOR DELETE USING (auth.uid() = id);

-- =====================================================
-- 2. CATEGORIES TABLE
-- =====================================================
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Users can view system categories AND their own categories
CREATE POLICY "Users can view system and own categories" ON public.categories
    FOR SELECT USING (is_system = true OR user_id = auth.uid());

CREATE POLICY "Users can insert own categories" ON public.categories
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own categories" ON public.categories
    FOR UPDATE USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own categories" ON public.categories
    FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- =====================================================
-- 3. BANK ACCOUNTS TABLE
-- =====================================================
CREATE TABLE public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    bank_name TEXT,
    account_name TEXT,
    iban TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts" ON public.bank_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank accounts" ON public.bank_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank accounts" ON public.bank_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank accounts" ON public.bank_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 4. BANK IMPORTS TABLE
-- =====================================================
CREATE TABLE public.bank_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    file_name TEXT,
    total_rows INTEGER,
    imported_rows INTEGER,
    skipped_rows INTEGER,
    date_from DATE,
    date_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.bank_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank imports" ON public.bank_imports
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank imports" ON public.bank_imports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank imports" ON public.bank_imports
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank imports" ON public.bank_imports
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 5. BANK TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    transaction_date DATE,
    value_date DATE,
    description TEXT,
    amount DECIMAL(10,2),
    is_expense BOOLEAN,
    status TEXT DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'ignored')),
    receipt_id UUID,
    import_batch_id UUID REFERENCES public.bank_imports(id) ON DELETE SET NULL,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank transactions" ON public.bank_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank transactions" ON public.bank_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank transactions" ON public.bank_transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank transactions" ON public.bank_transactions
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 6. RECEIPTS TABLE
-- =====================================================
CREATE TABLE public.receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'review', 'approved', 'rejected')),
    vendor TEXT,
    description TEXT,
    amount_gross DECIMAL(10,2),
    amount_net DECIMAL(10,2),
    vat_amount DECIMAL(10,2),
    vat_rate DECIMAL(4,2),
    currency TEXT DEFAULT 'EUR',
    receipt_date DATE,
    category TEXT,
    payment_method TEXT,
    notes TEXT,
    ai_confidence DECIMAL(3,2),
    ai_raw_response JSONB,
    bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own receipts" ON public.receipts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own receipts" ON public.receipts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own receipts" ON public.receipts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own receipts" ON public.receipts
    FOR DELETE USING (auth.uid() = user_id);

-- Add foreign key from bank_transactions to receipts
ALTER TABLE public.bank_transactions
    ADD CONSTRAINT fk_bank_transactions_receipt
    FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE SET NULL;

-- =====================================================
-- 7. CLOUD CONNECTIONS TABLE
-- =====================================================
CREATE TABLE public.cloud_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    provider TEXT CHECK (provider IN ('onedrive', 'google_drive', 'dropbox')),
    access_token TEXT,
    refresh_token TEXT,
    folder_path TEXT,
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.cloud_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cloud connections" ON public.cloud_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cloud connections" ON public.cloud_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cloud connections" ON public.cloud_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cloud connections" ON public.cloud_connections
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 8. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for receipts updated_at
CREATE TRIGGER update_receipts_updated_at
    BEFORE UPDATE ON public.receipts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on new user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to increment receipt count
CREATE OR REPLACE FUNCTION public.increment_receipt_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET monthly_receipt_count = monthly_receipt_count + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to increment receipt count on new receipt
CREATE TRIGGER on_receipt_created
    AFTER INSERT ON public.receipts
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_receipt_count();

-- =====================================================
-- 9. STORAGE BUCKETS
-- =====================================================

-- Create receipts bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Create bank-imports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bank-imports',
    'bank-imports',
    false,
    5242880, -- 5MB
    ARRAY['text/csv', 'application/csv', 'text/plain']
);

-- Storage policies for receipts bucket
CREATE POLICY "Users can upload own receipts"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'receipts' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own receipts"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'receipts' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own receipts"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'receipts' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own receipts"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'receipts' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for bank-imports bucket
CREATE POLICY "Users can upload own bank imports"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'bank-imports' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own bank imports"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'bank-imports' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own bank imports"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'bank-imports' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================
-- 10. SYSTEM CATEGORIES
-- =====================================================
INSERT INTO public.categories (name, icon, color, is_system, user_id) VALUES
    ('Büromaterial', 'Paperclip', '#3B82F6', true, NULL),
    ('Software & Lizenzen', 'Monitor', '#8B5CF6', true, NULL),
    ('Reisekosten', 'Plane', '#10B981', true, NULL),
    ('Bewirtung', 'Coffee', '#F59E0B', true, NULL),
    ('Telefon & Internet', 'Phone', '#EC4899', true, NULL),
    ('Versicherungen', 'Shield', '#6366F1', true, NULL),
    ('Miete & Betriebskosten', 'Building', '#64748B', true, NULL),
    ('Fahrzeugkosten', 'Car', '#EF4444', true, NULL),
    ('Werbung & Marketing', 'Megaphone', '#F97316', true, NULL),
    ('Sonstiges', 'MoreHorizontal', '#94A3B8', true, NULL);
