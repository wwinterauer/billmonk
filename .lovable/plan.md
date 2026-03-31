

# Fix: VAT Consistency Rule 0 zerstört Mixed-Tax-Rate Ergebnisse

## Problem

Die Monta-Rechnung enthält sowohl 0% (Transaktionsgebühren) als auch 20% (Ladegebühr, Betreiber-Abonnement) Positionen. Das Expenses-Only-Prompt-Update funktioniert korrekt — aber die **Post-Processing VAT Consistency Rules** (Zeilen 744-785) überschreiben das Ergebnis.

**Rule 0** (Zeile 747-753) sucht im AI-Response-Text nach dem Pattern `0.00% USt`. Die Monta-Rechnung enthält diesen Text bei den Transaktionsgebühren. Rule 0 greift und setzt:
- `vat_rate = 0`
- `vat_amount = 0`
- `amount_net = amount_gross`

Damit werden die korrekt berechneten mixed-tax Werte komplett überschrieben.

## Lösung

In `supabase/functions/extract-receipt/index.ts`, Zeilen 747-753: Rule 0 darf **nicht greifen wenn `is_mixed_tax_rate === true`**, da bei gemischten Sätzen sowohl 0% als auch andere Sätze vorkommen können.

### Änderung

```typescript
// Rule 0: Explicit 0% in document — skip for mixed tax rate receipts
const zeroVatPattern = /0[,.]?0{0,2}\s*%\s*(USt|MwSt|Ust|mwst|umsatzsteuer)/i;
if (zeroVatPattern.test(content) && extractedData.vat_rate !== 0 && !extractedData.is_mixed_tax_rate) {
```

Einzige Änderung: `&& !extractedData.is_mixed_tax_rate` zur Bedingung hinzufügen.

Zusätzlich sollten auch **Rules 1-4** bei `is_mixed_tax_rate === true` übersprungen werden, da diese für Single-Rate-Belege gedacht sind und bei Mixed-Rate die AI-berechneten Summen (net/vat) aus den `tax_rate_details` korrekt sein sollten.

### Vollständige Änderung (Zeilen 744-785)

```typescript
// ── Post-Processing: VAT consistency (skip for mixed tax rates) ──
if (extractedData.amount_gross != null && !extractedData.is_mixed_tax_rate) {
  // Rule 0 ... Rule 4 bleiben unverändert, aber sind jetzt 
  // nur aktiv wenn KEIN gemischter Steuersatz vorliegt
}
```

### Datei
- `supabase/functions/extract-receipt/index.ts` — Zeilen 744-786: gesamten VAT Consistency Block mit `!extractedData.is_mixed_tax_rate` Guard umschließen

