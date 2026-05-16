## Problem

Beim manuellen Speichern einer Ausgabe sendet `ManualExpenseDialog` `source: 'manual'`. Die DB-Constraint `receipts_source_check` lässt aber nur diese Werte zu:

`upload, email_webhook, email_imap, cloud, api, camera, share, split, bank_import`

→ Postgres lehnt das INSERT mit Check-Constraint-Verletzung ab. Im Frontend kommt nur „Unbekannter Fehler" an.

## Fix

**Migration** auf der `receipts`-Tabelle: Constraint droppen und neu anlegen, mit `'manual'` zusätzlich erlaubt.

```sql
ALTER TABLE public.receipts DROP CONSTRAINT receipts_source_check;
ALTER TABLE public.receipts ADD CONSTRAINT receipts_source_check
  CHECK (source = ANY (ARRAY[
    'upload','email_webhook','email_imap','cloud','api',
    'camera','share','split','bank_import','manual'
  ]));
```

## Zusätzlich (optional, klein)

In `handleSave` von `ManualExpenseDialog.tsx` die Fehlermeldung robuster machen, damit künftige DB-Fehler im Toast sichtbar werden (Supabase-Fehler haben `message`/`details`/`hint`, nicht zwingend `Error`-Instanz):

```ts
const msg = (err as any)?.message || (err as any)?.details || (err as any)?.hint || 'Unbekannter Fehler';
```

Keine weiteren Codeänderungen nötig.
