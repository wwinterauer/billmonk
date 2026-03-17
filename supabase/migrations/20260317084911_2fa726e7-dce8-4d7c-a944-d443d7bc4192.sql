
-- Rename legal_name to legal_names and convert from text to text[]
-- First add new column
ALTER TABLE public.vendors ADD COLUMN legal_names text[] DEFAULT '{}'::text[];

-- Migrate existing data: if legal_name has a value, put it into the array
UPDATE public.vendors SET legal_names = ARRAY[legal_name] WHERE legal_name IS NOT NULL AND legal_name != '';

-- Drop old column
ALTER TABLE public.vendors DROP COLUMN legal_name;
