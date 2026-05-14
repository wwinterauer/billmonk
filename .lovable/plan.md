# Lieferanten-Felder im Review-Fenster angleichen

**Ist-Zustand** in `src/pages/Review.tsx` (Zeilen 966–1033):
- **Lieferant (Markenname)** und **Rechtlicher Firmenname** sind beide schlichte `Input`-Felder.
- Kein Dropdown, keine Sperre — auch wenn der Beleg bereits einem Lieferanten (`vendor_id`) zugeordnet ist.

Im Detail-Panel (`ReceiptDetailPanel.tsx`) ist es bereits richtig: Firmenname = `VendorAutocomplete`, Markenname = bei zugeordnetem Vendor read-only mit „Bearbeiten"-Button. Im Review-Fenster fehlt das.

## Umsetzung in `src/pages/Review.tsx`

### 1) Markenname-Feld bei zugeordnetem Vendor sperren
- Wenn `currentReceipt?.vendor_id` gesetzt ist → `Input` `readOnly` + `disabled`, dezenter `bg-muted/50`-Stil, plus „Bearbeiten"-Button rechts (öffnet `/settings?tab=vendors&vendorId=…`, wie im Detail-Panel).
- Sonst: bleibt das aktuelle freie `Input`.

### 2) Rechtlichen Firmennamen als Dropdown
- Das `Input` bei Zeile 1026–1032 durch die bestehende `VendorAutocomplete`-Komponente ersetzen.
- `value={formData.vendor}`, `vendorId={currentReceipt?.vendor_id || null}`.
- `onChange(value, id)`: setzt `formData.vendor = value` und (falls `id` null wird beim manuellen Tippen) löscht die Vendor-Bindung lokal in `formData` (kein direktes DB-Update; passiert beim „Speichern & Weiter").
- `onVendorSelect(vendorData)`: füllt automatisch
  - `formData.vendor` = primärer `legal_names[0]` (oder `display_name` als Fallback),
  - `formData.vendor_brand` = `display_name` (wenn unterschiedlich),
  - `vendor_id` lokal merken — dazu wird ein neues `selectedVendorId`-State eingeführt, das beim Speichern in `receipts.vendor_id` geschrieben wird.
  - Optional: wenn `default_category_id`/`default_vat_rate` vorhanden und Felder leer/Default → vorbelegen (analog Detail-Panel).
- Dadurch wird das Markenname-Feld sofort gesperrt (siehe 1), weil `vendor_id` jetzt gesetzt ist.

### 3) State + Save anpassen
- Neuer State: `const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)`. Initialisierung beim Receipt-Wechsel aus `receipt.vendor_id`.
- `handleSave`: in den `update()`-Aufruf zusätzlich `vendor_id: selectedVendorId` aufnehmen, ebenso `vendor_brand: formData.vendor_brand`.
- `currentReceipt?.vendor_id` für die Sperrlogik des Markenname-Felds durch `selectedVendorId` ersetzen, damit die Sperre sofort greift, ohne dass der Beleg neu geladen werden muss.

## Technische Details
- Geänderte Datei: nur `src/pages/Review.tsx`.
- Keine Änderungen an `VendorAutocomplete.tsx`, `ReceiptDetailPanel.tsx`, DB oder Edge Functions.
- Bestehende Lernlogik (`useCorrectionTracking`) bleibt unverändert — beim Speichern werden weiterhin `vendor` und `vendor_brand` aus `formData` getrackt.

OK, soll ich umsetzen?
