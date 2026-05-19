## Ziel
Beim Export der Ausgaben (Excel/CSV) sollen alle Tags in der `tags`-Spalte strikt alphabetisch sortiert ausgegeben werden. Dadurch bleibt die Reihenfolge bei gleicher Tag-Kombination über alle Buchungszeilen identisch – essenziell für späteres Filtern/Gruppieren in Excel.

## Änderung

### `src/components/exports/ExportFormatDialog.tsx`

In der `getFieldValue`-Funktion, Case `'tags'` (Zeile 494–497):

```text
BEFORE:
tags.map(t => t.name).join('; ')

AFTER:
tags.map(t => t.name).sort((a, b) => a.localeCompare(b, 'de')).join('; ')
```

- Sortierung erfolgt über `localeCompare('de')` für korrekte deutsche Alphabetisierung (Umlaute etc.).
- Betrifft sowohl normale Belege als auch Split-Buchungszeilen, da beide denselben `case 'tags'`-Codepfad durchlaufen.

## Nicht betroffen
- `TaxExportDialog.tsx` / `taxExportFormats.ts` – diese Formate (DATEV, BMD) exportieren keine Tag-Spalte.
- Datenbank oder Split-Editor – reine Präsentationsänderung beim Export.