

# Auto-Versand & Mahnwesen — Detaillierter Plan

## Ist-Zustand

### Was bereits existiert
- **Cron Edge Function** `cron-generate-invoices`: Erzeugt Rechnungen aus `recurring_invoices` und setzt Status auf `"sent"` wenn `auto_send = true`, sonst `"draft"`. Markiert überfällige Rechnungen (`status = "sent"` + `due_date < today`) automatisch als `"overdue"`.
- **Einstellungs-UI** `InvoiceModuleSettings`: Schalter für "Automatischer Versand", "Kopie an mich", "Zahlungserinnerungen" und "Tage nach Fälligkeit" — werden in `invoice_settings` gespeichert.
- **E-Mail-Versand** `send-document-email`: Versendet PDFs mit Anhang via Gmail API oder SMTP über die E-Mail-Konten des Nutzers.

### Was FEHLT
1. **Kein tatsächlicher E-Mail-Versand** bei Auto-Send — die Cron-Funktion setzt nur den Status auf `"sent"`, verschickt aber keine E-Mail
2. **Kein Cron-Job** ist eingerichtet — die Edge Function existiert, wird aber nie automatisch aufgerufen
3. **Mahnwesen-Einstellungen werden nicht berücksichtigt** — die Cron-Funktion markiert pauschal alle überfälligen Rechnungen, unabhängig von `overdue_reminder_enabled` und `overdue_reminder_days`
4. **Keine Mahnstufen** — es gibt nur einen einzigen "Überfällig"-Status, keine gestuften Erinnerungen

---

## Umsetzungsplan

### 1. Cron-Job einrichten (pg_cron)

SQL-Insert (kein Migration-Tool, da projektspezifische Daten):

```sql
SELECT cron.schedule(
  'generate-invoices-daily',
  '0 6 * * *',  -- täglich um 06:00 UTC
  $$ SELECT net.http_post(
    url := 'https://nvvssxykygdxjywncvgd.supabase.co/functions/v1/cron-generate-invoices',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id; $$
);
```

### 2. `cron-generate-invoices/index.ts` erweitern

**a) Tatsächlicher E-Mail-Versand bei auto_send:**

Nach erfolgreicher Rechnungserstellung + PDF-Generierung:
- PDF über `generate-invoice-pdf` Edge Function erzeugen (intern aufrufen)
- E-Mail-Konto des Nutzers aus `email_accounts` laden
- `send-document-email` intern aufrufen mit PDF-Anhang an Kunden-E-Mail
- Kopie an eigenen Account wenn `send_copy_to_self = true`

```text
Ablauf für jede wiederkehrende Rechnung mit auto_send:
1. Rechnung + Positionen erstellen ✓ (existiert)
2. PDF generieren (invoke generate-invoice-pdf)
3. E-Mail senden (invoke send-document-email)
4. Bei send_copy_to_self: Kopie senden
5. Status auf "sent" + sent_at setzen
```

**b) Mahnwesen-Logik mit Nutzer-Einstellungen:**

Statt pauschal alle überfälligen Rechnungen zu markieren:
- Pro Nutzer `invoice_settings` laden (insb. `overdue_reminder_enabled`, `overdue_reminder_days`)
- Nur markieren wenn `overdue_reminder_enabled = true`
- Nur markieren wenn `due_date + overdue_reminder_days < today`

```text
Vorher:  Alle "sent" mit due_date < today → "overdue"
Nachher: Pro User prüfen:
  1. overdue_reminder_enabled = true?
  2. due_date + overdue_reminder_days < today?
  → Nur dann Status auf "overdue" setzen
```

### 3. Mahnstufen (Datenbank-Erweiterung)

Neue Tabelle `invoice_reminders` via Migration:

```sql
CREATE TABLE public.invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  reminder_level INT NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;
```

Mahnstufen-Logik in der Cron-Funktion:
- **Stufe 1** (Zahlungserinnerung): `overdue_reminder_days` nach Fälligkeit
- **Stufe 2** (1. Mahnung): 14 Tage nach Stufe 1
- **Stufe 3** (2. Mahnung): 14 Tage nach Stufe 2

Bei jeder Stufe:
- Eintrag in `invoice_reminders` mit `reminder_level`
- Status der Rechnung aktualisieren: `overdue` → `reminder_1` → `reminder_2`
- Optional: E-Mail-Benachrichtigung an den Nutzer (nicht an den Kunden — Mahnungen müssen manuell versendet werden)

### 4. Einstellungs-UI erweitern (`InvoiceModuleSettings.tsx`)

Zusätzliche Felder im Mahnwesen-Bereich:
- **Mahnstufen konfigurierbar**: Intervalle für Stufe 1/2/3 (Default: 7/14/14 Tage)
- **E-Mail-Benachrichtigung**: "Mich per E-Mail benachrichtigen wenn Rechnung überfällig wird" (Toggle)

Neue Felder in `invoice_settings` (Migration):
```sql
ALTER TABLE invoice_settings
  ADD COLUMN IF NOT EXISTS reminder_stage_1_days INT DEFAULT 7,
  ADD COLUMN IF NOT EXISTS reminder_stage_2_days INT DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reminder_stage_3_days INT DEFAULT 14,
  ADD COLUMN IF NOT EXISTS overdue_email_notify BOOLEAN DEFAULT false;
```

### 5. Status-Erweiterung für Rechnungen

Neue Stati im `STATUS_CONFIG` und in der Invoices-Übersicht:
- `reminder_1` → "1. Mahnung" (orange Badge)
- `reminder_2` → "2. Mahnung" (rot Badge)

Anpassung in `Invoices.tsx` (Filter + Badge-Farben) und `useInvoices.ts` (Status-Updates).

---

## Zusammenfassung der Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/cron-generate-invoices/index.ts` | E-Mail-Versand bei auto_send, nutzer-spezifische Mahnlogik, Mahnstufen |
| `src/components/settings/InvoiceModuleSettings.tsx` | Mahnstufen-Intervalle, E-Mail-Benachrichtigung |
| `src/pages/Invoices.tsx` | Neue Stati `reminder_1`, `reminder_2` in Filter + Badges |
| `src/hooks/useInvoices.ts` | Neue Stati unterstützen |
| DB-Migration | `invoice_reminders` Tabelle, `invoice_settings` Spalten |
| pg_cron | Täglicher Job um 06:00 UTC |

