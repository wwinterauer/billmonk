# Analyse: 310 Belege im Review nach dem Upload von heute

## Was heute tatsächlich passiert ist (aus der Datenbank geprüft)

- Heute wurden **343 Beleg-Datensätze** angelegt, davon nur **230 verschiedene Dateien** (eindeutiger Datei-Hash).
- **113 Dateien existieren exakt doppelt** — gleicher Hash, zwei Datensätze. Diese 113 Kopien sind **nicht** als Duplikat markiert, deshalb tauchen sie normal im Review auf.
- Nur **13 Datensätze** haben den Status "duplicate" — das sind genau die, die du im Duplikat-Dialog bewusst trotzdem hochgeladen hast.
- Aktuell: **310 Belege im Status "review"**, 14 approved, 3 noch in Verarbeitung.
- Die Zeitabstände der Doppel-Paare liegen bei **0–1 Sekunden** — die Kopien entstanden also im selben Upload-Lauf, nicht durch dein späteres zweites Hineinziehen.

## Ursache

Der Upload prüft Duplikate **einmalig vorab gegen die Datenbank** und lädt danach alle Dateien mit abgeschalteter Duplikatprüfung (`skipDuplicateCheck: true`) mit **3 parallelen Uploads** hoch. Daraus folgen zwei Lücken:

1. **Keine Prüfung innerhalb des Stapels**: Ist dieselbe Datei zweimal in der Auswahl (bzw. wird der Ordner nachgezogen, während der erste Lauf noch läuft), ist der Hash zum Prüfzeitpunkt noch in keiner der beiden Runden in der DB — beide werden als "neu" eingestuft.
2. **Race Condition durch Parallelität**: Zwei parallele Uploads derselben Datei prüfen/schreiben gleichzeitig; es gibt **keinen eindeutigen DB-Index** auf `(user_id, file_hash)`, der das abfangen würde.

## Warum von 287 Dateien nur 230 angekommen sind

Zwischen 17:56 und 18:05 (Ortszeit) sind 343 Datensätze mit 230 verschiedenen Dateien entstanden — es fehlen also **57 Dateien**. Aus der Datenbank lässt sich nicht rekonstruieren, welche das waren, weil abgelehnte und übersprungene Dateien nirgends protokolliert werden. Es kommen genau drei Wege in Frage:

1. **Übersprungene Duplikate (wahrscheinlichste Hauptursache)**: Die Vorab-Prüfung vergleicht gegen **alle** früheren Belege — davon gibt es bereits 217. Alles, was du im Duplikat-Dialog auf "überspringen" gesetzt hast, wurde gar nicht erst hochgeladen und erscheint nirgends.
2. **Validierung**: Dateityp nicht erlaubt (nur PDF/JPG/PNG/WebP — z. B. HEIC, TIFF, ZIP, E-Mail-Dateien fallen raus) oder größer als 10 MB. Diese landen im Toast "Einige Dateien wurden abgelehnt", der aber nur 3 Namen zeigt.
3. **Fehler während des Uploads**: fehlgeschlagene Bild-zu-PDF-Konvertierung oder Storage-Fehler — in der Liste als roter Eintrag, ohne Datenbankspur.

Weil keine dieser drei Kategorien festgehalten wird, ist die Meldung "viele wurden nicht hochgeladen" für dich nicht nachvollziehbar. Genau das behebt Maßnahme 3.



## Vorgeschlagene Maßnahmen

### 1. Bereinigung der aktuellen Daten
- Report erstellen: alle 114 Hash-Gruppen mit Mehrfach-Datensätzen auflisten (Datei, Datum, Betrag, Status).
- Aufräum-Aktion: pro Hash den **ältesten** Datensatz behalten, die späteren Kopien löschen (inkl. Storage-Datei), sofern sie nicht bereits bearbeitet/approved sind. Vorher Vorschau, Löschung erst nach deiner Bestätigung.

### 2. Fix im Upload (damit es nicht wieder passiert)
- **In-Batch-Dedupe**: vor dem Start doppelte Hashes innerhalb der Auswahl entfernen und im Ergebnis-Toast ausweisen.
- **Duplikatprüfung nicht mehr komplett abschalten**: statt `skipDuplicateCheck: true` unmittelbar vor dem Insert nochmals gegen die DB prüfen (die Vorab-Entscheidung des Nutzers wird dabei respektiert).
- **Eindeutiger Teil-Index** `unique (user_id, file_hash) where file_hash is not null and is_duplicate = false` als letzte Absicherung; der Insert fängt den Konflikt ab und meldet ihn als übersprungenes Duplikat statt als Fehler.

### 3. Transparenteres Upload-Ergebnis
- Abschluss-Zusammenfassung: hochgeladen / übersprungen (Duplikat) / abgelehnt (Typ, Größe, Limit) mit ausklappbarer Dateiliste, damit "viele wurden nicht hochgeladen" nachvollziehbar ist.

## Technische Details

- Betroffene Stellen: `src/pages/Upload.tsx` (`checkFilesForDuplicates`, `startUploading`, `UPLOAD_CONCURRENCY`), `src/hooks/useReceiptUpload.ts` (`uploadReceipt`, `checkExactDuplicate`).
- Migration: partieller Unique-Index auf `public.receipts (user_id, file_hash)`; vorher müssen die Duplikate bereinigt sein.
- Löschung erfolgt über bestehende Receipt-Delete-Logik inkl. Storage-Cleanup.
