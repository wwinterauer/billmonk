
-- 1. customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  company_name text,
  contact_person text,
  email text,
  phone text,
  street text,
  zip text,
  city text,
  country text DEFAULT 'AT',
  uid_number text,
  customer_number text,
  payment_terms_days integer DEFAULT 14,
  default_currency text DEFAULT 'EUR',
  notes text,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own customers" ON public.customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON public.customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON public.customers FOR DELETE USING (auth.uid() = user_id);

-- 2. invoice_items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  unit text DEFAULT 'Stk',
  unit_price numeric DEFAULT 0,
  vat_rate numeric DEFAULT 20,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own invoice_items" ON public.invoice_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoice_items" ON public.invoice_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoice_items" ON public.invoice_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoice_items" ON public.invoice_items FOR DELETE USING (auth.uid() = user_id);

-- 3. recurring_invoices (before invoices, as invoices references it)
CREATE TABLE public.recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  template_line_items jsonb DEFAULT '[]'::jsonb,
  interval text NOT NULL DEFAULT 'monthly',
  next_invoice_date date,
  last_generated_at timestamptz,
  auto_send boolean DEFAULT false,
  is_active boolean DEFAULT true,
  notes text,
  footer_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recurring_invoices" ON public.recurring_invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring_invoices" ON public.recurring_invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring_invoices" ON public.recurring_invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring_invoices" ON public.recurring_invoices FOR DELETE USING (auth.uid() = user_id);

-- 4. invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  status text DEFAULT 'draft',
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  paid_at timestamptz,
  subtotal numeric DEFAULT 0,
  vat_total numeric DEFAULT 0,
  total numeric DEFAULT 0,
  currency text DEFAULT 'EUR',
  notes text,
  footer_text text,
  payment_reference text,
  recurring_invoice_id uuid REFERENCES public.recurring_invoices(id) ON DELETE SET NULL,
  credit_note_for uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  pdf_storage_path text,
  sent_at timestamptz,
  sent_to_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

-- 5. invoice_line_items
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  invoice_item_id uuid REFERENCES public.invoice_items(id) ON DELETE SET NULL,
  position integer DEFAULT 1,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'Stk',
  unit_price numeric DEFAULT 0,
  vat_rate numeric DEFAULT 20,
  line_total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
-- RLS via invoice ownership
CREATE POLICY "Users can view own invoice_line_items" ON public.invoice_line_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid())
);
CREATE POLICY "Users can insert own invoice_line_items" ON public.invoice_line_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid())
);
CREATE POLICY "Users can update own invoice_line_items" ON public.invoice_line_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid())
);
CREATE POLICY "Users can delete own invoice_line_items" ON public.invoice_line_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid())
);

-- 6. invoice_settings
CREATE TABLE public.invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  invoice_number_prefix text DEFAULT 'RE',
  invoice_number_format text DEFAULT '{prefix}-{year}-{seq}',
  next_sequence_number integer DEFAULT 1,
  default_payment_terms_days integer DEFAULT 14,
  default_footer_text text,
  default_notes text,
  company_logo_path text,
  bank_name text,
  iban text,
  bic text,
  auto_send_enabled boolean DEFAULT false,
  send_copy_to_self boolean DEFAULT true,
  overdue_reminder_enabled boolean DEFAULT false,
  overdue_reminder_days integer DEFAULT 7,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own invoice_settings" ON public.invoice_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoice_settings" ON public.invoice_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoice_settings" ON public.invoice_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoice_settings" ON public.invoice_settings FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for invoices
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);

-- Storage RLS for invoices bucket
CREATE POLICY "Users can upload invoice files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own invoice files" ON storage.objects FOR SELECT USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own invoice files" ON storage.objects FOR DELETE USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
