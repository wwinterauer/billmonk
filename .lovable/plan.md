

# Inkonsistente Error-Codes vereinheitlichen

## Analyse der aktuellen Situation

| Funktion | Fehlerart | Aktuell | Soll |
|---|---|---|---|
| **split-pdf** | Auth fehlt/ungültig | 500 (catch-all) | 401 |
| **split-pdf** | Validierung (receiptId, splits) | 500 (catch-all) | 400 |
| **split-pdf** | Receipt nicht gefunden | 500 (catch-all) | 404 |
| **split-pdf** | Server-Fehler | 500 | 500 ✓ |
| **run-ab-test** | test_run_id fehlt | 400 | 400 ✓ |
| **run-ab-test** | Test run / Prompts nicht gefunden | 500 (throw) | 404 |
| **auto-reconcile** | Auth fehlt/ungültig | 500 (throw) | 401 |
| **extract-receipt** | Alles | Korrekt | ✓ |

## Änderungen

### 1. `supabase/functions/split-pdf/index.ts`

Statt alles in den catch-all zu werfen, spezifische Responses zurückgeben:

- **Zeilen 35-37** (Auth fehlt): Direkt `return new Response(... , { status: 401 })` statt `throw`
- **Zeilen 42-44** (Token ungültig): Direkt `return new Response(... , { status: 401 })` statt `throw`
- **Zeilen 49-61** (Validierungsfehler: receiptId, splits): Direkt `return new Response(... , { status: 400 })` statt `throw`
- **Zeilen 73-75** (Receipt nicht gefunden): Direkt `return new Response(... , { status: 404 })` statt `throw`
- **Zeilen 77-79** (Receipt hat keine Datei): Direkt `return new Response(... , { status: 404 })` statt `throw`
- **Zeile 100** (Ungültige Seitenzahl): Direkt `return new Response(... , { status: 400 })` statt `throw`
- Catch-all bleibt 500 für echte Server-Fehler

### 2. `supabase/functions/run-ab-test/index.ts`

- **Zeile 426** (`testRun` nicht gefunden): Direkt `return new Response(... , { status: 404 })` statt `throw`
- **Zeile 432** (Prompt versions nicht gefunden): Direkt `return new Response(... , { status: 404 })` statt `throw`
- Catch-all bleibt 500

### 3. `supabase/functions/auto-reconcile/index.ts`

- **Zeile 22** (Auth fehlt): Direkt `return new Response(... , { status: 401 })` statt `throw`
- **Zeile 26** (Auth ungültig): Direkt `return new Response(... , { status: 401 })` statt `throw`
- Catch-all bleibt 500

### Dateien
- `supabase/functions/split-pdf/index.ts`
- `supabase/functions/run-ab-test/index.ts`
- `supabase/functions/auto-reconcile/index.ts`

