# Excel-Export: echte Datumszellen statt Text

## Befund (geprüft)

In allen drei Excel-Export-Wegen werden Datumswerte als **Text** in die Datei geschrieben, nicht als echte Excel-Datumswerte:

- `src/components/exports/ExportFormatDialog.tsx` (Vorlagen-Export, "Ausgaben"): Datum wird per String-Split zu `"09.04.2026"` umgebaut und als Text abgelegt.
- `src/components/exports/ExportDialog.tsx` (Belege-Export): `receipt_date` wird unverändert als ISO-String `"2026-04-09"` geschrieben.
- `src/pages/Reports.tsx` (Bericht, Blatt "Belege"): ebenfalls ISO-String.

Bestätigt an der hochgeladenen Datei `ausgaben_01.04.-30.06.2026.xlsx`: die Datumsspalte liegt in `sharedStrings` als Text (`09.04.2026`), die Zellen tragen keinen Zahlenformat-Stil.

Folge: Es gibt kein definiertes Datumsformat in der Datei. Sobald Excel (oder ein Import/eine Konvertierung) die Textwerte in echte Datumswerte umwandelt, greift das gebietsschema-abhängige Kurzdatum – intern Format-ID 14 (`m/d/yy`). Genau das ist der beobachtete Effekt. Zusätzlich lässt sich als Text nicht korrekt sortieren, filtern oder rechnen.

## Lösung

Datumswerte als echte Excel-Datumszellen schreiben und ein explizites, gebietsschema-unabhängiges Zahlenformat setzen:

- Datum als `Date`-Objekt übergeben, Datei mit `cellDates: true` schreiben.
- Auf der Zelle `t = 'n'` (Datums-Seriennummer) und `z = 'DD.MM.YYYY'` setzen, statt Format-ID 14 zu erben.
- Ungültige/leere Datumswerte bleiben leer (kein 30.12.1899).
- Betrifft alle drei Export-Wege; CSV-, DATEV- und BMD-Exporte bleiben unverändert (dort sind Textformate korrekt und vorgeschrieben).

Optional gleiches Vorgehen für Geldspalten: Zahlformat `#,##0.00` statt Standardformat – sag Bescheid, ob das mit rein soll.

## Technische Details

1. Kleiner Helfer (z. B. in `src/lib/exportFilters.ts` oder neuer `src/lib/xlsxCells.ts`):
   - `toExcelDate(value)` → `Date | ''`
   - `applyDateFormat(worksheet, colIndex, rowIndices, 'DD.MM.YYYY')` setzt `cell.z` nach dem `aoa_to_sheet`/`json_to_sheet`-Aufruf.
2. `ExportFormatDialog.tsx`: statt `${d}.${m}.${y}`-String das `Date` in die Zeile schreiben; nach `aoa_to_sheet` für alle Spalten mit `col.type === 'date'` das `z`-Format setzen; `XLSX.write(..., { bookType: 'xlsx', type: 'array', cellDates: true })`.
3. `ExportDialog.tsx` (`exportAsExcel`): `Datum` als `Date`; nach `json_to_sheet` Spalte A formatieren; `XLSX.writeFile(wb, name, { cellDates: true })`.
4. `Reports.tsx` (Blatt "Belege"): analog für die Spalte `Datum`.
5. Prüfung: Export erzeugen und im entpackten XLSX kontrollieren, dass die Datumszellen numerisch sind und ein `numFmt` mit `DD.MM.YYYY` (kein `numFmtId="14"`) referenzieren.
