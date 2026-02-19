

# Link zum Lieferanten aus Review und Einzelbelegerkennung

## Uebersicht

In der Review-Seite und im Beleg-Detail-Panel (Einzelbelegerkennung) wird neben dem Lieferanten-Feld ein kleiner Button eingefuegt, der direkt zur Lieferanten-Verwaltung springt und den betreffenden Lieferanten vorselektiert/hervorhebt.

## Aenderungen

### 1. VendorManagement: Deep-Link-Unterstuetzung (`src/components/settings/VendorManagement.tsx`)

- Beim Laden der Komponente wird ein URL-Parameter `vendorId` aus der URL gelesen (z.B. `/settings?tab=vendors&vendorId=abc-123`).
- Falls vorhanden: Der Suchfilter wird automatisch auf den `display_name` dieses Lieferanten gesetzt und der Edit-Dialog wird geoeffnet.
- Falls der Lieferant nicht in der Liste ist (z.B. durch Paginierung), wird er trotzdem gefunden und direkt bearbeitet.

### 2. Review-Seite: Link-Button (`src/pages/Review.tsx`)

- Neben dem "Lieferant (Markenname)"-Label wird ein kleiner Icon-Button (ExternalLink oder Settings-Icon) angezeigt, sofern der aktuelle Beleg eine `vendor_id` hat oder ein Lieferant per Name zugeordnet werden kann.
- Klick oeffnet `/settings?tab=vendors&vendorId=XYZ` in einem neuen Tab.
- Ist kein Lieferant verknuepft, wird der Button nicht angezeigt.

### 3. Beleg-Detail-Panel: Bestehenden Link verbessern (`src/components/receipts/ReceiptDetailPanel.tsx`)

- Der bereits vorhandene "Bearbeiten"-Button (Zeile 1179-1190) wird angepasst: Statt `/settings?tab=vendors` wird `/settings?tab=vendors&vendorId={selectedVendorId}` verwendet, damit direkt der richtige Lieferant geoeffnet wird.

## Technische Details

### URL-Schema

```text
/settings?tab=vendors&vendorId=<uuid>
```

### VendorManagement Deep-Link-Logik

```text
useEffect:
  1. Lese vendorId aus URLSearchParams
  2. Finde Lieferant in vendors-Liste (oder lade ihn per Supabase-Query)
  3. Oeffne den Edit-Dialog mit openEditDialog(vendor)
  4. Entferne vendorId aus URL (damit Reload nicht erneut triggert)
```

### Review-Seite: Button neben Label

Neben dem Label "Lieferant (Markenname)" wird ein kleiner Button eingefuegt:
- Bedingung: `currentReceipt.vendor_id` ist vorhanden
- Aktion: `window.open('/settings?tab=vendors&vendorId=' + currentReceipt.vendor_id, '_blank')`

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/settings/VendorManagement.tsx` | Deep-Link per `vendorId`-Parameter: Lieferant automatisch oeffnen |
| `src/pages/Review.tsx` | Link-Button neben Lieferant-Feld einfuegen |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Bestehenden "Bearbeiten"-Link um `vendorId` erweitern |

