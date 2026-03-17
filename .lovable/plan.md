
# Gesamtplan: User-Strecke, Stripe-Bezahlung, Admin & Kontingent

## Status: Phase 1-5 implementiert ✅

### Umgesetzte Phasen:
- ✅ Phase 1: DB-Migration (profiles erweitert, user_roles, has_role(), reset_monthly_credits())
- ✅ Phase 2: Admin-Rolle für w.winterauer@gmail.com gesetzt (Business-Plan)
- ✅ Phase 3: planConfig.ts + usePlan.ts erstellt
- ✅ Phase 4: Onboarding-Wizard (3 Steps) + ProtectedRoute mit Onboarding-Check
- ✅ Phase 5: Sidebar mit Kontingent-Balken, Admin-Plan-Switcher, Feature-Gating

### Offene Phasen:
- ⬜ Phase 6: Stripe aktivieren + Edge Functions (create-checkout, stripe-webhook, customer-portal)
- ⬜ Phase 7: Landing Page Pricing Update (4 Pläne, monatlich/jährlich Toggle)
- ⬜ Phase 8: Plan-Enforcement (Upload-Limits durchsetzen)
- ⬜ Phase 9: Ausgangsrechnungs-Modul (Business-only)

---

## Bestehende Bugs

| Priorität | Problem | Dateien | Aufwand |
|-----------|---------|---------|--------|
| HOCH | 4x `parseFloat \|\| null` Bug | `ReceiptDetailPanel.tsx`, `Review.tsx` | 4 Zeilen |
| HOCH | CorrectionTracking originalVatRate | `useCorrectionTracking.ts` | 1 Zeile |
| MITTEL | Tote Links `/forgot-password`, `/agb` | `Login.tsx`, `Register.tsx` | 2-50 Zeilen |
| MITTEL | Badge ohne forwardRef | `badge.tsx` | 5 Zeilen |
