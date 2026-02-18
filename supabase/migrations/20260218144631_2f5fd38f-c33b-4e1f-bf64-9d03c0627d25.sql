
-- Add auto_approved flag to receipts
ALTER TABLE public.receipts ADD COLUMN auto_approved boolean NOT NULL DEFAULT false;

-- Add auto-approve settings to vendors
ALTER TABLE public.vendors ADD COLUMN auto_approve boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendors ADD COLUMN auto_approve_min_confidence numeric NOT NULL DEFAULT 0.8;
