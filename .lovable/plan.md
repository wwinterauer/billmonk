## Problem

Im `TagSelector` (`src/components/tags/TagSelector.tsx`) wird der vollständige Tag-Name beim Hover nicht zuverlässig angezeigt. Das native `title`-Attribut auf dem `<button>` funktioniert nicht konsistent, vor allem bei abgeschnittenen Namen (`truncate max-w-[120px]`), sodass man in der Review-Ansicht (und anderen Stellen) nicht erkennen kann, welcher Tag wirklich gemeint ist.

## Lösung

Den nativen `title`-Mechanismus durch shadcn/ui `Tooltip` ersetzen. Ein Tooltip umschließt jeden Tag-Chip und zeigt immer den vollständigen Namen an.

### Änderungen in `src/components/tags/TagSelector.tsx`

1. **`Tooltip` importieren** — aus `@/components/ui/tooltip`
2. **Tag-Chip rendern** — den `<button>` in `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>{tag.name}</TooltipContent></Tooltip>` wickeln
3. **Bestehendes `title` auf dem `<button>` entfernen** (ersetzt durch Tooltip)
4. **`title` auf dem inneren `<span>` entfernen** (verhindert Konflikte)

`TooltipProvider` ist bereits in `src/App.tsx` global vorhanden — kein zusätzliches Provider-Wrapping nötig.

## Betroffene Dateien

- `src/components/tags/TagSelector.tsx`

## Bewusst nicht enthalten

- Kein neues UI-Verhalten (Aktionen, Farben, Größen bleiben)
- Keine Änderung an der Zuweisungslogik
