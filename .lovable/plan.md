## Ziel
Bank-Import-Schlagwörter sollen zusätzlich zu Kategorie, Buchungsart, USt und Lieferant auch **Standard-Tags** mitgeben können. Werden über ein Schlagwort beim Bank-Import oder bei der Abstimmung Belege angelegt, werden die hinterlegten Tags automatisch zugewiesen.

## Umsetzung

**1. Datenbank**
- Neue Spalte `default_tag_ids uuid[]` (Default `'{}'`) in `bank_import_keywords`.

**2. Einstellungen → Bank-Import Schlagwörter (`src/components/settings/BankImportKeywords.tsx`)**
- Neue Spalte/Feld **Tags** im Bearbeitungs- und Anlegen-Formular.
- Auswahl per `SearchableSelect` mit Suchfunktion, Mausrad-Scrollen und alphabetischer Sortierung (entsprechend dem bestehenden Standard für Dropdowns) – Multi-Select über Chips: ausgewählte Tags werden als entfernbare Badges angezeigt, weitere Tags werden per Searchable-Select hinzugefügt.
- Tags via `useTags()` laden, nur aktive Tags zur Auswahl.
- Speichern/Updaten schreibt `default_tag_ids`.

**3. Beleg-Erzeugung**
- `src/pages/BankImport.tsx` (Zeile 348 ff.): Nach `insert` in `receipts` für jeden Tag in `matchedKeyword.default_tag_ids` einen Eintrag in `receipt_tags` anlegen.
- `src/pages/Reconciliation.tsx` (Zeile 636 ff.): Gleiche Logik beim Anlegen des Beleges aus Bank-Transaktion.

**4. Anzeige**
- In der Schlagwort-Liste die zugeordneten Tags als kleine farbige Badges anzeigen (analog zu Kategorie).

## Technische Details
- Spalte als `uuid[]` (kein Join-Table nötig, da nur Defaults, keine Referenzintegrität gegenüber Tag-Löschung kritisch; verwaiste IDs werden beim Anwenden ignoriert).
- Insert in `receipt_tags`: `tags.map(tag_id => ({ receipt_id, tag_id }))`, Fehler bei Duplikat-Constraint ignorieren.
- Types in `src/integrations/supabase/types.ts` werden nach Migration automatisch aktualisiert.

## Nicht im Umfang
- Keine Änderung an Tag-Verwaltung selbst.
- Keine rückwirkende Zuweisung auf bereits importierte Belege.
