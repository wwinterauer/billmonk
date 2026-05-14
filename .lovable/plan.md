# Fix: "+ als neuen Lieferanten" legt tatsächlich einen Lieferanten an

## Problem
In `src/components/receipts/VendorAutocomplete.tsx` öffnet sich beim Tippen ein Dropdown mit dem Button **"„{name}" als neuen Lieferanten"** (Z. 305–317) sowie im Empty-State **"„{name}" verwenden"** (Z. 253–260). Beide Buttons rufen `handleUseCustomValue` (Z. 179–182) auf, das ausschließlich `onChange(vendorSearch, null)` ausführt — also nur das Inputfeld befüllt und `vendor_id` explizit auf `null` setzt.

Es wird **nie** ein Insert in die Tabelle `vendors` ausgeführt. Beim Speichern in `Review.tsx` (Z. 454) wird dann `vendor_id: selectedVendorId` (=null) am Beleg gespeichert, der Name landet nur als Freitext in `vendor_brand`. Daraus folgt: "Fertigputze Haslinger GmbH" existiert nirgends in `vendors`, taucht im Dropdown nicht wieder auf, hat keine Defaults, keine Statistik.

## Lösung — nur Frontend

### A) `src/services/vendorMatchingService.ts`
- `createVendorInternal` exportieren (aktuell `async function` ohne `export`, Z. 310). Umbenennen ist nicht nötig — einfach `export async function createVendorInternal(...)` setzen, damit das UI eine direkte, eindeutige "Neu anlegen"-Aktion hat (ohne Matching-Heuristik, die den Namen sonst wieder mit einem ähnlichen verbindet).

### B) `src/components/receipts/VendorAutocomplete.tsx`
1. Imports ergänzen: `useAuth` ist da, zusätzlich `createVendorInternal` aus `@/services/vendorMatchingService` und `useToast` aus `@/hooks/use-toast`.
2. Neuer Handler `handleCreateNewVendor()`:
   - Validiert Name (trim, min. 2 Zeichen).
   - Setzt lokales `isCreating`-State (Button-Disabled + Spinner-Text).
   - Ruft `createVendorInternal(user.id, name)` auf.
   - Bei Erfolg: 
     - `loadAllVendors()` neu laden, damit der neue Lieferant sofort im Dropdown auftaucht.
     - In das `VendorWithCategory`-Shape mappen (mit `receipt_count: 0`, `default_category: null`, `default_tag_id`/`field_defaults` optional auf null) und `onVendorSelect(newVendor)` aufrufen → das setzt im `Review` `selectedVendorId`, sodass beim Speichern `vendor_id` korrekt gesetzt wird.
     - Dropdown schließen, Suchfeld leeren.
     - `toast({ title: 'Lieferant angelegt' })`.
   - Bei Fehler: `toast({ variant: 'destructive', title: 'Anlegen fehlgeschlagen', description: error.message })` und Dropdown offen lassen.
3. Beide Buttons (Empty-State Z. 253 + Footer Z. 307) auf `handleCreateNewVendor` umstellen. Der bisherige Free-Text-Pfad „nur ins Inputfeld übernehmen" wird abgeschafft, da das genau die jetzige Lücke ist und der User explizit „neuen Lieferanten anlegen" erwartet.
4. Button-Label klarer: „`{vendorSearch}` als neuen Lieferanten anlegen" (mit "anlegen") und im Empty-State analog.

### C) Sicherheitsnetz
- Wenn `createVendorInternal` `null` zurückgibt (z.B. RLS-Fehler), Fehler-Toast mit „Bitte erneut versuchen" und Konsole-Log behalten.
- Edge: leerer Username → Button disabled.

## Nicht im Scope
- Keine DB-Migration, keine Änderung an RLS oder Schema.
- Kein Backfill für Belege, bei denen früher nur Freitext gespeichert wurde — der User legt diesen Lieferanten jetzt manuell sauber neu an.
- `Upload.tsx` nutzt bereits `createVendorForReceipt` korrekt — bleibt unverändert.

## Verifikation
- Build prüfen.
- Im Preview Review öffnen, im Lieferanten-Feld "Fertigputze Haslinger GmbH" tippen → "+ als neuen Lieferanten anlegen" klicken.
  - Erwartung: Toast „Lieferant angelegt", Eingabefeld zeigt den Namen, `vendor_id` ist gesetzt (Edit-Icon „Lieferanten bearbeiten" erscheint, Z. 1012–1024).
  - Beleg speichern → in DB: `receipts.vendor_id IS NOT NULL`, ein neuer Eintrag in `vendors` mit `display_name = 'Fertigputze Haslinger GmbH'` ist vorhanden.
  - Anderen Beleg öffnen → Lieferant erscheint im Dropdown.
