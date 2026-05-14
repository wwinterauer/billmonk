# Plan: Tags in Review umbrechen statt "+X"-Popover

## Problem
Im Review werden bei vielen Tags nur die ersten 6 angezeigt, der Rest steckt hinter einem "...+2"-Popover-Button. Das ist umständlich und unübersichtlich.

## Lösung
Im `TagSelector` wird die Overflow-Logik entfernt. Da der Container bereits `flex flex-wrap` verwendet, brechen die Tags automatisch in weitere Zeilen um, sobald der Platz in einer Zeile nicht mehr reicht.

## Betroffene Dateien

### `src/components/tags/TagSelector.tsx`
1. Prop `maxVisibleTags` entfernen (nicht mehr benötigt).
2. `useMemo` für `visibleTags`/`overflowTags` entfernen.
3. Den gesamten Overflow-Popover-Block (Zeilen ~314-338) entfernen.
4. Stattdessen alle Tags direkt mappen: `tagStates.map(tag => renderTagChip(tag))`.

## Nicht betroffen
- Andere Stellen, die `<TagSelector>` verwenden, brauchen keine Anpassung.
- Keine Schema-, DB- oder RLS-Änderungen.
