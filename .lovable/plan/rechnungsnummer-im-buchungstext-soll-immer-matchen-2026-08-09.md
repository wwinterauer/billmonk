# Rechnungsnummer im Buchungstext soll immer matchen

## Was ich in deinen Daten gefunden habe

Buchung vom 08.05.2026, 270,55 EUR, Empfänger Sowana Handels GmbH, Zahlungsreferenz `AR26-01918` – Status "unmatched".
Passender Beleg: Sowana Handels GmbH, Rechnungsnummer `AR26-01918`, Betrag **269,55** EUR, Belegdatum **12.02.2026**.

Zwei Gründe, warum der Abgleich nichts gefunden hat:

1. **Betrag weicht um 1,00 EUR ab.** Der Haupt-Pass verlangt Cent-Genauigkeit (Abweichung < 0,02).
2. **Datum liegt 85 Tage auseinander.** Der Haupt-Pass erlaubt max. 60 Tage, der Skonto-Pass max. 30 Tage (und nur 1–5 % Abweichung – hier sind es 0,37 %).

Die Rechnungsnummer stand also eindeutig im Text, wurde aber von den Betrags- und Datumsfiltern ausgesperrt, bevor sie überhaupt geprüft werden konnte.

## Lösung: Rechnungsnummer als stärkstes Signal behandeln

Neuer erster Pass "Referenz-Match", der vor allen anderen läuft:

- Enthält der Buchungstext die Rechnungsnummer eines offenen Belegs (normalisiert, ohne Bindestriche/Leerzeichen, mind. 5 Zeichen und mindestens eine Ziffer, damit keine Zufallstreffer entstehen), gilt das als Treffer.
- **Kein Datumsfenster** mehr (bzw. großzügig 365 Tage) – bezahlt wird oft Monate später.
- **Betragstoleranz** dabei: bis 5 % oder max. 10 EUR Abweichung (deckt Mahnspesen, Rundungen, Teilrabatte ab). Größere Abweichungen bleiben ausgeschlossen.
- **Nur eindeutige Treffer** werden automatisch zugeordnet: passt die Referenz auf mehrere Belege, wird nichts gesetzt.
- Skonto-Fall bleibt erhalten: liegt die Abweichung im Skonto-Bereich, wandert der Treffer weiterhin in die Skonto-Vorschlagsliste statt in die Auto-Zuordnung.

Die bestehenden Pässe (exakter Betrag, Lieferantenname, Gruppen-Pass für PayPal & Co.) bleiben unverändert und laufen danach auf den restlichen Buchungen.

## Rückmeldung im UI

Die Abschlussmeldung nennt zusätzlich, wie viele Buchungen **über die Rechnungsnummer** zugeordnet wurden – das sind die verlässlichsten Treffer.

## Technische Details

- `supabase/functions/_shared/reconcileHelpers.ts`: neue Funktion `findReferenceMatch(txDescription, candidates)` mit Normalisierung der Rechnungsnummer und Eindeutigkeitsprüfung; dazu `amountWithinReferenceTolerance(a, b)` (5 % oder 10 EUR).
- `supabase/functions/reconcile-with-skonto/index.ts`: Referenz-Pass als Pass 4a vor dem High-Confidence-Pass; Zähler `reference_applied` in der Antwort.
- `supabase/functions/auto-reconcile/index.ts`: identischer Pass, Zähler `reference_matched`.
- `src/pages/Reconciliation.tsx`: Zähler in der Toast-Meldung ergänzen.
- Danach den Abgleich einmal testweise laufen lassen und prüfen, ob die Sowana-Buchung dem Beleg `AR26-01918` zugeordnet wird.
