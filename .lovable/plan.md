

# Plan: Dashboards & Auswertungen um Buchungsart (tax_type) erweitern

## Übersicht

6 Änderungsbereiche: Dashboard Pie-Chart toggle, Reports-Seite tax_type-Ansicht, Trend-Gruppierung, "Offen"/"Nicht zugeordnet"-Filter, Expenses-Spalte/-Filter, Review/DetailPanel Layout.

## 1. Dashboard — Kategorie/Buchungsart Toggle

**`useDashboardData.ts`:**
- `tax_type` in die Receipts-Query aufnehmen (Zeile 87: `select` erweitern)
- Neue `taxTypeData` analog zu `categoryData` berechnen: pro `tax_type` Summen aggregieren (split-aware)
- "Offen" = Belege ohne `tax_type`, analog zu `untaggedTotal`
- Neuer Return-Wert: `taxTypeData`, `openTaxTypeTotal`

**`Dashboard.tsx`:**
- Neuer State: `chartView: 'category' | 'taxType'` (default `'category'`)
- Im Pie-Chart-Card Header: Toggle-Buttons "Nach Kategorie" / "Nach Buchungsart"
- Pie-Chart wechselt zwischen `categoryData` und `taxTypeData`
- Bei Buchungsart-Ansicht: feste Farbpalette für TAX_TYPES

## 2. Reports — Umschaltbare Kategorie/Buchungsart-Ansicht

**`Reports.tsx`:**
- Neuer State: `groupBy: 'category' | 'taxType'` (default `'category'`)
- Toggle im Expense-Bereich: "Nach Kategorie" / "Nach Buchungsart"
- Neues `useMemo` für `taxTypeData`: Summen pro `tax_type` aus `receipts` (split-aware via `splitLines`)
- Feste Farben pro tax_type (aus einer Map: Betriebsausgabe → blau, GWG → grün, etc.)
- Pie-Chart + Tabelle zeigen je nach `groupBy` die Kategorie- oder Buchungsart-Daten
- "Offen" als eigener Eintrag für Belege ohne `tax_type`

## 3. Trend-Analyse — Gruppierung nach Buchungsart

**`Reports.tsx` — `timeSeriesData`:**
- Wenn `groupBy === 'taxType'`: Zeitreihe nach tax_type statt Gesamtsumme aufschlüsseln
- Stacked Bar Chart mit einer Farbe pro tax_type
- Wenn `groupBy === 'category'`: bestehende Logik bleibt

## 4. Expenses — tax_type Spalte und Filter

**`Expenses.tsx`:**
- `COLUMN_CONFIG`: `{ key: 'tax_type', label: 'Buchungsart', defaultVisible: false }` hinzufügen
- `ColumnKey` Type erweitern um `'tax_type'`
- Neuer Filter-State: `taxTypeFilter` (default `'all'`), Optionen: "Alle", TAX_TYPES + "Offen"
- Category-Filter: "Nicht zugeordnet" als Option hinzufügen
- `filteredReceipts`: Filter-Logik für `taxTypeFilter` und `categoryFilter === 'unassigned'`
- Tabellenzelle: Badge mit tax_type-Label oder "Offen" in grau

## 5. Review.tsx & ReceiptDetailPanel.tsx — Layout nebeneinander

**Review.tsx:**
- Kategorie + Buchungsart in `grid grid-cols-2 gap-4` nebeneinander statt untereinander
- Kategorie-Placeholder: "Nicht zugeordnet"
- Buchungsart-Placeholder: "Offen"
- Zahlungsmethode: eigene Zeile darunter, rein manuell (kein AI), Vendor-Default vorausgefüllt

**ReceiptDetailPanel.tsx:**
- Gleiche Anpassung: Kategorie + Buchungsart nebeneinander (`grid grid-cols-2`)
- Kategorie-Placeholder: "Nicht zugeordnet"
- Buchungsart-Placeholder: "Offen"

## 6. Konstanten — Farbzuordnung

**`constants.ts`:**
- `TAX_TYPE_COLORS` Map hinzufügen:
```ts
export const TAX_TYPE_COLORS: Record<string, string> = {
  'Betriebsausgabe': '#3B82F6',
  'GWG bis 1.000€': '#10B981',
  'Bewirtung 50%': '#F59E0B',
  'Bewirtung 100%': '#EAB308',
  'Vorsteuer abzugsfähig': '#6366F1',
  'Reisekosten': '#EC4899',
  'Kfz-Kosten': '#14B8A6',
  'Repräsentation': '#EF4444',
  'Abschreibung': '#8B5CF6',
  'Sonstige': '#94A3B8',
};
```

## Technische Details

- Keine DB-Migration nötig — `tax_type` existiert bereits auf `receipts` und `receipt_split_lines`
- Split-aware Aggregation: Bei `is_split_booking` die Split-Lines nach `tax_type` gruppieren (analog zur bestehenden Category-Logik)
- "Offen"-Filter: `tax_type IS NULL` bzw. `!receipt.tax_type`
- "Nicht zugeordnet"-Filter: `category IS NULL` bzw. `!receipt.category`
- Bestehende Export-Logik bleibt unverändert (Folgeschritt)

