

# Plan: Standard-Kategorien entfernen und Beleg-Zuordnungen bereinigen

## Überblick
Alle generischen System-Kategorien (ohne Länderzuordnung) aus der DB löschen. Bei Belegen, die eine dieser Kategorien zugeordnet haben, das `category`-Feld auf `NULL` setzen, damit keine verwaisten Zuordnungen entstehen.

## 1. Datenbank-Änderungen (via Insert-Tool, da Datenmanipulation)

**Schritt 1:** Beleg-Kategorien bereinigen — alle Belege, die eine der alten Standard-Kategorien nutzen, auf `NULL` setzen:

```sql
UPDATE public.receipts 
SET category = NULL 
WHERE category IN (
  SELECT name FROM public.categories 
  WHERE is_system = true AND country IS NULL
);
```

**Schritt 2:** Standard-Kategorien löschen:

```sql
DELETE FROM public.categories 
WHERE is_system = true AND country IS NULL;
```

## 2. Code-Anpassungen

### `CategoryManagement.tsx`
- **"Standard-Kategorien wiederherstellen" Button entfernen** — der `handleRestoreDefaults` Handler und der zugehörige Button werden gelöscht, da es keine generischen System-Kategorien mehr gibt.

### `extract-receipt/index.ts` (Edge Function)
- Die hardcodierte Fallback-Kategorienliste (`Büromaterial, Software & Lizenzen, Reisekosten, ...`) durch die tatsächlichen User-Kategorien ersetzen oder einen neutralen Fallback verwenden.

## Dateien

| Datei | Änderung |
|---|---|
| DB (Insert-Tool) | UPDATE receipts + DELETE categories |
| `CategoryManagement.tsx` | "Restore Defaults" Button + Handler entfernen |
| `extract-receipt/index.ts` | Hardcodierte Kategorienliste anpassen |

