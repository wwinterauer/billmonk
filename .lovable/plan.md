

## Bug: Doppelter "Umbenennung"-Tab in den Einstellungen

**Problem**: In `src/pages/Settings.tsx` Zeile 431-432 ist der Tab-Eintrag `{ value: 'naming', icon: FileText, label: 'Umbenennung' }` doppelt vorhanden.

**Fix**: Zeile 432 (das Duplikat) entfernen.

