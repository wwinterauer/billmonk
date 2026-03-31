

# Systemweite Kategorien-Bereinigung: TAX_TYPES → DB-Buchungsarten

## Problemanalyse

Das System hat aktuell **zwei parallele Systeme** für "Buchungsarten":

1. **`TAX_TYPES` in `constants.ts`** — eine statische, hartcodierte Liste (Betriebsausgabe, GWG, Bewirtung etc.) die NICHT mit der Datenbank synchronisiert ist
2. **`categories`-Tabelle** mit `is_system=true` + `country`-Feld — die länderspezifischen Buchungsarten, verwaltet über Einstellungen

Die statische `TAX_TYPES`-Liste ist ein **Überbleibsel** und muss durch die DB-Kategorien ersetzt werden. Das System braucht genau 2 Arten:
- **User-Kategorien**: `!is_system` oder (`is_system` ohne `country`) — persönliche Organisation
- **Buchungsarten**: `is_system && country` — staatliche Steuer-Kategorien

Zusätzlich: Zahlungsmethode bleibt auf Belegebene (Vendor-Learning etc.), wird aber aus den **Splitbuchungs-Positionen** entfernt.

## Änderungen

### 1. `useCategories` Hook erweitern — getrennte Listen bereitstellen

**Datei: `src/hooks/useCategories.ts`**

Zwei gefilterte Listen aus den geladenen Kategorien ableiten und exportieren:
- `userCategories`: Kategorien wo `!is_system || !country` (persönliche)
- `taxCategories`: Kategorien wo `is_system && !!country` (Buchungsarten vom Staat)

```typescript
const userCategories = categories.filter(c => !c.is_system || !c.country);
const taxCategories = categories.filter(c => c.is_system && !!c.country);
return { categories, userCategories, taxCategories, ... };
```

### 2. `TAX_TYPES` und `TAX_TYPE_COLORS` aus `constants.ts` entfernen

**Datei: `src/lib/constants.ts`**

- `TAX_TYPES`-Array komplett entfernen
- `TAX_TYPE_COLORS`-Map entfernen (Farben kommen aus der `categories.color`-Spalte in der DB)

### 3. Alle Stellen die `TAX_TYPES` nutzen → auf `taxCategories` aus Hook umstellen

**5 Dateien betroffen:**

| Datei | Änderung |
|---|---|
| `src/pages/Review.tsx` | Buchungsart-Dropdown: `TAX_TYPES.map(...)` → `taxCategories.map(c => <SelectItem value={c.name}>)` |
| `src/pages/Expenses.tsx` | Filter-Dropdown: `TAX_TYPES.map(...)` → `taxCategories.map(...)` |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Buchungsart-Dropdown → `taxCategories` |
| `src/components/receipts/SplitBookingEditor.tsx` | Buchungsart-Dropdown → `taxCategories`, **Payment-Method entfernen** |
| `src/hooks/useDashboardData.ts` | `TAX_TYPE_COLORS[taxType]` → Farbe aus category-Daten ableiten |
| `src/pages/Reports.tsx` | `TAX_TYPE_COLORS[name]` → Farbe aus geladenen categories |

### 4. Kategorie-Dropdown in Expenses-Filter aufteilen

**Datei: `src/pages/Expenses.tsx`** (Filter-Bereich ~Zeile 1633-1658)

Aktuell: 1 Dropdown "Kategorie" (zeigt alle categories) + 1 Dropdown "Buchungsart" (zeigt statische TAX_TYPES)

Neu: 
- **Kategorie-Dropdown**: Zeigt `userCategories` (User-Kategorien)
- **Buchungsart-Dropdown**: Zeigt `taxCategories` (DB-Buchungsarten statt TAX_TYPES)

### 5. Splitbuchung: Zahlungsmethode entfernen, KI-Beträge fixen

**Datei: `src/components/receipts/SplitBookingEditor.tsx`**

- Payment-Method-Select aus dem Grid entfernen → Grid wird 2-spaltig (Kategorie + Buchungsart)
- Kategorie-Dropdown: nur `userCategories` anzeigen
- Buchungsart-Dropdown: nur `taxCategories` anzeigen (statt TAX_TYPES)
- KI-Vorschläge: `item.total` statt `item.amount_gross` mappen (Beträge-Fix)

**Klarstellung**: Die Zahlungsmethode bleibt weiterhin auf der **Gesamtbeleg-Ebene** verfügbar (Review, ReceiptDetailPanel) und wird auch weiter per Vendor-Defaults/Learning unterstützt. Nur auf **Splitpositions-Ebene** wird sie entfernt.

### 6. Dashboard + Reports: Farben aus DB

**Dateien: `src/hooks/useDashboardData.ts`, `src/pages/Reports.tsx`**

Statt `TAX_TYPE_COLORS[taxType]` die Farbe aus der geladenen `categories`-Liste nehmen. Fallback: `#94A3B8`.

### Zusammenfassung der entfernten Konzepte
- `TAX_TYPES` (statische Liste) → ersetzt durch `taxCategories` aus DB
- `TAX_TYPE_COLORS` (statische Farben) → ersetzt durch `categories.color` aus DB
- Zahlungsmethode pro Split-Position → entfernt (bleibt auf Belegebene)

