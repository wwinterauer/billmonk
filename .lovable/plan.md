

# Fix: Email-Webhook Receipts sollen gleich behandelt werden wie Drag-and-Drop

## Problem
1. **Kieninger-Rechnung**: Status ist `processing`, aber `ai_processed_at` ist NULL — die KI-Extraktion wurde getriggert, ist aber lautlos fehlgeschlagen. Der Beleg bleibt für immer auf `processing` hängen.
2. **Review-Seite** zeigt nur `status = 'review'` — `processing`-Belege sind dort unsichtbar.
3. **Kein Error-Handling**: Wenn `extract-receipt` fehlschlägt, wird der Receipt-Status nicht aktualisiert. Bei Drag-and-Drop macht das Frontend das Error-Handling; beim Webhook gibt es keinen solchen Fallback.

## Lösung

### 1. `supabase/functions/email-import-webhook/index.ts` — Robusteres Error-Handling
Nach dem `extract-receipt`-Aufruf: Wenn die Extraktion fehlschlägt, Receipt-Status auf `error` setzen mit Fehlermeldung in `notes`. So bleibt kein Beleg mehr unsichtbar auf `processing` hängen.

```typescript
// Nach dem fetch-Aufruf:
if (!extractResponse.ok) {
  const errorText = await extractResponse.text();
  console.error("AI extraction failed:", errorText);
  // Receipt auf error setzen statt processing hängen lassen
  await supabase.from("receipts").update({
    status: "review",  // In Review statt Error, damit User ihn bearbeiten kann
    notes: `KI-Extraktion fehlgeschlagen. ${existingNotes}`
  }).eq("id", receipt.id);
}
```

### 2. `supabase/functions/extract-receipt/index.ts` — Status-Update bei Fehler
Am Ende der Funktion: Bei unbehandelten Fehlern (catch-Block) den Receipt-Status auf `review` setzen, damit der Beleg nicht auf `processing` hängen bleibt. Das betrifft ALLE Aufrufer (Webhook, Upload, Re-Analyse).

### 3. Migration — Stuck Receipt fixen
Die Kieninger-Rechnung manuell auf `review` setzen, damit sie sofort in der Review-Seite erscheint.

```sql
UPDATE receipts SET status = 'review' 
WHERE status = 'processing' AND ai_processed_at IS NULL 
AND created_at < now() - interval '1 hour';
```

## Dateien
| Datei | Änderung |
|-------|----------|
| `supabase/functions/email-import-webhook/index.ts` | Fallback auf `review` wenn Extraktion fehlschlägt |
| `supabase/functions/extract-receipt/index.ts` | Im globalen catch: Receipt-Status auf `review` setzen wenn `receiptId` vorhanden |
| Migration | Stuck `processing`-Receipts auf `review` setzen |

