# Suche nach Beträgen im Kontoabgleich

Heute durchsucht das Suchfeld im Kontoabgleich ausschließlich den Buchungstext (`description`). Gibt man "3,36" ein, kommt nichts, weil der Betrag nicht Teil des Textes ist.

## Was gebaut wird

Das bestehende Suchfeld wird zu einer kombinierten Suche: Text **oder** Betrag — je nachdem, was eingegeben wird. Kein zweites Feld, keine Umschaltung.

- **Text eingeben** (z. B. "PayPal") → wie bisher Suche im Buchungstext.
- **Zahl eingeben** (z. B. `3,36`, `3.36`, `-3,36`, `1.234,50`) → findet alle Buchungen mit diesem Betrag, unabhängig vom Vorzeichen (Ein- und Ausgänge), zusätzlich weiterhin Treffer im Buchungstext (falls die Zahl z. B. Teil einer Rechnungsnummer ist).
- **Bereichssuche** mit Operator: `>100`, `<50`, `100-200` (bzw. `100..200`) filtert nach Betragsspanne über den absoluten Betrag.
- Kleine Rundungstoleranz von ±0,005 bei der exakten Betragssuche, damit Nachkommastellen sicher treffen.

Der Platzhalter im Feld wird angepasst: "Suche: Text, Betrag (3,36) oder Bereich (>100)". Darunter erscheint ein dezenter Hinweis-Chip, sobald die Eingabe als Betragssuche erkannt wurde, damit klar ist, wonach gerade gefiltert wird.

Die Seitennummerierung setzt bei Änderung der Suche weiterhin auf Seite 1 zurück, und der Filter greift auch beim Serverzähler ("X Buchungen"), da er Teil der Datenbankabfrage ist.

## Technische Details

- Neuer Helper `parseAmountQuery(input)` in `src/pages/Reconciliation.tsx` (bzw. `src/lib/`): erkennt reine Zahlen, deutsches und englisches Dezimalformat, Tausenderpunkte, führende Operatoren `>`, `>=`, `<`, `<=` und Bereiche `a-b` / `a..b`. Rückgabe: `null` (reine Textsuche) oder `{ kind: 'exact' | 'gt' | 'lt' | 'range', value(s) }`.
- In der `bank_transactions`-Query (Zeilen ~425) wird der Filter erweitert:
  - Exakter Betrag: `query.or('and(amount.gte.X1,amount.lte.X2),and(amount.gte.-X2,amount.lte.-X1),description.ilike.*q*')` — deckt positive und negative Beträge sowie den Textfall ab.
  - Bereich/Operator: analoge `or()`-Gruppe für positives und negatives Intervall.
  - Nur Text: unverändert `ilike` auf `description`.
- `queryKey` bleibt `searchQuery`-basiert; keine zusätzliche State-Variable nötig, die Interpretation passiert bei der Abfrage.
- Reine Frontend-/Query-Änderung: keine Migration, keine Edge Function, keine Änderung an der Abgleichslogik.
