

# Fix: Keine Minusbetraege bei Ausgaben-Extraktion

## Problem

Die KI liefert fuer Rechnung 166218 (Monta) `amount_gross: -5.65` mit negativen Werten. Das passiert, weil die Monta-Rechnung Gutschriften/Auszahlungen mit negativem Vorzeichen zeigt und die KI diese Werte uebernimmt, statt nur die Kosten-Positionen korrekt als positive Betraege zu erfassen.

Korrekt waere: Transaktionsgebuehr 1,27 EUR (0% MwSt) + Betreiber-Abonnement 12,00 EUR (20% MwSt) = 13,27 EUR brutto, 11,27 EUR netto.

## Loesung: Zwei Ebenen

### 1. Prompt-Erweiterung (Edge Function)

Im "Gezielte Positions-Extraktion"-Block zwei Regeln ergaenzen:

```text
BETRAGS-REGELN:
- Alle Betraege MUESSEN POSITIV sein - es gibt keine negativen Ausgaben
- Wenn ein Betrag in Klammern steht z.B. (0,51) oder ein Minus hat z.B. -0,51, 
  behandle ihn als POSITIVEN Kostenbetrag (also 0,51)
- Ignoriere Gutschriften, Auszahlungen und Erstattungen komplett
```

Diese Regel wird in BEIDE expensesOnlyPrompt-Bloecke eingefuegt (mit Keywords und ohne Keywords).

### 2. Post-Processing Validierung (Edge Function)

Nach dem Parsen der KI-Antwort (Zeile 849) und vor dem DB-Update: Negative Betraege automatisch zu positiven konvertieren.

```text
Wenn amount_gross < 0: amount_gross = Math.abs(amount_gross)
Wenn amount_net < 0: amount_net = Math.abs(amount_net)
Wenn vat_amount < 0: vat_amount = Math.abs(vat_amount)

Falls tax_rate_details vorhanden:
  Fuer jedes Detail: net_amount und tax_amount mit Math.abs() korrigieren
```

Dies ist ein Sicherheitsnetz fuer den Fall, dass die KI trotz Prompt-Anweisung negative Werte liefert.

---

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/extract-receipt/index.ts` | Prompt: Positiv-Regel in beide expensesOnly-Bloecke. Post-Processing: Math.abs() nach JSON-Parse. |

