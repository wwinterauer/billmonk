

# Fix: KI ignoriert Schlagwort-Einschraenkung und extrahiert "Ladevorgang"

## Problem

Obwohl fuer Monta nur die Schlagwoerter "Transaktionsgebuehr" und "Betreiber-Abonnement" konfiguriert sind, extrahiert die KI zusaetzlich die Zeile "Ladevorgaenge". Die Prompt-Anweisung "Suche NUR nach Zeilen die folgende Begriffe enthalten" und "IGNORIERE alle anderen Zeilen" wird nicht strikt befolgt.

Erwartet: 1,27 EUR Transaktionsgebuehr + 12,00 EUR Betreiber-Abonnement = 13,27 EUR brutto / 11,27 EUR netto.

## Ursache

Der Prompt ist zu implizit. Die KI sieht "Ladevorgaenge" als Kosten-Position und nimmt sie auf, obwohl sie nicht in der Schlagwort-Liste steht. Es fehlt eine explizite Negativregel.

## Loesung

Die Prompt-Formulierung in beiden "GEZIELTE POSITIONS-EXTRAKTION"-Bloecken (Zeilen 383-409 und 436-462) deutlich verstaerken:

### Aenderungen am Prompt

```text
WICHTIGE REGEL - GEZIELTE POSITIONS-EXTRAKTION:
Dieser Lieferant hat spezifische Kosten-Positionen.
Suche NUR nach Zeilen/Positionen die eines der folgenden Schlagwoerter im Text enthalten:
[Keyword-Liste]

STRENGE FILTERREGEL:
- Eine Zeile wird NUR erfasst, wenn ihr Text eines der obigen Schlagwoerter woertlich enthaelt
- Wenn eine Zeile KEINES dieser Schlagwoerter enthaelt, wird sie KOMPLETT IGNORIERT - auch wenn sie wie eine Ausgabe/Kosten aussieht
- Beispiel: Wenn "Transaktionsgebuehr" ein Schlagwort ist, aber "Ladevorgaenge" NICHT, dann wird "Ladevorgaenge" ignoriert
- Es zaehlen NUR exakte Treffer auf die Schlagwoerter - keine aehnlichen Begriffe, keine Synonyme
```

### Betroffene Stellen

| Stelle | Zeilen | Kontext |
|--------|--------|---------|
| Block 1 | 383-409 | Vendor-DB-Pfad (wenn `expenses_only_extraction` in DB gesetzt) |
| Block 2 | 436-462 | Ad-hoc-Pfad (wenn `expensesOnly` im Request und Keywords vorhanden) |

Beide Bloecke erhalten die gleiche verstaerkte Formulierung.

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/extract-receipt/index.ts` | Prompt-Text in beiden Keyword-Bloecken verschaerfen |

