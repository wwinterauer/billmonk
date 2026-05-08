## Erledigte Punkte in eigenen Bereich verschieben

In der Checklisten-Ansicht (`src/pages/Checklists.tsx`) werden derzeit alle Positionen in einer einzigen Liste angezeigt – egal ob erledigt oder offen.

### Änderung
Innerhalb jeder Checkliste die Items in zwei Gruppen splitten:

1. **Offen** (oben): alle Positionen mit `is_completed = false`, sortiert nach `sort_order`. Direkt sichtbar.
2. **Erledigt** (unten): alle Positionen mit `is_completed = true`, gesammelt unter einem zusammenklappbaren Abschnitt mit Überschrift z. B. „Erledigt (12)". Standardmäßig **eingeklappt**, damit oben nur die noch zu erledigenden Punkte sichtbar bleiben. Per Klick aufklappbar.

### Verhalten
- Hakt der User eine offene Position ab → sie wandert automatisch in den „Erledigt"-Block.
- Entfernt er den Haken im „Erledigt"-Block → die Position wandert wieder nach oben in „Offen".
- Wenn keine erledigten Items existieren, wird der „Erledigt"-Abschnitt gar nicht angezeigt.
- Wenn alle Items erledigt sind, zeigt der obere Bereich einen kleinen Hinweis „Alle Punkte erledigt".
- Funktioniert für alle Checklisten gleich (auch z. B. „Ausgaben Rechnungen").

### Technische Details
- Rein clientseitig: Items in `checklist.items` per `filter` in `openItems` / `completedItems` aufteilen.
- Collapsible-Bereich mit lokalem `useState<Record<checklistId, boolean>>` für Aufklappstatus (oder einfach `useState` pro Card via Sub-Component).
- Keine Datenbank-Änderungen, keine Änderungen an Mutationen oder Sortierung in der DB.
- Bestehende Item-Render-Logik (Checkbox, Notes, Links, Dropdown-Menü) wird in beiden Gruppen identisch wiederverwendet – idealerweise in eine kleine interne Render-Funktion ausgelagert, um Duplikation zu vermeiden.