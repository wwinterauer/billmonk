## Ziel

Den Newsletter-Versand komplett auf den **Lovable Resend-Connector** umstellen und das alte manuell gepflegte Secret entfernen.

## Ausgangslage

- `supabase/functions/send-newsletter/index.ts` nutzt bereits den korrekten Resend-Gateway (`https://connector-gateway.lovable.dev/resend/emails`).
- Authentifizierung erfolgt aktuell über das manuell gesetzte Secret `RESEND_API_KEY`.
- Der Lovable Resend-Connector ist bereits verbunden — neues Connector-Secret: `RESEND_API_KEY_1`.
- `send-newsletter` ist die einzige Edge-Function, die `RESEND_API_KEY` direkt verwendet (alle anderen E-Mails laufen über die Lovable-Email-Infrastruktur mit `notify.billmonk.ai`).

## Umsetzung

### 1. `send-newsletter/index.ts` anpassen

Eine Zeile ändern — direkter Wechsel auf den Connector-Key:

```ts
const resendApiKey = Deno.env.get('RESEND_API_KEY_1');
```

Alle restlichen Aufrufe (`X-Connection-Api-Key: ${resendApiKey}`) bleiben unverändert.

### 2. Edge Function deployen

`send-newsletter` redeployen, damit die Änderung produktiv wirkt.

### 3. Altes Secret entfernen

Das manuelle Projekt-Secret `RESEND_API_KEY` aus den Lovable-Cloud-Secrets löschen, damit nichts mehr darauf zugreifen kann und kein „toter" Key herumliegt.

### 4. Smoke-Test (empfohlen)

Beim nächsten Newsletter-Versand kurz die Logs prüfen, um sicherzustellen, dass der Connector-Key sauber angenommen wird.

## Vorteile nach Migration

- Kein manuelles Token-Management mehr (kein Ablaufen, keine versehentliche Löschung).
- Resend-Credentials werden zentral im Workspace verwaltet — wiederverwendbar für andere Projekte.
- Weniger Konfigurations-Drift zwischen Umgebungen.

## Was sich NICHT ändert

- Der gesamte Versand-Flow (Empfänger-Filterung, Opt-out, Rate-Limit, Tracking in `newsletter_recipients`) bleibt identisch.
- Absender-Adresse bleibt `onboarding@resend.dev` (Resend-Test-Absender). Eine eigene verifizierte Resend-Domain ist ein eigenes, optionales Folge-Thema.
- Die Lovable-Email-Infrastruktur (Auth-Mails, Welcome-Mail, transaktionale Mails) bleibt unberührt.

## Risiko

**Sehr niedrig.** Die Umstellung betrifft nur eine Edge-Function. Falls nach Deployment unerwartet Probleme mit dem Connector-Key auftreten, können wir innerhalb von Sekunden auf das alte Secret zurückwechseln (solange es noch nicht gelöscht ist) — daher Empfehlung: **erst deployen + Test, dann altes Secret löschen** (Reihenfolge: 1 → 2 → 4 → 3).
