
# Gesamtplan: User-Strecke, Stripe-Bezahlung, Admin & Kontingent

## Status: Phase 1-5 implementiert ✅, Phase 9 Schritt 1-6 ✅

### Umgesetzte Phasen:
- ✅ Phase 1: DB-Migration (profiles erweitert, user_roles, has_role(), reset_monthly_credits())
- ✅ Phase 2: Admin-Rolle für w.winterauer@gmail.com gesetzt (Business-Plan)
- ✅ Phase 3: planConfig.ts + usePlan.ts erstellt
- ✅ Phase 4: Onboarding-Wizard (3 Steps) + ProtectedRoute mit Onboarding-Check
- ✅ Phase 5: Sidebar mit Kontingent-Balken, Admin-Plan-Switcher, Feature-Gating
- ✅ Phase 9 (Schritt 1-6): Rechnungsmodul Grundgerüst
  - DB: customers, invoice_items, invoices, invoice_line_items, recurring_invoices, invoice_settings (alle mit RLS)
  - Storage-Bucket: invoices (privat)
  - Settings-Tabs: Feature-Gating per usePlan + 4 neue Business-Tabs (Kunden, Artikel, Rechnung, Fakturierung)
  - Hooks: useCustomers, useInvoiceItems, useInvoiceSettings
  - Komponenten: CustomerManagement, InvoiceItemManagement, InvoiceTemplateSettings, InvoiceModuleSettings
  - Sidebar: "Rechnungen" Nav-Eintrag (Business-only)
  - Route: /invoices (Platzhalter-Seite)

### Offene Phasen:
- ⬜ Phase 6: Stripe aktivieren + Edge Functions (create-checkout, stripe-webhook, customer-portal)
- ⬜ Phase 7: Landing Page Pricing Update (4 Pläne, monatlich/jährlich Toggle)
- ⬜ Phase 8: Plan-Enforcement (Upload-Limits durchsetzen)
- ⬜ Phase 9 (Schritt 7-9):
  - Invoices.tsx (vollständige Liste mit Filter/Status)
  - InvoiceEditor.tsx (Rechnungs-Editor mit Positionen)
  - useInvoices.ts Hook
  - Edge Function: generate-invoice-pdf
  - Edge Function: cron-generate-invoices (wiederkehrende Rechnungen)

---

## Bestehende Bugs

| Priorität | Problem | Dateien | Aufwand |
|-----------|---------|---------|--------|
| HOCH | 4x `parseFloat \|\| null` Bug | `ReceiptDetailPanel.tsx`, `Review.tsx` | 4 Zeilen |
| HOCH | CorrectionTracking originalVatRate | `useCorrectionTracking.ts` | 1 Zeile |
| MITTEL | Tote Links `/forgot-password`, `/agb` | `Login.tsx`, `Register.tsx` | 2-50 Zeilen |
| MITTEL | Badge ohne forwardRef | `badge.tsx` | 5 Zeilen |
