

# Wiederkehrende Rechnungen: Freigabe-Workflow statt Auto-Versand

## Problem

Aktuell setzt die Cron-Funktion wiederkehrende Rechnungen bei `auto_send = true` direkt auf Status `"sent"` und versendet die E-Mail automatisch. Der User will aber, dass **alle** wiederkehrenden Rechnungen zunächst nur generiert und zur Freigabe vorgelegt werden — kein automatischer Versand ohne manuelle Bestätigung.

## Änderungen

### 1. `supabase/functions/cron-generate-invoices/index.ts`

- Zeile 87: Status immer auf `"draft"` setzen, unabhängig von `auto_send`
- Zeile 96: `sent_at` immer auf `null`
- Zeilen 138-200: Den gesamten Auto-Send-Block (PDF generieren + E-Mail senden) entfernen
- PDF wird trotzdem generiert (damit der User sie in der Vorschau sehen kann), aber **keine E-Mail** wird verschickt
- Optional: Einen Hinweis-Marker setzen (z.B. ein Feld oder die Verknüpfung über `recurring_invoice_id`), damit die Rechnungsübersicht erkennt, dass diese Rechnung aus einer wiederkehrenden Vorlage stammt und auf Freigabe wartet

### 2. `src/pages/Invoices.tsx` — Visueller Hinweis

- Bei Rechnungen mit `status === "draft"` und vorhandener `recurring_invoice_id`: einen kleinen Badge oder Hinweis anzeigen (z.B. "Wiederkehrend — wartet auf Freigabe")
- Der User kann die Rechnung dann wie gewohnt über die bestehenden Aktionen prüfen, bearbeiten und manuell versenden

### 3. `.lovable/plan.md` aktualisieren

Den Plan anpassen: Auto-Send-Logik wird durch einen Freigabe-Workflow ersetzt. Die Cron-Funktion generiert nur noch Entwürfe.

### Dateien
- `supabase/functions/cron-generate-invoices/index.ts` — Status immer `draft`, Auto-Send-Block entfernen
- `src/pages/Invoices.tsx` — Badge für wiederkehrende Entwürfe
- `.lovable/plan.md` — Plan aktualisieren

