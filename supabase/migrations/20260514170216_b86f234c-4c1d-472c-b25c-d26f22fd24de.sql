-- 1. Move category -> tax_type for receipts where category is a removed system entry and tax_type is empty
UPDATE public.receipts r
SET tax_type = r.category, category = NULL
WHERE r.tax_type IS NULL
  AND r.category IN (
    SELECT name FROM public.categories WHERE is_system = true AND country IS NOT NULL
  );

-- 2. For receipts where tax_type already exists, just clear the bogus category
UPDATE public.receipts
SET category = NULL
WHERE category IN (
  SELECT name FROM public.categories WHERE is_system = true AND country IS NOT NULL
);

-- 3. Same logic for split lines (if table exists with these columns)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='receipt_split_lines' AND column_name='category'
  ) THEN
    UPDATE public.receipt_split_lines s
    SET tax_type = s.category, category = NULL
    WHERE s.tax_type IS NULL
      AND s.category IN (
        SELECT name FROM public.categories WHERE is_system = true AND country IS NOT NULL
      );

    UPDATE public.receipt_split_lines
    SET category = NULL
    WHERE category IN (
      SELECT name FROM public.categories WHERE is_system = true AND country IS NOT NULL
    );
  END IF;
END $$;

-- 4. Clean learning data
DELETE FROM public.category_rules
WHERE category_name IN (
  SELECT name FROM public.categories WHERE is_system = true AND country IS NOT NULL
);

UPDATE public.community_patterns
SET is_rejected = true
WHERE suggested_category IN (
  SELECT name FROM public.categories WHERE is_system = true AND country IS NOT NULL
);

-- 5. Vendor default_category_id pointing at removed entries -> null
UPDATE public.vendors
SET default_category_id = NULL
WHERE default_category_id IN (
  SELECT id FROM public.categories WHERE is_system = true AND country IS NOT NULL
);

-- 6. Finally, delete the country-suffixed system categories themselves
DELETE FROM public.categories
WHERE is_system = true AND country IS NOT NULL;