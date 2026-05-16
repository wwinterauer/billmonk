## Ursache

In `supabase/functions/extract-receipt/index.ts` enthält `buildCategoryHints()` (Zeilen 168–198) hartkodierte Beispiel-Kategorienamen wie **„Software/EDV"**, „GWG", „Bewirtung". Diese landen im KI-Prompt, auch wenn der User diese Kategorien gar nicht hat. Die KI hat „Software-Abos → Software/EDV" wortwörtlich übernommen, obwohl bei dir nur „Software" existiert. Anschließend wird der AI-Wert ungeprüft als `finalCategory` gespeichert.

## Plan

### 1. Hartkodierte Kategorienamen aus Hints entfernen
`buildCategoryHints()` (Zeilen 168–198): Beispielzeilen so umbauen, dass entweder
- nur generische Konzepte genannt werden (ohne konkrete Namen), oder
- jede Beispielzeile dynamisch nur dann ausgegeben wird, wenn ein passender Name in `categories` existiert (Helper `has()` ist schon vorhanden).

Zeile 182 („Software-Abos → Software/EDV") und analoge Zeilen entsprechend bereinigen.

### 2. AI-Kategorie strikt gegen User-Liste validieren
Im Bereich um Zeile 933 (`let finalCategory = extractedData.category`):
- Vor dem Speichern prüfen, ob `finalCategory` (case-insensitive) **exakt** einer der geladenen User-Kategorien entspricht.
- Wenn nicht: `finalCategory = null` setzen → Feld bleibt leer (wie vom User gewünscht), kein Fuzzy-Matching, keine erfundenen Namen.
- Bestehende Vendor-Default- und Category-Learning-Logik bleibt unberührt, da diese ohnehin echte IDs/Namen aus der DB liefert.

### 3. Prompt-Hinweis verschärfen
Im KATEGORIE-Block (Zeilen ~629–631) noch deutlicher: **ausschließlich** Namen aus der Liste, sonst leer lassen — keine Variationen, keine Kombinationen, keine Erfindungen.

## Technisch betroffene Stellen

- `supabase/functions/extract-receipt/index.ts` Zeilen 168–198 (Hints)
- `supabase/functions/extract-receipt/index.ts` Zeilen ~629–631 (Prompt)
- `supabase/functions/extract-receipt/index.ts` Zeilen ~933 ff. (finalCategory-Validierung)
