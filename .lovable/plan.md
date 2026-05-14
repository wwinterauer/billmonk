# Dashboard "Nach Kategorie" / "Nach Buchungsart" Fix

## Probleme

Im Selektor (`src/pages/Dashboard.tsx` Zeile 522) sehe ich im Legendentext u.a. zwei UUIDs (`af1b199b-…`, `ac5bf110-…`) sowie ~15 Kategorien. Das erklärt alle drei Beschwerden:

1. **Unübersichtlich**: Das `<Legend>` rechts vom Pie zeigt _alle_ Kategorien des Monats. Bei 15+ Einträgen quillt die Legende über die Karte und überlagert die Toggle-Buttons im `CardHeader` → wirkt "kaputt".
2. **UUID statt Name**: In `useDashboardData.ts` (Z. 217–243) wird `r.category` / `line.category` direkt als Schlüssel verwendet. Wenn ein Beleg eine Kategorie-ID statt des Namens gespeichert hat (alte/gelöschte Kategorien, Splits), erscheint die rohe UUID im Chart.
3. **Toggle "Buchungsart" reagiert nicht**: vermutlich nur visuell verdeckt durch die überlaufende Legende — beim Klick passiert nichts Sichtbares, weil die Buchungsart-Liste ebenfalls überlange Namen ("Reparatur, Wartung, Ausbesserungsarbeiten" etc.) hat und das gleiche Layoutproblem produziert.

## Änderungen — nur Frontend

### A) `src/hooks/useDashboardData.ts`
- Beim Aufbau der `categoryMap` und `taxTypeMap`: Wenn der Wert wie eine UUID aussieht (`/^[0-9a-f-]{36}$/i`), per `categories`-Lookup auf den **Namen** mappen. Wenn nicht auflösbar → in einen Eimer **„Unbekannt"** legen statt UUID anzuzeigen.

### B) `src/pages/Dashboard.tsx` (Z. 118–131, 497–572)
- **Top-N + Sonstige**: `chartData` auf die **Top 6** Einträge begrenzen; Restbetrag als einen Eintrag „Sonstige" (grau) zusammenfassen. Gilt für beide Ansichten.
- **Legende kompakt**: Legende bei vielen Einträgen unter dem Chart (`align="center"`, `verticalAlign="bottom"`) statt rechts, mit `wrapperStyle` für Zeilenumbruch und max. Höhe + scroll. Lange Namen per `text-ellipsis` truncaten (Voller Name bleibt im Tooltip sichtbar).
- **Toggle-Buttons** außerhalb des Chart-Containers ins eigene `flex-shrink-0`-Header packen, damit sie nie von der Legende verdeckt werden. Falls weiter problematisch, Toggle als kleiner `Tabs`/`SegmentedControl` direkt unter dem Titel platzieren.
- Karten-Mindesthöhe (`min-h`) entfernen falls nötig, damit Layout stabil bleibt.

### C) Sicherheitsnetz für leere Buchungsart
- Wenn `taxTypeData` nur den Bucket `Offen` enthält, klare Empty-State-Meldung „Noch keine Buchungsarten zugewiesen" anzeigen, damit der Toggle sichtbar Wirkung zeigt.

## Nicht im Scope
- Keine DB-Migration; UUID-Werte in `receipts.category` werden _angezeigt_ aufgelöst, aber nicht umgeschrieben (separates Thema).
- Keine Änderungen an Tag-Statistik, Stats-Karten, Routing.

## Verifikation
- Build prüfen.
- Im Preview Dashboard öffnen: Pie zeigt max. 7 Slices (6 + Sonstige), keine UUIDs, Toggle wechselt sichtbar zwischen Kategorie/Buchungsart, Tooltip zeigt vollen Namen + Betrag + %.
