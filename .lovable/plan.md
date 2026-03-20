

# Plan: Stripe-Preise synchronisieren und neuen Pro-Monatspreis erstellen

## Ist-Zustand (Stripe Dashboard vs. Code)

| Plan | Stripe monatlich | Code monatlich | Stripe jährlich | Code jährlich |
|------|-----------------|----------------|-----------------|---------------|
| Starter | 2,99 € | 1,99 € | 28,70 € | 19,90 € |
| Pro | 5,99 € | 5,99 € | 76,70 € | 57,50 € |
| Business | 15,99 € | 15,99 € | 153,50 € | 153,50 € |

Pro monatlich soll von 5,99 € auf 7,99 € geändert werden. Alle anderen Preise müssen mit den aktuellen Dashboard-Werten synchronisiert werden.

## Schritte

### 1. Neuen Stripe-Preis erstellen
- Neuer monatlicher Preis für Pro-Produkt (`prod_UAKtEUTzqyQ44I`): **7,99 €/Monat** (recurring, monthly)
- Alter Preis (`price_1TC0DU1lIffwSHcf2hFtyWbQ` = 5,99 €) bleibt bestehen für Grandfathering

### 2. `src/lib/planConfig.ts` aktualisieren
Alle `PLAN_PRICES` auf die aktuellen Stripe-Werte setzen:
- Starter: 2,99 €/Monat, 28,70 €/Jahr
- Pro: **7,99 €/Monat**, 76,70 €/Jahr
- Business: 15,99 €/Monat, 153,50 €/Jahr

### 3. `src/lib/stripeConfig.ts` aktualisieren
- Pro `monthlyPriceId` auf die neue Price-ID setzen (wird beim Erstellen in Schritt 1 generiert)

### 4. UI-Stellen (keine Code-Änderungen nötig)
Beide UI-Komponenten lesen bereits aus `PLAN_PRICES` und `STRIPE_TIERS`:
- **Landing Page** (`src/components/landing/Pricing.tsx`) — zeigt `getPrice()` und `getBetaPrice()` aus `PLAN_PRICES`
- **Abo-Einstellungen** (`src/components/settings/SubscriptionSettings.tsx`) — nutzt `PLAN_PRICES` und `STRIPE_TIERS`

Durch die Aktualisierung der zentralen Config-Dateien werden alle UI-Stellen automatisch korrekt.

### 5. Dokumentation aktualisieren
`/mnt/documents/Platform_Feature_Overview.md` mit den neuen Preisen synchronisieren.

## Betroffene Dateien
- `src/lib/planConfig.ts` (Preise)
- `src/lib/stripeConfig.ts` (neue Price-ID für Pro monthly)
- Stripe: neuer Preis wird via API erstellt

