# Plan: Suchbare Dropdowns systemweit

Ziel: Alle relevanten Dropdowns für **Lieferant (rechtl. Name)**, **Kategorie**, **Tag**, **Buchungsart (Tax-Type)** und **Zahlungsart** werden auf eine einheitliche, suchbare Combobox umgestellt — überall im System. **Ausgenommen: MwSt-Felder** (bleiben unverändert).

## Ansatz

Die bestehende `SearchableSelect`-Komponente (`src/components/ui/searchable-select.tsx`) ist bereits vorhanden und im Einsatz (z. B. Vendor-Settings). Sie unterstützt Suche, Clear und optional Inline-Anlage neuer Einträge — wird systemweit als Standard verwendet.

Für **Tags** wird das bestehende `TagSelector`-Komponentenmuster beibehalten (es ist bereits Multi-Select + suchbar via Command), aber überprüft, ob die Suche dort durchgängig funktioniert.

## Betroffene Dateien (wird auf einfaches `<Select>` umgestellt → `SearchableSelect`)

Dropdowns mit den genannten Feldern (Kategorie / Buchungsart / Zahlungsart / Lieferant-Filter):

1. **`src/pages/Review.tsx`**
   - Zahlungsart-Dropdown (Z. ~1450)

2. **`src/components/receipts/ReceiptDetailPanel.tsx`**
   - Kategorie-Dropdown (Z. ~1497)
   - Zahlungsart-Dropdown (Z. ~1718)

3. **`src/components/receipts/SplitBookingEditor.tsx`**
   - Kategorie pro Zeile (Z. ~385)
   - Buchungsart (tax_type) pro Zeile (Z. ~397)

4. **`src/components/expenses/RecurringExpensesTab.tsx`**
   - Kategorie-Dropdown (Z. ~236)

5. **`src/pages/Expenses.tsx`**
   - Kategorie-Filter (Z. ~1639) + ggf. weitere Lieferanten-/Buchungsart-/Zahlungsart-Filter (vollständig prüfen)

6. **`src/pages/Dashboard.tsx`**
   - Falls Kategorie/Buchungsart-Auswahl im „Nach Kategorie"-Feld vorhanden ist

7. **`src/pages/BankImport.tsx` & `src/components/bank-import/ReceiptAssignmentModal.tsx`**
   - Kategorie/Buchungsart/Zahlungsart in Zuordnung & Keywords

8. **`src/components/settings/BankImportKeywords.tsx`**
   - Kategorie-Auswahl bei Keywords

9. **`src/pages/Reports.tsx`**
   - Filter-Dropdowns (Lieferant/Kategorie/Buchungsart) sofern vorhanden

10. **`src/components/receipts/ManualTrainingModal.tsx`**
    - Kategorie-/Buchungsart-Auswahl

11. **Settings-Komponenten** (CategoryManagement, VendorManagement, etc.) — nur dort umstellen, wo Auswahl-Dropdowns dieser Felder vorkommen (nicht für reine Listen).

## Was bleibt unverändert

- **MwSt-Felder** (VAT-Rate-Selects in Review, ReceiptDetailPanel, SplitBookingEditor, Invoice-Editor etc.) — explizit ausgenommen.
- Status-/Sortier-/Sprach-/Provider-/Theme-/Konfigurations-Dropdowns (Plan, Rolle, Land, Währung, Sortierreihenfolge, Sidebar etc.).
- `TagSelector` — bleibt wie heute (ist bereits suchbar via Command), nur leichte QA falls Suche fehlt.

## Vorgehen

1. Dropdown-für-Dropdown auf `SearchableSelect` umstellen, bestehende `value`/`onChange`-Logik unverändert lassen.
2. Optionen werden in `{ value, label }`-Form gemappt (oft trivial; Kategorien & Lieferanten sind bereits geladen).
3. Wo „Neu anlegen" sinnvoll ist (z. B. Kategorie inline in Review/Detail), `onCreate` mit der bestehenden Anlage-Logik verbinden — nur an Stellen, wo das auch heute über „+"-Buttons möglich ist. Sonst weglassen.
4. Layout/Breite/Placeholder bleiben sichtbar identisch, nur das Verhalten ändert sich (Suche + Tastatur).
5. Keine Daten-, Schema- oder RLS-Änderungen.

## Technische Hinweise

- `SearchableSelect` triggert `onChange("")` für Clear → bestehende Setter müssen leere Strings tolerieren (in betroffenen Stellen bereits der Fall, sonst Wrapper).
- Für Felder mit Sentinel-Wert `__empty__` (SplitBookingEditor) wird das Sentinel entfernt; Clear erfolgt jetzt über `allowClear`.
- Build-Check nach jeder Datei; abschließend visueller Smoke-Test in Review, Detail, Split, Expenses, BankImport.

## Out of Scope

- Keine Änderung an Geschäftslogik, Berechnungen oder Datenstrukturen.
- Keine Änderung am MwSt-Verhalten.
- Keine Designsystem-Token-Änderungen.
