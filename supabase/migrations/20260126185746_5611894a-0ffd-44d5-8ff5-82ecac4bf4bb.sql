-- Export Templates table for customizable export layouts
CREATE TABLE public.export_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- Column configuration (JSON Array)
  columns JSONB NOT NULL DEFAULT '[]',
  
  -- Sorting
  sort_by TEXT,
  sort_direction TEXT DEFAULT 'asc',
  
  -- Grouping
  group_by TEXT,
  group_subtotals BOOLEAN DEFAULT true,
  
  -- Export options
  include_header BOOLEAN DEFAULT true,
  include_totals BOOLEAN DEFAULT true,
  date_format TEXT DEFAULT 'DD.MM.YYYY',
  number_format TEXT DEFAULT 'de-AT',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.export_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own templates"
  ON public.export_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON public.export_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON public.export_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON public.export_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_export_templates_updated_at
  BEFORE UPDATE ON public.export_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();