

# Rechnungsmodul: Gesamtkonzept (Business-only, Phase 9)

## Funktionsumfang

Das Rechnungsmodul ermöglicht Business-Usern, Ausgangsrechnungen zu erstellen, Kunden zu verwalten, Artikel/Dienstleistungen als Vorlagen zu pflegen und wiederkehrende Rechnungen zu automatisieren.

---

## 1. Datenbank-Tabellen (neue Migration)

### `customers`
Kundenstammdaten für Rechnungsempfänger:
- `id`, `user_id`, `display_name`, `company_name`, `contact_person`
- `email`, `phone`, `street`, `zip`, `city`, `country` (default 'AT')
- `uid_number`, `customer_number` (auto-generiert pro User)
- `payment_terms_days` (default 14), `default_currency` (default 'EUR')
- `notes`, `is_archived` (default false)
- `created_at`, `updated_at`

### `invoice_items`
Artikel-/Dienstleistungs-Vorlagen (wiederverwendbar):
- `id`, `user_id`, `name`, `description`
- `unit` (Stk, Std, Pauschale, etc.), `unit_price`, `vat_rate` (default 20)
- `is_active` (default true), `sort_order`
- `created_at`, `updated_at`

### `invoices`
Ausgangsrechnungen:
- `id`, `user_id`, `customer_id` (FK → customers)
- `invoice_number` (formatiert, z.B. RE-2026-0001)
- `status` ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'credited')
- `invoice_date`, `due_date`, `paid_at`
- `subtotal`, `vat_total`, `total`, `currency` (default 'EUR')
- `notes`, `footer_text`, `payment_reference`
- `recurring_invoice_id` (FK → recurring_invoices, nullable)
- `credit_note_for` (FK → invoices, nullable, für Gutschriften)
- `pdf_storage_path` (generiertes PDF)
- `sent_at`, `sent_to_email`
- `created_at`, `updated_at`

### `invoice_line_items`
Positionen einer Rechnung:
- `id`, `invoice_id` (FK → invoices), `invoice_item_id` (FK → invoice_items, nullable)
- `position` (Sortierung), `description`, `quantity`, `unit`, `unit_price`
- `vat_rate`, `line_total`
- `created_at`

### `recurring_invoices`
Wiederkehrende Rechnungen:
- `id`, `user_id`, `customer_id` (FK → customers)
- `template_line_items` (jsonb — Positionen als Template)
- `interval` ('monthly', 'quarterly', 'yearly')
- `next_invoice_date`, `last_generated_at`
- `auto_send` (default false), `is_active` (default true)
- `notes`, `footer_text`
- `created_at`, `updated_at`

### `invoice_settings`
Pro-User Einstellungen fürs Rechnungsmodul:
- `id`, `user_id` (unique)
- `invoice_number_prefix` (default 'RE'), `invoice_number_format` (default '{prefix}-{year}-{seq}')
- `next_sequence_number` (default 1)
- `default_payment_terms_days` (default 14)
- `default_footer_text`, `default_notes`
- `company_logo_path` (Storage-Ref)
- `bank_name`, `iban`, `bic`
- `auto_send_enabled` (default false), `send_copy_to_self` (default true)
- `overdue_reminder_enabled` (default false), `overdue_reminder_days` (default 7)
- `created_at`, `updated_at`

Alle Tabellen mit RLS: `auth.uid() = user_id`.

---

## 2. Settings-Tabs (Business-only)

Neue Tabs in `Settings.tsx`, alle mit `requiredFeature: 'invoiceModule'`:

| Tab | Komponente | Inhalt |
|---|---|---|
| `customers` | `CustomerManagement.tsx` | CRUD Kundenliste, Suche, Archivierung |
| `invoice-items` | `InvoiceItemManagement.tsx` | CRUD Artikel/Dienstleistungen, Einheit, Preis, MwSt |
| `invoice-templates` | `InvoiceTemplateSettings.tsx` | Logo, Kopf-/Fußzeile, Bankdaten, Nummernformat |
| `invoice-settings` | `InvoiceModuleSettings.tsx` | Automatisierung: Auto-Versand, Mahnungen, Zahlungsziele |

---

## 3. Neue Seiten & Sidebar

### Sidebar (Business-only)
Neue Nav-Gruppe "Fakturierung" mit `requiredFeature: 'invoiceModule'`:
- **Rechnungen** (`/invoices`) — Liste aller Rechnungen mit Status-Filter
- **Neue Rechnung** (`/invoices/new`) — Rechnungs-Editor

### `/invoices` — Rechnungsliste
- Tabelle: Nr, Kunde, Datum, Betrag, Status (Badge farbcodiert)
- Filter: Status, Zeitraum, Kunde
- Aktionen: PDF anzeigen, als bezahlt markieren, stornieren, Gutschrift erstellen
- Statistik-Cards: Offen, Überfällig, Bezahlt (Monat)

