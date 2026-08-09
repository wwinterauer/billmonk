# Brutto/Netto-Verwechslung bei der Belegerkennung beheben

## Befund (in der Datenbank geprüft)

Beleg ARG028730 (Kieninger) ist gespeichert mit:

- Brutto 190,87 / Netto 159,06 / MwSt 31,81 / 20 % / `vat_detection_method = line_items`

Richtig wäre: Netto 190,87 + 20 % = **229,04 Brutto**. Die KI hat also die Zeile „Total EUR ohne MwSt." als Gesamtbetrag genommen, und die Nachbearbeitung hat den Fehler zusätzlich zementiert: Die Positionspreise auf dieser Rechnung sind **Nettopreise**, ihre Summe (190,87) stimmte mit dem KI-Wert überein, und die „Truth-from-Line-Items"-Logik behandelt Positionssummen grundsätzlich als Bruttowerte — dadurch wurde 190,87 als Brutto bestätigt und 159,06 herausgerechnet.

Das betrifft nicht nur diesen Beleg: Jede Rechnung mit Netto-Positionspreisen und einer Netto-Summenzeile kann so um den Steuersatz zu niedrig erfasst werden.

## Was geändert wird

### 1. Eindeutige Vorgaben im Extraktions-Prompt

Der Prompt sagt aktuell nur „BETRÄGE: Dezimalzahlen ohne Währungssymbol". Es fehlt die Definition, was Brutto ist. Ergänzt wird ein klarer Abschnitt:

- `total_amount` = **immer der Endbetrag inklusive MwSt.** (Zeilen wie „Summe inkl. MwSt.", „Gesamtbetrag brutto", „Zu zahlen", „Rechnungsbetrag", „Total incl. VAT").
- `net_amount` = Betrag **ohne** MwSt. („Total ohne MwSt.", „Nettosumme", „Zwischensumme", „Warenwert netto").
- Ausdrücklicher Warnhinweis: Steht „ohne MwSt." / „exkl." / „netto" / „zzgl. MwSt." in der Zeile, darf dieser Wert **niemals** in `total_amount`.
- Bei mehreren Summenzeilen gilt der **höchste** Betrag am Ende des Summenblocks als Brutto.
- Neues Schemafeld `line_items_are_net` (Boolean): Ist true, wenn die Positionspreise ohne MwSt. ausgewiesen sind (typisch für B2B-Rechnungen).

### 2. Plausibilitätsprüfung nach der Extraktion

In der Belegerkennung wird vor dem Speichern geprüft und korrigiert:

- Liefert die KI `net_amount` und `tax_amount` > 0 und ist `total_amount` praktisch gleich `net_amount` (Abweichung < 1 %), dann ist die Brutto-Zeile verwechselt worden → Brutto wird auf `net_amount + tax_amount` korrigiert.
- Ebenso, wenn `total_amount ≈ net_amount` und ein Steuersatz > 0 bekannt ist → Brutto = Netto × (1 + Satz/100).
- Jede solche Korrektur wird geloggt und die Erkennungssicherheit für die MwSt. leicht gesenkt, damit der Beleg eher in die Prüfung wandert statt automatisch freigegeben zu werden.

### 3. „Truth-from-Line-Items" netto-fähig machen

Die Logik, die Positionssummen als Wahrheit nimmt, behandelt jede Positionssumme als Brutto. Künftig gilt:

- Ist `line_items_are_net = true` **oder** entspricht die Positionssumme dem ausgewiesenen Nettobetrag (statt dem Brutto), werden die Positionen als Nettowerte behandelt: Brutto = Summe × (1 + Satz/100), bei gemischten Sätzen je Satzgruppe getrennt.
- Die Netto/MwSt./Brutto-Werte werden konsistent daraus abgeleitet, sodass Netto + MwSt = Brutto immer aufgeht.

### 4. Bestehende Belege korrigieren

- Abfrage aller Belege, bei denen die Verwechslung erkennbar ist (Brutto entspricht der Nettosumme, obwohl ein Steuersatz > 0 vorliegt), zunächst als Auflistung zur Kontrolle.
- Nach Freigabe: ARG028730 direkt auf 229,04 / 190,87 / 38,17 korrigieren und die weiteren betroffenen Belege in einem Durchlauf neu berechnen.

## Technische Details

- `supabase/functions/extract-receipt/index.ts`: Prompt-Abschnitt „BETRÄGE" erweitern, Schemafeld `line_items_are_net` ergänzen, Post-Processing um die Brutto/Netto-Plausibilisierung erweitern und den Single-Rate- sowie Mixed-Rate-Zweig der Line-Item-Logik netto-fähig machen.
- Anschließend Function neu deployen und mit dem Kieninger-Beleg gegenprüfen (erneute Analyse, Ergebnis vergleichen).
