

## Problem

Die Rechnungsnummer wird im `useEffect` (Zeile 103) nur generiert, wenn `settings` nicht `null` ist. Da `useInvoiceSettings` mit `maybeSingle()` abfragt, ist `settings` gleich `null`, wenn der User noch nie Einstellungen gespeichert hat. In dem Fall wird die Nummer nie erzeugt.

Auch bei existierenden Settings: Solange der Hook lädt (`loading: true`), ist `settings` noch `null` — die Nummer erscheint erst nach dem Laden, was zu einem kurzen "leeren Feld" führt.

## Lösung

In `src/pages/InvoiceEditor.tsx`, Zeile 103-123: Den `useEffect` so anpassen, dass er auch ohne gespeicherte Settings eine Standardnummer generiert (mit den gleichen Defaults wie im Hook definiert), aber erst nachdem das Laden abgeschlossen ist.

### Änderungen

**`src/pages/InvoiceEditor.tsx`**:

1. `loading` aus `useInvoiceSettings()` destructuren (Zeile 72)
2. `useRef` importieren und ein `invoiceNumberInitialized`-Flag einführen (verhindert Überschreiben manueller Änderungen)
3. `useEffect` anpassen:

```typescript
const invoiceNumberInitialized = useRef(false);

useEffect(() => {
  if (loading || isEdit || invoiceNumberInitialized.current) return;
  invoiceNumberInitialized.current = true;
  
  const prefix = settings?.invoice_number_prefix || 'RE';
  const seq = settings?.next_sequence_number || 1;
  const year = new Date().getFullYear();
  const formatted = (settings?.invoice_number_format || '{prefix}-{year}-{seq}')
    .replace('{prefix}', prefix)
    .replace('{year}', String(year))
    .replace('{seq}', String(seq).padStart(4, '0'));
  setInvoiceNumber(formatted);
  
  if (settings?.default_discount_percent) setDiscountPercent(settings.default_discount_percent);
  if (settings?.default_discount_days) setDiscountDays(settings.default_discount_days);
  if (settings?.default_footer_text) setFooterText(settings.default_footer_text);
  if (settings?.default_notes) setNotes(settings.default_notes);
}, [settings, loading, isEdit]);
```

### Umfang
- 1 Datei: `src/pages/InvoiceEditor.tsx` — Import erweitern + useEffect-Guard

