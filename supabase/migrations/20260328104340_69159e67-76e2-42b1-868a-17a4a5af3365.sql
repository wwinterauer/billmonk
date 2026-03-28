
-- Add country and tax_code columns to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS country text DEFAULT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tax_code text DEFAULT NULL;

-- Austrian tax categories (EAR-Kennzahlen)
INSERT INTO public.categories (name, icon, color, is_system, is_hidden, sort_order, country, tax_code) VALUES
  ('Bewirtung 50% (AT)', 'Utensils', '#F59E0B', true, true, 100, 'AT', 'KZ 9230'),
  ('Reisekosten (AT)', 'Plane', '#3B82F6', true, true, 101, 'AT', 'KZ 9200'),
  ('KFZ-Kosten (AT)', 'Car', '#6366F1', true, true, 102, 'AT', 'KZ 9160'),
  ('Büromaterial (AT)', 'Paperclip', '#10B981', true, true, 103, 'AT', 'KZ 9110'),
  ('Telefon & Internet (AT)', 'Phone', '#8B5CF6', true, true, 104, 'AT', 'KZ 9130'),
  ('Versicherungen (AT)', 'Shield', '#EC4899', true, true, 105, 'AT', 'KZ 9220'),
  ('Miete & Betriebskosten (AT)', 'Building', '#64748B', true, true, 106, 'AT', 'KZ 9100'),
  ('Werbung & Marketing (AT)', 'Megaphone', '#F97316', true, true, 107, 'AT', 'KZ 9140'),
  ('Rechts-/Beratungskosten (AT)', 'Briefcase', '#14B8A6', true, true, 108, 'AT', 'KZ 9150'),
  ('Fortbildung (AT)', 'Book', '#84CC16', true, true, 109, 'AT', 'KZ 9170'),
  ('Abschreibungen AfA (AT)', 'FileText', '#A855F7', true, true, 110, 'AT', 'KZ 9180'),
  ('Sozialversicherung SVS (AT)', 'Heart', '#EF4444', true, true, 111, 'AT', 'KZ 9225'),
  ('Kammerumlage WKO (AT)', 'Building', '#3B82F6', true, true, 112, 'AT', 'KZ 9226'),
  ('Bankgebühren (AT)', 'CreditCard', '#64748B', true, true, 113, 'AT', 'KZ 9210'),
  ('Geringwertige WG (AT)', 'Package', '#F59E0B', true, true, 114, 'AT', 'KZ 9185');

-- German tax categories (SKR03/SKR04)
INSERT INTO public.categories (name, icon, color, is_system, is_hidden, sort_order, country, tax_code) VALUES
  ('Bewirtung 70% (DE)', 'Utensils', '#F59E0B', true, true, 200, 'DE', 'SKR03: 4650 / SKR04: 6640'),
  ('Reisekosten (DE)', 'Plane', '#3B82F6', true, true, 201, 'DE', 'SKR03: 4660 / SKR04: 6650'),
  ('KFZ-Kosten (DE)', 'Car', '#6366F1', true, true, 202, 'DE', 'SKR03: 4510 / SKR04: 6520'),
  ('Bürobedarf (DE)', 'Paperclip', '#10B981', true, true, 203, 'DE', 'SKR03: 4930 / SKR04: 6815'),
  ('Telekommunikation (DE)', 'Phone', '#8B5CF6', true, true, 204, 'DE', 'SKR03: 4920 / SKR04: 6805'),
  ('Versicherungen (DE)', 'Shield', '#EC4899', true, true, 205, 'DE', 'SKR03: 4360 / SKR04: 6400'),
  ('Raumkosten/Miete (DE)', 'Building', '#64748B', true, true, 206, 'DE', 'SKR03: 4210 / SKR04: 6310'),
  ('Werbekosten (DE)', 'Megaphone', '#F97316', true, true, 207, 'DE', 'SKR03: 4600 / SKR04: 6600'),
  ('Rechts-/Beratungskosten (DE)', 'Briefcase', '#14B8A6', true, true, 208, 'DE', 'SKR03: 4950 / SKR04: 6825'),
  ('Fortbildungskosten (DE)', 'Book', '#84CC16', true, true, 209, 'DE', 'SKR03: 4945 / SKR04: 6821'),
  ('Abschreibungen AfA (DE)', 'FileText', '#A855F7', true, true, 210, 'DE', 'SKR03: 4830 / SKR04: 6220'),
  ('Geschenke §4 Abs.5 (DE)', 'Gift', '#EC4899', true, true, 211, 'DE', 'SKR03: 4630 / SKR04: 6620'),
  ('Geringwertige WG (DE)', 'Package', '#F59E0B', true, true, 212, 'DE', 'SKR03: 4855 / SKR04: 6260'),
  ('Leasingkosten (DE)', 'Car', '#6366F1', true, true, 213, 'DE', 'SKR03: 4570 / SKR04: 6560'),
  ('IHK-Beiträge (DE)', 'Building', '#3B82F6', true, true, 214, 'DE', 'SKR03: 4380 / SKR04: 6420');

-- Swiss tax categories (Kontenrahmen KMU)
INSERT INTO public.categories (name, icon, color, is_system, is_hidden, sort_order, country, tax_code) VALUES
  ('Geschäftsbewirtung (CH)', 'Utensils', '#F59E0B', true, true, 300, 'CH', 'KMU: 6640'),
  ('Reisekosten (CH)', 'Plane', '#3B82F6', true, true, 301, 'CH', 'KMU: 6530'),
  ('Fahrzeugkosten (CH)', 'Car', '#6366F1', true, true, 302, 'CH', 'KMU: 6200'),
  ('Büromaterial (CH)', 'Paperclip', '#10B981', true, true, 303, 'CH', 'KMU: 6500'),
  ('Telekommunikation (CH)', 'Phone', '#8B5CF6', true, true, 304, 'CH', 'KMU: 6510'),
  ('Versicherungsprämien (CH)', 'Shield', '#EC4899', true, true, 305, 'CH', 'KMU: 6300'),
  ('Mietaufwand (CH)', 'Building', '#64748B', true, true, 306, 'CH', 'KMU: 6000'),
  ('Werbeaufwand (CH)', 'Megaphone', '#F97316', true, true, 307, 'CH', 'KMU: 6600'),
  ('Beratungskosten (CH)', 'Briefcase', '#14B8A6', true, true, 308, 'CH', 'KMU: 6550'),
  ('Weiterbildung (CH)', 'Book', '#84CC16', true, true, 309, 'CH', 'KMU: 6540'),
  ('Abschreibungen (CH)', 'FileText', '#A855F7', true, true, 310, 'CH', 'KMU: 6800'),
  ('AHV/IV/EO-Beiträge (CH)', 'Heart', '#EF4444', true, true, 311, 'CH', 'KMU: 5700'),
  ('BVG-Beiträge (CH)', 'Heart', '#EC4899', true, true, 312, 'CH', 'KMU: 5720');
