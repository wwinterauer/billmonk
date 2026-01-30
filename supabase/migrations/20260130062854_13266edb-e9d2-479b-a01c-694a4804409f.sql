-- Step 1: Update all tables to use gen_random_uuid() instead of uuid_generate_v4()
-- gen_random_uuid() is a built-in PostgreSQL function that doesn't require an extension

-- For bank_accounts table
ALTER TABLE public.bank_accounts 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- For bank_imports table
ALTER TABLE public.bank_imports 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- For bank_transactions table  
ALTER TABLE public.bank_transactions 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- For categories table
ALTER TABLE public.categories 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- For cloud_connections table
ALTER TABLE public.cloud_connections 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- For receipts table
ALTER TABLE public.receipts 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- For vendors table
ALTER TABLE public.vendors 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 2: Now we can safely drop the extension from public schema
DROP EXTENSION IF EXISTS "uuid-ossp";

-- Step 3: Recreate extension in the extensions schema (proper location)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;