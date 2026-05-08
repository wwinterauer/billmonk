## Problem

In "Alle Ausgaben" zeigen aus dem CSV automatisch erstellte Ausgaben den Schlagwort-Text als Lieferanten (z.B. "Rahmenbereitstellung", "Kest", "Generali") statt des hinterlegten Lieferanten (z.B. "Raiffeisen", "Generali").

Ursache: Diese Receipts wurden erstellt **bevor** den Schlagwörtern Lieferanten zugeordnet wurden. Sie haben `vendor_id = NULL` und `vendor = <keyword>`. Die Auto-Erstellungs-Logik in `BankImport.tsx` ist bereits korrekt — sie greift nur für neue Imports.

## Lösung

### 1. Backfill via Migration
Bestehende Receipts aktualisieren, die per Bank-Import erstellt wurden und ein verknüpftes Keyword mit `vendor_id` haben:

```sql
UPDATE public.receipts r
SET vendor_id = k.vendor_id,
    vendor = v.display_name,
    tax_type = COALESCE(r.tax_type, k.tax_type)
FROM public.bank_import_keywords k
JOIN public.vendors v ON v.id = k.vendor_id
WHERE r.bank_import_keyword_id = k.id
  AND r.user_id = k.user_id
  AND k.vendor_id IS NOT NULL
  AND (r.vendor_id IS NULL OR r.vendor_id <> k.vendor_id);
```

Nur Receipts mit `bank_import_keyword_id` werden angefasst — keine manuell erfassten Belege.

### 2. Going-forward-Verhalten
`BankImport.tsx` (Zeilen 254–263, 344–350) schreibt bereits `vendor_id`, `vendor` (aus `vendorNameMap`) und `tax_type`. Keine Codeänderung nötig.

## Nicht im Scope
- Änderung der Default-Keywords-Trigger
- Änderung an `useBankImport.ts` oder UI-Komponenten