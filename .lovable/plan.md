# Plan: Multi-Invoice PDFs einheitlich über Review

## Ziel
Ein Ort für Multi-Invoice-Handling: Review. Kein separater `needs_splitting`-Workflow im Upload mehr. Nach Split läuft automatisch die KI pro Teilbeleg neu.

## Änderungen

### 1. `supabase/functions/extract-receipt/index.ts`
Wenn Multi-Invoice erkannt wird:
- **Vorher:** Status `needs_splitting`, keine weitere Extraktion.
- **Nachher:** Status `review` setzen, `split_suggestion` JSON speichern, **trotzdem** die normale Extraktion auf das gesamte PDF durchlaufen lassen (damit der User wahlweise "als einzelne Rechnung behalten" klicken kann und sofort Daten hat).

### 2. `src/pages/Review.tsx` / Review-Liste
- `MultiInvoiceAlert` triggert auf `split_suggestion != null` (nicht auf `status = needs_splitting`).
- Belege mit `split_suggestion` erscheinen ganz normal in der Review-Liste (visueller Hinweis via `SplitStatusBadge` bleibt).

### 3. `src/pages/Upload.tsx`
- `needs_splitting` aus den Status-Filtern entfernen — diese Belege zählen jetzt unter "Wartend"/"Erfolgreich" wie alle anderen.
- Klick auf den Beleg → Sprung in Review (dort regelt der User den Split).

### 4. Split-Workflow (bereits korrekt — keine Änderung nötig)
`supabase/functions/split-pdf/index.ts` Zeilen 248–277: Nach dem Split wird für **jeden** neu erzeugten Teilbeleg `extract-receipt` mit `skipMultiCheck: true` aufgerufen (mit 1× Retry, bei Fehler Status `error`). Das ist genau das Verhalten, das du willst — frische KI-Extraktion pro Teilbeleg.

### 5. Datenmigration
Die 2 aktuell auf `needs_splitting` stehenden Belege auf `review` setzen (sie haben bereits `split_suggestion`).

### 6. Optional/Aufräumen
- `NeedsSplittingBanner.tsx` und der separate Splitting-Screen können entfernt werden, falls nicht mehr verlinkt. Prüfen wir beim Umsetzen.

## Was passiert nach dem Split (zur Bestätigung)
1. User klickt im Review auf "PDF aufteilen" → `split-pdf` Edge Function.
2. Original-Beleg bekommt Status `split` (taucht nicht mehr in Review auf).
3. N neue Belege werden erzeugt, Status `processing`.
4. **Sofort, im Hintergrund:** `extract-receipt` läuft pro Teilbeleg → Felder werden frisch extrahiert → Status `review`.
5. User sieht die N neuen, separat extrahierten Belege in der Review-Liste.
