# Tag-Filter in Export-Vorlagen

Export-Vorlagen bekommen einen Tag-Filter: bestimmte Tags einschließen und/oder ausschließen. Der Filter wird in der Vorlage gespeichert und beim Export sowie in der Vorschau angewendet.

## Verhalten

- **Einschließen**: Nur Belege, die mindestens einen der gewählten Tags haben (leer = alle Belege).
- **Ausschließen**: Belege mit einem der gewählten Tags werden entfernt (gewinnt immer gegen Einschließen).
- Zusätzlich Option "Alle gewählten Tags erforderlich" (UND statt ODER) beim Einschließen.
- Ohne Auswahl bleibt alles wie bisher.

## UI (Einstellungen > Export-Vorlagen)

Neuer Abschnitt "Tag-Filter" unterhalb der Gruppierung im Vorlagen-Editor:
- Zwei Mehrfachauswahl-Felder (Einschließen / Ausschließen), gespeist aus den vorhandenen Tags des Nutzers, gewählte Tags als entfernbare Chips.
- Schalter für UND/ODER-Logik beim Einschließen.
- Kurzer Hinweistext, wie viele Belege die Vorschau nach Filterung zeigt.

## Technische Details

- Migration: Spalte `tag_filter jsonb not null default '{}'` auf `export_templates` (Form: `{ include: string[], exclude: string[], includeMode: 'any' | 'all' }`, Tag-IDs).
- `src/hooks/useExportTemplates.ts`: `tag_filter` im Typ `ExportTemplate`, in `createEmptyTemplate`, `fetchTemplates` (Parsing), `createTemplate` und `updateTemplate` mitführen.
- Neue Hilfsfunktion `matchesTagFilter(receiptTags, tagFilter)` (z. B. in `src/lib/exportFilters.ts`), genutzt von beiden Verbrauchern, damit Vorschau und Export identisch filtern.
- `src/components/exports/ExportTemplateEditor.tsx`: Filter-UI + State, Tags via `useTags`.
- `src/hooks/useExportPreview.ts`: Filter nach dem Laden/Flachklopfen der Tags anwenden, Summen erst danach berechnen.
- `src/components/exports/ExportFormatDialog.tsx`: Filter in `prepareExportData()` vor Sortierung/Gruppierung anwenden; bei Split-Zeilen zählen die Tags des Belegs (inkl. virtuellem "Privat"-Tag), damit z. B. "Privat ausschließen" funktioniert.
