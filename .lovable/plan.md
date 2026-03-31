

# Keyword-Lernsystem erweitern: Positions-Level + Buchungsart

## Übersicht

Das bestehende Keyword-Lernsystem (`category_rules`) wird um Buchungsart-Support und Line-Item-Extraktion erweitert. Aktuell speichert es nur `category_name` + `match_count` pro Keyword. Neu kommen `tax_type_name` und `tax_type_match_count` dazu, und Keywords werden auch aus Line-Items extrahiert.

## Änderungen

### 1. Database Migration — `category_rules` erweitern

```sql
ALTER TABLE public.category_rules 
  ADD COLUMN IF NOT EXISTS tax_type_name text,
  ADD COLUMN IF NOT EXISTS tax_type_match_count integer NOT NULL DEFAULT 0;
```

Keine bestehenden Daten betroffen — beide Spalten sind nullable/default 0.

### 2. `src/hooks/useCorrectionTracking.ts` — Keyword-Extraktion erweitern

**a) Keyword-Extraktion refactoren (Zeilen ~266-322)**

Aktuelle Logik extrahiert Keywords nur aus `receiptData.description`. Änderungen:
- Zusätzlich `line_items_raw` vom Receipt laden (`.select('description, line_items_raw')`)
- Keywords aus Hauptbeschreibung UND jeder `line_item.description` extrahieren
- Stopwort-Filterung und ≥4-Zeichen-Regel bleiben gleich
- Deduplizierung, dann max 10 Keywords statt 5
- Keyword-Extraktionslogik in eine Hilfsfunktion `extractKeywords(description, lineItemsRaw)` auslagern

**b) Buchungsart-Korrekturen tracken (nach Zeile ~326)**

Neuer Block analog zur Kategorie-Korrektur:
```typescript
if (fieldName === 'tax_type' && correctedValue) {
  // Lade description + line_items_raw
  // Extrahiere Keywords (gleiche Hilfsfunktion)
  // Für jedes Keyword: upsert in category_rules
  //   - Bei existierendem Keyword: update tax_type_name, increment tax_type_match_count
  //   - Bei neuem Keyword: insert mit tax_type_name, tax_type_match_count: 1
}
```

Die bestehende `category_name`/`match_count`-Logik bleibt unverändert.

### 3. `supabase/functions/extract-receipt/index.ts` — Auto-Fill erweitern

Zeilen 887-902: Aktuell wird nur `category_name` geprüft. Erweitern:

```typescript
// Bestehende category_rules-Abfrage erweitern um tax_type_name, tax_type_match_count
.select('keyword, category_name, match_count, tax_type_name, tax_type_match_count')

// Nach category-Match: auch tax_type prüfen
// Zusätzlich: line_items_raw durchsuchen (pro Item Keywords matchen)
if (matchedRule && matchedRule.tax_type_name && matchedRule.tax_type_match_count >= 3) {
  finalTaxType = matchedRule.tax_type_name;
}
```

Für Positions-Level: Wenn `line_items_raw` vorhanden, jede Position gegen `category_rules` matchen und bei Match ≥3 die Kategorie/Buchungsart der Position überschreiben.

Priorität: Positions-Keyword > Vendor-Default > AI-Vorschlag.

### 4. `src/components/receipts/FieldDefaultSuggestion.tsx` — Bereits korrekt

`tax_type` ist bereits in `TRACKED_FIELDS` und `FIELD_LABELS` enthalten:
- `TRACKED_FIELDS = ['payment_method', 'category', 'tax_type', 'tax_rate']` (in `useVendorFieldDefaults.ts`)
- `FIELD_LABELS` hat `tax_type: 'Steuerart'` → umbenennen zu `'Buchungsart'`

Die Komponente ist in `Review.tsx` eingebunden. Prüfen ob auch in `ReceiptDetailPanel.tsx` — aktuell fehlt sie dort, muss ergänzt werden.

### 5. `src/components/settings/AILearningSettings.tsx` — tax_type-Spalte anzeigen

Die Keyword-Regel-Tabelle zeigt aktuell nur `keyword`, `category_name`, `match_count`. Erweitern um `tax_type_name` und `tax_type_match_count` als zusätzliche Spalten.

### Dateien

- **Migration**: `category_rules` um `tax_type_name` + `tax_type_match_count` erweitern
- **`src/hooks/useCorrectionTracking.ts`**: Keyword-Extraktion aus Line-Items + tax_type-Tracking
- **`supabase/functions/extract-receipt/index.ts`**: Auto-Fill für tax_type + Positions-Level
- **`src/components/receipts/FieldDefaultSuggestion.tsx`**: Label `Steuerart` → `Buchungsart`
- **`src/components/receipts/ReceiptDetailPanel.tsx`**: `FieldDefaultSuggestion` einbinden
- **`src/components/settings/AILearningSettings.tsx`**: tax_type-Spalten in Regel-Tabelle

