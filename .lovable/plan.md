## Ziel

Saubere Trennung zwischen:
- **`category`** = persönliches Ordnungssystem des Users (z. B. „Auto", „Möbel"). Optional, frei wählbar.
- **`tax_type`** = steuerliche Buchungsart (z. B. „KFZ-Kosten (AT)", „Bewirtung 50% (AT)"). Wird **weiterhin aktiv von der KI erkannt**.

Damit verschwindet auch der irreführende Lerndialog „KFZ-Kosten (AT) → Auto", weil `category` nie mehr mit einem Steuer-Wert befüllt wird.

## Was sich konzeptionell ändert

```text
                       VORHER                                NACHHER
─────────────────────────────────────────  ─────────────────────────────────────────
categories (Tabelle)                       categories (Tabelle)
  ├─ User: Auto, Möbel, …          (8)      ├─ User: Auto, Möbel, …          (8)
  └─ System (AT): KFZ-Kosten, …   (15) ❌   └─ keine "(AT/DE/CH)"-Einträge mehr

Receipt.category   = "KFZ-Kosten (AT)"  →  Receipt.category   = "Auto" (oder NULL)
Receipt.tax_type   = "Betriebsausgabe"  →  Receipt.tax_type   = "KFZ-Kosten (AT)"  (KI erkennt aktiv)
```

Quelle der Buchungsarten ist künftig allein die bereits existierende Tax-Type-Liste (`useCategories().taxCategories` bzw. `taxCategoryInfo.ts`), die schon das `tax_type`-Dropdown speist.

## 1. Datenbank-Migration

**A) System-Kategorien aus `categories` entfernen**
- `DELETE FROM public.categories WHERE is_system = true AND country IS NOT NULL;`  
  (Globale System-Einträge ohne Land bleiben unverändert.)

**B) Bestehende Belege bereinigen** (per `insert`-Tool, kein Schema-Change)
- Wo `receipts.category` exakt einem entfernten System-Namen entspricht **und** `tax_type IS NULL`: `tax_type = category`, `category = NULL` (Wert geht nicht verloren).
- Wo `receipts.category` einem System-Namen entspricht **und** `tax_type` schon gefüllt ist: nur `category = NULL` (bestehender `tax_type` bleibt unverändert, wie gewünscht).
- Gleiche Logik einmalig auf `receipt_split_lines` anwenden.

**C) Lern-/Community-Daten säubern**
- `category_rules`: Einträge mit System-Namen in `category_name` löschen (oder analog ins `tax_type_name`-Feld verschieben).
- `community_patterns`: Einträge mit System-Namen in `suggested_category` deaktivieren (`is_rejected = true`).

## 2. KI-Extraktion (Edge Function `extract-receipt`)

**Wichtig:** Die KI erkennt `tax_type` weiterhin aktiv — nur die Datenquellen werden klar getrennt.

- **`category`-Liste im Prompt** (Zeilen ~510–562): Filter so ändern, dass nur User-Kategorien geladen werden:  
  `(user_id = userId) OR (is_system = true AND country IS NULL)`  
  → KI bekommt nie wieder länderspezifische Steuer-Einträge als „category" angeboten.
- **`tax_type`-Liste im Prompt**: separate Liste aus den bekannten Tax-Types (z. B. aus `taxCategoryInfo.ts`, gefiltert nach Userland AT/DE/CH/UK) zusätzlich injizieren — analog zur heutigen Kategorie-Liste, aber als zweite, eindeutig benannte Sektion: „BUCHUNGSARTEN (tax_type)".
- **Prompt-Anweisungen**:
  - „category" = persönliches User-Label, leer lassen wenn keine passt.
  - „tax_type" = steuerliche Buchungsart aus der vorgegebenen Tax-Type-Liste (hier KFZ-Kosten (AT) etc.).
  - Beide Felder sind **unabhängig** zu befüllen.
- **`buildCategoryHints`** (Tankstelle→KFZ, Bewirtung 50% etc.) bleibt erhalten, wird aber konzeptionell der **tax_type**-Sektion zugeordnet (nicht mehr der category-Sektion). Funktion ggf. umbenennen in `buildTaxTypeHints`.
- DACH-Hints (Km-Geld, Tagesdiäten, GWG-Grenzen) bleiben unverändert in der `tax_type`-Sektion.

## 3. Frontend

- `useCategories.taxCategories` greift heute auf `categories` mit `is_system && country` zu — das wird nach der Migration leer. **Umstellen** auf eine clientseitige Quelle aus `taxCategoryInfo.ts` (gefiltert nach `companySettings.country`), damit das `tax_type`-Dropdown im `ReceiptDetailPanel`, `BankImportKeywords` und `VendorManagement` (neu hinzugefügter „Standard-Buchungsart"-Selektor) weiterhin funktioniert.
- Smoke-Check in `ReceiptDetailPanel`, `ExportTemplateEditor`, `Expenses` (Spalten/Filter), `Settings → Kategorien`-Hinweis: „Steuerliche Buchungsarten findest du unter Buchungsart, nicht hier."
- `ReceiptDetailPanel.calculateFieldChanges`: keine Änderung nötig — die irrtümlichen „Kategorie"-Diffs verschwinden mit der Migration von selbst.

## 4. Vendor-Defaults / Field-Learning

- `vendors.default_category_id`: zeigt durch das UI-Dropdown ohnehin nur noch auf User-Kategorien.
- `vendors.default_tax_type` (im letzten Schritt eingeführt): bleibt vollständig erhalten und wirkt unverändert.
- `vendor_learning.field_patterns.category`: gelernte System-Werte werden durch die natürliche Lernkurve überschrieben — kein aktiver Eingriff nötig.

## 5. Reihenfolge

1. Migration A (DELETE der System-Country-Kategorien).
2. Daten-Cleanup B + C über `insert`-Tool.
3. `useCategories.taxCategories` auf `taxCategoryInfo.ts` umstellen.
4. Edge Function `extract-receipt`: getrennte Listen für `category` (User) und `tax_type` (Steuer) im Prompt + Deploy.
5. Smoke-Test mit Uniqa-Beleg: `category` bleibt leer (oder „Versicherungen" als User-Kategorie), `tax_type` = „Versicherungen (AT)" kommt von der KI, kein falscher Lerndialog mehr.

## Was NICHT geändert wird

- Kein neues DB-Feld, keine Schema-Änderung an `receipts`.
- `tax_type` bleibt Freitext-Spalte.
- KI-Erkennung der Buchungsart bleibt aktiv und wird sogar präziser, weil sie eine dedizierte Liste mit DACH-Hints bekommt.
