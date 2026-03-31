

# Plan: Prompt-Versionierung — V1 sichern

## Übersicht
Neue Tabelle `prompt_versions` anlegen, `receipts.prompt_version` Spalte hinzufügen, und den kompletten aktuellen Prompt als V1 speichern. Damit kann später ein optimierter V2-Prompt gegengetestet werden.

## Schritt 1: DB-Migration

Eine Migration mit folgenden Änderungen:

**Tabelle `prompt_versions`:**
- `id` (uuid, PK, default gen_random_uuid())
- `version` (text, unique, not null)
- `name` (text, not null)
- `system_prompt` (text, not null)
- `user_prompt_template` (text, not null)
- `expenses_only_prompt_template` (text, not null)
- `created_at` (timestamptz, default now())
- `is_active` (boolean, default false)
- `metadata` (jsonb, default '{}')

RLS aktivieren:
- SELECT: alle authentifizierten User
- INSERT/UPDATE/DELETE: nur Admins via `has_role(auth.uid(), 'admin')`

**Spalte `receipts.prompt_version`:**
- `text`, default `'v1'`, nullable

## Schritt 2: V1-Prompt als Daten einfügen

Per Insert-Tool den aktuellen Prompt aus `extract-receipt/index.ts` speichern:

| Feld | Quelle (Zeilen) |
|---|---|
| `system_prompt` | Zeile 447-449 — der kurze System-Prompt |
| `user_prompt_template` | Zeilen 701-996 — der gesamte User-Prompt inkl. Vendor-Regeln, MwSt-Regeln, JSON-Format |
| `expenses_only_prompt_template` | Zeilen 475-507 (Keyword-Variante) + Zeilen 509-523 (generische Variante) — als JSON-Objekt mit beiden Varianten |

Metadaten: `{"source_file": "extract-receipt/index.ts", "model": "gemini-3-flash-preview", "token_estimate": 5000}`

## Schritt 3: Edge Function anpassen (optional, Phase 2)

Kein sofortiger Code-Umbau nötig. Der aktuelle Prompt bleibt hardcoded im Code. Die Tabelle dient zunächst als **Archiv und Referenz** für das spätere Benchmarking. In Phase 2 kann die Edge Function dann den Prompt dynamisch aus der Tabelle laden.

## Technische Details

- Migration nutzt `has_role()` Security-Definer-Funktion (bereits vorhanden) für Admin-RLS
- `receipts.prompt_version` Default `'v1'` sorgt dafür, dass alle bestehenden und neuen Belege automatisch V1 zugeordnet werden
- Kein Code-Refactoring in dieser Phase — rein DB-seitige Vorbereitung

