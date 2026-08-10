# Export-Dialog: Zähler korrigieren und Ausschluss klar benennen

## Befund (geprüft)

- Der Dialog bekommt die gefilterten Belege der Ausgabenübersicht (265 Einträge im Zeitraum 01.04.–30.06.2026).
- Exportiert werden nur Belege mit hinterlegter Datei: 244.
- Datenbank-Abgleich für diesen Zeitraum: 270 normale Belege mit Datei, 4 „Keine Rechnung"-Einträge mit Datei, 21 „Keine Rechnung"-Einträge **ohne** Datei. Die 21 fehlenden Einträge sind also genau die dateilosen — sie werden unabhängig vom Häkchen „Keine Rechnung-Einträge ausschließen" übersprungen, weil es keine Datei zum Packen gibt.
- Der Fortschrittstext zählt fälschlich gegen die ungefilterte Gesamtmenge (265) statt gegen die exportierbaren 244.

## Änderungen

1. Fortschrittsanzeige zählt gegen die exportierbare Menge: „Verarbeite Beleg 5 von 244…" statt „von 265".
2. Auch die Dateiliste in der Vorschau („… und X weitere") zählt gegen die exportierbaren Belege.
3. Hinweistext präzisieren: Statt einer allgemeinen Formulierung wird getrennt ausgewiesen, wie viele Einträge **ohne hinterlegtes Dokument** übersprungen werden (nicht exportierbar) und wie viele durch das aktive Häkchen „Keine Rechnung" bewusst ausgeschlossen werden. So ist erkennbar, dass das Abwählen des Häkchens die dateilosen Einträge nicht in den ZIP holen kann.

Am Exportverhalten selbst ändert sich nichts: dateilose Einträge bleiben außen vor.

## Technische Details

Datei: `src/components/exports/ExportDialog.tsx`

- `receipts.length` in Zeile 430 und Zeilen 467/469 durch `exportableReceipts.length` ersetzen.
- Zwei getrennte Kennzahlen berechnen: `missingFileCount` (kein `file_url`) und `excludedNoReceiptCount` (nur wenn `excludeNoReceipt` aktiv und `file_url` vorhanden) statt des einzelnen `skippedCount`; Hinweisbox entsprechend mit beiden Zeilen rendern.
