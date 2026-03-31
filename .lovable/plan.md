

# Fix: Klammer-Regel aus dem Prompt entfernen — nur via Lieferanten-Hinweis

## Problem

Zeile 220 enthält hardcoded `"Alle Beträge POSITIV (Klammern/Minus → positiv umwandeln)"`. Diese Regel ist Monta-spezifisch und wird dort bereits im `extraction_hint` des Lieferanten gepflegt. Im generischen Prompt führt sie bei anderen Lieferanten zu falschen Interpretationen.

## Lösung

In `buildExpensesOnlyPrompt()` (Zeile 200-239 in `supabase/functions/extract-receipt/index.ts`):

**Keywords-Pfad (Zeile 220):** Ersetze `"Alle Beträge POSITIV (Klammern/Minus → positiv umwandeln)"` durch `"Alle Beträge POSITIV"` — die Klammer-Interpretation kommt dann nur über den LIEFERANTEN-HINWEIS rein, wenn der User sie dort hinterlegt hat.

**Ohne-Keywords-Pfad (Zeile 229):** Gleiche Änderung — `"Alle Beträge POSITIV. Gutschriften ignorieren."` bleibt, aber ohne Klammer-Regel.

### Vorher
```
- Alle Beträge POSITIV (Klammern/Minus → positiv umwandeln)
```

### Nachher
```
- Alle Beträge POSITIV
```

Die Klammer-Logik greift weiterhin bei Monta, weil dort im `extraction_hint` steht: *"Beträge in Klammern können Ausgaben sein"* — das wird als `LIEFERANTEN-HINWEIS` angehängt.

## Zusätzliche Prompt-Verbesserungen (aus genehmigtem Plan)

Gleichzeitig die weiteren Verbesserungen aus dem bereits genehmigten Plan umsetzen:

1. Kontext hinzufügen: "Dieser Beleg enthält sowohl Einnahmen/Gutschriften als auch Kosten"
2. "Durchsuche ALLE Seiten" explizit erwähnen
3. Summierung klarer formulieren
4. Selbst-Verifikation: "LISTE alle gefundenen Treffer in der description auf"

### Datei
- `supabase/functions/extract-receipt/index.ts` — nur `buildExpensesOnlyPrompt()` (Zeilen 200-239)

