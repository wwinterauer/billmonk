

# Plan: A/B-Test Timeout-Fix — Asynchrone Batch-Verarbeitung

## Problem

Die Edge Function `run-ab-test` verarbeitet 50 Belege sequentiell mit je 2 AI-Calls (~12s pro Beleg = ~20 Minuten). Edge Functions haben ein Timeout von ~60s. Die Funktion wurde nach 16/50 Items gekillt.

## Lösung: "Fire-and-forget" + Item-weise Verarbeitung

Die Edge Function wird in zwei Teile aufgeteilt:

### 1. `run-ab-test` (Orchestrator) — sofortige Antwort

- Nimmt `test_run_id` entgegen
- Setzt Status auf `running`
- Antwortet **sofort** mit `{ success: true, message: "Test gestartet" }`
- Startet die Item-Verarbeitung als **Background-Task** via `EdgeRuntime.waitUntil()` (Supabase Edge Functions unterstützen dies für bis zu 150s Hintergrundarbeit)
- Alternativ: Verarbeitet Items in **Batches von 5** und ruft sich selbst rekursiv auf (mit `batch_offset` Parameter)

### 2. Batch-Architektur

**Variante: Self-calling Batches**
- Funktion verarbeitet 5 Items pro Aufruf (~60s)
- Am Ende jedes Batches: Ruft sich selbst mit `{ test_run_id, batch_offset: offset + 5 }` auf (fire-and-forget fetch)
- Letzter Batch: Berechnet Summary + setzt Status `completed`
- Zwischenergebnisse werden nach jedem Item in DB gespeichert (bereits der Fall)

**Änderungen in der Edge Function:**
- Neuer Parameter `batch_offset` (default 0)
- Items werden mit `.range(offset, offset + 4)` geladen
- Nach Batch: Self-call oder Finalisierung
- Sofortige Response an Client beim ersten Call

**Änderungen im Frontend (`ABTestManager.tsx`):**
- `startTest` Mutation erwartet keine finale Antwort mehr
- Polling auf `ab_test_runs.status` via `refetchInterval` bis Status `completed`
- Progress-Anzeige: Zählt `ab_test_items` mit `result_a IS NOT NULL`

### 3. UI-Verbesserungen

- Laufender Test zeigt Progress-Bar (verarbeitete Items / Gesamt)
- Auto-Refresh alle 5 Sekunden während Status `running`
- Toast: "Test gestartet — Verarbeitung läuft im Hintergrund"

## Technische Details

- Batch-Size 5 = ~60s pro Batch (sicher unter Timeout)
- Self-call verwendet `SUPABASE_URL` + `/functions/v1/run-ab-test` mit Service-Role-Key als Authorization
- Fehlerbehandlung: Wenn ein Batch fehlschlägt, wird Status auf `error` gesetzt
- Bestehende Logik (Vergleich, Accuracy, Summary) bleibt identisch, nur die Orchestrierung ändert sich

