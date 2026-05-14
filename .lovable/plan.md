## Ziel

In den Lieferanten-Einstellungen soll zusätzlich zur Standard-Kategorie und Standard-MwSt auch eine **Standard-Buchungsart (Steuerart / tax_type)** hinterlegt werden können. Diese wird bei neuen Belegen dieses Lieferanten automatisch vorausgewählt — analog zur Logik bei Bank-Import-Keywords.

## Änderungen

### 1. Datenbank (Migration)
- Neue Spalte `default_tax_type text` (nullable) in `vendors` hinzufügen.

### 2. UI: `src/components/settings/VendorManagement.tsx`
- `formData` und `Vendor`-Typ um `default_tax_type` erweitern.
- Im Dialog (Anlegen + Bearbeiten) ein neues Select **"Standard-Buchungsart"** unterhalb von "Standard-MwSt-Satz" einfügen.
  - Werte stammen aus `useCategories().taxCategories` (gleich wie bei Bank-Import-Keywords).
  - Option "Keine Voreinstellung" als Default.
- Beim Speichern (`createVendor` / `updateVendor`) das Feld mitsenden.
- In der Lieferanten-Tabelle/Karte als kleines Badge anzeigen (optional, kompakt).

### 3. Hook: `src/hooks/useVendors.ts`
- `default_tax_type` in den Vendor-Typ und in `createVendor` / `updateVendor` Payloads aufnehmen.

### 4. Anwendung der Voreinstellung
Damit die Buchungsart bei neuen Belegen wirklich vorausgefüllt wird, an drei Stellen ergänzen — analog zu `default_category_id` / `default_vat_rate`:
- **`src/hooks/useReceiptProcessing.ts`**: in den 3 Stellen, wo `vendor.default_category_id` und `default_vat_rate` auf `updateData` gemappt werden, zusätzlich `tax_type` setzen wenn vom AI noch keiner extrahiert wurde.
- **`supabase/functions/extract-receipt/index.ts`**: in den `select(...)`-Statements `default_tax_type` mit auslesen und dort, wo Vendor-Defaults greifen, ebenfalls auf `tax_type` schreiben (nur wenn noch leer).

## Verhalten

- **Neuer Beleg von bekanntem Lieferant** → tax_type wird automatisch aus `vendor.default_tax_type` gesetzt, sofern AI keinen erkannt hat.
- **AI hat tax_type extrahiert** → AI-Wert hat Vorrang (Vendor-Default ist nur Fallback).
- **Manuell im Review änderbar** → bleibt unverändert.

## Hinweis

Das bestehende Field-Learning-System (`field_defaults` in vendors) lernt tax_type bereits implizit nach 3 Korrekturen pro Lieferant — die neue Spalte `default_tax_type` ist jedoch eine **explizite, vom User gepflegte Voreinstellung** und hat höhere Priorität als die gelernten Defaults.
