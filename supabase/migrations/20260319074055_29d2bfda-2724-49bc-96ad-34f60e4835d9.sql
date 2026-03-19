
-- 1. New table: company_settings
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text,
  street text,
  zip text,
  city text,
  country text DEFAULT 'AT',
  uid_number text,
  company_register_court text,
  company_register_number text,
  phone text,
  email text,
  logo_path text,
  bank_name text,
  iban text,
  bic text,
  account_holder text,
  is_small_business boolean DEFAULT false,
  small_business_text text DEFAULT 'Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company_settings" ON public.company_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own company_settings" ON public.company_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own company_settings" ON public.company_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own company_settings" ON public.company_settings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. ALTER invoice_settings
ALTER TABLE public.invoice_settings
  ADD COLUMN IF NOT EXISTS default_discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_discount_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS layout_variant text DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS customer_number_prefix text DEFAULT 'KD',
  ADD COLUMN IF NOT EXISTS customer_number_format text DEFAULT '{prefix}-{seq}',
  ADD COLUMN IF NOT EXISTS next_customer_number integer DEFAULT 1;

-- 3. ALTER customers (shipping address)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS shipping_street text,
  ADD COLUMN IF NOT EXISTS shipping_zip text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_country text,
  ADD COLUMN IF NOT EXISTS has_different_shipping_address boolean DEFAULT false;

-- 4. ALTER invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS copied_from_id uuid,
  ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_address_mode text DEFAULT 'same',
  ADD COLUMN IF NOT EXISTS shipping_street text,
  ADD COLUMN IF NOT EXISTS shipping_zip text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_country text,
  ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'invoice';

-- 5. ALTER invoice_line_items
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS is_group_header boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_group_subtotal boolean DEFAULT false;

-- 6. Create company-logos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own company logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own company logos" ON storage.objects FOR SELECT USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own company logos" ON storage.objects FOR UPDATE USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own company logos" ON storage.objects FOR DELETE USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
