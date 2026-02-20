
# Bug-Fix: 0% MwSt wird nach Speichern als 20% angezeigt

## Ursache (Root Cause)

Das Problem liegt am JavaScript-Ausdruck `parseFloat("0") || null`:

- `parseFloat("0")` ergibt numerisch `0`
- `0` ist in JavaScript **falsy**, daher ergibt `0 || null` den Wert `null`
- `null` wird in die Datenbank gespeichert statt `0`

Beim erneuten Laden: `data.vat_rate?.toString() || '20'` — da `null?.toString()` = `undefined` (falsy), greift der Fallback `'20'`.

**Der Benutzer sieht 0%, speichert 0%, aber in der DB landet `null` → nächstes Öffnen zeigt 20%.**

## Betroffene Stellen

### Datei 1: `src/components/receipts/ReceiptDetailPanel.tsx`

**Zeile 795** (Speichern im Detail-Panel):
```typescript
// FALSCH:
vat_rate: isMixedTaxRate ? null : (parseFloat(vatRate) || null),

// RICHTIG:
vat_rate: isMixedTaxRate ? null : (vatRate !== '' && vatRate !== undefined ? parseFloat(vatRate) : null),
```

**Zeile 762** (in `currentValues` für Change-Tracking):
```typescript
// FALSCH:
vat_rate: parseFloat(vatRate) || null,

// RICHTIG:
vat_rate: vatRate !== '' ? parseFloat(vatRate) : null,
```

**Zeile 667** (in `calculateFieldChanges`):
```typescript
// FALSCH:
vat_rate: parseFloat(vatRate) || null,

// RICHTIG:
vat_rate: vatRate !== '' ? parseFloat(vatRate) : null,
```

### Datei 2: `src/pages/Review.tsx`

**Zeile 409** (Speichern in der Review-Seite):
```typescript
// FALSCH:
const vatRate = formData.is_mixed_tax_rate ? null : (parseFloat(formData.vat_rate) || null);

// RICHTIG:
const vatRate = formData.is_mixed_tax_rate ? null : (formData.vat_rate !== '' && formData.vat_rate !== undefined ? parseFloat(formData.vat_rate) : null);
```

### Datei 3: `src/components/receipts/ReceiptDetailPanel.tsx` — Laden

**Zeile 427** (Fallback beim Laden ist ebenfalls problematisch):
```typescript
// AKTUELL (auch ein Problem: vat_rate = 0 wird als '20' geladen)
setVatRate(data.vat_rate?.toString() || '20');

// RICHTIG:
setVatRate(data.vat_rate !== null && data.vat_rate !== undefined ? data.vat_rate.toString() : '20');
```

Der Unterschied: `(0).toString()` = `"0"` (truthy → kein Fallback auf '20'). Aber `0 || '20'` würde ebenfalls '20' liefern. Mit der expliziten null-Prüfung funktioniert es korrekt — allerdings wird dieser Ladefall gar nicht mehr erreicht sobald das Speichern korrekt ist, da dann `0` statt `null` in der DB steht.

## Zusammenfassung der Änderungen

| Datei | Zeile | Problem | Fix |
|-------|-------|---------|-----|
| `ReceiptDetailPanel.tsx` | 427 | `0?.toString() \|\| '20'` → `'20'` | Explizite null-Prüfung |
| `ReceiptDetailPanel.tsx` | 667 | `parseFloat("0") \|\| null` → `null` | `vatRate !== '' ? parseFloat(vatRate) : null` |
| `ReceiptDetailPanel.tsx` | 762 | `parseFloat("0") \|\| null` → `null` | `vatRate !== '' ? parseFloat(vatRate) : null` |
| `ReceiptDetailPanel.tsx` | 795 | `parseFloat("0") \|\| null` → `null` | `vatRate !== '' ? parseFloat(vatRate) : null` |
| `Review.tsx` | 409 | `parseFloat("0") \|\| null` → `null` | Explizite Leer-String-Prüfung |

Außerdem den gleichen Fix für `amount_gross` prüfen (Zeile 408/666 etc.), damit auch 0€-Beträge korrekt gespeichert werden können (obwohl das in der Praxis selten vorkommt).
