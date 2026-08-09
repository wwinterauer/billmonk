# Lieferant fix als "Keine Rechnung" markieren

## Ziel

In den Lieferanteneinstellungen lässt sich pro Lieferant festlegen: Dokumente dieses Absenders sind grundsätzlich keine Rechnung. Neue Belege dieses Lieferanten landen dann automatisch als "Kein Beleg" (Status `not_a_receipt`, Kategorie "Keine Rechnung") und nicht mehr in der Review-Warteschlange.

## Was gebaut wird

1. **Neuer Schalter im Lieferanten-Dialog**
   Im Bereich "KI & Extraktion" ein Switch "Immer als 'Keine Rechnung' behandeln" mit Erklärtext: Belege dieses Lieferanten werden nicht als Ausgabe verbucht, sondern als Hilfsdokument abgelegt.

2. **Automatik bei der Verarbeitung**
   Erkennt die Extraktion den Lieferanten (über Markenname, rechtliche Namen oder erkannte Namen), wird der Beleg direkt als "Kein Beleg" gespeichert — mit Notiz "Regel: Lieferant ist als 'Keine Rechnung' hinterlegt". Auto-Freigabe und Ausgaben-Verbuchung entfallen für diese Belege.

3. **Rückholbar**
   Wie bisher bei Nicht-Belegen: über "Doch als Rechnung behandeln" (Force-Retry) wird die Regel für den einzelnen Beleg übergangen.

4. **Kennzeichnung in der Lieferantenliste**
   Kleines Badge "Keine Rechnung" beim Lieferanten, damit die Regel sichtbar ist.

Bestehende, bereits verarbeitete Belege werden nicht rückwirkend geändert.

## Technische Details

- Migration: `vendors.always_not_a_receipt boolean not null default false`.
- `src/hooks/useVendors.ts`: Feld in `Vendor`-Interface, Mapping und `updateVendor`-Whitelist ergänzen.
- `src/components/settings/VendorManagement.tsx`: Switch im Extraktions-Block, `formData`-Default, Speichern und Badge in der Tabelle.
- `supabase/functions/extract-receipt/index.ts`: nach `matchVendor(...)` (ca. Zeile 1237) prüfen; bei gesetztem Flag und ohne `forceTreatAsReceipt` denselben Update-Pfad wie der bestehende `is_receipt === false`-Zweig (Zeile ~1173) verwenden — Status `not_a_receipt`, Kategorie `Keine Rechnung`, `vendor_id` setzen — und früh zurückgeben, bevor Auto-Approve läuft. Zusätzlich Vendor-Match vor der KI-Extraktion nicht nötig, da der Lieferantenname erst aus der Extraktion kommt.
