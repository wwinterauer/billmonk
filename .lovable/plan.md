# Was passiert ist

Ich habe in der Datenbank nachgesehen — von deinen 214 Dateien sind tatsächlich nur **14 Belege** angekommen (12 in Review, 2 hängen in „processing"). Das Bild aus dem UI stimmt also mit der DB überein, nichts ist „verschwunden".

**Ursache (Hypothese, sehr wahrscheinlich):**

1. `validateFiles` kürzt jeden Drop hart auf `MAX_FILES = 200` — die 14 überzähligen Dateien wurden mit der Toast-Meldung „nicht mehr als 200" weggeworfen (`src/hooks/useReceiptUpload.ts:51-53`).
2. Die verbleibenden ~200 Dateien werden in `Upload.tsx:404-411` **rein sequentiell** in einer `for`-Schleife hochgeladen (~7-9 s pro PDF, also ~25 Minuten Gesamtdauer für 200 Stück).
3. Die Schleife läuft nur, solange die Upload-Seite offen bleibt. Die DB-Timestamps zeigen genau 1 m 54 s ununterbrochene Verarbeitung (12:36:42 → 12:38:36) und dann Stopp — passt zu Tab-Wechsel, Reload, Schließen, Verbindungsabbruch oder einem unauffangenen Fehler nach Datei 14.
4. Es gibt **keine Persistenz der Queue**. Sobald der Tab den State verliert, sind die noch nicht gestarteten Dateien weg — sie waren nie in der DB, also kann auch nichts „rückgängig gemacht" werden.
5. Die 2 Belege in `processing` hängen vermutlich, weil sie auf eine Vendor-Entscheidung warten (`Upload.tsx:457-491`), die nie beantwortet wurde.

# Sofortlösung für deine 214 Dateien

Nichts rückgängig machen — die 14 sind echte Belege und du willst sie behalten. Stattdessen:

1. Die zwei `processing`-Belege bekommen wir frei, indem du den Vendor-Dialog auf `/upload` abschließt (oder ich setze sie per Migration auf `review`, wenn der Dialog nicht mehr erscheint).
2. Du ziehst die restlichen ~200 Dateien einfach nochmal in den Upload — die **Duplikat-Prüfung per File-Hash** (`Upload.tsx:202-213`) filtert die schon vorhandenen 14 automatisch raus, sodass nur die fehlenden hochgeladen werden.

# Damit das nicht wieder passiert

Drei kleine, klar abgegrenzte Verbesserungen am Upload-Flow:

### 1. Upload-Fenster vergrößern und Hard-Cut entschärfen
- `MAX_FILES` von 200 → 500 anheben (passt zur Stack-Overflow-Empfehlung und zur Edge-Function-Kapazität, da pro Datei eine eigene Edge-Function-Invocation läuft, kein einziger 200-MB-Request).
- Statt Files >Limit stillschweigend wegzuschneiden: dem User klar sagen „X von Y Dateien werden in diesem Schwung verarbeitet, bitte den Rest danach erneut droppen".

### 2. Begrenzte Parallelität statt rein sequentiell
- In `startUploading` (`Upload.tsx:404-411`) eine kleine Concurrency-Grenze (z. B. 3 parallele Uploads) einführen. Bringt den Durchsatz von ~7 s/Datei auf ~2-3 s/Datei effektiv, ohne die Edge Function zu überlasten.
- Vendor-Decision-Files überspringen den Slot nicht, sondern blockieren ihn nur — Reihenfolge bleibt erhalten.

### 3. Persistente Upload-Queue (gegen Reload-Verlust)
- Zu uploadende Dateien können nicht in `localStorage` (zu groß), aber die Liste „dies sind die geplanten Hashes + Dateinamen" plus deren Status schon.
- Beim Mount von `/upload` prüfen wir, ob eine unvollendete Queue existiert, und zeigen einen Banner „X Dateien aus deinem letzten Upload wurden nicht beendet — erneut starten?". Der User muss dann die fehlenden Dateien nochmal aussuchen, aber wir wissen wenigstens, was offen war.
- Optional Phase 2 (nicht in diesem Plan): echte Server-seitige Queue über die existierende `pgmq`-Infrastruktur, damit auch bei geschlossenem Tab weiterläuft. Sage Bescheid, wenn du das willst — ist dann ein eigener, größerer Schritt.

# Technische Details

- Geänderte Dateien: `src/hooks/useReceiptUpload.ts` (Limit + Validierungstext), `src/pages/Upload.tsx` (Concurrency-Loop + localStorage-Persistenz + Recovery-Banner).
- Neue Helper-Datei: `src/lib/upload-queue.ts` für `saveQueue / loadQueue / clearQueue` mit Versionierung und User-ID-Scoping.
- Concurrency wird über eine simple Promise-Pool-Implementierung gemacht — keine neue Dependency.
- Keine DB-Migrationen nötig, kein Backend-Touch, RLS unverändert.

# Reihenfolge

1. Die 2 hängenden `processing`-Belege per einmaliger Migration auf `review` setzen (mit deiner Bestätigung).
2. Die drei Code-Verbesserungen oben implementieren.
3. Du droppst die ~200 fehlenden Dateien nochmal — Duplicate-Check filtert die 14 vorhandenen automatisch.
