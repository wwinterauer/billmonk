

# Buchungsart-Spalte in Export-Vorlagen + Split-Buchungs-Export

## Aktuelle Situation

In `DEFAULT_COLUMNS` und `SPLIT_COLUMNS` fehlt jeweils eine Spalte für **Buchungsart** (`tax_type`). Auch in `SORTABLE_FIELDS` und `GROUPING_OPTIONS` fehlt sie.

Bei Split-Buchungen werden Belege bereits korrekt aufgefächert (jede Split-Position wird zu einer eigenen Zeile), mit eigener Kategorie, Brutto/Netto/MwSt. Die Split-Spalten haben aber ebenfalls keine Buchungsart.

## Export bei Split-Buchungen

So sieht der Export mit aktivierten Split-Spalten aus:

```text
Datum      | Lieferant | Kategorie    | Buchungsart        | Brutto  | Netto   | MwSt% | MwSt €
-----------+-----------+--------------+--------------------+---------+---------+-------+-------
15.03.2026 | Monta     | Mobilität    | KFZ-Kosten (AT)    | 19.60   | 16.42   | 20%   | 3.18   ← Hauptbeleg (wenn NICHT aufgefächert)

-- ODER aufgefächert (Split aktiviert):
15.03.2026 | Monta     | Mobilität    | KFZ-Kosten (AT)    | 0.51    | 0.51    | 0%    | 0.00   ← Position 1
15.03.2026 | Monta     | Mobilität    | KFZ-Kosten (AT)    | 15.91   | 13.26   | 20%   | 2.65   ← Position 2
15.03.2026 | Monta     | Abo          | Betriebsausgabe    | 3.18    | 2.65    | 20%   | 0.53   ← Position 3
```

Jede Split-Position hat ihre **eigene Kategorie und Buchungsart**, die Werte kommen aus `receipt_split_lines`.

## Änderungen

### 1. `useExportTemplates.ts` — Buchungsart überall ergänzen

**DEFAULT_COLUMNS**: Neue Spalte nach Kategorie:
```typescript
{ id: '14', field: 'tax_type', label: 'Buchungsart', type: 'text', format: null, visible: true, order: 5, align: 'left' },
```
(order der nachfolgenden Spalten um 1 erhöhen)

**SPLIT_COLUMNS**: Neue Spalte für Positions-Buchungsart:
```typescript
{ id: 's9', field: 'split_tax_type', label: 'Positions-Buchungsart', type: 'text', format: null, visible: false, order: 22.5, align: 'left' },
```

**SORTABLE_FIELDS**: `{ value: 'tax_type', label: 'Buchungsart' }` hinzufügen

**GROUPING_OPTIONS**: `{ value: 'tax_type', label: 'Buchungsart', icon: 'Scale' }` hinzufügen

### 2. `ExportFormatDialog.tsx` — Split-Expansion um `tax_type` erweitern

In der Split-Expansion (~Zeile 592-610) wird `split_tax_type` aus `line.tax_type` gemappt, analog zu `split_category`.

### 3. `useExportPreview.ts` — `tax_type` Feld in Preview-Formatierung aufnehmen

Das `formatReceipt`-Mapping muss `tax_type` aus den Receipt-Daten übernehmen, damit es in der Vorschau angezeigt wird.

### Dateien
- `src/hooks/useExportTemplates.ts` — Spalten, Sort, Gruppierung
- `src/components/exports/ExportFormatDialog.tsx` — Split-tax_type Mapping
- `src/hooks/useExportPreview.ts` — Preview-Formatierung

