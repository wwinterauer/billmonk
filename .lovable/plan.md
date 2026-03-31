

# Fix: line_items Recalculation greift nicht — robustere Validierung

## Root Cause

Der Code auf Zeile 746 filtert `rawData.line_items` mit `typeof li.total === 'number' && li.total > 0`. Zwei mögliche Probleme:

1. **Negative Totals**: Bei Monta-Rechnungen können Beträge in Klammern als negative Zahlen zurückkommen → `li.total > 0` filtert sie raus
2. **String statt Number**: Das Schema definiert `total` als `number`, aber die KI könnte trotzdem Strings liefern → `typeof li.total === 'number'` schlägt fehl
3. **tax_rate als String "0%"**: Wird zu NaN bei `parseFloat("0%".replace('%',''))` — nein, das sollte funktionieren

## Lösung

**Datei: `supabase/functions/extract-receipt/index.ts`**, Zeilen 745-777

1. **Robustere Parsing**: `Number(li.total)` statt `typeof === 'number'`-Check, `Math.abs()` anwenden
2. **Debug-Logging**: `console.log` für `rawData.line_items` um zu sehen was die KI tatsächlich liefert
3. **Fallback auf tax_rate_details**: Wenn line_items nicht greifen, TROTZDEM die `tax_rate_details` mit korrekter Mathematik neu berechnen (Netto = Brutto / (1 + Satz/100))

### Konkrete Änderungen

```typescript
// Zeile 745-777 ersetzen:

// ── Post-Processing: rebuild tax_rate_details from line_items ──
const lineItems = Array.isArray(rawData.line_items) ? rawData.line_items : [];
console.log(`[LineItems Debug] Count: ${lineItems.length}, items:`, JSON.stringify(lineItems.slice(0, 5)));

const validLineItems = lineItems.filter((li: any) => {
  const total = Number(li?.total);
  return li && Number.isFinite(total) && total !== 0 && li.tax_rate != null;
});
console.log(`[LineItems Debug] Valid count: ${validLineItems.length}`);

if (validLineItems.length > 0) {
  const rateGroups: Record<string, { gross: number; descriptions: string[] }> = {};
  for (const li of validLineItems) {
    const rateKey = String(parseFloat(String(li.tax_rate).replace(',', '.').replace('%', '')) || 0);
    if (!rateGroups[rateKey]) rateGroups[rateKey] = { gross: 0, descriptions: [] };
    rateGroups[rateKey].gross += Math.abs(Number(li.total));
    if (li.description) rateGroups[rateKey].descriptions.push(li.description);
  }
  const rateKeys = Object.keys(rateGroups);
  if (rateKeys.length > 1) {
    // Multiple tax rates — rebuild
    const newDetails = rateKeys.map(rateStr => {
      const rate = parseFloat(rateStr);
      const gross = rateGroups[rateStr].gross;
      const netAmount = rate === 0 ? gross : gross / (1 + rate / 100);
      const taxAmount = gross - netAmount;
      return {
        rate,
        net_amount: Math.round(netAmount * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        description: rateGroups[rateStr].descriptions.join(', '),
      };
    });
    extractedData.tax_rate_details = newDetails;
    extractedData.is_mixed_tax_rate = true;
    extractedData.amount_net = Math.round(newDetails.reduce((s, d) => s + d.net_amount, 0) * 100) / 100;
    extractedData.vat_amount = Math.round(newDetails.reduce((s, d) => s + d.tax_amount, 0) * 100) / 100;
    console.log(`[VAT Mixed] Rebuilt: net=${extractedData.amount_net}, vat=${extractedData.vat_amount}, details=`, JSON.stringify(newDetails));
  }
}

// ── Fallback: recalculate tax_rate_details with correct math ──
if (!extractedData.is_mixed_tax_rate && Array.isArray(extractedData.tax_rate_details) && extractedData.tax_rate_details.length > 1) {
  const detailRates = [...new Set(extractedData.tax_rate_details.map((t: any) => Number(t?.rate)).filter((r: number) => !Number.isNaN(r)))];
  if (detailRates.length > 1) {
    // Recalculate each detail's net/vat from its gross (if available) or from the existing values
    extractedData.tax_rate_details = extractedData.tax_rate_details.map((d: any) => {
      const rate = Number(d.rate) || 0;
      const gross = Number(d.net_amount) + Number(d.tax_amount); // reconstruct gross from AI values
      const netAmount = rate === 0 ? gross : gross / (1 + rate / 100);
      const taxAmount = gross - netAmount;
      return { ...d, net_amount: Math.round(netAmount * 100) / 100, tax_amount: Math.round(taxAmount * 100) / 100 };
    });
    extractedData.is_mixed_tax_rate = true;
    extractedData.amount_net = Math.round(extractedData.tax_rate_details.reduce((s: number, t: any) => s + t.net_amount, 0) * 100) / 100;
    extractedData.vat_amount = Math.round(extractedData.tax_rate_details.reduce((s: number, t: any) => s + t.tax_amount, 0) * 100) / 100;
    console.log(`[VAT Mixed] Fallback recalc: net=${extractedData.amount_net}, vat=${extractedData.vat_amount}`);
  }
}
```

### Warum das hilft

- `Number(li.total)` statt `typeof === 'number'` akzeptiert auch Strings
- `total !== 0` statt `total > 0` akzeptiert negative Beträge (werden dann mit `Math.abs` korrigiert)
- Debug-Logs zeigen exakt was die KI in `line_items` liefert
- Fallback recalculated die `tax_rate_details` mit korrekter Mathematik, auch wenn keine line_items vorhanden

