-- Bestehende E-Mail-Imports nachträglich verknüpfen (über notes-Feld)
UPDATE receipts 
SET source = 'email_webhook' 
WHERE notes LIKE 'Importiert via E-Mail von %' 
  AND (source = 'upload' OR source IS NULL);