
-- Neue Spalten für erweiterte Backup-Konfiguration
ALTER TABLE public.cloud_connections 
  ADD COLUMN IF NOT EXISTS backup_include_excel boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS backup_include_csv boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS backup_zip_pattern text DEFAULT '{prefix}_{datum}_{zeit}',
  ADD COLUMN IF NOT EXISTS backup_folder_structure text DEFAULT 'flat';
