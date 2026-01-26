-- Neues Feld für Roh-Daten der Rechnungspositionen (für spätere Pro-Version)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS line_items_raw JSONB;

-- COMMENT für Dokumentation des Formats
COMMENT ON COLUMN receipts.line_items_raw IS 'Raw line items from receipt. Format: [{"description": "...", "quantity": 1, "unit_price": 10, "total": 10, "vat_rate": 20}]';

-- User-Einstellungen für Beschreibungs-Formatierung erweitern
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS description_settings JSONB DEFAULT '{
  "max_length": 100,
  "separator": ", ",
  "truncate_suffix": "...",
  "include_quantities": false
}'::jsonb;