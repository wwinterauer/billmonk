

# Gesamtplan: User-Strecke, Stripe-Bezahlung, Admin & Kontingent

Dieser Plan konsolidiert alle bisherigen Planungen in eine Umsetzungsreihenfolge.

---

## Phase 1: Datenbank-Grundlage

### 1a. profiles-Tabelle erweitern
Neue Spalten:
- `street`, `zip`, `city`, `country` (default 'AT'), `phone`
- `account_type` (default 'private') -- 'private', 'business', 'association'
- `uid_number`
- `newsletter_opt_in` (default false)
- `onboarding_completed` (default false)
- `receipt_credit` (default 0) -- Rollover-Guthaben
- `admin_view_plan` (default NULL) -- Admin-Vorschau
- `stripe_customer_id`, `subscription_status`, `subscription_end_date`

### 1b. user_roles Tabelle + has_role()
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (...);
CREATE FUNCTION public.has_role(...) SECURITY DEFINER;
```
RLS: Users sehen nur eigene Rollen.

### 1c. Admin-Rolle setzen
Insert: Admin-Rolle für `w.winterauer@gmail.com`, Plan auf `business`.

### 1d. Rollover-Funktion
`reset_monthly_credits()` -- berechnet unverbrauchte Belege und addiert zu `receipt_credit`.

---

## Phase 2: Plan-Konfiguration & Hook

### 2a. `src/lib/planConfig.ts` (neu)
| | Free | Starter | Pro | Business |
|---|---|---|---|---|
| Belege/Mo | 10 | 30 | 100 | 250 |
| Speicher | 100 gesamt | 7 Jahre | 10 Jahre | 10 Jahre |
| invoiceModule | nein | nein | nein | ja |
| bankImport | nein | ja | ja | ja |
| emailImport | nein | ja | ja | ja |
| cloudBackup | nein | nein | ja | ja |

### 2b. `src/hooks/usePlan.ts` (neu)
- Liest `plan`, `monthly_receipt_count`, `receipt_credit`, `admin_view_plan` aus profiles
- Prüft Admin-Status via user_roles Query
- Admin: `effectivePlan = admin_view_plan || 'business'`
- Berechnet `receiptsUsed`, `receiptsAvailable`, `receiptsLimit`
- Exportiert `setAdminViewPlan()` zum Umschalten

---

## Phase 3: Onboarding-Wizard

### 3a. `src/pages/Onboarding.tsx` (neu)
3-Step-Wizard mit Card-Layout und Step-Indicator:
1. **Persönliche Daten**: Vorname, Nachname, Straße, PLZ, Ort, Land (AT/DE/CH)
2. **Kontotyp**: Privat / Firma / Verein + Firmenname, UID bei Firma/Verein
3. **Abschluss**: Newsletter Opt-in, Datenschutz-Bestätigung, "Los geht's"

### 3b. Routing
- Neue Route `/onboarding` in `App.tsx` (protected, aber ohne Onboarding-Check)
- `ProtectedRoute.tsx`: Profil laden, bei `onboarding_completed === false` → Redirect `/onboarding`

---

## Phase 4: Sidebar -- Kontingent & Admin

### 4a. Kontingent-Balken (alle User)
Zwischen Navigation und User-Menü:
```
Belege: 7 / 40 verfügbar
[████████░░░░░░░░░░░░]
```
- Grün < 80%, Gelb 80-95%, Rot > 95%
- Zeigt Rollover: "(+10 Guthaben)" wenn credit > 0

### 4b. Admin Plan-Switcher (nur Admins)
Select-Dropdown über dem Kontingent: Free / Starter / Pro / Business. Speichert `admin_view_plan` in profiles.

### 4c. Feature-Gating
Nav-Items bekommen optionales `requiredFeature`-Feld. Items werden per `effectivePlan` ein-/ausgeblendet (z.B. Rechnungsmodul nur bei Business).

---

## Phase 5: Stripe-Integration

### 5a. Stripe aktivieren
Via `stripe--enable_stripe` Tool. Produkte/Preise anlegen:
- 4 Pläne × 2 Intervalle (monatlich/jährlich) = 7 Stripe-Preise (Free braucht keinen)

| | Monatlich | Jährlich (~17-20% Rabatt) |
|---|---|---|
| Free | €0 | €0 |
| Starter | €1,99 | €19,90 |
| Pro | €4,99 | €47,90 |
| Business | €9,99 | €95,90 |

### 5b. Edge Functions
- **`create-checkout`**: Erstellt Stripe Checkout Session
- **`stripe-webhook`**: Verarbeitet subscription events → aktualisiert `plan`, `subscription_status` in profiles
- **`customer-portal`**: Stripe Billing Portal für Self-Service (Planwechsel, Kündigung, Rechnungen)

### 5c. Plan-Auswahl in Onboarding (Step 3 erweitern)
Oder separate Seite nach Onboarding → Checkout-Flow.

---

## Phase 6: Landing Page Pricing Update

`src/components/landing/Pricing.tsx` erweitern:
- 4 Pläne statt 3
- Monatlich/Jährlich Toggle mit Rabatt-Badge
- Business-Plan mit Ausgangsrechnungs-Feature hervorgehoben
- CTA-Buttons verlinken auf Stripe Checkout

---

## Phase 7: Plan-Enforcement

Beleglimits durchsetzen:
- Upload-Seite: Prüfung vor Upload, Warnung/Block bei Limit
- `increment_receipt_count` Trigger existiert bereits
- Rollover-Credits berücksichtigen bei Limit-Prüfung

---

## Phase 8: Ausgangsrechnungs-Modul (Business-only, spätere Phase)

### 8a. Neue DB-Tabellen
- `customers` -- Kundenverwaltung
- `invoice_items` -- Artikel-/Dienstleistungs-Vorlagen
- `invoices` -- Ausgangsrechnungen
- `invoice_line_items` -- Rechnungspositionen
- `invoice_templates` -- Vorlagen (Logo, Kopf, Fuß, Bankdaten)
- `recurring_invoices` -- Wiederkehrende Rechnungen

### 8b. Neue Seiten
- Rechnungen, Kunden, Rechnungs-Editor, Vorlagen-Editor
- Neue Sidebar-Einträge unter "Fakturierung" (nur bei Business sichtbar)

---

## Bestehende Bugs (aus aktuellem plan.md)

Diese bleiben bestehen und werden separat behoben:
- 4x `parseFloat || null` Bug (HOCH)
- CorrectionTracking originalVatRate (HOCH)
- Tote Links `/forgot-password`, `/agb` (MITTEL)
- Badge ohne forwardRef (MITTEL)

---

## Empfohlene Umsetzungsreihenfolge

| Schritt | Was | Abhängigkeiten |
|---------|-----|----------------|
| 1 | DB-Migration (profiles + user_roles + functions) | -- |
| 2 | Admin-Rolle setzen per Insert | Schritt 1 |
| 3 | `planConfig.ts` + `usePlan.ts` | Schritt 1 |
| 4 | Onboarding-Wizard + ProtectedRoute | Schritt 1, 3 |
| 5 | Sidebar: Kontingent + Admin-Switcher + Feature-Gating | Schritt 3 |
| 6 | Stripe aktivieren + Edge Functions | -- |
| 7 | Pricing-Page Update (4 Pläne, Toggle) | Schritt 6 |
| 8 | Plan-Enforcement (Upload-Limits) | Schritt 3 |
| 9 | Ausgangsrechnungs-Modul | Schritt 6, 8 |

Schritte 1-5 können in einem ersten Durchlauf umgesetzt werden. Schritte 6-9 folgen danach.

