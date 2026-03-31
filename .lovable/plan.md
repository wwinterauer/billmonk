

# Fix: Expenses-Only Prompt — Netto-Beträge pro Position korrekt extrahieren

## Problem

Die KI erkennt den Bruttobetrag (19,60€) jetzt korrekt, berechnet aber die Netto/MwSt-Aufteilung falsch. Die drei Positionen haben unterschiedliche MwSt-Sätze:
- Transaktionsgebühr: 0,51€ brutto, 0,51€ netto (0%) ✓
- Betreiber-Abonnement: 12,00€ brutto, 10,00€ netto (20%) ✗
- Ladegebühr: 7,09€ brutto, 5,91€ netto (20%) ✗

Das ist ein Mixed-Tax-Rate-Fall (0% + 20%). Der Prompt sagt zwar "Verschiedene MwSt-Sätze → is_mixed_tax_rate=true + tax_rate_details", aber gibt der KI keine explizite Anweisung, die **Netto-Beträge pro Position korrekt zu berechnen**.

## Ursache

Die Zeile 213 sagt nur "Pro Treffer: Brutto, Netto, MwSt-Satz, MwSt-Betrag erfassen" — aber gibt keine Berechnungsformel. Die KI kennt die Formel aus dem Hauptprompt (Zeile 599), aber bei Expenses-Only wird die Verbindung offenbar nicht hergestellt.

## Lösung

In `buildExpensesOnlyPrompt()` (Zeile 200-240) die Berechnungsregel explizit einfügen:

```
- Pro Treffer: Brutto, Netto, MwSt-Satz, MwSt-Betrag erfassen
- Netto = Brutto / (1 + MwSt-Satz/100), MwSt = Brutto - Netto
- Bei verschiedenen MwSt-Sätzen: is_mixed_tax_rate=true, tax_rate_details mit rate/net_amount/tax_amount/description PRO Position
- total_amount = Summe Brutto, net_amount = Summe Netto, tax_amount = Summe MwSt
```

### Datei
- `supabase/functions/extract-receipt/index.ts` — `buildExpensesOnlyPrompt()`, Zeilen 211-217

