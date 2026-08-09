# Original-Beleg nach PDF-Split löschen

## Ausgangslage
Beim Aufteilen eines PDFs in mehrere Rechnungen wird der Original-Beleg aktuell **nicht gelöscht**, sondern nur auf `status = 'split'` gesetzt. Der Datensatz und die Original-PDF-Datei bleiben erhalten und können in Listen/Auswertungen als scheinbarer Doppeleintrag auftauchen.

## Ziel
Nach einem erfolgreichen Split wird der Original-Beleg samt Datei entfernt. Nur die neuen Teile-Belege bleiben bestehen.

## Geplante Änderungen

### 1. Datenbank: FK-Verhalten anpassen
- Die Fremdschlüssel-Beziehung `receipts_split_from_receipt_id_fkey` verhindert aktuell das Löschen des Originals, weil die Teile-Belege darauf verweisen.
- Migration: `ON DELETE SET NULL` für diesen FK setzen, damit die Teile-Belege erhalten bleiben und ihre Herkunftsreferenz sauber auf `NULL` gesetzt wird, wenn das Original gelöscht wird.

### 2. Edge Function `split-pdf` erweitern
- Nachdem alle Teile erfolgreich erstellt und hochgeladen wurden:
  1. Original-PDF-Datei aus dem `receipts`-Storage-Bucket löschen.
  2. Original-Beleg-Datensatz aus `public.receipts` löschen (statt nur `status = 'split` zu setzen).
- Fehler beim Löschen werden geloggt, führen aber nicht zum Abbruch der Antwort, damit der User die neuen Teile sofort sieht.

### 3. Frontend: Sicherheitsnetz für bestehende Daten
- In `Expenses.tsx` und anderen Listen, die alle Belege ohne Status-Filter laden, `status = 'split'` weiterhin ausschließen.
- Damit werden eventuell noch vorhandene alte "split"-Originale nicht mehr als Doppeleinträge angezeigt.

### 4. UI-Anpassungen
- `SplitStatusBadge`: Status `split` wird künftig selten angezeigt, aber das Icon/Label bleibt für eventuelle Rückfragen erhalten.
- In den Teile-Belegen bleibt der Hinweis "Teil" erhalten; die Verknüpfung zum Original verschwindet nach dem Löschen (durch `ON DELETE SET NULL`).

## Auswirkungen
- Keine doppelten Rechnungen mehr nach einem Split.
- Speicherplatz der Original-PDF wird freigegeben.
- Teile-Belege bleiben vollständig erhalten und werden normal weiterverarbeitet.
