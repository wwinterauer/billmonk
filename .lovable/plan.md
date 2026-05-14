## Status quo

Ja, das geht **prinzipiell schon** — aber mit Einschränkungen.

In `category_rules` werden bei jeder Korrektur Keywords aus Description + Line-Items extrahiert (`useCorrectionTracking.ts`, Z. 14–48) und je Keyword → Kategorie/Buchungsart gespeichert. Bei der Extraktion (`extract-receipt/index.ts`, Z. 910–943) wird **zuerst** nach Keyword-Match gesucht und **erst dann** der Vendor-Default angewandt — ein Treffer auf "ortstaxe" überschreibt also "Betriebskosten".

**Aber** zwei Probleme:

1. **Schwelle = 3:** Die Regel feuert erst, wenn `match_count >= 3`. Du brauchst also 3 Ortstaxe-Korrekturen, bevor es greift.
2. **User-global statt Vendor-scoped:** Das Keyword "ortstaxe" gilt für alle Lieferanten. Bei generischen Wörtern (z.B. "gebühr") kann es zu Konflikten kommen, wenn unterschiedliche Vendoren dasselbe Wort mit unterschiedlichen Kategorien benutzen.

## Plan

### 1. `category_rules` um `vendor_id` (nullable) erweitern

DB-Migration:
- Spalte `vendor_id uuid NULL` in `category_rules`
- Index `(user_id, vendor_id, keyword)`
- Unique-Constraint auf `(user_id, vendor_id, keyword)` statt nur `(user_id, keyword)`

Bestehende Zeilen bleiben mit `vendor_id = NULL` (= globale Regel) erhalten.

### 2. `useCorrectionTracking.ts` — Regeln vendor-scoped speichern

Beim Anlegen/Update einer category-/tax_type-Korrektur (~Z. 313–390): zusätzlich `vendor_id` aus dem Receipt mitschreiben. So entsteht pro Vendor ein eigener Keyword-Pool. Globale Aggregation läuft weiterhin über Community-Patterns.

### 3. `extract-receipt/index.ts` — Match-Logik mit Priorität

In der Keyword-Match-Schleife (~Z. 910–943) zwei Pässe:

1. **Vendor-spezifisch** (`vendor_id = currentVendorId`): Schwelle **`match_count >= 2`** (weil Kontext eindeutiger).
2. **Global** (`vendor_id IS NULL`): Schwelle bleibt `>= 3`.

Vendor-Match gewinnt vor globalem Match, beide gewinnen vor Vendor-Default.

### 4. Praktische Wirkung

- **Marktgemeinde Bad Goisern**: 
  - Rechnung mit "Grundsteuer / Hausbesitzerabgaben" → vendor-scoped Regel → Betriebskosten
  - Rechnung mit "Ortstaxe" → vendor-scoped Regel → Ortstaxe (nach **2** Korrekturen statt 3)
- Ein anderer Lieferant könnte "Ortstaxe" abrechnen und eine andere Kategorie zugewiesen bekommen, ohne dass sich die Regeln gegenseitig stören.

### 5. Geänderte Dateien

- DB-Migration (neue Spalte + Index + Constraint)
- `src/hooks/useCorrectionTracking.ts`
- `supabase/functions/extract-receipt/index.ts`

Keine Änderungen am UI nötig — Lernen passiert weiterhin transparent beim Speichern.

## Hinweis zum Sofort-Verhalten

Auch ohne diese Erweiterung: wenn du **3× eine Marktgemeinde-Rechnung mit "Ortstaxe" auf Kategorie Ortstaxe korrigierst**, wird die Auto-Kategorisierung schon heute beim 4. Beleg greifen — die globale Keyword-Regel überschreibt den Vendor-Default. Die Erweiterung macht's nur schneller (nach 2× statt 3×) und sauberer pro Lieferant.
