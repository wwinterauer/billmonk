

# Infofeld "Mehrere Steuersätze" — Beschreibungen zeilenweise auflisten

## Problem

Wenn mehrere Positionen zum selben MwSt-Satz gehören, werden alle Beschreibungen in einer Zeile zusammengefasst (z.B. `20% (Betreiber-Abonnement – Kauf eines benutzerdefinierten Abonnements, Ladegebühr (%) (64.25 kWh insgesamt))`). Das wird zu lang und erzeugt unschöne Zeilenumbrüche.

## Lösung

**Datei: `src/components/receipts/ReceiptDetailPanel.tsx`**, Zeilen 1617-1626

Die `description` jedes `taxRateDetails`-Eintrags am Komma splitten und jede Position als eigene Zeile darstellen:

```tsx
{taxRateDetails.map((detail, idx) => (
  <div key={idx} className="border-b border-amber-200 last:border-0 pb-1 last:pb-0 mb-1 last:mb-0">
    <div className="flex justify-between text-sm font-medium">
      <span className="text-amber-700">{detail.rate}% MwSt</span>
      <span className="text-amber-800">
        Netto: €{detail.net_amount?.toFixed(2)} / MwSt: €{detail.tax_amount?.toFixed(2)}
      </span>
    </div>
    {detail.description && (
      <div className="ml-4 mt-0.5">
        {detail.description.split(',').map((desc, i) => (
          <div key={i} className="text-xs text-amber-600">• {desc.trim()}</div>
        ))}
      </div>
    )}
  </div>
))}
```

### Ergebnis

Statt einer langen Zeile wird jede Position einzeln aufgelistet:

```text
0% MwSt                          Netto: €0.51 / MwSt: €0.00
  • Transaktionsgebühren (64.25 kWh insgesamt)

20% MwSt                         Netto: €15.91 / MwSt: €3.18
  • Betreiber-Abonnement – Kauf eines benutzerdefinierten Abonnements
  • Ladegebühr (%) (64.25 kWh insgesamt)
```

