-- Add new columns to categories table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Insert default system categories (only if they don't exist)
INSERT INTO public.categories (name, color, icon, is_system, sort_order) VALUES
  ('Büromaterial', '#3B82F6', 'Paperclip', true, 1),
  ('Software & Lizenzen', '#8B5CF6', 'Monitor', true, 2),
  ('Reisekosten', '#10B981', 'Plane', true, 3),
  ('Bewirtung', '#F59E0B', 'Coffee', true, 4),
  ('Telefon & Internet', '#EC4899', 'Phone', true, 5),
  ('Versicherungen', '#6366F1', 'Shield', true, 6),
  ('Miete & Betriebskosten', '#64748B', 'Building', true, 7),
  ('Fahrzeugkosten', '#EF4444', 'Car', true, 8),
  ('Werbung & Marketing', '#F97316', 'Megaphone', true, 9),
  ('Sonstiges', '#94A3B8', 'MoreHorizontal', true, 10)
ON CONFLICT DO NOTHING;