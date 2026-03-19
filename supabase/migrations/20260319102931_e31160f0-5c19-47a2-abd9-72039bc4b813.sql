
CREATE TABLE public.quote_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quote_number_prefix TEXT DEFAULT 'AG',
  quote_number_format TEXT DEFAULT '{prefix}-{year}-{seq}',
  next_sequence_number INTEGER DEFAULT 1,
  default_validity_days INTEGER DEFAULT 30,
  default_footer_text TEXT,
  default_notes TEXT,
  layout_variant TEXT DEFAULT 'classic',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT quote_settings_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.quote_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quote_settings" ON public.quote_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quote_settings" ON public.quote_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quote_settings" ON public.quote_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own quote_settings" ON public.quote_settings FOR DELETE USING (auth.uid() = user_id);
