# Tags im Export sichtbar machen

## Problem
Im Excel/CSV/PDF-Export bleibt die Spalte "Tags" leer, obwohl sie im Template aktiviert ist. Grund:
- `ExportFormatDialog` bekommt `receipts` von `Expenses.tsx` **ohne** angehängte Tags (Tags liegen separat in `receiptTagsCache`).
- `getReceiptValue` in `ExportFormatDialog.tsx` kennt das Feld `tags` nicht und liefert daher `undefined`.

## Fix

### 1. Tags in `prepareExportData` nachladen (`src/components/exports/ExportFormatDialog.tsx`)
Analog zu den Split-Lines: einmalig alle `receipt_tags` für die zu exportierenden Receipts laden und als `tags: [{name, color}]` an jedes Receipt anhängen, bevor die Zeilen erzeugt werden. Bei Split-Expansion werden die Tags durch `...receipt`-Spread automatisch mitkopiert (jede Split-Zeile bekommt dieselben Tags wie die Hauptbuchung – konsistent mit der bisherigen Logik).

### 2. `getReceiptValue` um `tags`-Case erweitern
```ts
case 'tags': {
  const tags = (receipt as any).tags as Array<{ name: string }> | undefined;
  return tags && tags.length > 0 ? tags.map(t => t.name).join('; ') : '';
}
```
Trennzeichen `; ` wie vom Nutzer gewünscht (sicher für CSV mit `;`-Delimiter, da Werte ohnehin in `"…"` gequotet werden).

## Nicht betroffen
- ZIP-Export (keine Spaltenlogik)
- Template-Editor / Preview (`useExportPreview.ts` macht das bereits korrekt mit `, `) – optional auf `; ` angleichen für Konsistenz.

## Frage
Soll ich die Preview auch von `, ` auf `; ` umstellen, damit Vorschau und Export identisch aussehen?
