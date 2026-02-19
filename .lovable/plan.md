

# Fix: Vendor-Daten fuer ReanalyzeOptions laden

## Problem

Die Schlagwoerter und der Extraktions-Hinweis werden in `Review.tsx` und `ReceiptDetailPanel.tsx` mit leeren Werten hardcoded uebergeben:

```text
vendorExtractionKeywords={[]}   // immer leer
vendorExtractionHint=""          // immer leer
vendorExpensesOnly               // fehlt komplett
```

Die tatsaechlichen Vendor-Daten (Keywords, Hint, Expenses-Only-Flag) werden nie aus der Datenbank geladen.

## Loesung

In beiden Dateien den Vendor per `vendor_id` aus der Datenbank laden und die echten Werte an `ReanalyzeOptions` weitergeben.

### 1. Review.tsx

- Neuen State `currentVendorData` einfuegen (oder per `useMemo` + kleinem Fetch)
- Wenn sich `currentReceipt.vendor_id` aendert: Vendor-Daten aus Supabase laden (`extraction_keywords`, `extraction_hint`, `expenses_only_extraction`)
- Die drei Props korrekt befuellen:
  - `vendorExpensesOnly={currentVendorData?.expenses_only_extraction}`
  - `vendorExtractionKeywords={currentVendorData?.extraction_keywords || []}`
  - `vendorExtractionHint={currentVendorData?.extraction_hint || ''}`
- Nach "merken" den lokalen State ebenfalls aktualisieren

### 2. ReceiptDetailPanel.tsx

- Gleiche Logik: Vendor-Daten per `vendor_id` (bzw. `selectedVendorId`) laden
- Die drei Props korrekt befuellen statt leere Werte zu uebergeben

---

## Technische Details

Kleiner `useEffect` in beiden Dateien, der bei Aenderung der `vendor_id` feuert:

```text
useEffect:
  wenn vendor_id vorhanden:
    SELECT expenses_only_extraction, extraction_keywords, extraction_hint
    FROM vendors WHERE id = vendor_id
  sonst:
    vendorData = null
```

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Review.tsx` | Vendor-Daten laden + Props korrekt setzen |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Vendor-Daten laden + Props korrekt setzen |

