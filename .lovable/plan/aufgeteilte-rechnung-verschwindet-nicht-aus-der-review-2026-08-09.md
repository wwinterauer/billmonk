# Aufgeteilte Rechnung verschwindet nicht aus der Review

## Befund (geprüft)

Der Split hat serverseitig korrekt funktioniert:

- Es existieren nur noch die zwei neuen Teile (`..._Teil1.pdf`, 2 Seiten und `..._Teil2.pdf`, 3 Seiten), beide im Status „review“.
- Das Original mit 4 Seiten ist in der Datenbank **nicht mehr vorhanden** — es wurde samt Datei gelöscht.

Das Problem liegt also rein in der Anzeige: Die Review-Seite hält ihre Belegliste in lokalem Komponenten-State, der nur einmal beim Öffnen der Seite geladen wird. Nach dem Split wird lediglich der React-Query-Cache invalidiert (`['receipts']`), was diesen lokalen State nicht berührt. Der bereits gelöschte Original-Beleg bleibt deshalb bis zum Seiten-Reload sichtbar — und die zwei neuen Teile tauchen nicht auf.

## Lösung

1. Nach einem abgeschlossenen Split in der Review die Liste tatsächlich neu vom Server laden (`loadReceipts()`) statt nur den Query-Cache zu invalidieren. Betrifft beide Split-Einstiegspunkte auf der Seite (Multi-Invoice-Alert und den Splitting-Banner).
2. Nach dem Neuladen sinnvoll positionieren: Ist der aktuell angezeigte Beleg weg (gelöschtes Original), automatisch auf den ersten neuen Teil bzw. den nächsten offenen Beleg springen, statt auf einem leeren Index zu landen.
3. Sicherheitsnetz: Beim Laden der Review-Liste Belege ausblenden, die zwischenzeitlich serverseitig verschwunden sind — d. h. die Liste kommt immer frisch aus der Datenbank, kein Merge mit altem State.

## Technische Details

- `src/pages/Review.tsx`: `onSplitComplete`-Callbacks (Zeilen um 1411 und beim Splitting-Banner) rufen künftig `await loadReceipts()` auf; zusätzlich `queryClient.invalidateQueries({ queryKey: ['receipts'] })` beibehalten, damit Sidebar-Zähler stimmen.
- `loadReceipts` so anpassen, dass es einen optionalen „bevorzugten Beleg“ akzeptiert bzw. bei fehlendem vorherigen Beleg auf Index 0 zurückfällt, inkl. `populateForm`/`loadImage`.
- Keine Änderungen an der Edge Function `split-pdf` oder der Datenbank nötig — die Löschung des Originals funktioniert bereits wie gewünscht.

## Hinweis zur Seitenzahl

Original hatte 4 Seiten, die Teile zusammen 5 (2 + 3). Das kommt daher, dass sich die vorgeschlagenen Seitenbereiche überlappen dürfen (eine Seite kann beiden Teilen zugeordnet werden). Falls das unerwünscht ist, kann ich in einem zweiten Schritt eine Überlappungs-Warnung im Split-Dialog ergänzen.
