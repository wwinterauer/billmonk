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

Zusätzlich für alle Geldspalten (Brutto, Netto, MwSt, Summen/Zwischensummen): Zahlen als echte Zahlen schreiben und das Buchhaltungsformat mit 2 Dezimalstellen und €-Symbol setzen:

`_-* #,##0.00\ "€"_-;\-* #,##0.00\ "€"_-;_-* "-"??\ "€"_-;_-@_-`

Damit sind Beträge am Dezimaltrenner ausgerichtet, Nullwerte erscheinen als „-", Negativwerte mit Minus – wie in Excels Formatvorlage „Buchhaltung".

## Technische Details

1. Kleiner Helfer (neue `src/lib/xlsxCells.ts`):
   - `toExcelDate(value)` → `Date | ''`
   - `DATE_FMT = 'DD.MM.YYYY'`, `ACCOUNTING_FMT = '_-* #,##0.00\\ "€"_-;\\-* #,##0.00\\ "€"_-;_-* "-"??\\ "€"_-;_-@_-'`
   - `applyColumnFormat(worksheet, colIndex, rowRange, fmt)` setzt `cell.z` (und `cell.t = 'n'` für Zahlen) nach `aoa_to_sheet`/`json_to_sheet`.
2. `ExportFormatDialog.tsx`: statt `${d}.${m}.${y}`-String das `Date` in die Zeile schreiben, Geldwerte als Zahl statt formatiertem String; nach `aoa_to_sheet` Spalten mit `col.type === 'date'` bzw. `'currency'` entsprechend formatieren; `XLSX.write(..., { bookType: 'xlsx', type: 'array', cellDates: true })`.
3. `ExportDialog.tsx` (`exportAsExcel`): `Datum` als `Date`; Brutto/Netto/MwSt mit Buchhaltungsformat (MwSt-Satz bleibt Prozent-/Zahlformat); `XLSX.writeFile(wb, name, { cellDates: true })`.
4. `Reports.tsx` (Blatt "Belege" und Summenzeilen): analog Datum + Geldspalten.
5. Prüfung: Export erzeugen und im entpackten XLSX kontrollieren, dass Datums- und Geldzellen numerisch sind und die erwarteten `numFmt`-Einträge referenzieren (kein `numFmtId="14"`).
