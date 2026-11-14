# Skonto manuell erfassen

## Ziel
Bei jedem Beleg kann man ein Skonto eintragen, wenn man mit Skonto überwiesen hat. Es wird nicht automatisch erkannt.

## Verhalten
- Eingabe im Beleg (Review und Ausgaben): Feld **Skonto %** oder **Skonto €**. Das jeweils andere wird automatisch berechnet. Leer bzw. 0 heißt kein Skonto.
- Anzeige: Rechnungsbetrag (brutto), Skonto, **Zahlbetrag** (= Brutto − Skonto).
- Steuer: Netto und Vorsteuer werden im Verhältnis des Skontos gekürzt. Beispiel: 120 € brutto (100 + 20 USt), 2 % Skonto → Skonto 2,40 €, bezahlt 117,60 €, davon Netto 98,00 €, USt 19,60 €.
- Bei Belegen mit mehreren Steuersätzen oder Positionen wird jeder Satz anteilig gekürzt.
- Die ursprünglichen Rechnungsbeträge bleiben gespeichert, damit Skonto jederzeit entfernt werden kann.

## Wo es überall wirkt
1. **Beleg-Detail** (Review, Ausgaben): Eingabe und Anzeige des Zahlbetrags.
2. **Ausgabenliste**: kleines Skonto-Kennzeichen; Summen rechnen mit gekürzten Beträgen.
3. **Dashboard und Auswertungen**: gekürzte Beträge.
4. **Kontoabgleich**: Abgleich mit dem Zahlbetrag, damit die Bankbuchung exakt passt. Wird ein Skonto-Vorschlag bestätigt, wird das Skonto am Beleg gespeichert.
5. **Exporte** (Excel/CSV, Steuerberater-Format): neue Spalten Skonto und Zahlbetrag; Netto/USt gekürzt; das Skonto-Feld im Steuerberater-Format wird befüllt.
6. **MCP**: Skonto lesbar und über `update_receipt` setzbar.

## Technische Details
- Neue Spalten in `receipts`: `skonto_percent numeric`, `skonto_amount numeric` (nullable).
- Zentrale Hilfsfunktion `src/lib/skonto.ts`: `applySkonto(receipt)` liefert gekürzte Brutto/Netto/USt (auch pro Steuersatz bzw. Split-Zeile), 0 bleibt 0 (`??`). Alle Stellen oben nutzen nur diese Funktion.
- `reconcile-with-skonto` und `auto-reconcile`: Vergleichsbetrag = Zahlbetrag; im Apply-Modus `skonto_amount` / `skonto_percent` am Beleg setzen.
- Tests für die Rechenregeln (Beispiel oben, Prozent↔Betrag, gemischte Sätze, kein Skonto).
