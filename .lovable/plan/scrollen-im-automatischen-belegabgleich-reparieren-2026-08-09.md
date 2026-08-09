# Scrollen im automatischen Belegabgleich reparieren

## Umsetzung

- Dem Abgleich-Dialog eine feste, viewportabhängige Höhe geben, statt ihn nur über eine Maximalhöhe zu begrenzen.
- Kopfzeile, Tabs und Aktionsleiste fest halten; ausschließlich die Liste der Vorschläge beziehungsweise Skonto-Treffer scrollbar machen.
- Für die Liste einen zuverlässig begrenzten `overflow-y-scroll`-Bereich mit dauerhaft sichtbarer vertikaler Scrollleiste verwenden, statt der aktuell nicht funktionierenden Radix-ScrollArea.
- Das Verhalten mit allen 19 Vorschlägen im geöffneten Dialog prüfen: Scrollen per Mausrad/Trackpad, Ziehen der Scrollleiste und Erreichbarkeit des letzten Eintrags sowie der unteren Aktionsleiste.

## Technische Details

Die Änderung bleibt auf `SkontoReconcileDialog` beschränkt. Der Dialog erhält eine definierte Höhe innerhalb des Viewports; die verschachtelte Flex-Struktur bekommt durchgehend `min-h-0`, und die beiden Ergebnislisten werden zu nativen vertikalen Scrollcontainern. Daten, Matching-Logik und Auswahlzustände bleiben unverändert.