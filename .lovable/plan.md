## Befund am konkreten Fall

Beleg **399,00 €** „Vorschreibung Ortstaxe 02/2026 für Villa Salzweg 54", Rechnungsnr. **0 1797 63**, Beleg­datum **16.03.2026**, Vendor *Marktgemeinde Bad Goisern am Hallstättersee*.

Bankbuchung **399,00 €** am **31.03.2026**, Beschreibung enthält *„Zahlungsempfänger: Marktgemeinde Bad Goisern Verwendungszweck: Re.Nr. **0 1797 63**, Kd.Nr. 59433, Ortst…"*.

Warum nicht erkannt:
- `auto-reconcile` und `reconcile-with-skonto` matchen **nur innerhalb ±5 Tagen** zwischen Beleg­datum und Buchungs­datum. Hier liegen **15 Tage** dazwischen → sofort verworfen, obwohl Betrag exakt passt, Vendor im Text steht und sogar die Rechnungsnummer 1:1 auftaucht.
- Vendor-Name und Rechnungsnummer im Bank-Verwendungszweck werden **derzeit gar nicht als Match-Signal genutzt** (nur in der Skonto-Stufe, und auch dort hart auf ±5 Tage limitiert).
- Bei mehreren Belegen mit gleichem Betrag (z. B. weitere Ortstaxe-Vorschreibungen) gibt es heute keine Disambiguierung über Vendor/Rechnungsnummer.

Außerdem betrifft das mehrere weitere Buchungen (297 €, 138 €, 66 €, 504 €, 630 € usw.) – alle Marktgemeinde-Belege, alle 12–18 Tage Versatz, alle mit eindeutiger Rechnungsnummer im Verwendungszweck.

## Lösung – mehrstufige Erkennung mit Vertrauensgrad

Beide Edge Functions (`auto-reconcile`, `reconcile-with-skonto`) bekommen dieselbe, sauberere Match-Pipeline. Pro Bank-Buchung wird in dieser Reihenfolge gesucht:

1. **High-Confidence Match** (neu):
   Betrag exakt (±0,02 €) **und** mindestens eines:
   - Rechnungsnummer des Belegs taucht im Verwendungszweck auf (whitespace/Sonderzeichen-toleranter Vergleich), oder
   - signifikanter Vendor-Token (≥ 4 Zeichen, z. B. „marktgemeinde", „goisern") taucht im Verwendungszweck auf.
   
   Datumsfenster großzügig: **±60 Tage** (typische Zahlungsziele 14/30 Tage + Puffer).

2. **Exact Match** (heute schon vorhanden, aber Fenster zu eng):
   Betrag exakt, kein Text-Signal nötig.  
   Fenster von **±5 → ±14 Tage** erweitert (deckt 7-/10-/14-Tage-Zahlungsziele ab).

3. **Skonto-Kandidat** (heute Stufe 2):
   1–5 % Abweichung, Vendor- oder Rechnungsnummer im Verwendungszweck.  
   Fenster ebenfalls auf **±30 Tage** erweitert. Bleibt wie bisher Vorschlag im Dialog (kein Auto-Apply).

### Disambiguierung gleicher Beträge

Wenn mehrere Belege im Fenster denselben Betrag haben:
- Mit Rechnungsnr.-Treffer im Verwendungszweck → eindeutig, sofort matchen.
- Sonst mit Vendor-Treffer und nur **einem** Beleg, der diesen Vendor matched → matchen.
- Sonst **nicht** automatisch matchen (heute würde der erste gefundene gewinnen, was falsch sein kann). Buchung bleibt offen, damit der Nutzer manuell zuordnet.

### Normalisierung für Textvergleich

Bestehende Hilfsfunktion in `reconcile-with-skonto` (`normalize`, `tokensOf`) wird in `auto-reconcile` mit übernommen. Für die Rechnungsnummer wird wie heute Whitespace entfernt, zusätzlich werden führende Nullen toleriert (Beleg „0 1797 63" → Suchstring „179763" wird im Text gefunden).

## Geplante Änderungen

**`supabase/functions/auto-reconcile/index.ts`**
- `normalize` + `tokensOf` Hilfsfunktionen ergänzen (Kopie aus `reconcile-with-skonto`).
- Beleg-Pool zusätzlich um `invoice_number` erweitern (bereits selektiert).
- Match-Schleife auf 3-stufiges Verfahren umbauen:
  1. High-Confidence (Betrag + Text-Signal, ±60 Tage)
  2. Exact (Betrag, ±14 Tage)
  3. Belegnummer-Pool für Disambiguierung
- Counter im Response um `high_confidence_matched` ergänzen (für späteres Logging/UI).

**`supabase/functions/reconcile-with-skonto/index.ts`**
- Exact-Pass: Fenster ±5 → ±14 Tage; vorgeschaltete High-Confidence-Stufe (±60 Tage) wie oben.
- Skonto-Pass: Fenster ±5 → ±30 Tage.
- Disambiguierung: gleicher Betrag im Pool → nur matchen, wenn Vendor/Rechnungsnr.-Signal eindeutig auf einen Beleg zeigt.

**Keine** Änderungen an UI/DB-Schema/RLS – reine Server-Logik. Die bestehenden Bestände bleiben unangetastet; beim nächsten Klick auf „Automatisch matchen" werden die offenen Buchungen (inkl. der Marktgemeinde-Fälle) erneut gegen die neue Logik geprüft und sollten sauber zugeordnet werden.

## Technische Details

- Datumsvergleich: bestehender `daysBetween`-Helper.
- Belegnummern-Match: `normalize(invoice_number).replace(/\s+/g,'')` muss in `normalize(description).replace(/\s+/g,'')` enthalten sein; nur akzeptiert wenn normalisierte Nummer ≥ 4 Zeichen, damit kurze Zahlen keine False-Positives erzeugen.
- Vendor-Match: alle Tokens ≥ 4 Zeichen aus dem Vendor müssen **mindestens** einmal im Verwendungszweck auftauchen – konservativ, damit „Allianz" nicht auf jede Versicherungsbuchung passt.
- Reihenfolge garantiert, dass ein Beleg, der per High-Confidence gematched wurde, in den folgenden Stufen nicht erneut zugewiesen wird (`usedReceiptIds`-Set).

## Out of Scope (bewusst nicht jetzt)

- Fuzzy/Levenshtein auf Vendor-Namen (bringt für diesen Fall nichts, da Vendor 1:1 im Text steht).
- Lernen aus manuellen Zuordnungen (separater Folge-Task wenn gewünscht).
- UI-Anzeige des Match-Grades im Frontend.
