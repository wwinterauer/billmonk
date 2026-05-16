## Problem

`src/pages/Review.tsx` springt beim Mounten immer auf `currentIndex = 0` (Zeile 178–180 in `loadReceipts`). Wenn der Nutzer kurz in die Einstellungen wechselt und zurück zur Review-Seite kommt, sieht er deshalb wieder den ersten Beleg statt des zuletzt bearbeiteten.

## Lösung

Den zuletzt aktiven Beleg merken und beim Neu-Laden wiederherstellen, sofern er noch im Review-Stack ist (Beleg wurde nicht freigegeben/gelöscht/sonst entfernt).

### Änderungen in `src/pages/Review.tsx`

1. **Persistenz-Helper** (Modul-Scope, oben in der Datei):
   - Key: `review-last-receipt-id` in `sessionStorage` (überlebt Navigation, nicht aber Browser-Schließen — passt zur Erwartung „letzte Arbeit in dieser Session").

2. **Schreiben** der ID immer dann, wenn sich `currentIndex` ändert und ein gültiger `currentReceipt` existiert:
   - Neuer `useEffect`, abhängig von `currentReceipt?.id`, schreibt die ID in `sessionStorage`.
   - Beim Verlassen / wenn die Liste leer ist, wird der Key bewusst nicht gelöscht (damit Hin- und Herwechseln zwischen Seiten weiter funktioniert). Cleanup erst, wenn der zuletzt gemerkte Beleg nicht mehr im Review-Stack ist (siehe 3).

3. **Wiederherstellen** in `loadReceipts` nach `setReceipts(allData)`:
   - Statt unbedingt `allData[0]` zu nehmen, zuerst `sessionStorage.getItem('review-last-receipt-id')` lesen.
   - Wenn die ID in `allData` gefunden wird → `setCurrentIndex(idx)`, `populateForm(allData[idx])`, `loadImage(allData[idx])`.
   - Sonst → Fallback auf `allData[0]` (bisheriges Verhalten) und Key aus `sessionStorage` entfernen.

4. **Bestehendes Save-Flow-Verhalten** (Beleg verschwindet nach Approve/Skip/Delete aus der Liste, `setCurrentIndex(nextIndex)`):
   - Nach diesem Pfad wird die `sessionStorage`-ID automatisch über den neuen Effekt (Punkt 2) auf die neue ID aktualisiert. Kein Sonderfall nötig.

5. **Keine** Veränderung an Filterlogik, Datenladen oder anderen Hooks.

## Betroffene Dateien

- `src/pages/Review.tsx` (Helper + zwei kleine Änderungen in `loadReceipts` und ein neuer Effekt)

## Bewusst nicht enthalten

- Kein Server-seitiges State-Tracking (Session reicht völlig).
- Kein URL-Parameter (?id=...) — könnte später nachgezogen werden, aber für die genannte UX-Lücke nicht nötig.
