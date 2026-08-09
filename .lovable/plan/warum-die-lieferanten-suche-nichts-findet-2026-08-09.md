# Warum die Lieferanten-Suche nichts findet

## Befund (aus der Datenbank geprüft)

Die Suche funktioniert – aber bei den meisten offenen Belegen gibt es schlicht **keinen Lieferanten zum Suchen**.

- 227 Belege stehen aktuell im Review.
- Davon haben **183 weder Lieferant noch Marke** – und auch keinen Betrag, kein Datum, keine Kategorie.
- Bei 182 dieser Belege lief die KI-Analyse zwar an (Zeitstempel gesetzt, ~1 Sekunde nach Upload), lieferte aber **kein Ergebnis** (leere Antwort). Trotzdem wurden sie auf Status „Review" gesetzt – sie sehen im Review also aus wie normale Belege, sind aber leere Hüllen.
- Alle 182 stammen aus dem Upload-Block vom 08.08. um 16:55 Uhr – das ist genau der Zeitraum, in dem das Guthaben-/Ratenlimit zugeschlagen hat.
- „Ionos" kommt in keinem Lieferantenfeld und in keinem Dateinamen vor – die Ionos-Rechnungen stecken mit hoher Wahrscheinlichkeit in diesen 182 leeren Belegen.

Kurz: kein Suchproblem, sondern ein Datenproblem plus ein Statusproblem.

## Was gemacht wird

### 1. Die 182 leeren Belege erneut analysieren
Alle Belege ohne Lieferant/Betrag, bei denen die Analyse ergebnislos war, werden erneut durch die Extraktion geschickt (in kleinen Blöcken, damit kein Limit wieder zuschlägt). Danach haben sie Lieferant, Marke, Betrag und Datum – und sind sofort suchbar.

### 2. Leere Extraktionen dürfen nicht mehr als „fertig" gelten
In der Verarbeitungslogik: wenn die KI kein verwertbares Ergebnis liefert (kein Lieferant **und** kein Betrag), wird der Beleg nicht mehr auf „Review" gesetzt, sondern als Problembeleg markiert. Damit landet er im bereits vorhandenen Tab „Problembelege" mit Retry-Button, statt still im Review-Stapel zu verschwinden.

### 3. Aufräum-Hinweis im Review
Im Review-Tab ein dezenter Hinweis, wenn Belege ohne erkannte Daten vorhanden sind, mit Button „Erneut analysieren" – nutzt die bestehende Retry-Logik.

### 4. Suche robuster machen (kleine Ergänzung)
Die Suche prüft zusätzlich den **Dateinamen** und die Beschreibung, damit auch Belege ohne erkannten Lieferanten auffindbar sind.

## Technische Details

- Nachverarbeitung der 182 Datensätze über die bestehende `extract-receipt` Edge Function, sequenziell mit Pause, Fortschritt protokolliert.
- Statuslogik in `src/hooks/useReceiptProcessing.ts` (bzw. der Stelle, die nach der Extraktion `status: 'review'` setzt): Leerergebnis → `failed`/Problemstatus statt `review`.
- `src/components/receipts/ProblemReceiptsPanel.tsx` und `useReceiptRetry` bleiben unverändert und greifen automatisch.
- `matchesVendorSearch` in `src/pages/Review.tsx` um `file_name` und `description` erweitern.
- Keine Schemaänderung nötig.
