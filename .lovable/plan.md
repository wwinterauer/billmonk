## Ziel
Beim Beleg-ZIP-Export sollen Einträge ohne hinterlegtes Dokument (manuelle Ausgaben ohne Beleg, Schlagwort-Buchungen aus dem Kontoabgleich, "Keine Rechnung"-Markierungen) korrekt herausgefiltert werden – inkl. richtiger Zählung und klarer Hinweismeldung.

## Änderungen

**`src/components/exports/ExportDialog.tsx`**

1. Am Anfang der Komponente abgeleitete Liste bilden:
   ```ts
   const exportableReceipts = receipts.filter(
     r => r.file_url && !r.is_no_receipt_entry
   );
   const skippedCount = receipts.length - exportableReceipts.length;
   ```
2. Überall wo bisher `receipts` für ZIP-Export, Fortschritt, Header-Zähler (`${receipts.length} Belege exportieren`) und `generateFileName` verwendet wird → `exportableReceipts` benutzen.
3. Hinweisbox (Zeile 516) ersetzen: Wenn `skippedCount > 0`, Text auf
   "{skippedCount} Eintrag/Einträge ohne Dokument werden übersprungen (z.B. manuelle Ausgaben oder Schlagwort-Buchungen aus dem Kontoabgleich)."
4. Export-Button deaktivieren wenn `exportableReceipts.length === 0`.
5. Innerhalb der ZIP-Schleife entfällt der `if (!receipt.file_url) continue;`-Check (bereits vorgefiltert), dient nur noch als Sicherheitsnetz.

## Nicht betroffen
- CSV/Excel/Steuer-Export (TaxExportDialog) → enthalten weiterhin alle Datensätze, da hier nur Metadaten exportiert werden, keine Dateien.
- Keine DB- oder Hook-Änderungen.