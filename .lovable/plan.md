## Ziel

Die Tabelle auf `/expenses` bekommt eine klassische Spalten-Bearbeitung:

1. **Sichtbarkeit** (existiert bereits via "Spalten"-Dropdown) — bleibt
2. **Reihenfolge per Drag & Drop** am Spaltenkopf
3. **Spaltenbreite per Ziehen** an der rechten Kante des Spaltenkopfes
4. **Sortierung per Klick** auf jeden sortierbaren Spaltenkopf (auf/ab, mit Indikator)
5. Alle Einstellungen werden pro Nutzer in `localStorage` persistiert (analog zur bestehenden `expenses-visible-columns`)

## Umsetzung

### Neue Hilfsstrukturen in `src/pages/Expenses.tsx`

- `SortField` wird auf alle sinnvollen Spalten erweitert: `date | vendor | invoice_number | description | category | tax_type | amount | ai_confidence | status`. `tags` bleibt nicht sortierbar (Mehrwert-Feld).
- Drei neue State-Hooks + Persistenz:
  - `columnOrder: ColumnKey[]` → key `expenses-column-order`
  - `columnWidths: Record<ColumnKey, number>` (px) → key `expenses-column-widths`
  - Bestehender `visibleColumns` bleibt
- Default-Werte aus `COLUMN_CONFIG` (Reihenfolge = Definition, Breite = sinnvolle Defaults pro Spalte).

### Rendering der Tabelle

- Aktuell ist jeder `TableHead`/`TableCell` einzeln hartkodiert. Refactor: ein gemeinsames Mapping `ColumnKey → { headerLabel, sortField?, renderCell(receipt) }`, dann wird `<TableHead>`/`<TableCell>` per `columnOrder.filter(isVisible).map(...)` gerendert.
- Vorteil: Reihenfolge, Breite und Sort-Hook greifen einheitlich; bestehende Zellinhalte werden 1:1 in die Renderer übernommen (kein UI-/Daten-Verhalten verändert).

### Drag & Drop für Spaltenreihenfolge

- `@dnd-kit/core` + `@dnd-kit/sortable` (bereits Projektstandard in shadcn-Umgebungen, sonst hinzufügen).
- `SortableContext` um die `TableRow` im `TableHeader`, jeder `TableHead` ist ein `useSortable`-Item mit kleinem Drag-Handle-Icon links neben dem Label.
- `onDragEnd` schreibt neue `columnOrder` in State + `localStorage`.

### Resize

- Jeder `TableHead` bekommt rechts eine 4 px breite Resize-Handle (`absolute right-0 top-0 h-full cursor-col-resize`).
- `onMouseDown` startet Resize, `mousemove` aktualisiert Breite (min 60 px, max 600 px), `mouseup` persistiert.
- Breite wird per `style={{ width }}` auf `TableHead` und zugehörige `TableCell` gesetzt; Tabelle bekommt `table-layout: fixed` damit Breiten greifen.

### Sortierung auf allen Spalten

- Vorhandene `handleSort`/`getSortIcon`-Logik bleibt, wird auf den vollen `SortField`-Union erweitert.
- `result.sort` im `useMemo` bekommt weitere Cases (`description`, `category`, `tax_type`, `status`, `ai_confidence` — string-vergleich bzw. nummerisch).
- Klick auf Header toggelt asc/desc; aktiver Sort wird per Pfeil-Icon angezeigt (existiert bereits).
- Drag-Handle und Resize-Handle stoppen `pointerdown`-Propagation, damit Sortierklick nicht ausgelöst wird.

### Reset

- Im bestehenden "Spalten"-Dropdown ein "Layout zurücksetzen"-Button → löscht die drei `localStorage`-Keys und setzt State auf Defaults.

## Betroffene Dateien

- `src/pages/Expenses.tsx` (Refactor Header/Body-Rendering, neue State + Persistenz, DnD, Resize, erweiterte Sort)
- ggf. `package.json` (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) falls nicht vorhanden

## Bewusst NICHT enthalten

- Server-seitige Persistenz pro Nutzer (bleibt lokal im Browser, wie heute schon die Sichtbarkeit)
- Neue Datenfelder/Spalten jenseits der heute schon konfigurierten 10 — "neue Spalten hinzufügen" meint im Kontext der Übersicht das Wieder-Einblenden über das vorhandene Set
