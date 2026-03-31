

# Split-PDF Retry-Logik

## Problem

Fire-and-Forget `extract-receipt`-Aufrufe (Zeilen 207-217) lassen geteilte Belege bei Fehlschlag im Status "processing" hängen.

## Lösung

Die Sofort-Antwort an den Client bleibt unverändert. Die Extraktionen laufen weiterhin im Hintergrund — aber mit Retry und Fehlerbehandlung statt Fire-and-Forget.

## Änderung in `supabase/functions/split-pdf/index.ts`

**Zeilen 207-217 ersetzen**: Statt des simplen `.then()/.catch()` wird eine Hintergrund-Funktion gestartet, die:

1. `extract-receipt` aufruft und auf die Antwort wartet
2. Bei Fehler: 2 Sekunden wartet, dann ein zweites Mal versucht
3. Bei erneutem Fehler: den Beleg-Status auf `'error'` setzt und die Fehlermeldung in `notes` schreibt

```typescript
// Background extraction with retry
(async () => {
  const extractWithRetry = async (receiptId: string) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { error } = await supabase.functions.invoke('extract-receipt', {
          body: { receiptId, skipMultiCheck: true }
        });
        if (error) throw error;
        console.log(`Extraction succeeded for ${receiptId} (attempt ${attempt})`);
        return;
      } catch (err) {
        console.error(`Extraction attempt ${attempt} failed for ${receiptId}:`, err);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    // Both attempts failed — mark as error
    await supabase.from('receipts').update({
      status: 'error',
      notes: 'KI-Extraktion nach 2 Versuchen fehlgeschlagen',
    }).eq('id', receiptId);
    console.error(`Marked ${receiptId} as error after 2 failed extraction attempts`);
  };

  for (const r of createdReceipts) {
    extractWithRetry(r.id);
  }
})();
```

Die IIFE läuft asynchron weiter nachdem die HTTP-Response an den Client gesendet wurde.

### Dateien
- `supabase/functions/split-pdf/index.ts`

