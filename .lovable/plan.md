

## Plan: Gestaffeltes Trial-System + Build-Fix

### Konzept

Dein Ansatz macht Sinn als Upsell-Strategie:

1. **Erstregistrierung**: 30 Tage kostenlos testen (beliebiger Plan)
2. **Nach Ablauf ohne Abo**: Hoeherer Plan nochmal 7 Tage gratis testen
3. **Mit aktivem Abo**: Hoeheren Plan 7 Tage gratis testen vor Upgrade

### Umsetzung

**1. Datenbank: `trialed_plans` Feld in `profiles`**
- Neues Feld `trialed_plans text[] default '{}'` — speichert welche Plaene bereits getestet wurden (z.B. `['starter', 'pro']`)
- Wird nach jedem Trial-Start aktualisiert

**2. Edge Function: `create-checkout/index.ts` erweitern**
- Logik fuer Trial-Tage:
  - Kein Stripe-Kunde → 30 Tage Trial (wie bisher)
  - Hat bereits ein Abo + Zielplan ist hoeher + noch nicht getestet → 7 Tage Trial
  - Trial abgelaufen + kein Abo + Zielplan ist hoeher als vorheriger → 7 Tage Trial
  - Bereits getesteter Plan → kein Trial
- Planvergleich ueber `PLAN_ORDER` Konstante (free=0, starter=1, pro=2, business=3)
- Nach Checkout: `trialed_plans` Array in Profil aktualisieren

**3. Edge Function: `check-subscription/index.ts`**
- Auch `trialing` Status von Stripe beruecksichtigen (derzeit nur `active`)
- `subscription_status: 'trialing'` in Profil speichern wenn Trial laeuft

**4. Frontend: `SubscriptionSettings.tsx`**
- Fuer bestehende Abonnenten: Upgrade-Karten mit "7 Tage gratis testen" Button anzeigen (nur fuer hoehere Plaene)
- Fuer abgelaufene Trials: "Upgrade testen" Karten anzeigen
- Badge "Bereits getestet" wenn Plan schon in `trialed_plans`

**5. Build-Fix: `npm:` Imports ersetzen**
- `admin-users/index.ts`, `customer-portal/index.ts`, `create-checkout/index.ts`, `check-subscription/index.ts`: `npm:@supabase/supabase-js@2.57.2` → `https://esm.sh/@supabase/supabase-js@2`

### Technischer Ablauf

```text
Neuer Nutzer waehlt "Starter"
  → create-checkout: kein Stripe-Kunde → 30 Tage Trial
  → trialed_plans = ['starter']

Trial laeuft ab, Nutzer klickt "Pro testen"
  → create-checkout: 'pro' nicht in trialed_plans + pro > starter → 7 Tage Trial
  → trialed_plans = ['starter', 'pro']

ODER: Nutzer hat Starter-Abo, klickt "Pro testen"  
  → create-checkout: aktives Abo + pro > starter + nicht getestet → 7 Tage Trial
  → Neues Abo mit Trial ersetzt altes (Stripe Subscription Update)
  → trialed_plans = ['starter', 'pro']
```

### Dateien
- **Migration**: `trialed_plans` Spalte zu `profiles` hinzufuegen
- `supabase/functions/create-checkout/index.ts` — Trial-Logik + Import-Fix
- `supabase/functions/check-subscription/index.ts` — Trialing-Status + Import-Fix
- `supabase/functions/admin-users/index.ts` — Import-Fix
- `supabase/functions/customer-portal/index.ts` — Import-Fix
- `src/components/settings/SubscriptionSettings.tsx` — Upgrade-Trial UI
- `src/lib/planConfig.ts` — `PLAN_ORDER` Export

