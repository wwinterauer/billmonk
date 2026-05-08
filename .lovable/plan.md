## Ziel
Der CSV-Import (`/bank-import`) bricht mit „Datumsspalte nicht gefunden" ab. Ursache ist meist eines davon: die echte Kopfzeile steht nicht in Zeile 1 (viele AT-Banken haben 5–15 Zeilen Meta-Daten davor), die Spalten heißen anders als in `bankConfigs` hinterlegt, oder Betrag steht in zwei Spalten (Soll/Haben) statt einer.

## Was ich umbauen werde (`src/hooks/useBankImport.ts`)

### 1. Auto-Header-Erkennung
Statt fix `rows[skipRows]` zu nehmen: die ersten ~20 Zeilen scannen und die erste Zeile finden, die nach „Header" aussieht (mehrere nicht-numerische Felder + enthält ein bekanntes Datums-/Betrags-Keyword wie `datum|date|buchung|valuta|betrag|amount|umsatz`). So funktionieren auch Exporte mit Vorspann (Kontonummer, Zeitraum, Leerzeilen).

### 2. Mehr Spalten-Aliase + bessere Fuzzy-Suche
- `dateColumn`: zusätzlich `Umsatztag`, `Buchung`, `Buchungs-/Wertstellungsdatum`, `Datum/Zeit`, `Posting Date`
- `amountColumn`: `Umsatz`, `Umsatzbetrag`, `Betrag in EUR`, `Wert`, `Saldo` ausschließen
- `descriptionColumn`: `Umsatzbezeichnung`, `Auftraggeber/Empfänger`, `Verwendungszweck 1`, `Text`, `Memo`
- `findColumn` zusätzlich Sonderzeichen entfernen (`/ - . ()`), damit `Buchungs-/Wertstellungsdatum` matcht.

### 3. Soll/Haben als Alternative zu einer Betragsspalte
Wenn keine einzelne Betragsspalte gefunden wird, nach Paaren suchen: `Soll`+`Haben`, `Belastung`+`Gutschrift`, `Debit`+`Credit`. Betrag = Haben − Soll, `isExpense` entsprechend.

### 4. Robusteres Datum-Parsing
- BOM (`\uFEFF`) am Dateianfang entfernen, sonst matcht der erste Header nicht.
- Zusätzlich `DD-MM-YYYY`, `YYYY/MM/DD`, `DD.MM.YY` (zweistelliges Jahr → 20YY).
- Excel-Seriennummern (z. B. `45234`) erkennen und in Datum umrechnen, falls die Spalte numerisch ist.

### 5. Bessere Fehlermeldung
Wenn nichts geht: erkannte Header in der Fehlermeldung mit anzeigen („Gefundene Spalten: …") – dann sieht man sofort, was fehlt.

## Nicht im Scope
- Kein UI-Mapping-Schritt (manuelle Spalten-Zuordnung). Falls die Auto-Erkennung trotzdem fehlschlägt, machen wir das in einem zweiten Schritt.
- Keine Änderungen an Import-Logik nach dem Parsen, an RLS oder an Edge Functions.

## Danach
Sobald du die CSV anhängst, prüfe ich konkret welche Spaltennamen drinstehen und ergänze sie zusätzlich fix in `bankConfigs` für die jeweilige Bank.
