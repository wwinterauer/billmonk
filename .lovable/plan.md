## Duplikat-Anzeige & manuelle Prüfung in Review

### 1. Banner für bereits markierte Duplikate
In `src/pages/Review.tsx` im CardContent (nach dem Multi-Invoice-Alert) ein Hinweis-Banner rendern, wenn `currentReceipt.is_duplicate && currentReceipt.duplicate_of`:

- Amber-styled Banner: "⚠️ Dieser Beleg wurde als Duplikat erkannt" + Score
- Buttons:
  - **"Original vergleichen"** → öffnet `DuplicateComparisonModal` mit `duplicateId=currentReceipt.id, originalId=currentReceipt.duplicate_of`
  - **"Kein Duplikat"** → setzt `is_duplicate=false, duplicate_of=null, duplicate_score=null` (analog zu `Expenses.tsx` Zeile 392–395)

Hinweis im Banner: "Zum Löschen den vorhandenen Löschen-Button unten verwenden." (kein zusätzlicher Delete-Button).

### 2. "Duplikat prüfen"-Button
Im Confidence-Header neben `ReanalyzeOptions` (Zeile ~907) `<Button variant="outline" size="sm">` mit Copy-Icon: **"Duplikat prüfen"**.

Handler:
- `checkForDuplicates(user.id, currentReceipt.file_hash, { vendor, amount_gross, receipt_date, invoice_number }, currentReceipt.id)`
- Treffer (`isDuplicate && score >= 70`): Receipt updaten (`is_duplicate=true, duplicate_of, duplicate_score, duplicate_checked_at`), Toast "Duplikat gefunden" → Banner aus Schritt 1 erscheint nach Refetch
- Kein Treffer: nur `duplicate_checked_at` setzen, ggf. bestehende Markierung entfernen, Toast "Kein Duplikat gefunden"
- Loading-State via lokalem `useState`

### 3. Modal-Integration
`DuplicateComparisonModal` einmal am Ende der Review-Seite mounten (analog zu Expenses), gesteuert über lokalen `open`/`ids`-State. Nach Schließen: `queryClient.invalidateQueries(['receipts'])`.

### Unverändert
- `useReceiptProcessing` (Auto-Check), `duplicateDetectionService`, Expenses-Seite, bestehender Lösch-Button in Review.

### Out of scope
- Bulk-Prüfung in Review, Schwellwert-Konfiguration.
