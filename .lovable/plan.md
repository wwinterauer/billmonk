

# Plan: Kategorie-Lern-Übersicht im KI-Training Tab

## Überblick
Der KI-Training-Reiter wird um zwei neue Abschnitte erweitert:
1. **Kategorie-Regeln (Produkt/Keyword)** — Tabelle mit gelernten Keyword→Kategorie-Zuordnungen aus `category_rules`
2. **Lieferanten-Standard-Kategorien** — Anzeige welche Lieferanten eine Default-Kategorie haben

Zusätzlich wird die Statistik-Karte um die Anzahl gelernter Kategorie-Regeln erweitert.

## Änderungen

### `AILearningSettings.tsx`

**Neue Daten laden** in `loadLearningData()`:
- `category_rules` abfragen (user_id, keyword, category_name, match_count, updated_at), sortiert nach match_count desc
- `vendors` mit `default_category_id IS NOT NULL` abfragen, um Lieferanten-Defaults zu zeigen (ggf. mit Category-Name per Join oder separatem Lookup)

**Neue Stats-Karte**:
- "Kategorie-Regeln" Zähler (Anzahl `category_rules` Einträge)

**Neuer Abschnitt: "Gelernte Kategorie-Regeln"**:
- Suchbare Tabelle mit Spalten: Keyword | Kategorie | Treffer (match_count) | Löschen-Button
- Löschen-Button entfernt einzelne Regeln aus `category_rules`
- Leerer Zustand: "Noch keine Kategorie-Regeln. Ändere eine Kategorie bei einem Beleg und das System merkt sich das."

**Neuer Abschnitt: "Lieferanten-Standard-Kategorien"**:
- Kompakte Liste der Lieferanten mit gesetzter Default-Kategorie (Name → Kategorie-Name)
- Nur anzeigen wenn mindestens 1 Eintrag vorhanden

**Keine DB-Änderungen nötig** — `category_rules` und `vendors.default_category_id` existieren bereits.

## Dateien

| Datei | Änderung |
|---|---|
| `AILearningSettings.tsx` | Neue Datenabfragen, Stats-Karte, zwei neue Card-Abschnitte mit Tabellen |

