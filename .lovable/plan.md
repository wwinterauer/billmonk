# Upload darf nie mehr still hängen bleiben

## Was die Daten zeigen (Lauf von 13:33 Uhr)
- 205 Dateien: Prüfung lief diesmal sauber durch (13:36:08 Uhr fertig).
- 1 Datei doppelt in der Auswahl, 31 als bereits vorhanden erkannt und von dir um 13:38:43 Uhr übersprungen.
- Danach: **keine einzige** der 173 neuen Dateien wurde angefangen hochzuladen – kein Speicher-Upload, kein neuer Beleg, kein Fehlereintrag. Der Lauf steht bis jetzt auf "aktiv".
- Deine Anmeldung war in dieser Zeit stabil; der Server war erreichbar.

## Die eigentliche Schwachstelle
Der Ablauf ist eine lange Kette, die nur im offenen Browserfenster lebt:
Prüfen → **warten bis du alle Duplikate entschieden hast** → erst dann hochladen.
Der Schritt "nach dem Duplikat-Fenster weitermachen" hat keinerlei Absicherung: Bricht er ab (Fehler im Browser, Neuladen der Vorschau, verlorener Zwischenstand), passiert einfach nichts mehr – ohne Meldung und ohne Protokolleintrag. Genau das ist zweimal passiert, nur an unterschiedlichen Stellen der Kette. Statt eine weitere einzelne Stelle zu flicken, baue ich den Ablauf so um, dass er gar nicht mehr still stehen kann.

## Was ich ändere

1. **Neue Belege sofort hochladen.** Sobald die Prüfung fertig ist, starten die 173 neuen Dateien direkt. Das Duplikat-Fenster läuft parallel und betrifft nur noch die 31 bekannten Dateien. Kein Warten mehr auf deine Entscheidung.
2. **Eigene, stabile Warteschlange.** Die Dateien liegen in einer Upload-Warteschlange, die nicht vom Neuzeichnen der Seite abhängt. Jede Datei wird beim Einreihen als "in Warteschlange" protokolliert.
3. **Jeder Fehler wird sichtbar.** Jeder Schritt ist abgesichert: Geht etwas schief, bekommt die betroffene Datei den Status "fehlgeschlagen" mit dem echten Grund, die anderen laufen weiter, und am Ende wird der Lauf sauber abgeschlossen. Nichts bleibt mehr auf "offen".
4. **Hänger-Wächter.** Gibt es 2 Minuten lang keinen Fortschritt, erscheint oben ein Hinweis "Upload hängt" mit dem Knopf **Fortsetzen**, der die noch offenen Dateien erneut anstößt – ohne neu auswählen.
5. **Nach Neuladen klar sagen, was fehlt.** Wurde die Seite während eines Laufs neu geladen, werden die offenen Dateien als "unterbrochen" markiert und namentlich aufgelistet. Beim erneuten Hineinziehen werden exakt identische, bereits hochgeladene Dateien automatisch übersprungen – das Duplikat-Fenster fragt dann nur noch bei echten Zweifelsfällen.
6. **Aufräumen.** Der aktuell hängende Lauf von 13:33 Uhr wird als "unterbrochen" abgeschlossen, damit die Anzeige stimmt.

## Danach für dich
Die 205 Dateien einfach noch einmal hineinziehen: die 32 bekannten werden übersprungen, die 173 neuen laufen sofort los.

## Prüfung, bevor ich "fertig" sage
- Automatische Tests: neue Dateien starten, bevor Duplikate entschieden sind; ein Fehler bei einer Datei stoppt die anderen nicht; ein unerwarteter Abbruch schließt den Lauf mit Fehlerstatus statt "offen"; Wächter löst nach 2 Minuten ohne Fortschritt aus.
- Echter Durchlauf in der Vorschau mit deinem Konto: Mischung aus bereits vorhandenen Belegen und 3 neuen Test-PDFs → neue laufen sofort, Duplikate werden übersprungen, Lauf wird abgeschlossen. Die 3 Test-Belege lösche ich danach wieder.

## Technische Details
- Neues Modul `src/lib/uploadController.ts`: ref-basierte Queue (Map eventId → File), `enqueue()`, `resume()`, Concurrency 3, Promise-Kette mit `try/catch/finally`, ruft `finishUploadRun` immer im `finally`; markiert verbleibende `pending` Events bei Fehler mit `reason_code: 'pipeline_error'` + Fehlermeldung.
- `Upload.tsx`: `processFiles` reiht Nicht-Duplikate direkt nach `checkFilesForDuplicates` ein; `handleDuplicateDecisions` reiht nur "upload"-Entscheidungen nach und schreibt Skip-Events parallel (`Promise.all`) statt sequenziell. Kein `nonDuplicateFiles`-State mehr (Closure-Abhängigkeit entfällt). Run wird erst abgeschlossen, wenn Queue leer **und** Duplikat-Dialog erledigt ist.
- `updateFileEvent`: neue Phase `queued`; Protokoll-Schreibfehler werden gezählt und im Lauf-Abschluss gemeldet statt nur in der Konsole.
- Watchdog: Intervall prüft `lastProgressAt` des Controllers; Banner + `resume()`.
- Mount-Effekt: aktiver Lauf ohne Dateien im Speicher → offene Events auf `outcome: 'failed'`, `reason_code: 'interrupted_reload'`; Upload-Übersicht zeigt "unterbrochen".
- Re-Upload: exakte Hash-Treffer mit Status `review/approved/processing/pending` werden automatisch als `existing_duplicate_skipped` protokolliert (Dialog nur noch, wenn der Nutzer das bewusst sehen will – Option "Duplikate einzeln prüfen").
- Datenkorrektur: Run `0f92917a…` → `status 'failed'`, offene Events → `interrupted`.
- `AGENTS.md`: Regel ergänzen – Upload-Pipeline läuft über den Controller, jeder Lauf endet in einem Endzustand (finally), Nicht-Duplikate warten nie auf Nutzerentscheidungen.
- Tests: `src/test/uploadController.test.ts`.
