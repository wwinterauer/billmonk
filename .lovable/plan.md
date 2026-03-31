

# Bulk-Zuweisung für Buchungsart (tax_type)

## Analyse

Die Bulk-Aktionsleiste in `Expenses.tsx` (Zeilen 1884-2170) hat bereits:
- Freigeben, Überprüfen, Ablehnen, Abschließen
- Tags bearbeiten (Popover)
- **Kategorie zuweisen** (Popover mit Select, Zeilen 2002-2049)
- KI-Analyse, Duplikate prüfen, Vergleichen, Löschen

**Was fehlt:** Bulk-Buchungsart-Zuweisung. Die Buchungsarten kommen aus `taxCategories` (via `useCategories()`), dasselbe was der Filter nutzt (Zeile 1658).

**Kategorie-Bulk hat kein "Nicht zugeordnet"** — das ergänze ich ebenfalls.

## Änderungen in `src/pages/Expenses.tsx`

### 1. Bulk-Buchungsart-Button nach dem Kategorie-Button (nach Zeile 2049)

Neuer Popover-Block analog zum Kategorie-Block:
- Button: `<FileText /> Buchungsart`
- Select mit:
  - `"__clear__"` → "Offen" (setzt `tax_type` auf `null`)
  - Separator
  - Alle `taxCategories` aus `useCategories()`
- `onValueChange`: Loop über `selectedIds`, `supabase.update({ tax_type })`, Toast, clear selection, reload

### 2. Kategorie-Select erweitern (Zeile 2041)

Vor den Kategorien ein `"__clear__"` → "Nicht zugeordnet" Option + Separator einfügen. Bei `__clear__` wird `category: null` gesetzt.

### Dateien
- `src/pages/Expenses.tsx`

