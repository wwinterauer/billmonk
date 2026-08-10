# Aktionsspalte in Ausgabenübersicht nach links verschieben

## Ziel
In der Ausgabenübersicht (`/expenses`) soll die Spalte mit den Aktionen (Auge, Stift, Mülleimer) direkt rechts neben der Auswahl-Checkbox-Spalte stehen, damit schneller gearbeitet werden kann.

## Aktueller Zustand
Die Tabelle in `src/pages/Expenses.tsx` hat folgende Reihenfolge:
1. Checkbox-Spalte (48 px)
2. Dynamische sichtbare Spalten (Datum, Lieferant, Rechnungsnr., Beschreibung, Kategorie, Buchungsart, Tags, Betrag, KI, Status)
3. Aktionen-Spalte (rechts)

## Geplante Änderung
Spaltenreihenfolge anpassen auf:
1. Checkbox-Spalte
2. Aktionen-Spalte
3. Dynamische sichtbare Spalten

## Umsetzung
In `src/pages/Expenses.tsx`:
- Den `<TableHead>` für "Aktionen" (inkl. Resize-Handle) aus seiner aktuellen Position am Ende der Kopfzeile entfernen und direkt nach der Checkbox-`<TableHead>` einfügen.
- Die zugehörige `<TableCell>` mit den Aktionen-Buttons in jeder Datenzeile ebenfalls direkt nach der Checkbox-`<TableCell>` verschieben.
- Die `colSpan={totalCols}`-Logik für aufklappbare Split-Buchungszeilen bleibt unverändert, da die Gesamtspaltenanzahl gleich bleibt.
- Die breitenabhängigen States (`actionsColWidth`, `columnWidths`) bleiben erhalten.

## Technische Details
- Datei: `src/pages/Expenses.tsx`
- Betroffene Zeilenbereiche: ca. 2783–2941 (TableHeader + TableBody-Zeilen)
- Keine Datenbank- oder Backend-Änderungen nötig.
- Keine neuen Abhängigkeiten.
