## Ziel
Beim Excel-Export soll die Reihenfolge der Gruppen (z. B. Kategorien, Lieferanten, Tags, Zahlungsart, Buchungsart, MwSt-Satz, Monat/Quartal/Jahr) frei per Drag & Drop festlegbar sein — analog zur Spaltenreihenfolge.

## Umsetzung

### 1. Datenmodell
- Neue Spalte `group_order jsonb` in `export_templates` (Default `'{}'`).
- Struktur: `{ "<group_by>": ["Wert1", "Wert2", ...] }` — pro Gruppierungsfeld eine eigene Reihenfolge.
- Migration via Supabase-Tool.
- Typ `ExportTemplate` um `group_order: Record<string, string[]>` erweitern.

### 2. Editor-UI (`ExportTemplateEditor.tsx`)
Im Bereich "Gruppierung" (nur sichtbar wenn `group_by` gesetzt):
- Distinct-Gruppenwerte aus den vorhandenen Belegen/Rechnungen des Users laden (per Query, abhängig vom gewählten `group_by` und `template_type`).
- Für Datums-Gruppen (month/quarter/year): chronologisch vorbelegen.
- Werte als sortierbare Liste mit `@dnd-kit` rendern (gleiches Pattern wie Spalten-Drag-Drop, bereits im Editor vorhanden).
- Drag & Drop aktualisiert `editingTemplate.group_order[group_by]`.
- Neue/unbekannte Werte (die noch nicht in der gespeicherten Reihenfolge stehen) werden alphabetisch ans Ende angehängt.
- Button "Alphabetisch sortieren" / "Zurücksetzen".

### 3. Export-Anwendung
In `ExportFormatDialog.tsx` (CSV/Excel/PDF-Branches, Zeilen ~700, ~760, ~835) und `useExportPreview.ts`:
- Nach Gruppierung in `Map`/`Record` die Keys gemäß `template.group_order[group_by]` sortieren.
- Nicht gelistete Keys (neue Werte) alphabetisch dahinter.
- Bei Datumsgruppen ohne explizite Order: chronologisch.

### 4. Verhalten beim Wechsel von `group_by`
- `group_order` bleibt erhalten (pro Feld separat gespeichert), wird beim erneuten Wählen wieder verwendet.

## Geänderte/neue Dateien
- Migration: neue Spalte `group_order`
- `src/hooks/useExportTemplates.ts` — Typ + Default + Persistenz
- `src/components/exports/ExportTemplateEditor.tsx` — neue Drag-Liste, Distinct-Loader
- `src/components/exports/ExportFormatDialog.tsx` — Sortierung der Gruppen vor Ausgabe
- `src/hooks/useExportPreview.ts` — gleiche Sortierung für Vorschau

## Nicht enthalten
- Keine Änderung an Spalten-Reihenfolge, Sortier-Logik innerhalb einer Gruppe oder Gruppen-Subtotals.
- Kein nested/multi-level Grouping.
