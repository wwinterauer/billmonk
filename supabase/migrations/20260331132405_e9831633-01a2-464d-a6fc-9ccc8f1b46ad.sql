CREATE OR REPLACE FUNCTION public.get_vendor_stats(p_user_id uuid)
RETURNS TABLE(vendor_id uuid, receipt_count bigint, total_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.vendor_id, COUNT(*) AS receipt_count, COALESCE(SUM(r.amount_gross), 0) AS total_amount
  FROM public.receipts r
  WHERE r.user_id = p_user_id AND r.vendor_id IS NOT NULL
  GROUP BY r.vendor_id
$$;