

# Email-Import auf Plus-Addressing umstellen

## Übersicht
Import-Adressen von `rechnungen+TOKEN@import.billmonk.ai` auf `import+TOKEN@billmonk.ai` umstellen. Rückwärtskompatibilität im Webhook beibehalten.

## Änderungen

### 1. `supabase/functions/email-import-webhook/index.ts` (Zeilen 294-306)
Token-Extraction durch eine Funktion ersetzen, die beide Formate unterstützt:
- **Primär**: `import+TOKEN@billmonk.ai` (Plus-Addressing)
- **Legacy**: `*+TOKEN@import.billmonk.ai` oder `TOKEN@import.billmonk.ai`

Auch Unterstriche in der Token-Validierung erlauben (`[a-z0-9._-]`).

Edge Function danach neu deployen.

### 2. `src/hooks/useEmailImport.ts` (3 Stellen)
- Zeile 224: `rechnungen+${token}@import.billmonk.ai` → `import+${token}@billmonk.ai`
- Zeile 282: gleiche Änderung
- Zeile 315: gleiche Änderung

### 3. `src/components/settings/EmailImportSettings.tsx` (4 Stellen)
- Zeile 526: Prefix `rechnungen+` → `import+`
- Zeile 537: Suffix `@import.billmonk.ai` → `@billmonk.ai`
- Zeile 606: Prefix `rechnungen+` → `import+`
- Zeile 617: Suffix `@import.billmonk.ai` → `@billmonk.ai`

### Dateien
| Datei | Änderung |
|-------|----------|
| `supabase/functions/email-import-webhook/index.ts` | Token-Extraction für beide Formate + Redeploy |
| `src/hooks/useEmailImport.ts` | 3× Adress-Format ändern |
| `src/components/settings/EmailImportSettings.tsx` | 4× Anzeige-Format ändern |

