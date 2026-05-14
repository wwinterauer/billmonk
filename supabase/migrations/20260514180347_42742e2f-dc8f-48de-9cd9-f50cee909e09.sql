ALTER TABLE public.category_rules ADD COLUMN IF NOT EXISTS vendor_id uuid NULL;

-- Drop old unique constraint on (user_id, keyword) if it exists
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.category_rules'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.category_rules DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

-- Drop old unique indexes (non-constraint) on (user_id, keyword)
DROP INDEX IF EXISTS public.category_rules_user_id_keyword_key;
DROP INDEX IF EXISTS public.category_rules_user_keyword_idx;

-- New unique index treating NULL vendor_id as a distinct "global" bucket
CREATE UNIQUE INDEX IF NOT EXISTS category_rules_user_vendor_keyword_uniq
  ON public.category_rules (user_id, COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid), keyword);

CREATE INDEX IF NOT EXISTS category_rules_user_vendor_idx
  ON public.category_rules (user_id, vendor_id);