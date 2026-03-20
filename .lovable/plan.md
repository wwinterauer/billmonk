

## Plan: Live-Bankanbindung ab Pro, Preisanpassung

### Zusammenfassung
Live-Bankanbindung wird von "nur Business" auf "ab Pro" heruntergestuft. Pro und Business erhalten jeweils +1€/Monat. Limit: 1 Bankverbindung für Pro, 3 für Business.

### Änderungen

**1. `src/lib/planConfig.ts`**
- `PLAN_FEATURES.pro.liveBankConnection` → `true`
- `PLAN_PRICES.pro` → 5.99€/Monat, 57.50€/Jahr
- `PLAN_PRICES.business` → 15.99€/Monat, 153.50€/Jahr
- `FEATURE_MIN_PLAN.liveBankConnection` → `'pro'` (statt `'business'`)
- `PLAN_LIMITS` erweitern um `maxBankConnections`: free=0, starter=0, pro=1, business=3

**2. `src/lib/stripeConfig.ts`**
- Neue Stripe Price IDs für Pro und Business nötig (müssen in Stripe Dashboard erstellt werden)
- Alternativ: Preise im Dashboard anpassen, dann bleiben die IDs gleich

**3. `src/components/landing/Pricing.tsx`**
- Pro-Features um "Live-Bankanbindung (1 Konto)" ergänzen
- Business-Features um "Bis zu 3 Bankkonten" ergänzen

**4. `src/components/settings/LiveBankSettings.tsx`**
- Limit-Prüfung: Anzahl bestehender Verbindungen gegen `PLAN_LIMITS[effectivePlan].maxBankConnections` prüfen
- Wenn Limit erreicht → Hinweis anzeigen statt "Neue Verbindung"

**5. Edge Function `bank-connect/index.ts`**
- Server-seitige Limit-Prüfung: Vor `create-requisition` die Anzahl aktiver Verbindungen zählen und gegen Plan-Limit validieren

### Stripe-Hinweis
Du musst die Preise in deinem Stripe Dashboard anpassen (Pro: 5.99€/Monat bzw. Jahrespreis, Business: 15.99€/Monat). Wenn du neue Price-IDs bekommst, müssen diese in `stripeConfig.ts` aktualisiert werden. Wenn du die bestehenden Prices nur editierst, bleiben die IDs gleich.

### Technische Details

Neues Feld in `PlanLimits`:
```text
interface PlanLimits {
  ...existing fields...
  maxBankConnections: number;
}
```

Limit-Werte:
```text
free:     0 Verbindungen
starter:  0 Verbindungen  
pro:      1 Verbindung
business: 3 Verbindungen
```

