-- Tabelle für benutzerdefinierte Import-Schlagwörter
CREATE TABLE IF NOT EXISTS public.bank_import_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  category TEXT,
  description_template TEXT,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, keyword)
);

-- Index für schnelle Suche
CREATE INDEX idx_bank_import_keywords_user ON public.bank_import_keywords(user_id, is_active);

-- RLS Policies
ALTER TABLE public.bank_import_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own keywords"
ON public.bank_import_keywords FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own keywords"
ON public.bank_import_keywords FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own keywords"
ON public.bank_import_keywords FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own keywords"
ON public.bank_import_keywords FOR DELETE
USING (auth.uid() = user_id);

-- Receipts-Tabelle erweitern für "ohne Rechnung" Einträge
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS is_no_receipt_entry BOOLEAN DEFAULT false;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS bank_import_keyword_id UUID REFERENCES public.bank_import_keywords(id) ON DELETE SET NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS bank_transaction_reference TEXT;

-- Source-Constraint erweitern um bank_import
ALTER TABLE public.receipts DROP CONSTRAINT IF EXISTS receipts_source_check;
ALTER TABLE public.receipts ADD CONSTRAINT receipts_source_check 
CHECK (source IN ('upload', 'email_webhook', 'email_imap', 'cloud', 'api', 'camera', 'share', 'split', 'bank_import'));

-- Funktion zum Erstellen von Default-Keywords für neue User
CREATE OR REPLACE FUNCTION public.create_default_bank_keywords()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.bank_import_keywords (user_id, keyword, category, description_template, tax_rate) VALUES
    (NEW.id, 'Kontoführung', 'Bankgebühren', 'Kontoführungsgebühr', 0),
    (NEW.id, 'Kontof', 'Bankgebühren', 'Kontoführungsgebühr', 0),
    (NEW.id, 'Kest', 'Steuern & Abgaben', 'Kapitalertragsteuer', 0),
    (NEW.id, 'Kapitalertragsteuer', 'Steuern & Abgaben', 'Kapitalertragsteuer', 0),
    (NEW.id, 'Zinsen', 'Bankgebühren', 'Sollzinsen', 0),
    (NEW.id, 'Überziehungszinsen', 'Bankgebühren', 'Überziehungszinsen', 0),
    (NEW.id, 'Generali', 'Versicherungen', 'Versicherung Generali', 0),
    (NEW.id, 'Uniqa', 'Versicherungen', 'Versicherung UNIQA', 0),
    (NEW.id, 'Allianz', 'Versicherungen', 'Versicherung Allianz', 0),
    (NEW.id, 'Wiener Städtische', 'Versicherungen', 'Versicherung Wiener Städtische', 0),
    (NEW.id, 'SVS', 'Sozialversicherung', 'Sozialversicherung SVS', 0),
    (NEW.id, 'Sozialversicherung', 'Sozialversicherung', 'Sozialversicherungsbeitrag', 0),
    (NEW.id, 'ÖGK', 'Sozialversicherung', 'Österreichische Gesundheitskasse', 0),
    (NEW.id, 'GIS', 'Betriebskosten', 'GIS Gebühr', 0),
    (NEW.id, 'Rundfunk', 'Betriebskosten', 'Rundfunkgebühr', 0)
  ON CONFLICT (user_id, keyword) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger für neue User (an profiles angehängt)
DROP TRIGGER IF EXISTS on_profile_created_add_bank_keywords ON public.profiles;
CREATE TRIGGER on_profile_created_add_bank_keywords
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_bank_keywords();