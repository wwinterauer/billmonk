

# Auto-Versand & Mahnwesen — Aktualisierter Plan

## Umgesetzt

### Freigabe-Workflow (statt Auto-Versand)
- Die Cron-Funktion `cron-generate-invoices` erzeugt wiederkehrende Rechnungen **immer als Entwurf** (`status: "draft"`)
- PDF wird automatisch generiert (für Vorschau), aber **keine E-Mail** wird verschickt
- Der User muss jede wiederkehrende Rechnung manuell prüfen und freigeben
- In der Rechnungsübersicht wird bei wiederkehrenden Entwürfen ein 🔄-Icon mit Tooltip "Wiederkehrend — wartet auf Freigabe" angezeigt

### Mahnwesen (mehrstufig)
- Tabelle `invoice_reminders` für Mahnstufen-Tracking
- Spalten in `invoice_settings`: `reminder_stage_1_days`, `reminder_stage_2_days`, `reminder_stage_3_days`, `overdue_email_notify`
- Cron-Logik: Pro User werden `overdue_reminder_enabled` und die Intervalle geprüft
  - Stufe 1: `sent` → `overdue` (nach `reminder_stage_1_days` Tagen)
  - Stufe 2: `overdue` → `reminder_1` (nach zusätzlich `reminder_stage_2_days` Tagen)
  - Stufe 3: `reminder_1` → `reminder_2` (nach zusätzlich `reminder_stage_3_days` Tagen)
- Status-Badges: "1. Mahnung" (destructive), "2. Mahnung" (destructive)

### Cron-Job
- pg_cron: täglich um 06:00 UTC
- Ruft `cron-generate-invoices` Edge Function auf

## Dateien
| Datei | Status |
|-------|--------|
| `supabase/functions/cron-generate-invoices/index.ts` | ✅ Umgesetzt |
| `src/pages/Invoices.tsx` | ✅ Umgesetzt |
| `src/components/settings/InvoiceModuleSettings.tsx` | ✅ Umgesetzt |
| DB-Migration (invoice_reminders + invoice_settings Spalten) | ✅ Umgesetzt |
| pg_cron Job | ✅ Eingerichtet |
