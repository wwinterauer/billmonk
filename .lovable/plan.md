

## Phase 6: Stripe-Integration -- Implementierungsplan

### 1. Stripe-Produkte anlegen (6 Preise)

Drei Produkte mit je monatlichem und jaehrlichem Preis:

| Produkt | Monatlich | Jaehrlich |
|---|---|---|
| XpenzAI Starter | 199 ct (€1,99) | 1990 ct (€19,90) |
| XpenzAI Pro | 499 ct (€4,99) | 4790 ct (€47,90) |
| XpenzAI Business | 999 ct (€9,99) | 9590 ct (€95,90) |

### 2. Datenbank-Migration

Neue Spalten auf `profiles`:
- `stripe_customer_id text` -- Stripe Customer ID
- `stripe_product_id text` -- aktives Stripe Product ID (fuer Plan-Zuordnung)

### 3. Edge Functions erstellen

- **`check-subscription`**: Prueft via Stripe API ob der User eine aktive Subscription hat, gibt `subscribed`, `product_id`, `subscription_end` zurueck. Aktualisiert `profiles.plan` und `stripe_product_id` basierend auf dem product_id-Mapping.
- **`create-checkout`**: Erstellt Stripe Checkout Session mit dem gewaehlten `price_id`, leitet zu Stripe weiter. Unterstuetzt monatliche und jaehrliche Intervalle.
- **`customer-portal`**: Erstellt Stripe Billing Portal Session fuer Self-Service (Planwechsel, Kuendigung, Zahlungsmethode).

### 4. Plan-Mapping Konfiguration

Neue Datei `src/lib/stripeConfig.ts` mit Mapping:
```text
product_id -> PlanType
price_ids (monthly + yearly) pro Tier
```

### 5. Frontend-Integration

**usePlan Hook**: Subscription-Check bei Login und periodisch (alle 60s). `profiles.plan` wird serverseitig durch `check-subscription` aktualisiert.

**Landing Pricing** (`src/components/landing/Pricing.tsx`): 
- Alle 4 Plaene (Free, Starter, Pro, Business) mit korrekten Preisen und Features
- Monatlich/Jaehrlich Toggle
- Checkout-Buttons die `create-checkout` aufrufen (fuer eingeloggte User) oder zu `/register` weiterleiten

**Settings**: Neuer "Abo"-Tab mit aktuellem Plan, naechstem Zahlungsdatum, und "Abo verwalten"-Button (oeffnet Stripe Portal).

### 6. Sidebar & Settings Feature-Gating Pruefung

Aktueller Stand ist korrekt:
- **Sidebar**: `reconciliation` (Starter+), `bankImport` (Starter+), `invoiceModule` (Business)
- **Settings-Tabs**: `bankImport` (Starter+), `emailImport` (Starter+), `cloudBackup` (Pro+), `invoiceModule` x4 (Business)

Keine Aenderungen noetig -- das Gating funktioniert bereits korrekt ueber `PLAN_FEATURES` und `usePlan().features`.

### Dateien

| Aktion | Datei |
|---|---|
| Neu | `src/lib/stripeConfig.ts` |
| Neu | `supabase/functions/check-subscription/index.ts` |
| Neu | `supabase/functions/create-checkout/index.ts` |
| Neu | `supabase/functions/customer-portal/index.ts` |
| Migration | `profiles` + 2 Spalten |
| Bearbeiten | `src/hooks/usePlan.ts` (Subscription-Check) |
| Bearbeiten | `src/components/landing/Pricing.tsx` (4 Plaene, korrekte Preise, Checkout) |
| Bearbeiten | `src/pages/Settings.tsx` (Abo-Tab) |

