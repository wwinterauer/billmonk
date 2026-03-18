

## Plan: High-Priority Bugs beheben

### Bug 1: `parseFloat || null` → verschluckt Wert 0

**Problem**: In `ReceiptDetailPanel.tsx` (Zeilen 762, 764, 794, 795) wird `calculatedValues.net || null` und `calculatedValues.vat || null` verwendet. Wenn der berechnete Wert `0` ist (z.B. bei 0% MwSt), wird er als falsy interpretiert und durch `null` ersetzt.

**Fix** in `src/components/receipts/ReceiptDetailPanel.tsx`:
- `calculatedValues.net || null` → `calculatedValues.net ?? null`
- `calculatedValues.vat || null` → `calculatedValues.vat ?? null`

4 Stellen betroffen (Zeilen ~762, ~764, ~794, ~795).

### Bug 2: Gleicher Bug in Review.tsx

**Problem**: In `Review.tsx` (Zeile 373, 382) wird `parseFloat(...) || 0` verwendet. Hier ist `|| 0` korrekt (Fallback auf 0 für Berechnung). Aber in den Berechnungen (Zeile ~419, ~427) wird `calculations.net` und `calculations.vat` ohne Override ebenfalls berechnet -- diese Stellen sind bereits korrekt mit expliziten if/else. Kein Fix nötig hier.

### Bug 3: `originalVatRate` in CorrectionTracking

**Problem**: In `useCorrectionTracking.ts` (Zeile 251) wird `correctedStr !== '' ? parseFloat(correctedStr) : 0` verwendet. Wenn der korrigierte Wert ein leerer String ist, wird `0` gesetzt -- das ist korrekt (0% MwSt als bewusste Korrektur).

Aber in Zeile 253: `detectedStr !== '' ? parseFloat(detectedStr) : null` -- wenn `detectedValue` den Wert `0` hat, wird `String(0)` = `"0"`, also `parseFloat("0")` = `0`. Das ist korrekt.

Das eigentliche Problem: Wenn `detectedValue` z.B. `undefined` oder `null` ist, wird `String(null)` = `"null"`, und `parseFloat("null")` = `NaN`. Der Fix sollte `NaN` abfangen:

**Fix** in `src/hooks/useCorrectionTracking.ts` (Zeile 251-253):
```typescript
const correctedStr = String(correctedValue ?? '').replace(',', '.');
const vatRate = correctedStr !== '' ? parseFloat(correctedStr) : 0;
const detectedStr = String(detectedValue ?? '').replace(',', '.');
const parsed = detectedStr !== '' ? parseFloat(detectedStr) : NaN;
const originalVatRate = !isNaN(parsed) ? parsed : null;
```

### Zusammenfassung

| Datei | Fix |
|-------|-----|
| `src/components/receipts/ReceiptDetailPanel.tsx` | 4× `\|\| null` → `?? null` bei berechneten Netto/MwSt-Werten |
| `src/hooks/useCorrectionTracking.ts` | `NaN`-Check für `originalVatRate` hinzufügen |

