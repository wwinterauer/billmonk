# Review-Zähler aktualisiert sich während des Uploads nicht

## Ursache

Der rote Zähler neben "Review" in der Seitenleiste wird nur einmal beim Laden geholt. Danach soll ihn eine Live-Verbindung zur Belegtabelle aktualisieren — diese Live-Verbindung ist aber für keine einzige Tabelle des Projekts aktiviert (die Veröffentlichungsliste für Echtzeit-Änderungen ist leer). Die Aktualisierung feuert also nie.

Ergebnis: Während des Uploads laufen im Hintergrund laufend neue Belege in den Status "Review", der Zähler bleibt aber auf dem Stand vom Seitenaufruf stehen — bis man die Seite neu lädt. Genau der beobachtete Effekt.

Das betrifft dieselbe Live-Verbindung, die auch die Belegliste auf der Upload-Seite aktualisieren soll; dort rettet ein 3-Sekunden-Nachladen die Anzeige, in der Seitenleiste gibt es diesen Rettungsanker nicht.

## Was gemacht wird

1. **Echtzeit für Belege aktivieren** — die Belegtabelle wird in die Echtzeit-Veröffentlichung aufgenommen und liefert vollständige Zeilendaten. Damit funktioniert die bereits vorhandene Live-Logik in Seitenleiste und Upload-Seite endlich.

2. **Zusätzliche Absicherung in der Seitenleiste** — solange ein Upload aktiv ist bzw. das Fenster im Vordergrund steht, wird der Zähler zusätzlich alle 5 Sekunden nachgeholt. So stimmt er auch, wenn die Live-Verbindung kurz abreißt oder der Tab im Hintergrund war.

3. **Sofort-Aktualisierung beim Upload** — nach jedem fertig verarbeiteten Beleg wird das bereits existierende interne Signal für den Zähler ausgelöst, sodass er ohne Verzögerung mitwandert.

## Technische Details

- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;` plus `ALTER TABLE public.receipts REPLICA IDENTITY FULL;` (RLS bleibt unverändert, Abonnenten sehen weiterhin nur eigene Belege).
- `src/components/dashboard/Sidebar.tsx`: Realtime-Kanal auf `filter: user_id=eq.<uid>` einschränken, Kanalnamen pro Nutzer eindeutig machen, Polling-Fallback (5 s, pausiert bei `document.hidden`) ergänzen.
- `src/pages/Upload.tsx`: `window.dispatchEvent(new Event('refresh-review-count'))` nach Abschluss jeder Datei (Erfolg, Duplikat, Fehler) auslösen.
