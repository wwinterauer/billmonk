# Notizzettel (Post-its) im Dashboard

## Was du bekommst
- Neuer Bereich **„Notizen"** im Dashboard, ganz oben, noch über den Kennzahlen.
- Notizen sehen aus wie Post-its: kleine farbige Zettel nebeneinander in einem Raster.
- **+ Notiz**: Ein neuer gelber Zettel erscheint, du tippst sofort los. Gespeichert wird automatisch, ohne Speichern-Knopf.
- Jeder Zettel hat:
  - ein Häkchen zum Abhaken als erledigt (Text wird durchgestrichen und blasser, rutscht nach hinten),
  - eine Farbauswahl (gelb, grün, blau, rosa, orange),
  - einen Mülleimer zum Löschen.
- Zettel sind gespeichert und bleiben nach dem Neuladen und auf jedem Gerät da.
- Mit „Erledigte ausblenden" verschwinden abgehakte Zettel aus der Ansicht.
- Wenn noch keine Zettel da sind: kurzer Hinweis mit dem Knopf „Erste Notiz anlegen".

## Technische Details
- Neue Tabelle `dashboard_notes` (id, user_id, content text, color text default 'yellow', is_done bool default false, sort_order int, created_at, updated_at) mit GRANTs, RLS (nur eigene Zeilen) und updated_at-Trigger.
- Neue Komponente `src/components/dashboard/StickyNotes.tsx` mit React Query: anlegen, ändern (Speichern mit kurzer Verzögerung nach dem Tippen), löschen. Sortierung: offen vor erledigt, neueste zuerst.
- Die Post-it-Farben kommen als Design-Variablen in `index.css` (hell und dunkel) statt als feste Farbwerte.
- Einbindung in `src/pages/Dashboard.tsx` ganz oben, vor den Kennzahlen.
