
-- Add new field_defaults columns to vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS field_defaults_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS field_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS field_suggestions_dismissed jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Migrate existing default_payment_method into field_defaults
UPDATE public.vendors
SET field_defaults = jsonb_build_object('payment_method', default_payment_method)
WHERE default_payment_method IS NOT NULL AND default_payment_method != '';

-- Drop the old column
ALTER TABLE public.vendors DROP COLUMN IF EXISTS default_payment_method;
