

# Landing Page Redesign

## Analyse: Aktuell vs. SparkReceipt

**Aktuell (One-Pager, 5 Sektionen):** Hero → HowItWorks → Features → Pricing → CTA

**SparkReceipt hat:** Hero mit Social Proof → Early Bird Deal → Problem/Solution Vergleich → 4-Schritt Workflow (mit Screenshots) → Pricing → Weltkarte → Testimonials → Founder Support → FAQ → Final CTA

**Unser Gap:** Keine Testimonials auf der Seite (Komponente existiert aber), kein FAQ, keine Problem/Solution Story, keine Feature-Vergleichstabelle bei Pricing, kein "Vertrauen"-Element (Social Proof im Hero fehlt).

## Empfehlung: Erweiterter One-Pager + eigene Pricing-Seite

Der One-Pager bleibt als Hauptseite, wird aber um fehlende Sektionen ergänzt. Pricing bekommt zusätzlich eine eigene Seite (`/pricing`) mit detaillierter Funktionsvergleichstabelle.

## Neue Seitenstruktur

```text
Landing Page (/)
├── Hero (überarbeitet: Social Proof Avatare + Sterne)
├── Problem/Solution (NEU: "Belegchaos vs. Automatisierung")
├── HowItWorks (bestehend, leicht aufgefrischt)
├── Features (bestehend, Rechnungsmodul ergänzen)
├── Testimonials (existierende Komponente einbinden)
├── Pricing (kompakt, mit Link zu /pricing)
├── FAQ (NEU)
├── CTA (bestehend)
└── Footer

Pricing-Seite (/pricing)
├── Header
├── Pricing Cards (aus Landing Page)
├── Feature-Vergleichstabelle (NEU: alle Features × alle Pläne)
├── FAQ (Preis-bezogen)
├── CTA
└── Footer
```

## Konkrete Änderungen

### 1. Hero aufwerten (`Hero.tsx`)
- Social-Proof-Leiste unter dem CTA: Sterne-Rating + "Vertraut von X+ Nutzern in Österreich & Deutschland"
- Stärkerer Claim im Untertitel

### 2. Neue Sektion: Problem/Solution (`ProblemSolution.tsx`)
- Zweispaltig: Links "Ohne XpenzAi" (Schmerzpunkte), rechts "Mit XpenzAi" (Lösung)
- Inspiriert von SparkReceipts "Tax-Time Panic vs. Automatic Tracking"
- Positioniert zwischen Hero und HowItWorks

### 3. Testimonials einbinden
- `Testimonials.tsx` existiert bereits, wird in `Index.tsx` importiert
- Platzierung zwischen Features und Pricing

### 4. Neue Sektion: FAQ (`FAQ.tsx`)
- 6-8 häufige Fragen: Datensicherheit, KI-Genauigkeit, Steuerberater-Export, Beta-Preise, Kündigung, DSGVO
- Accordion-basiert (vorhandene UI-Komponente)
- Platzierung zwischen Pricing und CTA

### 5. Features-Sektion erweitern (`Features.tsx`)
- Rechnungsmodul, Angebote/Lieferscheine und Live-Bankanbindung als zusätzliche Features aufnehmen
- Badge "Business" bzw. "Pro" an Premium-Features

### 6. Eigene Pricing-Seite (`/pricing`)
- Neue Seite `src/pages/PricingPage.tsx` mit Route `/pricing`
- Enthält die bestehenden Pricing Cards + eine neue **Feature-Vergleichstabelle** (Check/X Matrix)
- Tabelle basiert auf `PLAN_FEATURES` und `PLAN_LIMITS` aus `planConfig.ts`
- Header-Navigation bekommt "Preise" Link zur neuen Seite

### 7. Index.tsx & Header aktualisieren
- `Index.tsx`: ProblemSolution, Testimonials und FAQ einbinden
- `Header.tsx`: "Preise"-Link auf `/pricing` statt Scroll-to-Section
- `App.tsx`: Route `/pricing` hinzufügen

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `src/components/landing/Hero.tsx` | Social Proof ergänzen |
| `src/components/landing/ProblemSolution.tsx` | **NEU** |
| `src/components/landing/Features.tsx` | Premium-Features ergänzen |
| `src/components/landing/FAQ.tsx` | **NEU** |
| `src/components/landing/PricingComparison.tsx` | **NEU** (Feature-Tabelle) |
| `src/pages/PricingPage.tsx` | **NEU** |
| `src/pages/Index.tsx` | Neue Sektionen einbinden |
| `src/components/landing/Header.tsx` | Preise-Link aktualisieren |
| `src/App.tsx` | Route `/pricing` hinzufügen |

