
-- Add document count columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS monthly_document_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS document_credit integer NOT NULL DEFAULT 0;

-- Create trigger function to increment document count on invoice insert
CREATE OR REPLACE FUNCTION public.increment_document_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.profiles
    SET monthly_document_count = monthly_document_count + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;

-- Create the trigger on invoices table
CREATE TRIGGER on_invoice_created
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_document_count();

-- Update reset_monthly_credits to also handle document credits
CREATE OR REPLACE FUNCTION public.reset_monthly_credits()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles SET
    receipt_credit = COALESCE(receipt_credit, 0) + GREATEST(0,
      CASE COALESCE(plan, 'free')
        WHEN 'starter' THEN 30
        WHEN 'pro' THEN 100
        WHEN 'business' THEN 250
        ELSE 10
      END - COALESCE(monthly_receipt_count, 0)
    ),
    monthly_receipt_count = 0,
    document_credit = COALESCE(document_credit, 0) + GREATEST(0,
      CASE COALESCE(plan, 'free')
        WHEN 'business' THEN 250
        ELSE 0
      END - COALESCE(monthly_document_count, 0)
    ),
    monthly_document_count = 0;
END;
$$;
