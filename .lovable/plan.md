

## Kleinunternehmerregelung in der Layout-Vorschau

### Problem
Die `InvoiceLayoutPreview` zeigt immer 20% MwSt an, unabhängig davon ob die Kleinunternehmerregelung aktiviert ist.

### Änderung

**`src/components/settings/InvoiceLayoutPreview.tsx`**:
- `companySettings.is_small_business` auswerten
- Wenn aktiv: MwSt-Zeile (20% USt) ausblenden, Gesamt = Netto
- Unterhalb der Summe den Kleinunternehmer-Hinweistext anzeigen (`companySettings.small_business_text`)

Konkret im Totals-Block:
```typescript
const isSmallBusiness = companySettings?.is_small_business === true;
const vat = isSmallBusiness ? 0 : subtotal * 0.2;
const total = subtotal + vat;

// Im Render:
// Netto-Zeile immer zeigen
// "20% USt" Zeile nur wenn !isSmallBusiness
// Nach Gesamt: Kleinunternehmer-Hinweistext wenn isSmallBusiness
```

### Umfang
- 1 Datei: `InvoiceLayoutPreview.tsx` — ~10 Zeilen anpassen

