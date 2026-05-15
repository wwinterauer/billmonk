## Idee bestätigt — so setzen wir's um

Beide Felder werden zu Dropdowns mit Auto-Verheiratung beim Speichern.

### 1. Markenname → Combobox (statt Input)
In `src/pages/Review.tsx` (Zeilen 1076–1084):
- `<Input>` ersetzen durch eine neue `<VendorBrandAutocomplete>`-Komponente (analog zu `VendorAutocomplete`, aber liefert `display_name` statt `legal_names[0]`).
- Liste: alle Vendors des Users, gruppiert nach `display_name`.
- Suche/Tippen erlaubt; "Neue Marke '<X>' anlegen" als letzter Eintrag.
- `readOnly`/`disabled` entfällt → Marke ist immer wechselbar.

### 2. Rechtsname-Dropdown bleibt wie heute
`VendorAutocomplete` zeigt bereits alle Vendors mit ihren legal_names. Kleine Ergänzung: freier Text wird akzeptiert (kein Zwang sofort einen Vendor zu wählen) — er wird nur in `formData.vendor` gespeichert.

### 3. „Verheiraten" beim Freigeben/Speichern
Im `handleSave` von Review.tsx vor dem Receipt-Update folgende Logik einfügen:

```text
brand   = formData.vendor_brand (string)
legal   = formData.vendor (string)
selVid  = selectedVendorId

Fall A: brand gesetzt, selVid leer
  → finde Vendor mit display_name = brand (case-insensitive)
  → existiert? selVid = dessen id
  → existiert nicht? lege neuen Vendor an (display_name=brand, legal_names=[legal])

Fall B: brand gesetzt, selVid gesetzt, aber Vendor.display_name ≠ brand
  → Marke wurde gewechselt: setze selVid auf den neuen Brand-Vendor
    (anlegen falls nicht vorhanden)

Fall C: legal nicht in Vendor.legal_names
  → array_append(legal_names, legal) am Vendor → „verheiratet"
  → Dedupe case-insensitive
```

Receipt bekommt am Ende: `vendor_id = selVid`, `vendor = legal`, `vendor_brand = brand`.

### 4. Was bereits passt (kein Change)
- DB-Schema (`vendors.legal_names text[]`, `vendors.display_name`) — unverändert.
- Export verwendet schon `receipt.vendor` (Rechtsname) als „Lieferant"-Spalte.
- `handleVendorSelect` (wenn man einen Rechtsnamen eines bestehenden Vendors wählt) füllt `vendor_brand` schon korrekt mit `display_name`.

### Out of Scope
- Vendor-Settings UI, Auto-Approve, extract-receipt Edge Function, Export-Templates.

### Edge Cases
- Brand leer + Legal gesetzt: kein Vendor anlegen, nur `vendor` in receipt schreiben (heutiges Verhalten).
- Brand-Wechsel: Receipt-Hinweis-Toast „Mit Marke 'Amazon' verknüpft, 'XY GmbH' wurde als Händler hinzugefügt."
- Race-Schutz: Brand-Lookup case-insensitive `ilike` + bei Konflikt vorhandenen Vendor wiederverwenden.
