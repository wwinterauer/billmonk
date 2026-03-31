

# Fix: Expenses-Only Prompt — V1-Logik für Netto/MwSt übernehmen

## Problem

Der V2 `buildExpensesOnlyPrompt` sagt nur abstrakt "Pro Treffer: Brutto, Netto, MwSt-Satz, MwSt-Betrag erfassen" mit `Netto = Brutto / (1 + MwSt-Satz/100)`. Das reicht nicht — die KI berechnet die Aufteilung falsch.

Der V1-Prompt (in `prompt_versions.expenses_only_prompt_template`) hatte es richtig: Er verlangt explizit pro Position Brutto, Netto, MwSt-Satz UND MwSt-Betrag und nutzt die bewährte Summenregel.

Zusätzlich enthält der **Hauptprompt** (Zeile 600) die korrekte Formel mit Validierung:
> `MwSt = Brutto × Satz/(100+Satz). Validiere: Netto + MwSt = Brutto (±0.05€)`

Diese fehlt im Expenses-Only-Block komplett.

## Lösung

`buildExpensesOnlyPrompt()` (Zeilen 203-221) mit V1-Logik + Hauptprompt-Formel ersetzen:

### Keyword-Variante (Zeilen 204-221)

```
WICHTIG – NUR AUSGABEN EXTRAHIEREN:
Dieser Beleg enthält sowohl Einnahmen/Gutschriften als auch Kosten.
Extrahiere AUSSCHLIESSLICH die Positionen, die eines dieser Schlagwörter enthalten: ${keywords}
Ignoriere alle anderen Zeilen (Einnahmen, Gutschriften, Auszahlungen).

STRENGE FILTERREGEL:
- Eine Zeile wird NUR erfasst, wenn ihr Text eines der obigen Schlagwörter wörtlich enthält
- Wenn eine Zeile KEINES dieser Schlagwörter enthält → KOMPLETT IGNORIEREN
- Es zählen NUR exakte Treffer — keine Synonyme

FÜR JEDE gefundene Position:
- Erfasse Bruttobetrag, Nettobetrag, MwSt-Satz und MwSt-Betrag
- Berechne: MwSt = Brutto × Satz/(100+Satz), Validiere: Netto + MwSt = Brutto (±0.05€)
- Bei 0% MwSt: Netto = Brutto, MwSt = 0
- Ein Schlagwort kann MEHRFACH vorkommen → jede Zeile einzeln erfassen

SUMMIERUNG:
- amount_gross = Summe ALLER gefundenen Positionen (Brutto)
- amount_net = Summe ALLER gefundenen Positionen (Netto)
- vat_amount = Summe ALLER Steuerbeträge
- Bei verschiedenen MwSt-Sätzen: is_mixed_tax_rate=true, tax_rate_details ausfüllen
  (rate, net_amount, tax_amount, description PRO Steuersatz-Gruppe)

DUPLIKAT-VERMEIDUNG:
- Jede Zeile genau EINMAL zählen
- Nur Einzelpositionen, NICHT Summen-/Zwischensummenzeilen

BETRAGS-REGELN:
- Alle Beträge POSITIV
- Gutschriften/Erstattungen komplett ignorieren

description: Gefundene Positionen mit Beträgen auflisten
```

### Kernänderungen vs. aktuellem Code

1. **V1-Filterregel** zurück: "Strenge Filterregel" mit exakten Treffern statt vager Anweisung
2. **Hauptprompt-Formel**: `MwSt = Brutto × Satz/(100+Satz)` + Validierung `±0.05€` (Zeile 600)
3. **0%-Sonderfall** explizit: `Netto = Brutto, MwSt = 0`
4. **V1-Duplikat-Vermeidung** zurück: Einzelpositionen vs. Summenzeilen
5. **tax_rate_details**: Pro Steuersatz-Gruppe mit `rate/net_amount/tax_amount/description`

### Datei
- `supabase/functions/extract-receipt/index.ts` — `buildExpensesOnlyPrompt()`, Zeilen 203-231

