

# BUGFIX: Stripe Webhook absichern

## Problem

Zeilen 49-58: Wenn `STRIPE_WEBHOOK_SECRET` nicht gesetzt ist, wird der Payload ohne Signaturprüfung als `JSON.parse` akzeptiert — ein Sicherheitsrisiko.

## Änderung

### `supabase/functions/stripe-webhook/index.ts`

**Zeilen 29-35**: `webhookSecret`-Check direkt nach `stripeKey`-Check einfügen — bei fehlendem Secret sofort HTTP 500 zurückgeben.

**Zeilen 49-58**: Den `if/else`-Block vereinfachen — der `else`-Branch (Dev-Fallback) wird entfernt, da `webhookSecret` jetzt garantiert gesetzt ist:

```typescript
const signature = req.headers.get("stripe-signature");
if (!signature) {
  return new Response("Missing stripe-signature header", { status: 400 });
}
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

### Dateien
- `supabase/functions/stripe-webhook/index.ts`

