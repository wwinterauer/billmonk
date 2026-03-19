
-- Kunden: Rabatt, Skonto
ALTER TABLE public.customers ADD COLUMN default_discount_percent numeric DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN default_skonto_percent numeric DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN default_skonto_days integer DEFAULT 0;

-- Firmen-Standard-Rabatt + AB/LS-Präfixe
ALTER TABLE public.invoice_settings ADD COLUMN default_rabatt_percent numeric DEFAULT 0;
ALTER TABLE public.invoice_settings ADD COLUMN order_confirmation_prefix text DEFAULT 'AB';
ALTER TABLE public.invoice_settings ADD COLUMN delivery_note_prefix text DEFAULT 'LS';

-- Lieferzeiten + Rabatt auf Belegebene
ALTER TABLE public.invoices ADD COLUMN delivery_time text;
ALTER TABLE public.invoices ADD COLUMN rabatt_percent numeric DEFAULT 0;

-- Lieferzeit pro Position
ALTER TABLE public.invoice_line_items ADD COLUMN delivery_time text;

-- Lieferzeit-Template in Artikelstamm
ALTER TABLE public.invoice_items ADD COLUMN default_delivery_time text;

-- Teilzahlungen
ALTER TABLE public.invoices ADD COLUMN invoice_subtype text DEFAULT 'normal';
ALTER TABLE public.invoices ADD COLUMN related_order_id uuid REFERENCES public.invoices(id);
