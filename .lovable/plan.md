## Ursache

In `ReceiptDetailPanel.handleSave` (`src/components/receipts/ReceiptDetailPanel.tsx`, ~Z. 821–823) gilt für **alle** lernbaren Felder:

```ts
const originalIsEmpty = normalizedOriginal === null || normalizedOriginal === '';
if (originalIsEmpty) continue; // → keine Korrektur, kein Lernen
```

Das heißt: Sobald die KI ein Feld **gar nicht erkennt** und du es manuell ausfüllst, geht das Signal komplett verloren — egal ob Kategorie, Buchungsart, Rechnungsnummer, Datum, Lieferant oder Beträge.

Folgen:
- `category_rules` (Beschreibung → Kategorie/Buchungsart) wird nicht angelegt
- `vendor.default_category_id`, `vendor.default_tax_type`, `vendor.default_vat_rate` werden nicht aktualisiert
- `field_defaults_stats` (3er-Vorschlag) wird nicht hochgezählt
- `vendor_learning.field_patterns` (typische Beträge, Datumsformate, RG-Nr-Präfixe) lernt nichts dazu
- Community-Pattern wird nicht aggregiert

Auf der Lese-Seite (Edge Function `extract-receipt`) ist die Logik bereits vorhanden (Schwelle Match-Count ≥ 3 + Vendor-Defaults). Es fehlt nur das Schreiben bei Erst-Befüllungen.

Zusätzlich: `useVendorFieldDefaults.trackFieldChange` wird heute nur im Split-Editor gerufen, nicht beim normalen Beleg-Speichern.

## Plan

### 1. `ReceiptDetailPanel.tsx` — Erst-Befüllungen als Lernsignal zulassen

In der Korrektur-Schleife (~Z. 808–843) den `originalIsEmpty`-Skip entfernen — mit zwei Ausnahmen:

- **`vendor`**: Erst-Befüllung wird übersprungen, weil ohne Vendor-ID kein `vendor_learning`-Eintrag existiert (Vendor wird über Autocomplete/Selection-Dialog separat gepflegt).
- **`description`**: keine Korrektur tracken bei Erst-Befüllung (würde sonst nur die Description selbst „lernen", ohne Mehrwert).

Für alle anderen Felder (`invoice_number`, `receipt_date`, `amount_gross`, `amount_net`, `vat_rate`, `vat_amount`, `category`, `tax_type`) wird auch eine Erst-Befüllung als `correction` mit `detectedValue: ''` an `trackCorrection` übergeben.

Zusätzlich nach erfolgreichem Save:
- `trackFieldChange(selectedVendorId, 'category', value)` und `'tax_type'` aufrufen, damit der bestehende „nach 3 Bestätigungen Vorschlag"-Mechanismus auch außerhalb des Split-Editors greift.

### 2. `useCorrectionTracking.ts` — leere `detectedValue` robust handhaben

In `trackCorrection` (~Z. 238) und `updateFieldPatterns`:

- Frühausstieg bei identischen Werten bleibt.
- `field_corrections`-Insert akzeptiert leeren `detected_value` (Spalte ist nullable).
- `updateFieldPatterns`: bei leerem `detected` keinen `common_mistakes`-Eintrag schreiben (würde sonst die Pattern-Map verschmutzen). Aber:
  - `prefixes`/`suffixes`-Erkennung läuft weiter, wenn `detected` Teil von `corrected` ist.
  - `typical_range` für Beträge wird auch ohne `detected` aus dem `corrected`-Wert gelernt.
  - `confidence`-Boost läuft normal.
- Spezial-Handler für `category` (Z. 291–347), `tax_type` (Z. 349–388), `vat_rate` (Z. 390–397) und Community-Aggregation (Z. 402–433) funktionieren bereits ohne `detected` — keine Änderung.

### 3. Was die KI dann konkret lernt

| Feld | Was bei Erst-Befüllung gelernt wird |
|---|---|
| `category` | Keyword aus Description/Line-Items → `category_rules`; Vendor-Default; Community-Pattern |
| `tax_type` | Keyword → `category_rules.tax_type_name`; Vendor `field_defaults` |
| `vat_rate` | `vendor.default_vat_rate` über `recordVatRateCorrection` |
| `amount_gross` / `amount_net` / `vat_amount` | `typical_range` (min/max) im `vendor_learning.field_patterns` für Plausibilitätswarnungen |
| `invoice_number` | Zukünftige Präfix-/Suffix-Erkennung (sobald ein zweiter Beleg eine ähnliche Struktur zeigt) |
| `receipt_date` | nur Konfidenz-Boost (Datumsformate werden nicht über `common_mistakes` gelernt) |
| `vendor` | bleibt ausgenommen (Vendor wird separat gepflegt) |

### 4. Auswirkung in der Praxis

- **Marktgemeinde Bad Goisern**: Nach 3 Belegen mit „Grundsteuer" → Betriebskosten greift die Auto-Kategorisierung beim 4. Beleg.
- **Beträge & RG-Nummer**: Wenn die KI sie zunächst gar nicht erkennt, lernt das System aus deinen Eingaben trotzdem typische Wertbereiche und Strukturen für diesen Lieferanten.
- Kein DB-Migrations-Bedarf, keine Edge-Function-Änderung.

## Geänderte Dateien

- `src/components/receipts/ReceiptDetailPanel.tsx`
- `src/hooks/useCorrectionTracking.ts`
