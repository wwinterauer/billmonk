# Was du siehst und warum

Ich habe die DB geprüft. Befund: **209 Belege in den letzten 4 Stunden** — das Hochladen hat also tatsächlich funktioniert, nur die Anzeige täuscht.

| Status | Anzahl |
|---|---|
| review (zur Prüfung bereit) | 176 |
| approved | 23 |
| **pending (hängend)** | **8** |
| needs_splitting | 2 |

## Drei verschiedene Probleme, die zusammen das Bild ergeben

### 1. Verstecktes 200er-Limit in der Anzeige (`Upload.tsx:135`)
Die Upload-Seite lädt beim Mount nur die ersten **200** Belege:
```ts
.limit(200)
```
Du hast aber **209** — die letzten 9 fallen aus der Liste, deshalb sieht es aus, als wäre wieder etwas „verschwunden". `MAX_FILES` haben wir zwar auf 500 erhöht, aber dieses zweite, separate Limit war übersehen.

### 2. UI aktualisiert sich nicht während des Uploads (`Upload.tsx:118-161, 882-908`)
- `pendingReceipts` wird **nur einmal beim Seitenaufruf** geladen (`useEffect` mit `[user]`).
- Die Status-Counts „Alle / Erfolgreich / Wartend / …" rechnen ausschließlich aus `pendingReceipts`, nicht aus den laufenden In-Memory-Uploads.
- Während neue Belege im Hintergrund in die DB geschrieben werden, weiß die Seite nichts davon → erst Reload zeigt die echten Zahlen.

### 3. Die 8 „pending" sind echt hängend (Konsolen-Logs)
Die Console zeigt für genau diesen Zeitraum:
- `Edge Function returned a non-2xx status code`
- `Keine Daten in der KI-Antwort`

Die KI-Extraktion ist für 8 Belege fehlgeschlagen (vermutlich AI-Gateway-Throttle bei 3 parallelen Edge-Function-Calls + großen PDFs). Der Upload-Flow setzt im Fehlerfall den Status aber nicht zurück → Beleg bleibt in `pending` hängen statt in `review` oder `error` zu landen.

# Plan

## Schritt 1 — Sofort: 8 hängende Belege freischalten
Migration: die 8 `pending`-Belege von Benutzer `bb51fc98…` auf `review` setzen, damit du sie manuell ergänzen kannst (KI-Daten fehlen, Datei und Storage-Pfad sind aber vorhanden).

## Schritt 2 — Anzeige-Limit raus (`src/pages/Upload.tsx`)
- Zeile 135: `.limit(200)` entfernen bzw. auf z. B. `.limit(1000)` heben (Supabase-Default-Cap).
- Optional: nur Belege der letzten 24 h zeigen, damit die Liste nicht unendlich wächst.

## Schritt 3 — Live-Refresh der Status-Counts
Zwei kleine Ergänzungen, beide in `src/pages/Upload.tsx`:

a) **Realtime-Subscription** auf `receipts`-Tabelle (gefiltert per `user_id`). Bei jedem `INSERT`/`UPDATE` den entsprechenden Eintrag in `pendingReceipts` patchen. Realtime ist im Projekt schon eingerichtet (`useReceipts.ts` nutzt es bereits) — wir hängen uns einfach an.

b) **Fallback-Polling**: solange `isAnyProcessing === true`, alle 3 s `loadPendingReceipts()` neu aufrufen. Das deckt den Fall ab, dass Realtime kurz hängt oder die Tab-Verbindung schläft.

## Schritt 4 — Hängende Belege im Fehlerfall sauber abschließen
In `useReceiptUpload.ts` / `useReceiptProcessing.ts`: wenn die KI-Extraktion fehlschlägt, den Beleg **nicht in `pending` lassen**, sondern direkt auf `review` (mit leeren Feldern) oder einen neuen `error`-Status setzen, damit der User sofort sieht, was nachzubearbeiten ist. Aktuell bleibt der Beleg unsichtbar in der DB hängen.

# Reihenfolge

1. Migration für die 8 stuck-Belege (mit deiner Bestätigung).
2. Code-Änderungen Schritt 2-4 in einem Rutsch.
3. Du lädst die nächsten Belege — Counts laufen jetzt live mit, kein 200er-Cap mehr, fehlerhafte AI-Extraktionen landen sichtbar in der Liste statt zu verschwinden.

# Technische Details

- Geänderte Dateien: `src/pages/Upload.tsx` (Limit + Realtime + Polling), `src/hooks/useReceiptUpload.ts` und/oder `src/hooks/useReceiptProcessing.ts` (Fehler-Status-Handling).
- Eine Migration für die 8 hängenden Belege (`status='pending' → 'review'`).
- Keine neuen Dependencies, keine Backend-Änderungen, RLS unverändert.
