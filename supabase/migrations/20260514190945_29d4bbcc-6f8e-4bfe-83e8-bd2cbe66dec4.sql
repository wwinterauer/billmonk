UPDATE public.receipts SET tax_type = NULL WHERE tax_type IS NOT NULL AND tax_type !~ '\([A-Z]{2}\)\s*$';
UPDATE public.vendors SET default_tax_type = NULL WHERE default_tax_type IS NOT NULL AND default_tax_type !~ '\([A-Z]{2}\)\s*$';
UPDATE public.category_rules SET tax_type_name = NULL, tax_type_match_count = 0 WHERE tax_type_name IS NOT NULL AND tax_type_name !~ '\([A-Z]{2}\)\s*$';