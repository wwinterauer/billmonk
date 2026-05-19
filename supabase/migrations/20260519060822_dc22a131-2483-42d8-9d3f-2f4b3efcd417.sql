ALTER TABLE public.export_templates
ADD COLUMN IF NOT EXISTS group_order jsonb NOT NULL DEFAULT '{}'::jsonb;