# Duplikat-Erkennung: "Inoffiziell" ignorieren, Betrag/Datum nur ohne Rechnungsnummer, nie automatisch löschen

## Befund aus den Daten

- `Maler Walter`: 330,00 EUR (20.02.) und 200,00 EUR (26.02.) sind gegenseitig als Duplikat markiert (Score 95) — einziges gemeinsames Merkmal ist die Rechnungsnummer `Inoffiziell`.
- Dieselbe Kette zieht sich über völlig verschiedene Lieferanten (`Ivana Pavosevic`, `Franz Pilz`, `Lena Pichler`, `Dani Musler Mama`, `Kieneswenger Florian`, `Pilz Herbert`), Beträge 100–450 EUR, alle mit `invoice_number = 'Inoffiziell'`.
- Ursache: die Regel "nur Rechnungsnummer" (Score 70) prüft weder Lieferant noch Betrag/Datum, und Platzhalter-Nummern werden wie echte Nummern behandelt.
- Der Tag `Inoffiziell` existiert (13 Belege); zusätzlich steht "Inoffiziell" bei vielen Belegen direkt im Feld Rechnungsnummer.
- Invoice/Receipt/Faktura steht nicht in einem eigenen Feld, sondern im Dateinamen (z. B. `Receipt-2789-9010.pdf` vs. `Invoice-EIMEUTC1-0001.pdf`) und teilweise in der Beschreibung.

## Neue Regeln

### 1. Gleiche Rechnungsnummer = Duplikat
Stimmt die Rechnungsnummer überein (und ist sie echt, siehe Regel 2), gilt der Beleg als Duplikat — unabhängig von Betrag und Datum. Zusätzlich muss der Lieferant zusammenpassen, damit zufällig gleiche Nummern verschiedener Lieferanten nicht verkettet werden.

### 2. Platzhalter-Rechnungsnummern zählen nicht
Rechnungsnummern, die "inoffiziell" enthalten (Groß-/Kleinschreibung egal), sowie leere und generische Werte ("ohne", "keine", "n/a", "-") gelten als *keine* Rechnungsnummer. Belege mit dem Tag `Inoffiziell` werden von der automatischen Duplikatmarkierung komplett ausgenommen.

### 3. Ohne Rechnungsnummer: Betrag und Datum als Ausschluss
Gibt es keine verwertbare Rechnungsnummer, entscheiden Betrag und Datum:
- Betrag: Abweichung bis **±20 %** erlaubt
- Datum: Abweichung bis **±3 Tage** erlaubt

Liegt einer der beiden bekannten Werte außerhalb der Toleranz, ist es kein Duplikat. Identischer Datei-Hash bleibt immer ein Duplikat.

### 4. Rechnung und Zahlungsbeleg
Zwei Belege desselben Lieferanten mit gleicher Rechnungsnummer und gleichem Betrag, bei denen einer als Rechnung erkennbar ist ("Invoice", "Rechnung", "Faktura") und der andere als Zahlungsbeleg ("Receipt", "Quittung", "Zahlungsbeleg", "Payment"): der Zahlungsbeleg wird als Duplikat der Rechnung markiert, mit dem Hinweis "Zahlungsbeleg zur Rechnung".

**Nichts wird automatisch gelöscht** — Markierung erfolgt in der Duplikat-Ansicht, das Löschen bleibt bei dir.

## Bereinigung der bestehenden Fehlmarkierungen

Einmalig werden alle Duplikat-Markierungen aufgehoben, die nur auf einer Platzhalter-Rechnungsnummer beruhten oder bei denen weder Rechnungsnummer noch Betrag/Datum innerhalb der Toleranz passen. Die betroffenen Belege gehen zurück in ihren normalen Status (kein Löschen).

## Technische Details

- Neue gemeinsame Helfer in `src/services/duplicateDetectionService.ts` und als Deno-Variante unter `supabase/functions/_shared/`: `isPlaceholderInvoiceNumber`, `amountWithinTolerance` (relativ zum größeren Betrag), `dateWithinTolerance` (UTC-normalisierte Kalendertage), `classifyDocumentKind` (invoice | payment_receipt | unknown aus `file_name`, `custom_filename`, `description`).
- `checkForDuplicates`: Reihenfolge Hash → Rechnungsnummer + Lieferant (Score 95, ohne Betrags-/Datumsbedingung) → Betrag + Datum + Lieferant mit Toleranzfenster (Score 90/80) → Betrag + Datum mit Toleranz (Score 60). Die bisherige Regel "nur Rechnungsnummer ohne Lieferant" entfällt.
- SQL-Vorfilter nutzt Datums- und Betragsfenster statt exakter Gleichheit, damit knappe OCR-Abweichungen weiterhin gefunden werden; tolerierte Abweichungen senken den Score um 10 Punkte und werden in der Begründung genannt.
- `supabase/functions/extract-receipt/index.ts` (Nachprüfung nach der KI-Extraktion): dieselbe Platzhalter-, Toleranz- und Invoice/Receipt-Logik vor dem Markieren.
- Tag-Ausnahme über `receipt_tags`/`tags` (Tagname `Inoffiziell`, case-insensitive).
- Bereinigung als einmalige Datenaktualisierung, keine Schemaänderung.
