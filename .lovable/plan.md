

# Plan: A/B-Test-System für Prompt V1 vs V2

## Übersicht

Drei Komponenten: DB-Tabellen, Edge Function `run-ab-test`, Admin-UI als neuer Tab im bestehenden Admin-Dashboard.

## 1. DB-Migration

**Neue Tabellen:**

- `ab_test_runs` — id, name, description, prompt_version_a, prompt_version_b, status (pending/running/completed), created_at, completed_at, results_summary (jsonb), created_by (uuid)
- `ab_test_items` — id, test_run_id (FK), receipt_id (FK), original_data (jsonb), result_a (jsonb), result_b (jsonb), field_scores (jsonb), created_at
- `ab_test_field_accuracy` — id, test_run_id (FK), field_name, version_a_correct (int), version_a_total (int), version_b_correct (int), version_b_total (int)

**RLS:** Alle 3 Tabellen admin-only (CRUD via `has_role(auth.uid(), 'admin')`)

## 2. Edge Function `run-ab-test`

- Nimmt `test_run_id` entgegen
- Lädt Test-Items mit Receipt-Daten (file_url, file_type)
- Für jeden Beleg:
  - Downloadt Original aus Storage
  - **V1-Call:** Lädt V1-Prompt aus `prompt_versions`, sendet OHNE `response_format` an AI Gateway
  - **V2-Call:** Verwendet aktuellen V2-Prompt MIT `response_format: json_schema` + `extractionSchema`
  - Speichert beide Ergebnisse in `result_a`/`result_b`
  - Vergleicht 7 Felder gegen `original_data`: vendor, amount_gross, vat_rate, vat_amount, category, receipt_date, payment_method
  - Berechnet `field_scores` pro Beleg (match/mismatch pro Feld)
- Am Ende: Aggregiert Accuracy pro Feld in `ab_test_field_accuracy`, speichert Summary in `results_summary`
- Setzt Status auf `completed`
- Prozessiert sequentiell mit Logging (kein Timeout-Risiko durch Batching bei vielen Belegen — ggf. Limit auf 50 Belege pro Run)

**Vergleichslogik:**
- `vendor`: Fuzzy-Match (lowercase, trimmed, Levenshtein-Toleranz oder `includes`)
- `total_amount`/`vat_amount`: ±0.05 Toleranz
- `tax_rate`: String-Vergleich nach Normalisierung
- `category`/`payment_method`/`receipt_date`: exakter Vergleich (case-insensitive)

## 3. Admin-UI

**Kein neuer Route** — neuer Tab "A/B Tests" im bestehenden `/admin`-Dashboard (neuer `TabsTrigger` + `TabsContent`).

**Datei:** `src/components/admin/ABTestManager.tsx`

**Ansichten:**
1. **Übersicht:** Liste aller Test-Runs mit Status-Badge, Datum, Beleg-Anzahl. Button "Neuen Test erstellen" (erstellt Run + Items aus allen approved Belegen)
2. **Ergebnis-Ansicht:** Klick auf abgeschlossenen Test zeigt:
   - Tabelle: Feld | V1 Correct | V1 Total | V1 % | V2 Correct | V2 Total | V2 % | Winner
   - Gesamt-Score (Durchschnitt aller Feld-Accuracies)
   - Beleg-Liste mit Klick für Detail
3. **Detail-Vergleich (Dialog):** Side-by-side: Original (approved) | V1-Ergebnis | V2-Ergebnis — Felder farbig markiert (grün=korrekt, rot=abweichend)

**Änderungen in bestehenden Dateien:**
- `src/pages/Admin.tsx`: Import + neuer Tab `ab-test`
- `src/App.tsx`: Keine Änderung nötig (nutzt bestehende `/admin` Route)

## Technische Details

- Edge Function nutzt `LOVABLE_API_KEY` (bereits konfiguriert) und `SUPABASE_SERVICE_ROLE_KEY` für Admin-Zugriff auf Storage/DB
- V1-Prompt wird aus `prompt_versions.user_prompt_template` geladen — der V1-Prompt enthält die JSON-Formatbeschreibung inline
- V2-Prompt nutzt den komprimierten Prompt + `extractionSchema` aus dem aktuellen Code
- Max 50 Belege pro Test-Run um Edge Function Timeout (60s) nicht zu überschreiten — UI zeigt Warnung wenn mehr approved Belege vorhanden
- Beide Calls nutzen `google/gemini-3-flash-preview` für fairen Vergleich

