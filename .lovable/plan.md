# Betrags-Vorschläge im Kontoabgleich (PayPal / IONOS)

## Warum es aktuell nicht matcht

Ich habe die betroffenen Buchungen und Belege in der Datenbank geprüft:

- Buchungstext: `Zahlungsempfänger: PayPal Europe ... Verwendungszweck: 1050369`
- IONOS-Belege haben Rechnungsnummern wie `100187160135`

Die Zahl im Verwendungszweck ist die **PayPal-Vorgangsnummer**, nicht die IONOS-Rechnungsnummer. Damit greift keiner der bestehenden Durchläufe:

1. Referenz-Pass: Rechnungsnummer steht nicht im Text.
2. Lieferanten-Pass: "IONOS" steht nicht im Text (nur PayPal).
3. Exakt-Pass: Betrag 3,36 € kommt vielfach vor → mehrdeutig, wird bewusst übersprungen.
4. Gruppen-Pass: verlangt exakt gleich viele Buchungen wie Belege (13 Buchungen zu 3,36 € vs. 14 Belege) → verworfen.

Ergebnis: alles bleibt offen, obwohl die Zuordnung für einen Menschen offensichtlich ist.

## Was gebaut wird

Ein neuer **Vorschlags-Pass** — nichts wird automatisch verbucht, der User entscheidet.

- Für jede offene Buchung werden Belege mit **exakt gleichem Betrag** (±0,02 €) gesucht, unabhängig davon, ob die Zuordnung eindeutig ist.
- Bei mehreren Kandidaten werden diese nach Nähe zum Buchungsdatum sortiert; der beste Kandidat wird als Vorschlag markiert, die anderen bleiben als Alternativen wählbar.
- Zusatzsignale erhöhen die Vertrauensstufe: Zahlungsdienstleister im Text (PayPal, Klarna, Stripe …), Lieferant wiederholt sich mit gleichem Betrag, Datumsabstand klein.
- Der Gruppen-Pass darf künftig auch bei ungleich großen Gruppen greifen — aber nur noch als **Vorschlag**, nicht als Auto-Buchung.

## Neue Vorschlags-Ansicht

Der bestehende Abgleich-Dialog wird zu einem allgemeinen Vorschlags-Dialog erweitert:

- Zwei Bereiche: "Skonto-Vorschläge" (wie bisher) und "Betrags-Vorschläge" (neu).
- Pro Zeile: Buchung (Datum, Betrag, Text) gegenüber vorgeschlagenem Beleg (Datum, Lieferant, Rechnungsnummer, Betrag) plus Konfidenz-Badge (hoch / mittel / mehrdeutig).
- **Beleg einblenden**: Klick auf den Beleg öffnet die Belegvorschau (bestehendes `ReceiptDetailPanel`) direkt im Dialog-Kontext, damit man die Rechnung vor dem Bestätigen sehen kann.
- **Alternative wählen**: Aufklappbare Liste weiterer Belege mit gleichem Betrag; ein Klick tauscht den Vorschlag.
- Mehrdeutige Vorschläge sind standardmäßig **nicht** vorausgewählt; eindeutige (nur ein Kandidat) sind vorausgewählt. "Alle auswählen" / "Alle abwählen" pro Gruppe.
- Übernehmen verknüpft alle bestätigten Paare in einem Rutsch.

## Technische Details

- `supabase/functions/_shared/reconcileHelpers.ts`: neue Funktion `buildAmountSuggestions(txs, candidates)` — gruppiert nach Cent-Betrag, ordnet Buchungen und Belege datumsweise zu (greedy, nächstes Datum zuerst), liefert pro Buchung Hauptvorschlag + Alternativen + Konfidenz. `buildGroupPairs` wird von "nur gleiche Größe" auf "beliebige Größe, Rest als Vorschlag" umgestellt.
- `supabase/functions/reconcile-with-skonto/index.ts` (Preview-Modus): liefert zusätzlich `amount_suggestions`. Apply-Modus akzeptiert weiterhin `accepted_pairs` (funktioniert für beide Vorschlagsarten, inkl. Split-Zeilen über optionale `receipt_split_line_id`).
- `supabase/functions/auto-reconcile/index.ts`: Gruppen-Pass verbucht nicht mehr unsicher automatisch, sondern nur die eindeutigen Fälle; Zählung im Response angepasst.
- `src/components/reconciliation/SkontoReconcileDialog.tsx`: erweitert um Tab/Sektion für Betrags-Vorschläge, Alternativen-Auswahl und Beleg-Vorschau.
- `src/pages/Reconciliation.tsx`: neuer State für `amountSuggestions`, Übergabe an den Dialog, Toast-Text angepasst.
- Unit-Test für `buildAmountSuggestions` mit dem realen IONOS/PayPal-Szenario (13 Buchungen zu 3,36 € gegen 14 Belege).
