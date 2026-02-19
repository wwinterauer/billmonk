
# Fix: Review-Seite springt nach Neuanalyse weiter + Daten werden nicht aktualisiert

## Problem

Drei zusammenhaengende Fehler:

1. **Navigation springt auf ersten Beleg**: Nach jeder Neuanalyse wird `onReanalyzeComplete` aufgerufen, was `loadReceipts()` ausfuehrt. Diese Funktion laedt alle Belege neu und zeigt immer den **ersten** Beleg an (Index 0) -- statt auf dem aktuellen Beleg zu bleiben.

2. **"Alle Betraege" nutzt falschen Analyse-Pfad**: Die Schnellzugriff-Optionen (inkl. "Alle Betraege") verwenden die Client-seitige `extractReceiptData()` Funktion, die das Bild direkt an die KI sendet. Die Edge Function aktualisiert dabei **nicht** die Datenbank. Die Ergebnisse werden nur lokal im Formular angezeigt, gehen aber beim Neuladen verloren.

3. **"Nur Ausgaben" aktualisiert DB, aber springt weg**: Die Expenses-Only-Analyse nutzt korrekt den `receiptId`-Pfad der Edge Function (DB wird aktualisiert), aber `onReanalyzeComplete` laesst die Seite wegspringen, bevor der Nutzer die neuen Daten sieht.

## Loesung

### 1. `onReanalyzeComplete` in Review.tsx aendern

Statt `loadReceipts()` (kompletter Reload) soll nur der **aktuelle Beleg** neu aus der DB geladen und das Formular aktualisiert werden:

```text
onReanalyzeComplete wird zu:
1. Aktuellen Beleg per getReceipt(currentReceipt.id) neu laden
2. populateForm() mit den neuen Daten aufrufen
3. currentIndex bleibt unveraendert
```

### 2. Einzelbeleg-Reload-Funktion erstellen

Neue Hilfsfunktion `reloadCurrentReceipt()` in Review.tsx:
- Laedt den aktuellen Beleg per `supabase.from('receipts').select('*').eq('id', id).single()`
- Aktualisiert `receipts[currentIndex]` im State
- Ruft `populateForm()` mit den neuen Daten auf
- Laedt das Bild nicht neu (ist bereits geladen)

### 3. onReanalyzeComplete Callback anpassen

```text
Vorher:  onReanalyzeComplete={() => loadReceipts()}
Nachher: onReanalyzeComplete={() => reloadCurrentReceipt()}
```

### 4. Gleiche Logik fuer ReceiptDetailPanel pruefen

Falls `ReceiptDetailPanel.tsx` ein aehnliches Muster hat, dort ebenfalls den Einzelbeleg-Reload statt Komplett-Reload verwenden.

---

## Betroffene Dateien

| Datei | Aenderungen |
|-------|------------|
| `src/pages/Review.tsx` | Neue `reloadCurrentReceipt()` Funktion, `onReanalyzeComplete` Callback anpassen |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Gleiche Anpassung falls betroffen |
