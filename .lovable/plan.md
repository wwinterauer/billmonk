## Links im Position-Dialog bearbeitbar machen

Aktuell können Links im "Position bearbeiten"-Dialog nur gelöscht (Mülleimer) oder neu hinzugefügt werden. Es soll möglich sein, Bezeichnung und URL bestehender Links direkt zu ändern.

### Änderungen in `src/pages/Checklists.tsx`

1. **Inline-Bearbeitung der Linkliste** (Zeilen 798–815): Die bestehende read-only Anzeige (`LinkIcon` + `<span>{link.label}</span>` + Trash-Button) wird durch zwei `Input`-Felder pro Link ersetzt — eines für Bezeichnung, eines für URL — plus den Trash-Button rechts. Layout analog zur "neuer Link"-Zeile darunter, damit es konsistent aussieht.

2. **Neue Hilfsfunktion `updateLink(index, field, value)`**: aktualisiert `itemForm.links[index].label` bzw. `.url` immutabel via `setItemForm`.

3. Speichern erfolgt wie bisher über `saveItemMutation` beim Klick auf "Speichern" — keine zusätzliche Logik nötig, da der gesamte `links`-Array übernommen wird.

### Nicht im Scope
- Keine Änderungen an Datenbank, Mutationen oder an der Anzeige der Links in der Listenansicht.
- Keine Drag-and-Drop-Sortierung der Links.