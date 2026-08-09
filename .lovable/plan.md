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

## Intelligenteres Matching (Scoring statt Alles-oder-Nichts)

Statt starrer Ja/Nein-Regeln bekommt jedes Buchung-Beleg-Paar einen **Score** aus mehreren Signalen:

- Betrag: exakt (±0,02 €) = stark, Abweichung bis 5 % / 10 € = schwächer (z. B. Skonto, Rundung, Erkennungsfehler).
- Datum: je näher am Belegdatum, desto höher; Zahlungen nach Belegdatum werden bevorzugt.
- Rechnungsnummer im Buchungstext = sehr stark.
- Lieferantenname im Text — inkl. Marken- und rechtlicher Firmenname sowie hinterlegter Schlagwörter des Lieferanten (nicht nur `vendor`).
- Zahlungsdienstleister erkannt (PayPal, Klarna, Stripe …): Lieferant fehlt im Text erwartungsgemäß → das darf nicht mehr gegen den Treffer zählen.
- Wiederkehrendes Muster: gleicher Lieferant zahlt regelmäßig denselben Betrag (typisch IONOS-Tagesrechnungen) → Buchungen und Belege werden datumsweise in Reihenfolge gepaart.
- Bereits bestätigte Zuordnungen desselben Lieferanten dienen als Lernsignal (z. B. „PayPal-Buchungen dieses Betrags gehören zu IONOS").

Entscheidungsregel:
- Score sehr hoch und eindeutig → automatisch verbuchen (wie bisher).
- Score gut, aber mehrdeutig oder nur mittelstark → **Vorschlag** statt Auto-Buchung.
- Score niedrig → bleibt offen.

Damit landet nichts mehr stillschweigend im Nichts: Was nicht sicher genug ist, wird dem User zur Entscheidung vorgelegt. Der Gruppen-Pass greift künftig auch bei ungleich großen Gruppen — dann als Vorschlag.


## Neue Vorschlags-Ansicht

Der bestehende Abgleich-Dialog wird zu einem allgemeinen Vorschlags-Dialog erweitert:

- Zwei Bereiche: "Skonto-Vorschläge" (wie bisher) und "Betrags-Vorschläge" (neu).
- Pro Zeile: Buchung (Datum, Betrag, Text) gegenüber vorgeschlagenem Beleg (Datum, Lieferant, Rechnungsnummer, Betrag) plus Konfidenz-Badge (hoch / mittel / mehrdeutig).
- **Beleg einblenden**: Klick auf den Beleg öffnet die Belegvorschau (bestehendes `ReceiptDetailPanel`) direkt im Dialog-Kontext, damit man die Rechnung vor dem Bestätigen sehen kann.
- **Alternative wählen**: Aufklappbare Liste weiterer Belege mit gleichem Betrag; ein Klick tauscht den Vorschlag.
- Mehrdeutige Vorschläge sind standardmäßig **nicht** vorausgewählt; eindeutige (nur ein Kandidat) sind vorausgewählt. "Alle auswählen" / "Alle abwählen" pro Gruppe.
- Übernehmen verknüpft alle bestätigten Paare in einem Rutsch.

## Technische Details

- `supabase/functions/_shared/reconcileHelpers.ts`: neue `scoreMatch(tx, candidate, context)` (gewichtete Signale, liefert Score + Begründung) und `buildSuggestions(txs, candidates)` — gruppiert nach Cent-Betrag, paart datumsweise (greedy), liefert pro Buchung Hauptvorschlag + Alternativen + Konfidenz. `buildGroupPairs` wird von "nur gleiche Größe" auf "beliebige Größe, Rest als Vorschlag" umgestellt.
- Lieferanten-Erkennung nutzt `vendors` (Markenname, `legal_names`, Schlagwörter) statt nur des Textfelds am Beleg.

- `supabase/functions/reconcile-with-skonto/index.ts` (Preview-Modus): liefert zusätzlich `amount_suggestions`. Apply-Modus akzeptiert weiterhin `accepted_pairs` (funktioniert für beide Vorschlagsarten, inkl. Split-Zeilen über optionale `receipt_split_line_id`).
- `supabase/functions/auto-reconcile/index.ts`: Gruppen-Pass verbucht nicht mehr unsicher automatisch, sondern nur die eindeutigen Fälle; Zählung im Response angepasst.
- `src/components/reconciliation/SkontoReconcileDialog.tsx`: erweitert um Tab/Sektion für Betrags-Vorschläge, Alternativen-Auswahl und Beleg-Vorschau.
- `src/pages/Reconciliation.tsx`: neuer State für `amountSuggestions`, Übergabe an den Dialog, Toast-Text angepasst.
- Unit-Test für `buildAmountSuggestions` mit dem realen IONOS/PayPal-Szenario (13 Buchungen zu 3,36 € gegen 14 Belege).
