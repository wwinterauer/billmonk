

# Fix: Email-Webhook Receipt-Status + Stuck Receipts

## Problem
Der Webhook erstellt Receipts mit `status: "pending"`. Wenn die KI-Extraktion fehlschlägt, bleiben Belege unsichtbar (weder in Review noch in Expenses).

## Änderungen

### 1. `supabase/functions/email-import-webhook/index.ts` (Zeile 537)
- Receipt-Status bei Erstellung von `"pending"` auf `"processing"` ändern
- Das macht den Beleg sofort sichtbar und konsistent mit allen anderen Upload-Pfaden (Camera, Upload-Seite, Share)

### 2. Stuck Receipts manuell fixen
- Die 2 stuck Receipts (Kieninger + Test) per Migration auf `status = 'processing'` setzen
- Dann kannst du sie in der Expenses-Seite sehen und manuell die KI-Analyse neu starten

### Dateien
| Datei | Änderung |
|-------|----------|
| `supabase/functions/email-import-webhook/index.ts` | Zeile 537: `"pending"` → `"processing"` |
| Migration | UPDATE für die 2 stuck receipts |

