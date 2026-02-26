

# Umfassende Projekt-Pruefung: XpenzAi

## Status: Kuerzlich behobene Bugs

Die folgenden Fixes sind korrekt implementiert:
- 0% MwSt-Bug (Speichern/Laden in ReceiptDetailPanel + Review): Korrekt
- Doppelter Loesch-Button im Duplikat-Filter: Korrekt

---

## Verbleibende Probleme

### 1. HOCH: `parseFloat(...) || null` Bug an 4 weiteren Stellen

Der gleiche 0-Wert-Bug existiert noch an diesen Stellen:

| Datei | Zeile | Code | Auswirkung |
|-------|-------|------|------------|
| `ReceiptDetailPanel.tsx` | 294 | `amount_gross: parseFloat(amountGross) \|\| null` | Dateinamen-Vorschau zeigt keinen Betrag bei 0 EUR |
| `ReceiptDetailPanel.tsx` | 1467 | `value={parseFloat(amountGross) \|\| null}` | LearnableField erkennt 0 EUR Aenderung nicht |
| `ReceiptDetailPanel.tsx` | 1488 | `value={isMixedTaxRate ? null : (parseFloat(vatRate) \|\| null)}` | LearnableField erkennt 0% MwSt Aenderung nicht |
| `Review.tsx` | 470 | `corrected: ... (parseFloat(formData.vat_rate) \|\| null)` | 0% MwSt wird im KI-Learning als null gespeichert |

**Fix:** Ueberall `parseFloat(x) \|\| null` ersetzen durch `x !== '' ? parseFloat(x) : null`

### 2. HOCH: `parseFloat(...) || 0` und `|| null` in useCorrectionTracking.ts

| Datei | Zeile | Code | Problem |
|-------|-------|------|---------|
| `useCorrectionTracking.ts` | 250 | `parseFloat(...) \|\| 0` | 0% MwSt-Korrektur: `parseFloat("0") \|\| 0` = korrekt (zufaellig), aber semantisch verwirrend |
| `useCorrectionTracking.ts` | 251 | `parseFloat(...) \|\| null` | Original 0% wird als `null` geloggt statt `0` |

**Fix Zeile 251:** `const originalVatRate = val !== '' && val !== 'null' ? parseFloat(val) : null;`

### 3. MITTEL: Tote Links - Fehlende Seiten

| Link | Verwendet in | Problem |
|------|-------------|---------|
| `/forgot-password` | `Login.tsx` Zeile 151 | Keine Route definiert - fuehrt zu 404 |
| `/agb` | `Register.tsx` Zeile 246 | Keine Route definiert - fuehrt zu 404 |

**Fix:** Entweder Seiten erstellen oder Links entfernen/deaktivieren.

### 4. MITTEL: Badge-Komponente ohne forwardRef

`src/components/ui/badge.tsx` ist eine einfache Funktion ohne `React.forwardRef`. Wenn Badge innerhalb von Tooltip verwendet wird (z.B. auf Dashboard, in LearnableField), entsteht eine React-Console-Warnung.

**Fix:** Badge mit `React.forwardRef` wrappen und `displayName` setzen.

### 5. NIEDRIG: `amount_gross` Laden mit `?.toString() || ''`

`ReceiptDetailPanel.tsx` Zeile 426 und `Review.tsx` Zeile 324: `amount_gross?.toString() || ''` -- Bei `amount_gross = 0` wird `"0"` (truthy), also kein Problem. Aber `amount_gross?.toString() || ''` ist inkonsistent mit dem expliziten null-Check beim `vat_rate`. Zur Klarheit angleichen.

### 6. NIEDRIG: `onReset` in LearnableField mit altem Muster

`ReceiptDetailPanel.tsx` Zeile 1492: `setVatRate(originalReceipt?.vat_rate?.toString() || '20')` -- Wenn originalReceipt.vat_rate = 0, ergibt `(0).toString()` = `"0"` (truthy), also funktioniert es zufaellig. Trotzdem inkonsistent.

### 7. INFO: Sicherheit

Die Datenbank-Linter-Pruefung zeigt nur eine Warnung:
- **Leaked Password Protection deaktiviert** -- empfohlen zu aktivieren fuer Produktivbetrieb, verhindert die Nutzung bekannter kompromittierter Passwoerter.

---

## Zusammenfassung der notwendigen Aenderungen

| Prioritaet | Problem | Dateien | Aufwand |
|------------|---------|---------|--------|
| HOCH | 4x `parseFloat \|\| null` Bug | `ReceiptDetailPanel.tsx`, `Review.tsx` | 4 Zeilen |
| HOCH | CorrectionTracking originalVatRate | `useCorrectionTracking.ts` | 1 Zeile |
| MITTEL | Tote Links `/forgot-password`, `/agb` | `Login.tsx`, `Register.tsx` oder neue Pages | 2-50 Zeilen |
| MITTEL | Badge ohne forwardRef | `badge.tsx` | 5 Zeilen |
| NIEDRIG | Inkonsistente null-Checks | `ReceiptDetailPanel.tsx` | Optional |

### Technische Details der Fixes

**ReceiptDetailPanel.tsx Zeile 294:**
```typescript
// Vorher:
amount_gross: parseFloat(amountGross) || null,
// Nachher:
amount_gross: amountGross !== '' ? parseFloat(amountGross) : null,
```

**ReceiptDetailPanel.tsx Zeile 1467:**
```typescript
// Vorher:
value={parseFloat(amountGross) || null}
// Nachher:
value={amountGross !== '' ? parseFloat(amountGross) : null}
```

**ReceiptDetailPanel.tsx Zeile 1488:**
```typescript
// Vorher:
value={isMixedTaxRate ? null : (parseFloat(vatRate) || null)}
// Nachher:
value={isMixedTaxRate ? null : (vatRate !== '' ? parseFloat(vatRate) : null)}
```

**Review.tsx Zeile 470:**
```typescript
// Vorher:
corrected: formData.is_mixed_tax_rate ? null : (parseFloat(formData.vat_rate) || null)
// Nachher:
corrected: formData.is_mixed_tax_rate ? null : (formData.vat_rate !== '' ? parseFloat(formData.vat_rate) : null)
```

**useCorrectionTracking.ts Zeile 251:**
```typescript
// Vorher:
const originalVatRate = parseFloat(String(detectedValue).replace(',', '.')) || null;
// Nachher:
const detectedStr = String(detectedValue ?? '').replace(',', '.');
const originalVatRate = detectedStr !== '' ? parseFloat(detectedStr) : null;
```

**badge.tsx:**
```typescript
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = "Badge";
```

**Tote Links:**
- `/forgot-password` in Login.tsx vorerst entfernen oder auskommentieren
- `/agb` in Register.tsx auf `/datenschutz` umleiten oder Seite erstellen

