# Belegvolumen als Zusatzsignal bei der Lieferantenzuordnung

## Einschätzung

Ja, das ist ein sinnvolles Signal — aber nur als **Tiebreaker**, nicht als Verstärker. Wenn zwei Lieferanten ähnlich heißen, ist der mit deutlich mehr Belegen der wahrscheinlichere Treffer. Gefährlich wäre es, die Schwelle für die unscharfe Suche wegen vieler Belege zu senken: dann würden große Lieferanten kleine „einsaugen" (z. B. „Amazon" schluckt „Amazon Marketplace Händler XY"). Die exakten Stufen (Firmenname, rechtlicher Name, normalisierter Name, Markenname) bleiben deshalb unverändert vorne.

## Was gebaut wird

1. **Belegzahl pro Lieferant laden** — die vorhandene Statistikfunktion liefert Belegzahl je Lieferant; sie wird beim Abgleich einmalig mitgeladen.
2. **Nur in der unscharfen Stufe wirksam** — bisher gewinnt dort einfach der höchste Ähnlichkeitswert. Künftig gewinnt bei nahezu gleichwertigen Kandidaten (Abstand unter 2 Prozentpunkte) der Lieferant mit mehr Belegen.
3. **Mindestähnlichkeit bleibt bei 88 %** — kein Aufweichen durch Belegvolumen.
4. **Zusätzlich: Markenname-Teiltreffer mit Volumen absichern.** Wenn der erkannte Firmenname den Markennamen eines Lieferanten als eigenständiges Wort enthält (z. B. „Stripe Payments Europe Limited" → „Stripe"), gilt das künftig als Treffer — aber nur, wenn dieser Lieferant bereits mindestens 3 zugeordnete Belege hat. Damit greift genau das, was du beschreibst: bewährte Lieferanten ziehen Varianten ihres Namens an, neue nicht.
5. **Nachvollziehbarkeit** — bei welcher Stufe zugeordnet wurde, wird protokolliert, damit Fehlzuordnungen erkennbar bleiben.

## Technische Details

- Erweiterung von `matchVendor` in `supabase/functions/_shared/vendorMatch.ts` um einen optionalen Parameter `receiptCounts: Record<vendorId, number>`; ohne diesen verhält sich die Funktion exakt wie bisher (kein Bruch für bestehende Aufrufe).
- Neue Stufe 4b „Marken-Teiltreffer" mit Wortgrenzen-Prüfung und Schwelle `MIN_RECEIPTS_FOR_TOKEN_MATCH = 3`.
- Stufe 5 (fuzzy): bei `bestScore - score < 0.02` entscheidet die höhere Belegzahl.
- `extract-receipt` und `reconcile-vendors` laden die Zahlen über `get_vendor_stats(user_id)` und reichen sie durch.
- Anschließend Deploy beider Funktionen; „Lieferanten neu zuordnen" in der Review nutzt die neue Logik dann sofort für die noch offenen unverknüpften Belege.
