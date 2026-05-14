## Ursache

Im Lieferanten-Bearbeiten-Dialog ist das Feld **„Rechtliche Firmennamen"** als **Tag/Chip-Input** umgesetzt: Der getippte Text wird erst dann als Firmenname übernommen, wenn du

- **Enter** drückst, oder
- den **+-Button** rechts neben dem Eingabefeld klickst.

Tippst du nur Text ein und klickst direkt auf **Speichern**, bleibt der Wert nur im Eingabefeld stehen — `formData.legal_names` ist weiterhin leer und genau dieses leere Array wird gespeichert. Beim nächsten Öffnen ist daher nichts hinterlegt.

Das ist nicht offensichtlich und führt erwartbar zu Datenverlust.

## Fix

Beim Klick auf **Speichern** in `VendorManagement.tsx` (`handleSave`) zuerst prüfen, ob im Input `#new_legal_name` noch ein nicht übernommener Wert steht. Falls ja: vor dem Speichern automatisch in das `legal_names`-Array übernehmen (dedupliziert, getrimmt) und Input leeren.

Damit wird sowohl der bisherige Workflow (Enter/+) als auch das intuitive „Tippen + Speichern" korrekt verarbeitet.

Optional zusätzlich (UX-Klarheit, gleiche Datei):
- Hinweistext unter dem Input von „Mehrere rechtliche Firmennamen möglich …" ergänzen um „Mit Enter oder + hinzufügen — wird beim Speichern automatisch übernommen."

## Betroffene Datei

- `src/components/settings/VendorManagement.tsx` — `handleSave` (~Zeile 240) ergänzen, kleiner Hinweistext (~Zeile 1235).

Keine Datenbank-Änderungen nötig. Bestehende Lieferanten sind nicht betroffen.
