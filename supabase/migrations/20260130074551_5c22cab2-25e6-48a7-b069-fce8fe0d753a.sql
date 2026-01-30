-- Neue Felder für erweiterte MwSt-Erkennung
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vendor_country TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vat_confidence DECIMAL(3,2);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vat_detection_method TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS special_vat_case TEXT;

-- Kommentare für Dokumentation
COMMENT ON COLUMN receipts.vendor_country IS 'ISO-2 Ländercode des Rechnungsstellers (AT, DE, CH, IT, FR, etc.)';
COMMENT ON COLUMN receipts.vat_confidence IS 'Konfidenz der MwSt-Erkennung (0.00 - 1.00)';
COMMENT ON COLUMN receipts.vat_detection_method IS 'Erkennungsmethode: explicit, calculated, learned, estimated';
COMMENT ON COLUMN receipts.special_vat_case IS 'Sonderfall: kleinunternehmer, reverse_charge, ig_lieferung, export';