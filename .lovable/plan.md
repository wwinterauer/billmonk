## Plan

Ich behebe die Verschiebung der Aktionsspalte an der eigentlichen Ursache: Die Header-Zeile ist aktuell ungültiges Tabellen-HTML, weil `DndContext` direkt innerhalb von `<tr>` rendert und zusätzliche `<div>`-Elemente erzeugt. Dadurch kann der Browser die Spalten automatisch reparieren/verschieben — genau deshalb wirken „Aktionen“ und die Buttons wie zwei verschiedene Spalten.

### Änderungen

1. **Ungültige Tabellenstruktur korrigieren**
   - `DndContext` und `SortableContext` werden außerhalb der `<Table>`-Struktur platziert.
   - Innerhalb von `<TableRow>` bleiben nur gültige Tabellenzellen (`<th>`/`<td>`).

2. **Füllspalte wieder entfernen**
   - Die zuletzt eingefügte leere `aria-hidden`-Spalte wird entfernt, weil sie bei korrigierter Struktur nicht mehr nötig ist und die optische Trennung eher verstärkt.

3. **Aktionen-Spalte fest und kompakt halten**
   - Header und Body-Zelle bekommen dieselbe feste Breite.
   - Header-Text und Buttons werden beide rechtsbündig mit identischem Padding ausgerichtet.
   - Die Buttons bleiben in einer Zeile direkt unter „Aktionen“.

4. **Validierung**
   - Danach prüfe ich die Browser-Konsole auf das verschwundene `validateDOMNesting`-Warning.
   - Zusätzlich kontrolliere ich visuell, dass „Aktionen“ und die Icons in derselben Spalte stehen.