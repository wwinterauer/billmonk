## Ziel

In den Bank-Import-Schlagwörtern (Settings → "Buchungen ohne Rechnung") soll pro Schlagwort
1. eine **Steuerart (tax_type)** und
2. ein **Lieferant (vendor)**

hinterlegt werden können – inkl. der Möglichkeit, direkt im Dialog einen neuen Lieferanten anzulegen. Beim automatischen "Keine Rechnung"-Beleg im Bank-Import werden beide Werte übernommen.

## Änderungen

### 1. Datenbank (Migration)
`bank_import_keywords` erweitern:
- `tax_type text` (nullable)
- `vendor_id uuid` (nullable, kein FK – konsistent mit anderen Vendor-Referenzen über UUID)

Bestehende Daten bleiben unverändert (NULL = keine Voreinstellung).

### 2. Settings UI – `src/components/settings/BankImportKeywords.tsx`
- `BankKeyword`-Interface um `tax_type: string | null` und `vendor_id: string | null` ergänzen.
- `formData` um `tax_type` und `vendor_id` erweitern; in `resetForm` und `handleEdit` mitführen.
- Im Hinzufügen/Bearbeiten-Dialog **zwei neue Felder** ergänzen:
  - **Steuerart**: Select mit Optionen aus `useCategories().taxCategories`. Erste Option "Keine Voreinstellung" → speichert NULL.
  - **Lieferant**: `VendorAutocomplete` (`src/components/receipts/VendorAutocomplete.tsx`) verwenden. Auswahl eines bestehenden Lieferanten setzt `vendor_id` + Vendor-Name. Das Komponenten-eigene Inline-Anlegen erlaubt Neuanlage im selben Dialog.
- In der Tabelle zwei zusätzliche Spalten **Lieferant** und **Steuerart** rendern (Badge / Text, "—" wenn leer).
- `saveMutation`: `tax_type` und `vendor_id` mitschreiben (`|| null`).
- `createDefaultsMutation`: keine Vorbelegung von `tax_type`/`vendor_id`.

### 3. Bank-Import – `src/pages/BankImport.tsx`
Beim Anlegen des automatischen Receipts (aktuell ~Zeile 329):
- `tax_type: matchedKeyword.tax_type ?? null`
- `vendor_id: matchedKeyword.vendor_id ?? null`
- Falls `vendor_id` gesetzt ist: `vendor` mit dem Vendor-Namen aus der `vendors`-Tabelle vorbelegen (einmal pro Import laden, in einer Map cachen), sonst wie bisher `matchedKeyword.keyword`.

## Hinweise
- Keine Änderungen an `useBankImport.ts` (CSV-Parsing) nötig.
- Keine Änderung an Default-Schlagwörtern (Trigger `create_default_bank_keywords`).
- Nach der Migration aktualisiert sich `src/integrations/supabase/types.ts` automatisch; danach Code-Änderungen.
