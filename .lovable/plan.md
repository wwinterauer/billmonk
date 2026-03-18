

# Gesamtplan: User-Strecke, Stripe-Bezahlung, Admin & Kontingent

## Status: Phase 1-6 implementiert ✅, Phase 9 vollständig ✅

### Umgesetzte Phasen:
- ✅ Phase 1: DB-Migration (profiles erweitert, user_roles, has_role(), reset_monthly_credits())
- ✅ Phase 2: Admin-Rolle für w.winterauer@gmail.com gesetzt (Business-Plan)
- ✅ Phase 3: planConfig.ts + usePlan.ts erstellt
- ✅ Phase 4: Onboarding-Wizard (3 Steps) + ProtectedRoute mit Onboarding-Check
- ✅ Phase 5: Sidebar mit Kontingent-Balken, Admin-Plan-Switcher, Feature-Gating
- ✅ Phase 6: Stripe-Integration komplett
  - Edge Functions: create-checkout (Checkout-Session), check-subscription (Abo-Status prüfen), customer-portal (Self-Service Portal)
  - Alle 3 Functions mit verify_jwt=false in config.toml, Auth-Prüfung im Code
  - stripeConfig.ts: Product-IDs + Price-IDs für Starter/Pro/Business (monatlich & jährlich)
  - AuthContext: Automatischer Abo-Check bei Login + periodisches Polling (60s)
  - SubscriptionSettings: Abo verwalten, Status prüfen, Plan upgraden
  - Kein Webhook nötig – Polling via check-subscription synchronisiert den Plan-Status
- ✅ Phase 9: Rechnungsmodul komplett
  - DB: customers, invoice_items, invoices, invoice_line_items, recurring_invoices, invoice_settings (alle mit RLS)
  - Storage-Bucket: invoices (privat)
  - Settings-Tabs: Feature-Gating per usePlan + 4 neue Business-Tabs (Kunden, Artikel, Rechnung, Fakturierung)
  - Hooks: useCustomers, useInvoiceItems, useInvoiceSettings, useInvoices
  - Komponenten: CustomerManagement, InvoiceItemManagement, InvoiceTemplateSettings, InvoiceModuleSettings
  - Sidebar: "Rechnungen" Nav-Eintrag (Business-only)
  - Seiten: /invoices (Liste mit Stats & Filter), /invoices/new (Editor), /invoices/:id/edit (Bearbeitung)
  - Edge Function: generate-invoice-pdf (PDF-Generierung mit pdf-lib, Upload in Storage)
  - Edge Function: cron-generate-invoices (täglich 06:00, wiederkehrende Rechnungen + Überfälligkeits-Check)
  - Cron-Job: generate-recurring-invoices-daily (pg_cron)

### Offene Phasen:
- ⬜ Phase 7: Landing Page Pricing Update (4 Pläne, monatlich/jährlich Toggle)
- ⬜ Phase 8: Plan-Enforcement (Upload-Limits durchsetzen)

---

## Bestehende Bugs

| Priorität | Problem | Dateien | Aufwand |
|-----------|---------|---------|--------|
| ✅ BEHOBEN | 4x `parseFloat \|\| null` Bug | `ReceiptDetailPanel.tsx` | 4 Zeilen |
| ✅ BEHOBEN | CorrectionTracking originalVatRate | `useCorrectionTracking.ts` | 1 Zeile |
| MITTEL | Tote Links `/forgot-password`, `/agb` | `Login.tsx`, `Register.tsx` | 2-50 Zeilen |
| MITTEL | Badge ohne forwardRef | `badge.tsx` | 5 Zeilen |
