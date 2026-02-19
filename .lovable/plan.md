
# Fix: MwSt-Satz wird nach Neuanalyse auf 20% zurueckgesetzt

## Problem

Nach einer "Komplett neu"-Analyse wird der korrekt erkannte MwSt-Satz (0%) kurz gesetzt, dann aber sofort wieder auf 20% zurueckgesetzt. Der Benutzer sieht im Dropdown "20% (Normal)" statt "0% (Steuerfrei)".

## Ursache

In `src/pages/Review.tsx` (Zeile 781-794) laufen zwei Aktionen direkt nacheinander:

1. `handleReanalysisUpdate` setzt `formData.vat_rate = "0"` (korrekt)
2. `onReanalyzeComplete` laedt den Beleg aus der Datenbank neu und ruft `populateForm()` auf
3. Da die Neuanalyse ueber `ReanalyzeOptions` die Datenbank NICHT aktualisiert (kein `receiptId` wird mitgesendet), steht in der DB noch `vat_rate = NULL`
4. `populateForm` setzt bei `NULL` den Standardwert `'20'` (Zeile 314)

Das Ergebnis: Die korrekte KI-Erkennung wird sofort von den veralteten DB-Werten ueberschrieben.

## Loesung

Den `onReanalyzeComplete`-Callback so aendern, dass er die Formular-Daten NICHT ueberschreibt. Stattdessen wird nur das Receipt-Objekt im `receipts`-Array aktualisiert (fuer die Sidebar/Navigation), aber `populateForm` wird NICHT aufgerufen, da die aktuellen Formular-Werte (aus `handleReanalysisUpdate`) bereits korrekt sind.

### Aenderung

```text
Vorher (Zeile 781-796):
  onReanalyzeComplete -> DB laden -> populateForm(data)

Nachher:
  onReanalyzeComplete -> DB laden -> nur receipts-Array aktualisieren, KEIN populateForm()
```

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Review.tsx` | `onReanalyzeComplete`-Callback: `populateForm(data)` entfernen (Zeile 793) |
