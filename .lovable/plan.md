

# Bulk-Kategorie-Aenderung, "Keine Rechnung"-Ausschluss und Kategorie-Schutz

## Zusammenfassung

Drei zusammenhaengende Aenderungen:
1. Neue Bulk-Aktion "Kategorie aendern" in der Ausgabenuebersicht
2. Belege mit Kategorie "Keine Rechnung" werden bei allen Geldberechnungen ausgeschlossen
3. Die Kategorie "Keine Rechnung" wird als geschuetzte System-Kategorie markiert (nicht editier-/loeschbar)

---

## 1. Bulk-Aktion: Kategorie aendern

In der bestehenden Bulk-Aktionsleiste (unterhalb der Tags-Aktion) wird ein neuer Button "Kategorie" mit einem Popover eingefuegt. Der Nutzer waehlt eine Kategorie aus einem Select-Dropdown, und alle markierten Belege werden auf diese Kategorie umgestellt.

**Ablauf:**
- Button mit Folder-Icon in der Bulk-Leiste
- Popover oeffnet sich mit einem Select aller sichtbaren Kategorien
- Bei Auswahl: Batch-Update aller `selectedIds` in der Datenbank (`receipts.category = neuer Wert`)
- Toast-Bestaetigung
- Liste wird neu geladen

**Datei:** `src/pages/Expenses.tsx`
- Neuer Handler `handleBulkCategoryChange(categoryName: string)`
- Neuer Button + Popover in der Bulk-Aktionsleiste (nach dem Tags-Bereich)

---

## 2. "Keine Rechnung" bei Berechnungen ausschliessen

Ueberall wo Geldsummen berechnet werden, muessen Belege mit `category === 'Keine Rechnung'` herausgefiltert werden.

### Betroffene Stellen:

| Datei | Stelle | Aenderung |
|-------|--------|-----------|
| `src/pages/Expenses.tsx` | `stats` useMemo (Zeile ~796) | Filter auf `category !== 'Keine Rechnung'` vor der Summenberechnung |
| `src/hooks/useDashboardData.ts` | `totalExpenses`, `totalVat`, `categoryMap` (Zeile ~134) | Belege mit `category = 'Keine Rechnung'` bei Summenberechnung ausschliessen |
| `src/pages/Reports.tsx` | `stats` useMemo (Zeile ~210) und `categoryData` | Belege mit dieser Kategorie bei KPIs und Analysen ausschliessen |
| `src/components/exports/ExportFormatDialog.tsx` | Export-Optionen UI + `prepareExportData` | Neue Checkbox "Keine Rechnung ausschliessen" (Standard: an), filtert Belege vor dem Export |

### Export-Checkbox Details:
- Neue State-Variable `excludeNoReceipt` (default: `true`)
- Switch im Options-Bereich: "Belege ohne Rechnung ausschliessen"
- Wenn aktiv: `receipts.filter(r => r.category !== 'Keine Rechnung')` vor dem Export
- Gilt fuer CSV, Excel und PDF (nicht ZIP, da dort Dateien exportiert werden)

---

## 3. "Keine Rechnung" als geschuetzte Kategorie

### Datenbank-Migration:
Die bestehende Kategorie "Keine Rechnung" wird auf `is_system = true` gesetzt. Da sie aktuell `is_system = false` ist, muss sie migriert werden.

```text
UPDATE categories SET is_system = true WHERE name = 'Keine Rechnung';
```

Zusaetzlich muss die RLS-Policy fuer Updates angepasst werden, damit `is_system = true`-Kategorien nicht geaendert werden koennen (bestehende Policy erlaubt nur Updates wenn `is_system = false`). Die bestehende Policy schuetzt bereits vor Loeschung und Updates von System-Kategorien -- das passt also bereits.

### UI-Schutz in CategoryManagement:
- **Bearbeiten-Button**: Deaktiviert fuer "Keine Rechnung"
- **Loeschen-Button**: Deaktiviert fuer "Keine Rechnung"
- **Sichtbarkeits-Toggle**: Deaktiviert fuer "Keine Rechnung"
- Zusaetzliches Badge "Geschuetzt" oder Tooltip-Hinweis

**Datei:** `src/components/settings/CategoryManagement.tsx`
- Pruefung `category.name === 'Keine Rechnung'` oder `category.is_system && category.name === 'Keine Rechnung'` fuer die Button-Deaktivierung

---

## Technische Details

### Konstante fuer den Kategorienamen
Eine zentrale Konstante `NO_RECEIPT_CATEGORY = 'Keine Rechnung'` wird definiert und ueberall verwendet, um Tippfehler zu vermeiden.

### Dateien und Aenderungen

| Datei | Aenderung |
|-------|-----------|
| Migration (SQL) | `UPDATE categories SET is_system = true WHERE name = 'Keine Rechnung'` |
| `src/pages/Expenses.tsx` | Bulk-Kategorie-Button + Handler; Stats-Berechnung filtert "Keine Rechnung" |
| `src/hooks/useDashboardData.ts` | Summen-Berechnung filtert "Keine Rechnung" |
| `src/pages/Reports.tsx` | KPI- und Analyse-Berechnung filtert "Keine Rechnung" |
| `src/components/exports/ExportFormatDialog.tsx` | Neue Checkbox + Filter-Logik |
| `src/components/settings/CategoryManagement.tsx` | Buttons deaktiviert fuer geschuetzte Kategorie |