### `/invoices/new` (und `/invoices/:id/edit`) — Rechnungs-Editor
- Kunde auswählen (Autocomplete aus `customers`)
- Positionen hinzufügen: aus Artikel-Vorlagen oder frei
- Jede Position: Beschreibung, Menge, Einheit, Einzelpreis, MwSt-Satz
- Automatische Berechnung: Netto, MwSt, Brutto
- Rechnungsdatum, Fälligkeitsdatum (aus Zahlungsziel)
- Notizen, Fußtext
- Aktionen: Als Entwurf speichern, PDF generieren, per E-Mail senden

---

## 4. PDF-Generierung (Edge Function)

### `generate-invoice-pdf`
- Nimmt `invoice_id`, lädt Daten + Positionen + Kundeninfos + Settings
- Generiert PDF mit Logo, Absender, Empfänger, Positionen, MwSt-Aufschlüsselung, Bankdaten, Fußzeile
- Speichert in Storage-Bucket `invoices` (neu)
- Gibt URL zurück

---

## 5. Automatisierungen

### Wiederkehrende Rechnungen
- Cron-Job (Edge Function `cron-generate-invoices`) prüft täglich `recurring_invoices` wo `next_invoice_date <= today`
- Erstellt neue Rechnung aus Template, berechnet nächstes Datum
- Optional: Auto-Versand per E-Mail

### Mahnungen
- Cron-Job prüft `invoices` wo `status = 'sent'` und `due_date + reminder_days < today`
- Setzt Status auf `overdue`, optional: Erinnerungs-E-Mail

---

## 6. Dateien-Übersicht

| Datei | Typ | Beschreibung |
|---|---|---|
| Migration SQL | DB | 6 neue Tabellen + RLS |
| `src/pages/Invoices.tsx` | Neu | Rechnungsliste |
| `src/pages/InvoiceEditor.tsx` | Neu | Rechnungs-Editor |
| `src/components/settings/CustomerManagement.tsx` | Neu | Kundenverwaltung |
| `src/components/settings/InvoiceItemManagement.tsx` | Neu | Artikel/Dienstleistungen |
| `src/components/settings/InvoiceTemplateSettings.tsx` | Neu | Rechnungsvorlage (Logo, Bank, Fußzeile) |
| `src/components/settings/InvoiceModuleSettings.tsx` | Neu | Automatisierung & Nummernformat |
| `src/hooks/useCustomers.ts` | Neu | CRUD Hook für Kunden |
| `src/hooks/useInvoiceItems.ts` | Neu | CRUD Hook für Artikel |
| `src/hooks/useInvoices.ts` | Neu | CRUD Hook für Rechnungen |
| `src/hooks/useInvoiceSettings.ts` | Neu | Hook für Rechnungseinstellungen |
| `supabase/functions/generate-invoice-pdf/index.ts` | Neu | PDF-Generierung |
| `supabase/functions/cron-generate-invoices/index.ts` | Neu | Wiederkehrende Rechnungen |
| `src/pages/Settings.tsx` | Edit | Tabs dynamisch filtern + 4 neue Business-Tabs |
| `src/components/dashboard/Sidebar.tsx` | Edit | "Fakturierung" Nav-Gruppe |
| `src/App.tsx` | Edit | Neue Routen `/invoices`, `/invoices/new`, `/invoices/:id/edit`, `/account` |
| `.lovable/plan.md` | Edit | Phase 9 Detail aktualisieren |

### Storage
- Neuer Bucket `invoices` (privat) für generierte PDFs und Logos

---

## 7. Umsetzungsreihenfolge innerhalb Phase 9

1. DB-Migration (alle 6 Tabellen + RLS + Storage-Bucket)
2. Settings-Tabs: Feature-Gating in `Settings.tsx` + `usePlan`
3. `CustomerManagement.tsx` + `useCustomers.ts` (vollständiges CRUD)
4. `InvoiceItemManagement.tsx` + `useInvoiceItems.ts` (Artikel/Dienstleistungen)
5. `InvoiceTemplateSettings.tsx` + `InvoiceModuleSettings.tsx` + `useInvoiceSettings.ts`
6. Sidebar: Fakturierung-Gruppe
7. `Invoices.tsx` (Liste) + `InvoiceEditor.tsx` (Editor) + `useInvoices.ts`
8. Edge Function: `generate-invoice-pdf`
9. Edge Function: `cron-generate-invoices` (wiederkehrende Rechnungen)

Schritte 1-6 können im ersten Durchlauf umgesetzt werden. Schritte 7-9 folgen danach.

