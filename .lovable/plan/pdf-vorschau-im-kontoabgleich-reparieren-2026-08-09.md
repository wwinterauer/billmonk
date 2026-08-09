# PDF-Vorschau im Kontoabgleich reparieren

## Warum es aktuell nicht funktioniert

Im Beleg-Zuordnen-Dialog (Kontoabgleich) wurde eine eigene, einfache Vorschau gebaut:
- Sie rendert PDFs über ein natives `<object data="blob:...">`-Element. Chrome blockiert bzw. rendert den eingebetteten PDF-Plugin-Viewer in dieser Konstellation häufig nicht — dadurch bleibt die Fläche leer.
- Der Vorschau-Dialog liegt zusätzlich verschachtelt innerhalb des Zuordnungs-Dialogs, was zu Overlay-/Fokus-Konflikten führt.

In allen anderen Modulen (z. B. Ausgaben) wird dagegen die bestehende Komponente `ReceiptPreviewDialog` verwendet, die PDFs mit dem echten PDF.js-Viewer (`PdfViewer`) rendert — inklusive Seitennavigation, Zoom, Download und Fallback bei Fehlern. Genau dieser Weg fehlt im Kontoabgleich.

## Lösung

Die Eigenbau-Vorschau im Kontoabgleich durch die überall genutzte Standard-Vorschau ersetzen.

1. In `src/components/bank-import/ReceiptAssignmentModal.tsx`:
   - Eigenen `preview`-State, den Storage-Download, die Blob-URL-Verwaltung und den verschachtelten Vorschau-Dialog entfernen.
   - Stattdessen `ReceiptPreviewDialog` einbinden und beim Klick auf das Auge-Symbol nur noch die `receiptId` setzen.
   - Der Vorschau-Dialog wird außerhalb des Zuordnungs-Dialogs gerendert, damit keine Overlay-Konflikte entstehen.
2. Gleiche Prüfung für die Vorschau im Skonto-/Vorschlags-Dialog (`SkontoReconcileDialog`), falls dort ebenfalls ein Auge-Symbol existiert — dann dieselbe Komponente verwenden.

## Ergebnis

Im Kontoabgleich öffnet sich beim Auge-Symbol dieselbe Vorschau wie in den Ausgaben: PDF direkt im Fenster, mit Blättern, Zoom, Download und "In neuem Tab" als Fallback.
