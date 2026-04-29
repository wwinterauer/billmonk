## Ziel
Im Newsletter-Status (und LastNewsletterCard) einen Button **„Testversand"** hinzufügen. Damit kann ein Newsletter zuerst an die eigene Adresse gesendet werden, ohne den echten Versand auszulösen, ohne Empfänger anzulegen und ohne den Status (`sent_count`, `failed_count`, `status`) zu verändern.

## Backend-Änderungen

**Edge Function `send-newsletter` erweitern** (kein neuer Function-Name, einfacher Test-Modus):
- Request-Body akzeptiert zusätzlich `test_email?: string` und `test_mode?: boolean`.
- Wenn `test_mode === true`:
  - Lade Newsletter (auch Status `draft` zulässig) und Company-Settings wie bisher.
  - Empfänger = nur die übergebene `test_email` (validieren via simpler Regex).
  - Falls keine `test_email` übergeben wird: Fallback auf E-Mail des eingeloggten Users (`user.email`).
  - Betreff wird mit Präfix `[TEST] ` versehen.
  - HTML enthält oben ein dezentes Test-Banner („Testversand – Vorschau, dieser Newsletter wurde noch nicht an Empfänger versendet").
  - **Keine** Inserts in `newsletter_recipients`.
  - **Keine** Updates an `newsletters` (Status, sent_count, failed_count, sent_at, total_recipients bleiben unangetastet).
  - Response: `{ success, test: true, sent_to }` bzw. Fehlerdetails.

## Frontend-Änderungen

**1. `src/pages/NewsletterStatus.tsx`**
- Neuer Button „Testversand" pro Newsletter-Eintrag (Icon `Send`/`Mail`, Variant `outline`).
- Klick öffnet Dialog mit:
  - Eingabefeld für E-Mail-Adresse (vorbefüllt mit User-E-Mail aus `useAuth`/`supabase.auth.getUser`).
  - Hinweistext: „Sendet eine Test-E-Mail an die angegebene Adresse. Echte Empfänger werden nicht benachrichtigt, der Newsletter-Status bleibt unverändert."
  - Bestätigen-Button → ruft `supabase.functions.invoke('send-newsletter', { body: { newsletter_id, test_mode: true, test_email } })`.
  - Zeigt Lade-Status, danach Toast (Erfolg/Fehler).

**2. `src/components/dashboard/LastNewsletterCard.tsx`**
- Zusätzlich kleiner „Testversand"-Button (gleiche Dialog-Komponente wiederverwenden — extrahiert nach `src/components/newsletter/TestSendDialog.tsx`).

**3. `src/components/newsletter/TestSendDialog.tsx`** (neu)
- Wiederverwendbare Dialog-Komponente mit `newsletterId`, `defaultEmail`, Trigger-Slot.

## Edge Cases
- Newsletter im Status `draft` muss ebenfalls testbar sein.
- Validierung: ungültige E-Mail → 400 mit klarer Meldung.
- Keine Änderung an Rate-Limiting nötig (nur 1 E-Mail).
- Logging: einfacher `console.log('[test-send]', ...)` für Debugging.

## Dateien
- `supabase/functions/send-newsletter/index.ts` (erweitern, anschließend deployen)
- `src/components/newsletter/TestSendDialog.tsx` (neu)
- `src/pages/NewsletterStatus.tsx` (Button + Dialog einbinden)
- `src/components/dashboard/LastNewsletterCard.tsx` (Button + Dialog einbinden)
