## Ursache

In `src/pages/Expenses.tsx` zeigt das Browser-Layout der Spalte „Aktionen" zu viel Leerraum, weil die HTML-Tabelle mit **`table-layout: auto`** und **`w-full`** läuft. Bei diesem Layout werden gesetzte `width`-Styles auf `<td>`/`<th>` nur als *Hinweis* behandelt — übrig bleibender horizontaler Platz wird auf alle Spalten verteilt, und die letzte Spalte (Aktionen) bekommt überproportional viel davon ab. Das `width: 96px` greift faktisch nicht.

Die Icons selbst sind im Cell-Inhalt korrekt `justify-end` ausgerichtet — aber die Cell ist deutlich breiter als 96 px, dadurch wirken sie wie „in einer anderen Spalte" und der Header „Aktionen" steht weit rechts davon.

## Fix

Eine **flexible Füll-Spalte** zwischen den letzten Datenspalten und der Aktionen-Spalte einbauen. Sie absorbiert den verbleibenden Platz, sodass „Aktionen" tatsächlich nur ihre echten 96 px belegt und Icons + Header bündig übereinanderstehen.

### Änderungen ausschließlich in `src/pages/Expenses.tsx`

1. **Header-Zeile** (ca. Zeile 2628, direkt vor dem `<TableHead>` für „Aktionen"):
   ```tsx
   <TableHead aria-hidden className="p-0" />
   ```
   Kein `width`-Style → wird zur Flex-Spalte und schluckt den Restplatz.

2. **Body-Zeile** (ca. Zeile 2654, direkt vor dem Aktionen-`<TableCell>`):
   ```tsx
   <TableCell aria-hidden className="p-0" />
   ```

3. **Default-Breite** der Aktionen-Spalte bei `90 px` belassen (4 Icons × 32 px = 128 px wären zu breit für das Wunschbild — die Icons in der User-Vorlage wirken wie ca. 24 px). Alternativ auf `120 px` setzen, falls die Icons sonst zu eng aneinander kleben. Empfehlung: **96 px** beibehalten und `gap-0.5` lassen.

4. **`flex-wrap` aus dem inneren Div entfernen** (Zeile 2656), da die Spalte jetzt garantiert die volle Icon-Breite hat — Wrapping würde nur stören:
   ```tsx
   <div className="flex items-center justify-end gap-0.5">
   ```

### Warum keine globale `table-fixed`-Umstellung

`table-layout: fixed` würde das Problem zwar prinzipiell auch lösen, zwingt aber **alle** Spalten in starre Breiten und überschreibt das bestehende dynamische Resize-/Sort-Verhalten der anderen Spalten (`EditableTableHead`). Die Filler-Spalte ist die punktuelle, risikoarme Lösung.

### Ergebnis

- „Aktionen"-Header steht exakt über den 4 Icons (Copy, Eye, Pencil, Trash).
- Kein weißer Leerraum mehr rechts neben dem Header oder zwischen Icons und Spaltenkante.
- Resize-Griff der Aktionen-Spalte bleibt erhalten.
- Andere Spalten (DnD-Reihenfolge, Sort, Resize) bleiben unverändert.