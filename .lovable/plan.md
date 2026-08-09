# Warum nur 1 IONOS-Beleg zugeordnet wurde – und wie der Abgleich schlauer wird

## Befund aus den Daten

Abfragen auf die offenen Buchungen und Belege zeigen genau zwei Blocker:

- **3,36 €**: 12 offene PayPal-Buchungen stehen 12 offenen IONOS-Belegen gegenüber — aber die Belege haben **zwei Lieferantenschreibweisen** ("IONOS" bei 3 Belegen, "IONOS SE" bei 9). Die Gruppen-Zuordnung verlangt aktuell genau *einen* Lieferantennamen in der Gruppe und bricht deshalb komplett ab.
- **10,76 €**: 7 offene Buchungen gegen 14 offene Belege. Die Gruppen-Zuordnung verlangt **exakt gleich große Gruppen** und bricht ebenfalls ab.

Der eine bereits verknüpfte 3,36-Beleg stammt aus einem früheren Lauf, als der Betrag noch eindeutig war.

Die restlichen Fälle landen zwar in den Vorschlägen, werden dort aber als "mittel" eingestuft und sind daher nicht vorausgewählt — es sieht so aus, als wäre nichts passiert.

## Was geändert wird

**1. Gruppen-Zuordnung nicht mehr "alles oder nichts"**
- Ungleich große Gruppen werden erlaubt: Es wird so weit gepaart, wie beide Seiten reichen (7 Buchungen gegen 14 Belege → 7 Paare, chronologisch nach Datum, jeweils der zeitlich nächstliegende offene Beleg).
- Lieferanten werden über einen **normalisierten Schlüssel** verglichen: Rechtsformen und Zusätze (SE, GmbH, AG, S.a.r.l., Ltd., …) werden abgeschnitten, zusätzlich zählen Markenname (`vendor_brand`), hinterlegte Rechtsnamen und Schlagwörter. "IONOS" und "IONOS SE" gelten damit als derselbe Lieferant.
- Sicherheitsnetz bleibt: automatisch zugeordnet wird nur, wenn der Zahlungsempfänger ein Zahlungsdienstleister ist (PayPal, Klarna …) oder der Lieferant im Buchungstext steht, alle Belege derselben Betragsgruppe zum selben Lieferanten gehören und die Datumsdifferenz im Fenster liegt (±14 Tage, für Zahlungsdienstleister ±21 Tage, da PayPal-Abbuchungen verzögert kommen).

**2. Vorschläge deutlicher und vorausgewählt**
- Wenn alle Belege einer Betragsgruppe zum selben (normalisierten) Lieferanten gehören und die Datumszuordnung eindeutig chronologisch ist, steigt die Bewertung auf "hoch" — solche Vorschläge sind im Dialog vorausgewählt und lassen sich mit einem Klick übernehmen.
- In der Vorschlagsliste wird der Grund sichtbar ergänzt: "Lieferant gleich (IONOS)", "Gruppe 7 von 14 Belegen".

**3. Nachvollziehbarkeit**
- Der Abgleich protokolliert pro Betragsgruppe, warum nicht automatisch zugeordnet wurde (Anzahl Buchungen/Belege, Lieferantenvarianten, Datumsabstand). Das erscheint als aufklappbarer Abschnitt "Nicht zugeordnet – Gründe" im Ergebnis-Dialog, damit solche Fälle künftig ohne Nachfrage erkennbar sind.

## Technische Details

- `supabase/functions/_shared/reconcileHelpers.ts`
  - Neu: `vendorMatchKey(name)` — normalisiert und entfernt Rechtsformen/Zusätze.
  - `buildGroupPairs`: Bedingung `cands.length !== group.length` entfällt; stattdessen greedy chronologische Paarung über `min(n_tx, n_cand)`, Vendor-Prüfung über `vendorMatchKey`, konfigurierbares Datumsfenster, Rückgabe zusätzlich mit `unpairedTx`/`unpairedCandidates` und Gruppen-Diagnose.
  - `buildSuggestions`: Confidence-Regel erweitert (einheitlicher `vendorMatchKey` in der Gruppe + Datumsnähe ≤ 21 Tage ⇒ `high`), Gründe um Lieferanten- und Gruppeninfo ergänzt.
- `supabase/functions/reconcile-with-skonto/index.ts`: Kandidaten-Pool liefert `vendorKey` aus Vendor + `vendor_brand` + `legal_names`; Gruppen-Pass nutzt das erweiterte Ergebnis; neues Feld `group_diagnostics` in der Antwort.
- `src/components/reconciliation/SkontoReconcileDialog.tsx`: neue Props `diagnostics`, Anzeige der Gruppen-Gründe, erweiterte Reason-Badges.
- `src/pages/Reconciliation.tsx`: `group_diagnostics` durchreichen.
- Tests der Helper gegen die realen Konstellationen (12/12 mit zwei Schreibweisen, 7/14) vor dem Deploy.
- Keine Datenbankmigration nötig; keine bestehenden Verknüpfungen werden verändert.
