

# Gesamtplan: User-Strecke, Stripe-Bezahlung, Admin & Kontingent

## Status: Phase 1-6 implementiert ✅, Phase 9 vollständig ✅, Integration vollständig ✅

### Umgesetzte Phasen:
- ✅ Phase 1: DB-Migration (profiles erweitert, user_roles, has_role(), reset_monthly_credits())
- ✅ Phase 2: Admin-Rolle für w.winterauer@gmail.com gesetzt (Business-Plan)
- ✅ Phase 3: planConfig.ts + usePlan.ts erstellt
- ✅ Phase 4: Onboarding-Wizard (3 Steps) + ProtectedRoute mit Onboarding-Check
- ✅ Phase 5: Sidebar mit Kontingent-Balken, Admin-Plan-Switcher, Feature-Gating
- ✅ Phase 6: Stripe-Integration komplett
- ✅ Phase 9: Rechnungsmodul komplett

### Rechnungs-Integration (alle implementiert):
- ✅ DB: invoices.category, invoice_tags + RLS, export_templates.template_type, cloud_connections.backup_include_invoices
- ✅ InvoiceEditor: Kategorie-Dropdown + InvoiceTagSelector
- ✅ Invoices-Liste: Kategorie-Spalte
- ✅ Dashboard: Einnahmen-KPIs (Einnahmen, Offene Rechnungen, Gewinn/Verlust) in FeatureGate
- ✅ Reports: Einnahmen-Analyse (KPIs, nach Kunde, nach Kategorie, Gewinn/Verlust) in FeatureGate
- ✅ Export-Vorlagen: Typ-Umschalter (Belege/Rechnungen) + DEFAULT_INVOICE_COLUMNS + template_type Filter
- ✅ Cloud-Backup: backup_include_invoices Flag + backup-to-drive lädt Rechnungen + PDFs in eigenen Ordner

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
