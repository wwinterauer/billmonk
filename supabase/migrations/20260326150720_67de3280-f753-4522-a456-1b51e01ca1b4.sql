
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_beta_user boolean NOT NULL DEFAULT false;
