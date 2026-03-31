

# Kategorien im Dokumenten-Editor: Nur User-Kategorien anzeigen

## Problem

Im `InvoiceEditor.tsx` wird `categories` aus `useCategories()` verwendet, was sowohl persönliche Kategorien als auch steuerliche Buchungsarten (System-Kategorien mit Länderzuordnung) enthält. Für Ausgangsrechnungen, Angebote, Lieferscheine und AB sollen nur die **persönlichen User-Kategorien** zur Sortierung angezeigt werden.

## Änderung

### `src/pages/InvoiceEditor.tsx`

Eine einzige Änderung:

- Zeile 95: Statt `const { categories } = useCategories()` → `const { userCategories } = useCategories()`
- Zeile 495: Statt `categories.filter(c => !c.is_hidden)` → `userCategories.filter(c => !c.is_hidden)`

Der Hook `useCategories()` liefert bereits `userCategories` (filtert `c => !c.is_system || !c.country`), das sind genau die persönlichen Kategorien ohne steuerliche Buchungsarten.

### Dateien
- `src/pages/InvoiceEditor.tsx` — 2 Zeilen ändern

