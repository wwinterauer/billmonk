## Ziel

Vier neue automatische Mails ergänzen, die bei Abo- und Zahlungs-Ereignissen automatisch verschickt werden – konsistent zur bestehenden BillMonk-Mail-Optik (siehe `subscription-confirmed.tsx`, `welcome-email.tsx`).

## Neue Templates

In `supabase/functions/_shared/transactional-email-templates/` jeweils ein neues `.tsx` plus Eintrag in `registry.ts`:

1. **`plan-changed.tsx`** – Plan-Wechsel (Up- oder Downgrade)
   - Daten: `name`, `oldPlan`, `newPlan`, `effectiveDate`
   - Subject: „Dein BillMonk-Plan wurde geändert"
2. **`subscription-cancelled.tsx`** – Kündigung
   - Daten: `name`, `plan`, `accessUntil` (Periodenende)
   - Subject: „Deine BillMonk-Kündigung ist bestätigt"
   - Hinweis, dass das Konto bis Periodenende nutzbar bleibt + Button „Reaktivieren"
3. **`payment-failed.tsx`** – Zahlung fehlgeschlagen
   - Daten: `name`, `amount`, `currency`, `nextRetryDate`
   - Subject: „Zahlung fehlgeschlagen – bitte Zahlungsmethode prüfen"
   - Button „Zahlungsmethode aktualisieren" → öffnet Customer Portal
4. **`payment-method-updated.tsx`** – Bestätigung neue Zahlungsmethode
   - Daten: `name`, `last4`, `brand` (z. B. Visa •••• 4242)
   - Subject: „Deine Zahlungsmethode wurde aktualisiert"

Alle Templates folgen exakt dem Stil der bestehenden Templates (Logo, HSL-Farben, Inter-Font, Button-Style, weißer Body).

## Trigger-Verdrahtung

Wir nutzen ausschließlich den **Stripe-Webhook** (`supabase/functions/stripe-webhook/index.ts`) als Auslöser, da:
- Plan-Wechsel/Kündigung im Customer Portal **immer** als Stripe-Webhook ankommen (kein eigener Self-Service-Endpoint in der App)
- Zahlung fehlgeschlagen / Zahlungsmethode aktualisiert nur Stripe weiß
- Idempotenz durch `event.id` bereits etabliert

Wir filtern auf User-initiiierte Ereignisse durch Vergleich `previous_attributes` im Webhook-Event – damit lösen Admin-Änderungen über die DB **keine** Mails aus.

Neue Event-Handler in `stripe-webhook/index.ts`:

| Stripe Event | Bedingung | Mail |
|---|---|---|
| `customer.subscription.updated` | `previous_attributes.items` vorhanden & neuer Plan ≠ alter Plan | `plan-changed` |
| `customer.subscription.updated` | `cancel_at_period_end: true` (vorher false) | `subscription-cancelled` |
| `customer.subscription.deleted` | – | `subscription-cancelled` (sofort beendet) |
| `invoice.payment_failed` | `attempt_count >= 1` | `payment-failed` |
| `payment_method.attached` ODER `customer.updated` mit `default_source`/`invoice_settings.default_payment_method` Änderung | – | `payment-method-updated` |

Jeweils:
- Idempotency-Key: `<template>-<event.id>`
- Vorab-Check in `email_send_log` (wie bei `subscription-confirmed`)
- Empfänger-Email + Vorname aus Stripe-Customer + `profiles`

## Geänderte Dateien

- **Neu:** `supabase/functions/_shared/transactional-email-templates/plan-changed.tsx`
- **Neu:** `supabase/functions/_shared/transactional-email-templates/subscription-cancelled.tsx`
- **Neu:** `supabase/functions/_shared/transactional-email-templates/payment-failed.tsx`
- **Neu:** `supabase/functions/_shared/transactional-email-templates/payment-method-updated.tsx`
- **Bearbeitet:** `supabase/functions/_shared/transactional-email-templates/registry.ts` (4 neue Einträge)
- **Bearbeitet:** `supabase/functions/stripe-webhook/index.ts` (neue Event-Handler)
- **Deploy:** `stripe-webhook` + alle Templates werden mit deploy_edge_functions ausgeliefert

## Verifikation

Nach Deploy:
1. Stripe-Dashboard → Webhook konfigurieren prüfen, dass die neuen Event-Typen abonniert sind (`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `payment_method.attached`, `customer.updated`) – falls nicht, Hinweis an dich
2. Test-Event aus Stripe-Dashboard senden (z. B. `invoice.payment_failed`)
3. `email_send_log` prüfen: Eintrag mit korrektem Template + Status `sent`

## Nicht enthalten
- Out-of-the-box „Zahlungserinnerung 3 Tage vor Retry" (Stripe Smart Retries macht das automatisch)
- Pause/Resume-Mails (gibt es im Customer Portal aktuell nicht)
