# Duplikat-Erkennung: Betrag/Datum als Ausschluss, "Inoffiziell" ignorieren, Zahlungsbeleg-Regel

## Befund aus den Daten

Die Prüfung der betroffenen Belege bestätigt das Problem:

- `Maler Walter`: zwei Belege mit 330,00 EUR (20.02.) und 200,00 EUR (26.02.) sind gegenseitig als Duplikat markiert (Score 95) — einziges gemeinsames Merkmal ist die Rechnungsnummer `Inoffiziell`.
- Weitere Fälle über völlig verschiedene Lieferanten hinweg (`Ivana Pavosevic`, `Franz Pilz`, `Lena Pichler`, `Dani Musler Mama`, `Kieneswenger Florian`, `Pilz Herbert`) hängen alle an derselben Kette — alle mit `invoice_number = 'Inoffiziell'`, Beträge zwischen 100 und 450 EUR.
- Ursache: die Regeln "Rechnungsnummer + Lieferant" (Score 95) und "nur Rechnungsnummer" (Score 70) prüfen weder Betrag noch Datum, und die Regel mit Score 70 prüft nicht einmal den Lieferanten.
- Der Tag `Inoffiziell` existiert (13 Belege), zusätzlich steht "Inoffiziell" bei vielen Belegen direkt im Feld Rechnungsnummer.
- Invoice/Receipt/Faktura steht nicht in einem eigenen Feld, sondern im Dateinamen (z. B. `Receipt-2789-9010.pdf` vs. `Invoice-EIMEUTC1-0001.pdf`) und teilweise in der Beschreibung.

## Neue Regeln

### 1. Betrag und Datum sind harte Ausschlusskriterien
Ein Beleg ist nur dann ein Duplikat, wenn beides plausibel passt:
- Betrag: Abweichung bis **±20 %** erlaubt
- Datum: Abweichung bis **±3 Tage** erlaubt

Ist einer der beiden Werte bekannt und außerhalb der Toleranz, ist es **kein** Duplikat — auch bei identischer Rechnungsnummer. Einzige Ausnahme: identischer Datei-Hash (physisch dieselbe Datei).

### 2. Platzhalter-Rechnungsnummern zählen nicht
Rechnungsnummern, die "inoffiziell" enthalten (unabhängig von Groß-/Kleinschreibung) — ebenso leere Werte und generische Platzhalter wie "ohne", "keine", "n/a", "-" — werden bei der Duplikatprüfung wie "keine Rechnungsnummer" behandelt. Belege mit dem Tag `Inoffiziell` werden von der automatischen Duplikatmarkierung ganz ausgenommen.

### 3. Lieferant ist Pflicht bei der Nummern-Regel
Die Regel "nur Rechnungsnummer" (Score 70) matcht künftig nur noch bei passendem Lieferanten und innerhalb der Betrags-/Datumstoleranz.

### 4. Rechnung schlägt Zahlungsbeleg
Wenn zwei Belege desselben Lieferanten dieselbe Rechnungsnummer und denselben Betrag haben, und einer als Rechnung erkennbar ist (Dateiname/Beschreibung enthält "Invoice", "Rechnung", "Faktura") und der andere als Zahlungsbeleg ("Receipt", "Quittung", "Zahlungsbeleg", "Payment"), dann ist der Zahlungsbeleg der Nachrang: er wird als Duplikat der Rechnung markiert, mit dem Hinweis "Zahlungsbeleg zur Rechnung".

Damit nichts unbeabsichtigt verloren geht, wird der Zahlungsbeleg zunächst markiert statt sofort gelöscht. In der Duplikat-Ansicht gibt es dafür eine Sammelaktion "Zahlungsbelege löschen", mit der alle so erkannten Belege auf einmal entfernt werden.

## Bereinigung der bestehenden Fehlmarkierungen

Einmalig werden alle bestehenden Duplikat-Markierungen aufgehoben, die nach den neuen Regeln keine sind — konkret alle, deren einziges Übereinstimmungsmerkmal eine Platzhalter-Rechnungsnummer war oder bei denen Betrag oder Datum außerhalb der Toleranz liegen. Die betroffenen Belege gehen zurück in ihren normalen Status.

## Technische Details

- Neue gemeinsame Helfer in `src/services/duplicateDetectionService.ts` und als Deno-Variante unter `supabase/functions/_shared/`: `isPlaceholderInvoiceNumber`, `amountWithinTolerance` (relativ zum größeren Betrag), `dateWithinTolerance` (UTC-normalisierte Kalendertage), `classifyDocumentKind` (invoice | payment_receipt | unknown, aus `file_name`, `custom_filename`, `description`).
- `checkForDuplicates`: Hash-Regel unverändert; alle übrigen Regeln laden Kandidaten inkl. Betrag/Datum/Dateiname und filtern anschließend über die Toleranz- und Platzhalter-Prüfung. SQL-Vorfilter nutzt Datums- und Betragsfenster statt exakter Gleichheit, damit knappe OCR-Abweichungen weiterhin gefunden werden. Score bei tolerierten Abweichungen um 10 Punkte reduziert, Begründung nennt "Betrag/Datum leicht abweichend".
- `supabase/functions/extract-receipt/index.ts` (Nachprüfung nach der KI-Extraktion): dieselbe Toleranz-, Platzhalter- und Invoice/Receipt-Logik vor dem Markieren.
- Tag-Ausnahme über `receipt_tags`/`tags` (Tagname `Inoffiziell`, case-insensitive).
- Bereinigung als einmalige Datenaktualisierung, keine Schemaänderung.
