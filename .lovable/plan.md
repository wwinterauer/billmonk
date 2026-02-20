
# Konsistente "Geändert"-Anzeige für alle Felder

## Problem

Aktuell sind nur 3 von ~10 editierbaren Feldern in die `LearnableField`-Komponente eingebettet:
- Rechnungsnummer
- Bruttobetrag  
- MwSt-Satz

Alle anderen Felder haben kein "Geändert"-Badge, obwohl sie denselben `originalReceipt`-State für Vergleiche verwenden könnten. Das wirkt inkonsistent.

## Felder die fehlen

| Feld | DB-Spalte | Aktuell | Ziel |
|------|-----------|---------|------|
| Lieferant (Markenname) | `vendor_brand` | plain `div` | `LearnableField` |
| Rechtlicher Firmenname | `vendor` | plain `div` | `LearnableField` |
| Beschreibung | `description` | plain `div` | `LearnableField` |
| Belegdatum | `receipt_date` | plain `div` | `LearnableField` |
| Kategorie | `category` | plain `div` | `LearnableField` |
| Nettobetrag (Override) | `amount_net` | plain `div` | `LearnableField` |
| MwSt-Betrag (Override) | `vat_amount` | plain `div` | `LearnableField` |
| Zahlungsart | `payment_method` | plain `div` | `LearnableField` |
| Notizen | `notes` | plain `div` | `LearnableField` |

## Technische Details

### Wie `LearnableField` funktioniert

Die Komponente bekommt `value` (aktueller Wert) und `originalValue` (aus `originalReceipt` beim Laden) und vergleicht sie:

```typescript
const hasChanged = String(normalizedValue || '') !== String(normalizedOriginal || '') && normalizedOriginal !== null;
```

Wenn sie verschieden sind, wird das "Geändert"-Badge mit orangem Stift-Symbol angezeigt, darunter der ursprüngliche Wert (mit Zurücksetzen-Button).

### Besonderheiten je Feld

**Vendor/Brand**: Nur "Geändert" zeigen wenn kein `selectedVendorId` (wenn verknüpft, ist das Feld read-only). Für den rechtlichen Namen wird der Wert aus `originalReceipt?.vendor` verglichen.

**Belegdatum**: Das Datum wird als `Date`-Objekt gespeichert, original als ISO-String. Vergleich erfolgt über formatierten String (z.B. `'2024-01-15'`).

**Kategorie**: `originalReceipt?.category` vs. aktueller `category`-State. Kein `onReset` nötig (kein Lernfeld), nur das "Geändert"-Badge.

**Nettobetrag / MwSt-Betrag**: Diese sind Override-Felder – "Geändert" wird gezeigt wenn `amountNetOverride` gesetzt und vom ursprünglichen DB-Wert abweicht. `originalValue = originalReceipt?.amount_net`.

**Zahlungsart**: `originalReceipt?.payment_method` vs. `paymentMethod`.

**Notizen**: `originalReceipt?.notes` vs. `notes`.

**Beschreibung**: `originalReceipt?.description` vs. `description`.

### `LearnableField`-Anpassung für reine "Geändert"-Anzeige

Für Felder ohne Lern-Funktion (kein `vendorLearning` relevant) werden einfach keine `vendorLearning`-Props übergeben. Das Badge erscheint trotzdem, sobald `value !== originalValue`.

Das "KI erkannt: ..." mit Zurücksetzen-Zeile unter dem Feld soll nur erscheinen wenn `onReset` übergeben wird (bereits so implementiert).

### Änderung in `src/components/receipts/ReceiptDetailPanel.tsx`

Die folgenden Blöcke werden von `<div>` auf `<LearnableField ...>` umgestellt:

1. **Vendor Brand** (Zeile ~1279-1318): Wrapper um `div.space-y-2`, mit `value={vendorBrand}`, `originalValue={originalReceipt?.vendor_brand}`, `onReset={() => setVendorBrand(originalReceipt?.vendor_brand || '')}` — aber nur wenn kein `selectedVendorId` (read-only-Modus braucht kein Badge)

2. **Vendor Legal Name** (Zeile ~1321-1337): Wrapper um `VendorAutocomplete`, mit `value={vendor}`, `originalValue={originalReceipt?.vendor}`, `onReset={() => { setVendor(originalReceipt?.vendor || ''); setSelectedVendorId(null); }}`

3. **Beschreibung** (Zeile ~1340-1370): Wrapper, mit `value={description}`, `originalValue={originalReceipt?.description}`, `onReset={() => setDescription(originalReceipt?.description || '')}`. Das Zeichen-Counter im Label bleibt via `labelExtra`-Prop.

4. **Belegdatum** (Zeile ~1372-1401): Wrapper, mit `value={receiptDate ? format(receiptDate, 'yyyy-MM-dd') : null}`, `originalValue={originalReceipt?.receipt_date ? originalReceipt.receipt_date.substring(0,10) : null}`, `onReset={() => setReceiptDate(originalReceipt?.receipt_date ? new Date(originalReceipt.receipt_date) : undefined)}`

5. **Kategorie** (Zeile ~1421-1435): Wrapper, mit `value={category}`, `originalValue={originalReceipt?.category}`, `onReset={() => setCategory(originalReceipt?.category || '')}`

6. **Nettobetrag** (Zeile ~1560-1570): Wrapper, mit `value={amountNetOverride ? parseFloat(amountNetOverride) : null}`, `originalValue={originalReceipt?.amount_net}`, kein `onReset` (da calculated field)

7. **MwSt-Betrag** (Zeile ~1572-1586): Wrapper, mit `value={vatAmountOverride ? parseFloat(vatAmountOverride) : null}`, `originalValue={originalReceipt?.vat_amount}`, kein `onReset`

8. **Zahlungsart** (Zeile ~1590-1604): Wrapper, mit `value={paymentMethod}`, `originalValue={originalReceipt?.payment_method}`, `onReset={() => setPaymentMethod(originalReceipt?.payment_method || '')}`

9. **Notizen** (Zeile ~1606-1616): Wrapper, mit `value={notes}`, `originalValue={originalReceipt?.notes}`, `onReset={() => setNotes(originalReceipt?.notes || '')}`

### Ergebnis

Nach der Änderung zeigen **alle Felder** konsistent das orange "Geändert"-Badge mit Stift-Symbol sobald der aktuelle Wert vom ursprünglichen DB-Wert abweicht. Der Nutzer sieht sofort, was er oder die KI geändert hat, und kann jeden Wert einzeln zurücksetzen.
