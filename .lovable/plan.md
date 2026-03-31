

# Kategorie und Buchungsart trennen — verbleibende Stellen

## Betroffene Stellen

| Datei | Stelle | Problem |
|---|---|---|
| **Expenses.tsx** Zeile 2045 | Bulk-Kategorie-Dropdown | `categories.map` statt `userCategories.map` — zeigt auch Buchungsarten |
| **RecurringExpensesTab.tsx** Zeile 231-244 | Kategorie-Select pro Expense | Ein Dropdown mit `categories.map` — kein separates Buchungsart-Dropdown |
| **VendorManagement.tsx** Zeile 827 | Kategorie-Filter | `categories.map` — mischt beide Typen |
| **VendorManagement.tsx** Zeile 1118 | Bulk-Kategorie-Dialog | `categories.map` — mischt beide Typen |
| **VendorManagement.tsx** Zeile 1290 | Vendor-Edit Standard-Kategorie | `categories.map` — kein zweites Dropdown für Buchungsart |
| **AILearningSettings.tsx** Zeile 753 | Vendor-Standard-Kategorie Tabelle | `categories.map` — mischt beide Typen |
| **BankImportKeywords.tsx** Zeile 396 | Keyword-Kategorie | Hardcoded `CATEGORIES`-Liste — eigenes Thema, nicht Teil dieser Änderung |

## Änderungen

### 1. `src/pages/Expenses.tsx`
- Zeile 2045: `categories.map` → `userCategories.map` (Buchungsart-Bulk existiert bereits separat)

### 2. `src/components/expenses/RecurringExpensesTab.tsx`
- `useCategories()` → `{ userCategories, taxCategories }` destructuren
- Bestehendes Select (Zeile 231-244): Auf `userCategories` umstellen, Label "Kategorie"
- Zweites Select daneben einfügen für Buchungsart mit `taxCategories`, Label "Buchungsart", speichert in `tax_type`-Feld (sofern das Feld auf `recurring_expenses` existiert — falls nicht, nur Kategorie-Dropdown auf `userCategories` einschränken)

### 3. `src/components/settings/VendorManagement.tsx`
- `{ categories }` → `{ userCategories, taxCategories }` destructuren
- **Filter** (Zeile 819-840): Auf `userCategories` einschränken. Zweiten Filter "Buchungsart" mit `taxCategories` daneben hinzufügen
- **Bulk-Kategorie-Dialog** (Zeile 1113-1131): Auf `userCategories` einschränken
- **Vendor-Edit** (Zeile 1279-1308): Auf `userCategories` einschränken. Zweites Select "Standard-Buchungsart" daneben einfügen (speichert in `default_tax_type` auf `vendors` — falls Spalte nicht existiert, nur Kategorie-Dropdown filtern ohne zweites Dropdown)

### 4. `src/components/settings/AILearningSettings.tsx`
- `{ categories }` → `{ userCategories, taxCategories }` destructuren
- Tabelle (Zeile 730-764): Spalte "Standard-Kategorie" auf `userCategories` filtern. Zweite Spalte "Buchungsart" hinzufügen mit `taxCategories`

### Dateien
- `src/pages/Expenses.tsx`
- `src/components/expenses/RecurringExpensesTab.tsx`
- `src/components/settings/VendorManagement.tsx`
- `src/components/settings/AILearningSettings.tsx`

