

# Plan: Kategorien-Einstellungen — Optische Trennung

## Übersicht

Die eine gemischte Tabelle wird in zwei visuell getrennte Bereiche aufgeteilt. Keine Logik-/DB-Änderungen.

## Änderungen in `CategoryManagement.tsx`

### Daten aufteilen (computed)

```ts
const userCategories = categories.filter(c => !c.is_system || !c.country);
const taxCategories = categories.filter(c => c.is_system && !!c.country);
```

### Layout-Struktur (ersetzt den aktuellen einzelnen Table-Block ab Zeile 512)

**Bereich 1: "Meine Kategorien"**
- Header mit Titel "Meine Kategorien" + "Neue Kategorie"-Button (verschoben von ganz oben)
- Hinweistext: "Deine persönlichen Kategorien zur Organisation deiner Belege."
- Tabelle mit `userCategories` — gleiche Spalten wie bisher, aber OHNE "Typ"-Spalte (da nur eigene) und OHNE Steuernummern-Spalte

**Separator** (deutliche Trennlinie via `<Separator />`)

**Bereich 2: "Buchungsarten"**
- Header mit Titel "Buchungsarten"
- Der bestehende Steuer-Kategorien-Kontrollbereich (Zeilen 526-574: Land, Toggle, Switch, Zähler) wandert hierher — unverändert
- Hinweistext: "Steuerliche Einordnung deiner Belege. Wird in Exporten verwendet."
- Tabelle mit `taxCategories` — gleiche Spalten, aber OHNE "Typ"-Spalte, MIT optionaler Steuernummern-Spalte

### Was entfällt

- Der bisherige gemeinsame Header "Ausgaben-Kategorien" (Zeilen 514-523)
- Die "Typ"-Spalte (Badge "Steuer"/"Eigene") in beiden Tabellen — nicht mehr nötig da visuell getrennt

### Was unverändert bleibt

- Alle Handler, Modals, Dialoge, Daten-Logik
- Steuer-Kontrollbereich (Land-Auswahl, Toggle, Switch) — nur Position ändert sich
- Tabellen-Zellen-Rendering (Icon, Name, Info-Tooltip, Aktionen)

