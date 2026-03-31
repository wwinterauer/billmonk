

# Rechnungsübersicht aufwerten — wie Ausgaben-Seite

## Problem

Die Rechnungsübersicht (`Invoices.tsx`) hat aktuell nur einen Status-Dropdown-Filter und einzelne Aktionen pro Zeile. Es fehlen:
- Checkbox-Selektion für Batch-Aktionen
- Batch-Statusänderungen (als bezahlt markieren, bezahlt mit Skonto, stornieren)
- Datumsfilter, Suchfeld, Spaltenauswahl
- Status `paid_with_skonto` fehlt komplett
- Fixierte Bulk-Aktionsleiste wie bei Expenses

## Geplante Änderungen

### 1. `src/pages/Invoices.tsx` — Umfangreiche Erweiterung

**Neue Features nach Vorbild `Expenses.tsx`:**

- **Checkbox-Spalte**: Jede Zeile bekommt eine Checkbox, Header hat "Alle auswählen"
- **Bulk-Aktionsleiste**: Fixierte Leiste am unteren Rand bei Selektion, mit Buttons:
  - "Als bezahlt markieren" (grün)
  - "Bezahlt mit Skonto" (grün, nur wenn Rechnungen mit `discount_percent > 0`)
  - "Als versendet markieren"
  - "Stornieren" (rot)
  - "Löschen" (rot, mit Bestätigung)
- **Suchfeld**: Suche nach Rechnungsnummer, Kundenname
- **Datumsfilter**: Von/Bis-Datepicker + Preset-Select (Aktueller Monat, Letztes Quartal, etc.)
- **Neuer Status**: `paid_with_skonto` mit Label "Bezahlt (Skonto)" und grünem Styling
- **Spaltenauswahl**: Dropdown um Spalten ein-/auszublenden (wie Expenses)
- **Pagination**: Wenn viele Rechnungen vorhanden

**Batch-Logik:**
```text
selectedIds: Set<string>
- handleBulkPaid(): Loop über selectedIds → updateInvoiceStatus(id, 'paid')
- handleBulkPaidSkonto(): Loop → updateInvoiceStatus(id, 'paid_with_skonto')  
- handleBulkSent(): Loop → updateInvoiceStatus(id, 'sent')
- handleBulkCancel(): Loop → updateInvoiceStatus(id, 'cancelled')
- handleBulkDelete(): Bestätigungsdialog → Loop → deleteInvoice(id)
```

### 2. `src/hooks/useInvoices.ts` — Skonto-Status

- `updateInvoiceStatus`: Bei `paid_with_skonto` den `skonto_amount` berechnen aus `total * discount_percent / 100` und `paid_at` setzen

### 3. `STATUS_CONFIG` erweitern

```typescript
paid_with_skonto: { label: 'Bezahlt (Skonto)', variant: 'outline' }
```

- Auch im Status-Filter als Option hinzufügen

### Dateien
- `src/pages/Invoices.tsx` — Checkboxen, Bulk-Aktionen, Suchfeld, Datumsfilter, Pagination, Spaltenauswahl
- `src/hooks/useInvoices.ts` — `paid_with_skonto` Status-Logik

