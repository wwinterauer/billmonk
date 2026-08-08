# Live-Übersicht beim Upload

## Problem

Die Zusammenfassung erscheint erst am Ende des Laufs, zeigt nur fünf Zahlen ohne Begründung und nennt keine Dateinamen. Dadurch bleibt unklar, warum aus 288 gezogenen Dateien z. B. nur 284 sichtbar werden.

Zusätzlich meldet der Hinweis "Von 266 Dateien wurden 266 vor dem Abschluss unterbrochen" fälschlich einen Totalausfall. Ursache: Der Wiederherstellungs-Schnappschuss im Browser wird beim Start des Laufs einmalig mit allen Dateien im Zustand "pending" geschrieben, danach aber nie pro Datei aktualisiert — er wird erst am Ende des gesamten Laufs gelöscht. Wird die Seite währenddessen neu geladen (oder läuft der Upload noch), erscheinen deshalb immer alle Dateien als "unterbrochen", obwohl sie tatsächlich verarbeitet werden.


## Was gebaut wird

### 1. Übersichtsleiste ganz oben (live, ab dem ersten Moment)

Direkt über dem Upload-Bereich, sichtbar sobald Dateien gezogen wurden — nicht erst am Ende:

```text
288 Dateien reingezogen
├─ 262 hochgeladen        (davon x noch in Verarbeitung)
├─  18 Duplikat übersprungen
├─   4 nicht nutzbar
└─   4 fehlgeschlagen
```

Die Summe der Zeilen ist immer exakt gleich der Gesamtzahl — jede Datei landet in genau einem Bucket, damit die Rechnung für den Nutzer aufgeht.

### 2. Aufklappbare Begründung je Kategorie

Jede Zeile ist anklickbar und listet die betroffenen Dateien mit Klartext-Grund:

- **Nicht nutzbar**: "Dateityp nicht unterstützt (.heic)", "Datei ohne Endung", "Datei zu groß: 14,2 MB (max. 10 MB)", "Über Stapel-Limit von 500 hinaus"
- **Duplikat**: "Bereits vorhanden: <Beleg> vom <Datum> — übersprungen", "Doppelt in dieser Auswahl (identisch mit <Dateiname>)", "Inhaltsgleich zu bestehendem Beleg"
- **Fehlgeschlagen**: konkrete Fehlermeldung (Bildkonvertierung, Storage, KI-Verarbeitung)
- **Hochgeladen**: Dateiname + Status (in Verarbeitung / fertig)

### 3. Handlungsangebote statt Sackgasse

- Button "Fehlgeschlagene erneut versuchen" (Dateien sind im Browser noch vorhanden, solange der Tab offen ist)
- Button "Liste als CSV exportieren" für die vollständige Protokollauswertung
- Bei nicht nutzbaren Dateien ein kurzer Hinweis, was zu tun ist (z. B. Datei mit `.pdf`-Endung neu speichern)

### 4. Zählung stabil machen

Die Zähler kommen aus dem bereits bestehenden Upload-Protokoll (eine Zeile je ausgewählter Datei) und nicht mehr aus dem flüchtigen UI-State. Beim Neuladen der Seite wird der letzte bzw. laufende Upload-Lauf wieder eingelesen und die Leiste erscheint erneut.

## Technische Details

- Nur Frontend: `src/pages/Upload.tsx` plus neue Komponente `src/components/upload/UploadRunOverview.tsx` (Leiste + aufklappbare Listen) und `src/lib/uploadReasons.ts` (Mapping `reason_code` → deutscher Klartext).
- Datenquelle: `upload_file_events` je `run_id`, gruppiert nach `outcome` und `reason_code`; Live-Aktualisierung über Supabase-Realtime auf der Tabelle mit Polling-Fallback alle 3 s während `uploadPhase !== 'idle'`.
- Bestehendes `runSummary`-Card wird durch die neue Leiste ersetzt; `finishUploadRun` bleibt unverändert und schreibt weiter die Endzahlen in `upload_runs`.
- Ergänzende `reason_code`-Werte werden nur dort gesetzt, wo bislang keiner geschrieben wird (z. B. Dateigröße, Konvertierungs- und Storage-Fehler) — keine Schemaänderung nötig.
- Bereits laufender Upload: Leiste liest den aktiven `upload_runs`-Eintrag mit `status = 'active'` beim Mount.
