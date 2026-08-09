# Automatischer Abgleich: PayPal-Buchungen mit IONOS-Rechnungen

## Warum aktuell nichts gematcht wird

Geprüft an deinen echten Daten (4,20 EUR):

- Die Bankbuchungen lauten auf "Zahlungsempfänger: PayPal Europe S.a.r.l. ... Verwendungszweck: 1051202" – der eigentliche Lieferant (IONOS SE) steht nirgends im Text.
- Die Rechnungsnummern der IONOS-Belege (z. B. 100189032295) kommen im Verwendungszweck nicht vor; dort steht nur eine PayPal-interne Nummer.
- Damit scheitert Durchgang 1 (Betrag + Rechnungsnummer oder Lieferantenname im Text).
- Durchgang 2 (nur Betrag, ±14 Tage) verlangt **genau einen** passenden Beleg. Bei 4 Buchungen à 4,20 EUR und 4 IONOS-Belegen à 4,20 EUR ist die Zuordnung mehrdeutig – deshalb wird bewusst gar nichts zugeordnet.

Also kein Bug, sondern eine zu strenge Eindeutigkeitsregel plus fehlendes Wissen über Zahlungsdienstleister.

## Was gebaut wird

### 1. Zahlungsdienstleister erkennen (PayPal, Klarna, Stripe, Amazon Pay, Apple Pay)
Steht ein solcher Name als Zahlungsempfänger im Buchungstext, wird er nicht mehr als "Lieferant" gewertet. Die Buchung gilt dann als "Lieferant unbekannt" und wird nur über Betrag + Datum zugeordnet – statt am Namensvergleich zu scheitern.

### 2. Gruppen-Zuordnung bei gleichen Beträgen
Neuer dritter Durchgang: Buchungen und Belege mit identischem Betrag werden als Gruppe betrachtet. Passen beide Gruppen zusammen (gleicher Betrag, jede Buchung hat genau einen Beleg im Zeitfenster), werden sie paarweise nach Datum zugeordnet – älteste Buchung zum ältesten Beleg usw.

Sicherheitsregeln, damit nichts falsch verknüpft wird:
- Nur wenn alle Belege der Gruppe denselben Lieferanten haben.
- Nur wenn Anzahl Buchungen und Anzahl Belege gleich sind (sonst bleibt alles offen).
- Zeitfenster ±14 Tage zwischen Beleg- und Buchungsdatum.
- Diese Treffer werden als "niedrige Sicherheit" gezählt und im Ergebnis separat ausgewiesen.

### 3. Rückmeldung im UI
Das Ergebnis des Abgleichs zeigt künftig zusätzlich, wie viele Treffer über die Gruppenlogik kamen, damit du sie gezielt gegenprüfen kannst.

## Technische Details

- `supabase/functions/auto-reconcile/index.ts`:
  - Neue Konstante `PAYMENT_PROCESSORS` und Hilfsfunktion, die den Zahlungsempfänger-Teil des Buchungstexts erkennt und Prozessor-Namen aus den Vendor-Tokens entfernt.
  - Neuer `findGroupMatches()`-Durchgang nach `findExactMatch`: gruppiert offene Ausgaben und Pool-Kandidaten nach auf Cent gerundetem Betrag, prüft gleiche Anzahl + einheitlicher Lieferant + Datumsfenster, ordnet sortiert nach Datum paarweise zu.
  - Antwort erhält zusätzliches Feld `group_matched`.
- `src/pages/Reconciliation.tsx`: Toast/Ergebnisanzeige um die Gruppen-Treffer erweitern.

Kein Datenbankschema-Änderung nötig; bestehende manuelle Zuordnung und Aufhebung bleiben unverändert.
