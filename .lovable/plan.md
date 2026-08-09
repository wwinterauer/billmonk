# Duplikat-Erkennung: Datum und Betrag als harte Ausschlusskriterien

## Ziel

Ein Beleg gilt nur noch dann als Duplikat, wenn Betrag **und** Datum plausibel übereinstimmen:

- Betrag: Abweichung bis **±20 %** erlaubt (OCR-Unschärfe)
- Datum: Abweichung bis **±3 Tage** erlaubt
- Liegt eines von beiden außerhalb der Toleranz, ist es **kein** Duplikat — auch bei gleicher Rechnungsnummer.

Einzige Ausnahme: **identischer Datei-Hash**. Das ist physisch dieselbe Datei und bleibt immer ein Duplikat.

## Wo das aktuell nicht so ist

1. Regel "Rechnungsnummer + Lieferant" (Score 95) und Regel "nur Rechnungsnummer" (Score 70) prüfen Betrag und Datum überhaupt nicht.
2. Die Regeln für Betrag+Datum verlangen exakte Gleichheit — knappe OCR-Abweichungen werden gar nicht erst als Duplikat erkannt.
3. Die Nachprüfung in der Server-Verarbeitung (nach der KI-Extraktion) markiert ebenfalls allein anhand gleicher Rechnungsnummer als Duplikat.

## Umsetzung

### Gemeinsame Toleranz-Prüfung
Zwei kleine Hilfsfunktionen (Frontend-Service und Edge-Function-Variante):

- `amountWithinTolerance(a, b)` — true, wenn `|a-b| <= 0.20 * max(|a|,|b|)`. Fehlt einer der Beträge, gilt die Prüfung als „unbekannt" (nicht als Ausschluss).
- `dateWithinTolerance(a, b)` — true, wenn Differenz `<= 3` Kalendertage. Fehlt eines der Daten, „unbekannt".

Regel: Ein Kandidat wird verworfen, sobald einer der beiden Werte **bekannt, aber außerhalb der Toleranz** ist.

### `src/services/duplicateDetectionService.ts`
- Hash-Match: unverändert (Score 100).
- Rechnungsnummer-Regeln (95 und 70): Kandidaten laden inkl. Betrag/Datum, danach über die Toleranzprüfung filtern. Verworfene Kandidaten führen nicht mehr zum Duplikat-Treffer.
- Betrag+Datum+Lieferant / Betrag+Datum: statt exakter Gleichheit im SQL wird über ein Datumsfenster (±3 Tage) und ein Betragsfenster (±20 %) vorgefiltert und anschließend clientseitig exakt bewertet.
- Scoring bleibt gestaffelt: exakte Werte behalten den bisherigen Score, tolerierte Abweichungen werden um ca. 10 Punkte reduziert und die Begründung nennt „Betrag/Datum leicht abweichend".

### `supabase/functions/extract-receipt/index.ts` (Nachprüfung)
- Geschwister-Suche liefert weiterhin Kandidaten über Rechnungsnummer oder Betrag/Datum, aber vor dem Markieren wird dieselbe Toleranzprüfung angewandt.
- Ausnahme bleibt der identische Datei-Hash.
- Score analog abgestuft, Begründungstexte entsprechend.

## Technische Details

- Kalendertagsdifferenz wird UTC-normalisiert berechnet, damit Zeitzonen keine Fehltreffer erzeugen.
- Betragsvergleich nutzt den relativen Abstand zum größeren Wert, damit die Prüfung symmetrisch ist.
- Keine Datenbank-Migration nötig; bestehende Duplikat-Markierungen bleiben unverändert (können bei Bedarf in einem zweiten Schritt neu bewertet werden).
