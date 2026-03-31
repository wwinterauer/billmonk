ALTER TABLE public.category_rules 
  ADD COLUMN IF NOT EXISTS tax_type_name text,
  ADD COLUMN IF NOT EXISTS tax_type_match_count integer NOT NULL DEFAULT 0;