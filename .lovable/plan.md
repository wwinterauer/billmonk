

## Konzept: Ausgangsrechnungen in alle Module integrieren

### Übersicht

Die Ausgangsrechnungen (Business-Feature) existieren aktuell isoliert. Sie sollen in Dashboard, Berichte, Export und Cloud-Backup integriert werden. Zusätzlich sollen Kategorien und Tags auf Rechnungen anwendbar sein.

### 1. Datenbank: Kategorien & Tags für Rechnungen

Neue Spalten auf `invoices`:
- `category TEXT` (Kategorie-Name, analog zu receipts)
- Neue Join-Tabelle `invoice_tags` (analog zu `receipt_tags`):
  - `id UUID`, `invoice_id UUID FK → invoices`, `tag_id UUID FK → tags`, `created_at`
  - RLS: User darf nur eigene (über invoices.user_id = auth.uid())

### 2. Dashboard: Einnahmen-KPI + Rechnungs-Übersicht

`useDashboardData` erweitern:
- Zusätzlich `invoices` für den Monat laden (status != 'cancelled')
- Neue Stats: `totalIncome` (Summe `total`), `openInvoices` (status = 'sent' oder 'overdue'), `paidThisMonth`
- Dashboard zeigt bei Business-Plan zusätzliche KPI-Karten:
  - "Einnahmen" (Summe bezahlter Rechnungen)
  - "Offene Rechnungen" (Anzahl + Betrag)
  - "Gewinn/Verlust" (Einnahmen - Ausgaben, vereinfacht)
- Alles in `FeatureGate` wrappen → Free/Starter/Pro sehen Vorschau

### 3. Berichte: Einnahmen-Analyse

`Reports.tsx` erweitern:
- Neuer Tab/Abschnitt "Einnahmen" neben bestehenden Ausgaben-Analysen
- Lädt `invoices` für den gewählten Zeitraum (bezahlt = `paid_at` im Range)
- KPIs: Gesamteinnahmen, USt (= vat_total), Anzahl Rechnungen
- Charts: Einnahmen nach Kategorie, Einnahmen nach Kunde, Zeitverlauf
- Gegenüberstellung Einnahmen vs. Ausgaben (einfache Gewinnrechnung)
- In `FeatureGate` wrappen

### 4. Export-Vorlagen für Ausgangsrechnungen

`export_templates` Tabelle erweitern:
- Neue Spalte `template_type TEXT DEFAULT 'receipts'` (Werte: `'receipts'` oder `'invoices'`)
- `DEFAULT_INVOICE_COLUMNS` definieren (analog zu `DEFAULT_COLUMNS`):
  - Rechnungsnr., Kunde, Datum, Fällig am, Netto, USt, Brutto, Status, Kategorie, Tags
- Export-Funktionen (CSV, Excel, PDF) für Rechnungsdaten anpassen
- In `ExportTemplateSettings` und `ExportFormatDialog` einen Typ-Umschalter ("Belege" / "Rechnungen") einbauen
- Einnahmen-Aufstellung für Steuerberater als Standardvorlage anbieten

### 5. Cloud-Backup: Rechnungen einschließen

`cloud_connections` erweitern:
- Neue Spalte `backup_include_invoices BOOLEAN DEFAULT false`
- `CloudStorageSettings` UI: Checkbox "Ausgangsrechnungen einschließen"

`backup-to-drive` Edge Function erweitern:
- Wenn `backup_include_invoices = true`: zusätzlich `invoices` laden (mit PDFs aus Storage-Bucket `invoices`)
- Separate ZIP oder eigener Ordner "Ausgangsrechnungen" innerhalb des Backups
- Rechnungs-CSV/Excel nach konfigurierbarer Export-Vorlage (Typ `invoices`)

### 6. InvoiceEditor: Kategorie & Tags zuweisen

`InvoiceEditor.tsx` erweitern:
- Kategorie-Dropdown (wie bei Belegen) → speichert in `invoices.category`
- `TagSelector`-Komponente einbinden → speichert über `invoice_tags`

`Invoices.tsx` Listenansicht:
- Kategorie und Tags als Spalten/Badges anzeigen
- Filter nach Kategorie/Tags

### 7. Betroffene Dateien

| Datei | Änderung |
|---|---|
| **Migration** | `invoices.category`, `invoice_tags` Tabelle + RLS, `export_templates.template_type` |
| `src/hooks/useDashboardData.ts` | Einnahmen-Stats aus `invoices` laden |
| `src/pages/Dashboard.tsx` | Einnahmen-KPIs + FeatureGate |
| `src/pages/Reports.tsx` | Einnahmen-Tab mit Rechnungsdaten |
| `src/hooks/useExportTemplates.ts` | `DEFAULT_INVOICE_COLUMNS`, `template_type` Filter |
| `src/components/settings/ExportTemplateSettings.tsx` | Typ-Umschalter |
| `src/components/exports/ExportFormatDialog.tsx` | Rechnungsexport-Logik |
| `src/components/settings/CloudStorageSettings.tsx` | Checkbox für Rechnungen |
| `supabase/functions/backup-to-drive/index.ts` | Rechnungen + PDFs ins Backup |
| `src/pages/InvoiceEditor.tsx` | Kategorie + TagSelector |
| `src/pages/Invoices.tsx` | Kategorie/Tag-Spalten + Filter |
| `src/hooks/useInvoices.ts` | Tags-Laden, Kategorie-Support |
| `cloud_connections` Spalte | `backup_include_invoices` |

### 8. Priorisierung (Empfehlung)

1. **DB-Migration** (Basis für alles)
2. **InvoiceEditor + Invoices** (Kategorie & Tags zuweisen/anzeigen)
3. **Dashboard** (Einnahmen-KPIs)
4. **Export-Vorlagen** (Einnahmen-Aufstellung)
5. **Berichte** (Einnahmen-Analyse)
6. **Cloud-Backup** (Rechnungen sichern)

