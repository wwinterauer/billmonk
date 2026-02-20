
# Bug-Fix: Nettobetrag bleibt nach KI-Neu-Analyse falsch (Override nicht zurückgesetzt)

## Ursache

Beim **Laden** des Belegs aus der Datenbank erkennt der Code, dass der gespeicherte Nettobetrag (6,71 €) von der Standardberechnung (79,42 € / 1,20 = 66,18 €) abweicht und setzt deshalb einen manuellen Override:

```typescript
// Zeilen 451-455 in ReceiptDetailPanel.tsx
if (data.amount_net !== null && Math.abs((data.amount_net || 0) - calcNet) > 0.01) {
  setAmountNetOverride(data.amount_net.toString()); // → "6.71"
} else {
  setAmountNetOverride('');
}
```

Nach der **KI-Neu-Analyse** setzt `onFieldsUpdated`:
- `setVatRate("0")` → korrekt
- `setAmountGross("79.42")` → korrekt

**Aber `amountNetOverride` bleibt bei `"6.71"`!**

Die `calculatedValues` würde danach korrekt `net = 79.42 / (1 + 0/100) = 79.42` berechnen. Doch weil der Override noch gesetzt ist, gewinnt er (Zeile 793/761):

```typescript
amount_net: amountNetOverride ? parseFloat(amountNetOverride) : calculatedValues.net,
// → parseFloat("6.71") = 6.71  ← Falsch!
```

Das gleiche Problem gilt für `vatAmountOverride` (bleibt z.B. bei einem alten Wert, obwohl jetzt 0% MwSt aktiv ist).

## Lösung

Im `onFieldsUpdated`-Callback in `ReceiptDetailPanel.tsx` müssen beim Update von `vat_rate` oder `amount_gross` die manuellen Override-Felder zurückgesetzt werden – weil neue KI-Werte die alten DB-basierten Overrides ungültig machen.

### Änderung: `src/components/receipts/ReceiptDetailPanel.tsx`

**Aktueller Code (Zeilen 1154-1165):**

```typescript
if (updates.amount_gross !== undefined) {
  if (amountGross !== updates.amount_gross) {
    changes['Bruttobetrag'] = { old: amountGross || '-', new: updates.amount_gross };
  }
  setAmountGross(updates.amount_gross);
}
if (updates.vat_rate !== undefined) {
  if (vatRate !== updates.vat_rate) {
    changes['MwSt-Satz'] = { old: vatRate || '-', new: updates.vat_rate + '%' };
  }
  setVatRate(updates.vat_rate);
}
```

**Geänderter Code:**

```typescript
if (updates.amount_gross !== undefined) {
  if (amountGross !== updates.amount_gross) {
    changes['Bruttobetrag'] = { old: amountGross || '-', new: updates.amount_gross };
  }
  setAmountGross(updates.amount_gross);
  // KI hat Bruttobetrag geändert → manuelle Net/VAT-Overrides zurücksetzen
  setAmountNetOverride('');
  setVatAmountOverride('');
}
if (updates.vat_rate !== undefined) {
  if (vatRate !== updates.vat_rate) {
    changes['MwSt-Satz'] = { old: vatRate || '-', new: updates.vat_rate + '%' };
  }
  setVatRate(updates.vat_rate);
  // KI hat MwSt-Satz geändert → manuelle Net/VAT-Overrides zurücksetzen
  setAmountNetOverride('');
  setVatAmountOverride('');
}
```

## Warum das sicher ist

- Die manuellen Override-Felder wurden beim Laden aus der DB gesetzt, weil die DB-Werte von der Standardberechnung abwichen
- Sobald die KI neue Brutto- oder MwSt-Werte liefert, sind die alten DB-basierten Overrides **inhaltlich falsch** (basieren auf anderen Ursprungswerten)
- Nach dem Reset berechnet `calculatedValues` automatisch korrekte Netto/MwSt-Werte aus den neuen KI-Daten
- Falls der Nutzer danach manuell eingreift, kann er die Override-Felder wie gewohnt befüllen
- Bei 0% MwSt: `net = 79.42 / (1 + 0/100) = 79.42` → korrekt angezeigt und gespeichert

## Betroffene Datei

| Datei | Änderung |
|-------|----------|
| `src/components/receipts/ReceiptDetailPanel.tsx` | Im `onFieldsUpdated`-Callback: nach `setAmountGross()` und nach `setVatRate()` je `setAmountNetOverride('')` und `setVatAmountOverride('')` hinzufügen |
