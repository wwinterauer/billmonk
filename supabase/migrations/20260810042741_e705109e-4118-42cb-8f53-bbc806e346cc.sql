ALTER TABLE public.export_templates
  ADD COLUMN IF NOT EXISTS tag_filter jsonb NOT NULL DEFAULT '{}'::jsonb;