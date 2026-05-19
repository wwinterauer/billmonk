## Ziel

Wenn eine Split-Buchungszeile als **Privat** markiert ist, soll die exportierte Zeile (Excel/CSV) zusätzlich den Tag **„Privat"** in der Spalte `tags` erhalten — ohne dass dieser Tag dauerhaft in der Datenbank am Beleg gespeichert wird (rein virtuell beim Export).

## Umfang

Nur Export-Ausgabe. Keine Änderung am Datenmodell, an `receipt_tags` oder am Split-Editor.

## Änderungen

### `src/components/exports/ExportFormatDialog.tsx`

In der Stelle, wo Belege mit `is_split_booking` in einzelne Zeilen expandiert werden (~Zeile 622–643):

- Beim Erzeugen der expanded-Zeile prüfen, ob `line.is_private === true`.
- Falls ja, die bestehenden `tags` der Zeile kopieren und einen virtuellen Eintrag `{ id: '__virtual_private__', name: 'Privat', color: '#…' }` anhängen — nur falls noch nicht enthalten (Duplikat-Check per Name, case-insensitive).
- Die Spalte `tags` wird bereits über `tags.map(t => t.name).join('; ')` ausgegeben (Zeile 494–497), sodass „Privat" automatisch in der Tag-Zelle erscheint.

### Optional: Gruppierung nach Tag

Wenn der Benutzer im Template nach `tags` gruppiert, landen Privat-Splits damit automatisch in der Gruppe „Privat" — gewünschter Nebeneffekt, keine Extra-Logik nötig.

## Nicht betroffen

- `useExportPreview.ts` (expandiert keine Splits)
- `TaxExportDialog.tsx` (nutzt `is_private` bereits explizit für Steuer-Logik)
- Split-Editor & DB-Schema bleiben unverändert
- Bestehende echte „Privat"-Tags am Beleg werden nicht doppelt angefügt
