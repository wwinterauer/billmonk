# Review-Zähler live + Tagesübersicht beim Upload

## Teil 1: Review-Zähler wandert während des Uploads nicht mit

### Ursache

Der rote Zähler neben "Review" in der Seitenleiste wird nur einmal beim Laden geholt. Danach soll ihn eine Live-Verbindung zur Belegtabelle aktualisieren — diese Live-Verbindung ist aber für keine einzige Tabelle des Projekts aktiviert (die Veröffentlichungsliste für Echtzeit-Änderungen ist leer). Die Aktualisierung feuert also nie.

Ergebnis: Während des Uploads laufen im Hintergrund laufend neue Belege in den Status "Review", der Zähler bleibt aber auf dem Stand vom Seitenaufruf stehen — bis man die Seite neu lädt.

Dieselbe tote Live-Verbindung betrifft auch die Belegliste auf der Upload-Seite; dort rettet ein 3-Sekunden-Nachladen die Anzeige, in der Seitenleiste gibt es diesen Rettungsanker nicht.

### Was gemacht wird

1. **Echtzeit für Belege aktivieren** — die Belegtabelle wird in die Echtzeit-Veröffentlichung aufgenommen und liefert vollständige Zeilendaten. Damit funktioniert die bereits vorhandene Live-Logik in Seitenleiste und Upload-Seite.
2. **Absicherung in der Seitenleiste** — solange das Fenster im Vordergrund ist, wird der Zähler zusätzlich alle 5 Sekunden nachgeholt.
3. **Sofort-Aktualisierung beim Upload** — nach jeder fertig verarbeiteten Datei wird das bereits vorhandene interne Signal für den Zähler ausgelöst.

## Teil 2: Uploads eines Tages sammeln

Heute zeigt die Übersicht nur den zuletzt gestarteten Lauf. Wer an einem Tag mehrfach ansetzt (Nachzügler, unterbrochener Lauf, zweiter Stapel), verliert den Gesamtblick.

### Tagesbilanz ganz oben

```text
Heute, 8. August 2026 · 3 Sitzungen
576 Dateien reingezogen
├─ 452 hochgeladen
├─  36 Duplikat übersprungen
├─   5 nicht nutzbar
├─   2 fehlgeschlagen
└─  81 offen
```

Die Tagesbilanz addiert alle Läufe des Kalendertags. Sie steht über der Sitzungsliste und ist der Wert, der "was habe ich heute geschafft" beantwortet.

### Sitzungen darunter, gruppiert

- Jede Sitzung als eigene, zusammenklappbare Zeile: Startzeit, Dauer, Status (läuft / abgeschlossen / abgebrochen) und die fünf Zahlen.
- Die aktive bzw. zuletzt gestartete Sitzung ist automatisch aufgeklappt und behält die bestehenden Detaillisten mit Dateinamen und Klartext-Grund.
- Ältere Sitzungen des Tages bleiben eingeklappt und lassen sich einzeln öffnen.

### Frühere Tage

Unter der Tagesansicht ein Auswahlfeld bzw. eine kurze Liste der letzten Upload-Tage ("7. August · 120 Dateien", "31. Juli · 64 Dateien"). Auswahl wechselt die Tagesbilanz samt Sitzungen; standardmäßig steht immer der heutige Tag oben.

### CSV-Export

Der Export umfasst wahlweise die gewählte Sitzung oder den ganzen Tag (Spalte mit Sitzungs-Startzeit ergänzt).

## Technische Details

- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;` plus `ALTER TABLE public.receipts REPLICA IDENTITY FULL;` — RLS bleibt unverändert, Abonnenten sehen weiterhin nur eigene Belege.
- `src/components/dashboard/Sidebar.tsx`: Realtime-Kanal auf `filter: user_id=eq.<uid>` einschränken, Kanalnamen pro Nutzer eindeutig, Polling-Fallback (5 s, pausiert bei `document.hidden`).
- `src/pages/Upload.tsx`: `window.dispatchEvent(new Event('refresh-review-count'))` nach Abschluss jeder Datei; die Übersicht bekommt statt `runId` das gewählte Datum plus die aktive `runId`.
- `src/components/upload/UploadRunOverview.tsx` wird zu einer Tagesansicht erweitert: lädt `upload_runs` des gewählten Tages (`started_at` im Tagesfenster, nach `user_id`) und dazu die `upload_file_events` aller dieser Läufe in einer Abfrage (`in('run_id', ids)`), gruppiert clientseitig nach Lauf und Ergebnis.
- Tagesliste: `upload_runs` der letzten 30 Tage, clientseitig nach Kalendertag gruppiert (lokale Zeitzone).
- Polling alle 3 s nur, solange ein Lauf des heutigen Tages aktiv ist; keine Schemaänderung an den Upload-Tabellen nötig.
