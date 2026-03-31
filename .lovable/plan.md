

# Fix: Duplikat-Banner zeigt alte Duplikate trotz erfolgreicher Prüfung

## Problem

Das Banner "5 mögliche Duplikate gefunden" zeigt Belege, die **bereits zuvor** als Duplikat markiert wurden (`is_duplicate = true` in der DB). Die heutige Duplikat-Prüfung hat nur **neue** Belege geprüft (die noch nicht als Duplikat markiert sind, Zeile 466: `.eq('is_duplicate', false)`), keine neuen gefunden, und "Keine Duplikate gefunden" gemeldet.

Die 5 alten Duplikate bleiben aber in der DB markiert → das Banner bleibt sichtbar. Das ist verwirrend.

## Lösung

Zwei Anpassungen:

### 1. `startDuplicateCheck` — Alte Duplikate re-validieren

Nach der Prüfung der neuen Belege: Auch alle bestehenden `is_duplicate = true` Belege nochmal gegen ihr `duplicate_of` prüfen. Wenn das Original nicht mehr existiert oder der Score unter 70 liegt, wird `is_duplicate` zurückgesetzt.

Konkret: Am Ende von `startDuplicateCheck()` (nach Zeile 521) eine Re-Validierung der bestehenden Duplikate einfügen:

```ts
// Re-validate existing duplicates
const { data: existingDuplicates } = await supabase
  .from('receipts')
  .select('id, duplicate_of, file_hash, vendor, amount_gross, receipt_date, invoice_number')
  .eq('user_id', user.id)
  .eq('is_duplicate', true);

if (existingDuplicates) {
  for (const dup of existingDuplicates) {
    // Check if original still exists and is not deleted/rejected
    const { data: original } = await supabase
      .from('receipts')
      .select('id, status')
      .eq('id', dup.duplicate_of)
      .single();
    
    if (!original || original.status === 'rejected') {
      // Original gone → unmark
      await supabase.from('receipts').update({
        is_duplicate: false,
        duplicate_of: null,
        duplicate_score: null,
        duplicate_checked_at: new Date().toISOString()
      }).eq('id', dup.id);
    }
  }
}
```

### 2. Banner-Text verbessern

Das Banner-Wording ändern von "mögliche Duplikate **gefunden**" zu "als Duplikat **markiert**", damit klar ist, dass es sich um bestehende Markierungen handelt — nicht um neue Ergebnisse:

```
"{duplicateCount} Beleg{e} als Duplikat markiert"
"Im Duplikat-Filter überprüfen und ggf. bereinigen"
```

### 3. Receipts neu laden nach Duplikat-Prüfung

Nach `startDuplicateCheck` wird `loadReceipts()` aufgerufen, damit die Zähler aktuell sind — auch wenn Duplikate entfernt wurden. Dies passiert bereits (Zeile nach dem Toast), muss aber sichergestellt werden, dass es auch im "keine gefunden"-Pfad passiert.

## Dateien

- `src/pages/Expenses.tsx` — Re-Validierung + Banner-Text + loadReceipts nach Check

