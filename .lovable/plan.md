# Kontrollierter Neu-Upload der 287 Belege

## Ziel

Den heutigen fehlerhaften Lauf vollständig zurücksetzen, den nächsten Upload lückenlos protokollieren und danach exakt auswerten, welche Dateien hochgeladen, als Duplikat übersprungen, abgelehnt oder mit Fehler beendet wurden.

## Aktueller Rücksetzungsumfang

- **343 heute angelegte Datensätze** zwischen 17:56 und 18:05 Uhr Ortszeit
- Davon: 310 Review, 16 Duplikate, 14 Approved, 3 Processing
- **230 unterschiedliche Dateien** im Storage
- Alle 343 Datensätze und ihre zugehörigen Storage-Dateien werden entfernt; ältere Belege bleiben unangetastet.

## Ablauf

### 1. Upload-Protokollierung zuerst einbauen

- Neue geschützte Tabelle für Upload-Läufe und einzelne Dateien anlegen.
- Für jede der 287 ausgewählten Dateien erfassen:
  - Dateiname, Größe, MIME-Typ und Datei-Hash
  - Zeitpunkt und eindeutige Lauf-ID
  - jede Phase: ausgewählt, validiert/abgelehnt, Duplikatprüfung, übersprungen/freigegeben, Storage-Upload, Datenbankeintrag, KI-Verarbeitung, abgeschlossen/fehlgeschlagen
  - konkrete Fehlerursache und verknüpfte Beleg-ID
- Ein Upload-Abschlussprotokoll anzeigen: Gesamtzahl sowie hochgeladen / Duplikat / abgelehnt / fehlgeschlagen / offen, jeweils mit Dateiliste.
- Das Protokoll bleibt auch bei Reload oder Browser-Absturz im Backend erhalten.

### 2. Doppel-Upload während des Tests verhindern

- Gleiche Hashes bereits innerhalb der 287 ausgewählten Dateien erkennen und separat protokollieren.
- Unmittelbar vor dem Datenbankeintrag nochmals auf vorhandene Hashes prüfen.
- Nur einen aktiven Upload-Lauf gleichzeitig zulassen, damit ein zweites Hineinziehen nicht parallel denselben Stapel startet.
- Noch **keinen Unique-Index** setzen, damit der Test alle realen Pfade protokolliert; die endgültige Absicherung folgt nach der Auswertung.

### 3. Heutigen Lauf vollständig löschen

- Zuerst die 230 heutigen Storage-Dateien entfernen.
- Danach alle 343 heute erzeugten Datensätze löschen, einschließlich der bereits 14 freigegebenen Belege.
- Anschließend verifizieren: heute 0 Datensätze und keine heutigen Storage-Pfade mehr vorhanden; ältere Daten unverändert.

### 4. Kontrollierter Neu-Upload

- Du ziehst die 287 Dateien **einmal** in die Upload-Seite.
- Du lässt den Tab geöffnet, bis die neue Abschlussübersicht erscheint.
- Bei erkannten Duplikaten kannst du wieder "überspringen" wählen; jede Entscheidung wird diesmal protokolliert.

### 5. Auswertung direkt danach

- Erwartete 287 Eingaben gegen das Protokoll und die neu angelegten Belege abgleichen.
- Für jede fehlende Datei die konkrete Ursache nennen.
- Prüfen, ob Hash-Duplikate aus dem Stapel, ältere vorhandene Belege, Dateiformat/-größe, Storage, Konvertierung oder KI-Verarbeitung verantwortlich waren.
- Danach den Upload dauerhaft korrigieren und einen Unique-Index als letzte Absicherung hinzufügen.

## Technische Details

- RLS: Nutzer sehen und schreiben ausschließlich ihre eigenen Upload-Läufe und Dateieinträge; Service-Zugriff bleibt für Diagnose möglich.
- Änderungen betreffen `src/pages/Upload.tsx`, `src/hooks/useReceiptUpload.ts`, die Queue-Hilfe und neue kleine Logging-Helfer/UI-Komponenten.
- Die Datenlöschung erfolgt als explizite Datenoperation, nicht als Schema-Migration.
- Vor der Löschung wird die Liste der IDs und Storage-Pfade serverseitig auf den heutigen Zeitraum und deinen Nutzer eingeschränkt.
