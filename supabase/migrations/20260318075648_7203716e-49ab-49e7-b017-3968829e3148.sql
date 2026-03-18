
-- 1. Add category column to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Create invoice_tags join table
CREATE TABLE IF NOT EXISTS public.invoice_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (invoice_id, tag_id)
);

ALTER TABLE public.invoice_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice tags" ON public.invoice_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_tags.invoice_id AND invoices.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own invoice tags" ON public.invoice_tags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_tags.invoice_id AND invoices.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.tags WHERE tags.id = invoice_tags.tag_id AND tags.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own invoice tags" ON public.invoice_tags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_tags.invoice_id AND invoices.user_id = auth.uid())
  );

-- 3. Add template_type to export_templates
ALTER TABLE public.export_templates ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'receipts';

-- 4. Add backup_include_invoices to cloud_connections
ALTER TABLE public.cloud_connections ADD COLUMN IF NOT EXISTS backup_include_invoices BOOLEAN DEFAULT false;
