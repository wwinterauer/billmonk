

# E-Mail-Import aktivieren: Infrastruktur & Bugfix

## Ausgangslage

- Domain `billmonk.ai` auf Cloudflare, Google Workspace für Haupt-E-Mails
- Webhook-Funktion (`email-import-webhook`) existiert und erwartet JSON/multipart POST
- Import-Adressen im Format `rechnungen+token@import.billmonk.ai`
- **Problem 1**: Subdomain `import.billmonk.ai` kann keine E-Mails empfangen — es fehlt ein Inbound-E-Mail-Service
- **Problem 2**: Webhook-Regex und Validierung matchen keine Punkte/Bindestriche in Custom-Tokens (Frontend erlaubt `w.winterauer`, Webhook lehnt es ab)

## Was gebraucht wird

### 1. Inbound-E-Mail-Service einrichten (Infrastruktur, kein Code)

Da du bereits Cloudflare nutzt, ist **Cloudflare Email Routing** die einfachste und kostenlose Option:

1. **In Cloudflare Dashboard** → Domain `billmonk.ai` → **Email Routing** aktivieren
2. **Catch-All-Regel** für `import.billmonk.ai` einrichten:
   - Subdomain `import` als Custom Address hinzufügen
   - Alle E-Mails an `*@import.billmonk.ai` an einen **Email Worker** weiterleiten
3. **Email Worker** erstellen (Cloudflare Workers), der:
   - Die eingehende E-Mail parst (Absender, Empfänger, Betreff, Anhänge als Base64)
   - Einen HTTP POST an `https://nvvssxykygdxjywncvgd.supabase.co/functions/v1/email-import-webhook` sendet
   - Das JSON-Format `{ from, to, subject, text, attachments: [{ filename, content, contentType, size }] }` verwendet

**Alternative** (falls Email Workers zu aufwändig): Einen Dienst wie **Mailgun Inbound Routing** (kostenloser Tier) nutzen — dort MX-Records für `import.billmonk.ai` setzen und die Webhook-URL als Forwarding-Ziel konfigurieren. Mailgun postet automatisch im richtigen Format.

### 2. Webhook-Funktion fixen: Custom-Tokens unterstützen (Code-Änderung)

**Datei:** `supabase/functions/email-import-webhook/index.ts`

- **Zeile 298**: Regex von `/\+([a-z0-9]+)@/` → `/\+([a-z0-9.-]+)@/` (Punkte und Bindestriche erlauben)
- **Zeile 302**: Regex von `/^([a-z0-9]+)@/` → `/^([a-z0-9.-]+)@/`
- **Zeile 309**: Validierung von `token.length < 12` → `token.length < 3` (Custom-Tokens ab 3 Zeichen) und Regex von `/^[a-z0-9]+$/` → `/^[a-z0-9.-]+$/`

Danach Edge Function neu deployen.

## Zusammenfassung

| Schritt | Art | Aufwand |
|---------|-----|---------|
| Cloudflare Email Routing / Worker | Infrastruktur (manuell) | ~1-2h |
| Webhook-Regex-Fix | Code-Änderung | 5 min |

Soll ich mit dem Webhook-Fix (Schritt 2) starten, während du die Cloudflare-Infrastruktur einrichtest?

