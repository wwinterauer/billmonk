

# Fix: Mixed-Tax Fields fehlen im Reanalyse-Rückkanal

## Problem

Die Edge Function berechnet die Werte korrekt (`net=16.42, vat=3.18`) und speichert sie in der Datenbank. Aber der **Client-seitige Rückkanal** gibt diese Werte nie an das Formular weiter:

1. `ReanalyzeOptions.onFieldsUpdated` Interface akzeptiert nur: `vendor`, `vendor_brand`, `description`, `invoice_number`, `receipt_date`, `amount_gross`, `vat_rate`, `category`, `confidence`
2. Die Mapping-Logik in `reanalyzeFields()` mappt nie: `amount_net`, `vat_amount`, `is_mixed_tax_rate`, `tax_rate_details`
3. `handleReanalysisUpdate` in Review.tsx setzt diese Felder nie im FormData

Das Formular zeigt daher immer die **alten** Werte. Die DB hat die richtigen Werte, aber das Formular wird nie aktualisiert.

## Lösung

### 1. `ReanalyzeOptions.tsx` — Interface und Mapping erweitern

**onFieldsUpdated Interface** (Zeile 87-97): Felder hinzufügen:
```typescript
onFieldsUpdated: (updates: {
  // ... bestehende Felder ...
  amount_net?: string;
  vat_amount?: string;
  is_mixed_tax_rate?: boolean;
  tax_rate_details?: { rate: number; net_amount: number; tax_amount: number; description?: string }[] | null;
}) => void;
```

**reanalyzeFields Mapping** (nach Zeile 202): Neue Felder mappen:
```typescript
if (normalized.amount_net !== null && normalized.amount_net !== undefined) {
  updates.amount_net = normalized.amount_net.toString();
}
if (normalized.vat_amount !== null && normalized.vat_amount !== undefined) {
  updates.vat_amount = normalized.vat_amount.toString();
}
if (normalized.is_mixed_tax_rate !== undefined) {
  updates.is_mixed_tax_rate = normalized.is_mixed_tax_rate;
}
if (normalized.tax_rate_details) {
  updates.tax_rate_details = normalized.tax_rate_details;
}
```

Dasselbe auch in `handleExpensesOnlyReanalyze()` (ca. Zeile 310-337).

### 2. `Review.tsx` — handleReanalysisUpdate erweitern

**Callback** (Zeile 298-323): Neue Felder akzeptieren und in formData setzen:
```typescript
const handleReanalysisUpdate = useCallback((updates: {
  // ... bestehende Felder ...
  amount_net?: string;
  vat_amount?: string;
  is_mixed_tax_rate?: boolean;
  tax_rate_details?: TaxRateDetail[] | null;
}) => {
  setFormData(prev => ({
    ...prev,
    // ... bestehende Zuweisungen ...
    is_mixed_tax_rate: updates.is_mixed_tax_rate ?? prev.is_mixed_tax_rate,
    tax_rate_details: updates.tax_rate_details ?? prev.tax_rate_details,
    amount_net_override: updates.amount_net ?? prev.amount_net_override,
    vat_amount_override: updates.vat_amount ?? prev.vat_amount_override,
  }));
});
```

### 3. `ReceiptDetailPanel.tsx` — Dasselbe Muster anwenden

Auch hier den `onFieldsUpdated` Callback erweitern, damit gemischte Steuersätze in der Detailansicht korrekt aktualisiert werden.

### Dateien
- `src/components/receipts/ReanalyzeOptions.tsx` — Interface + Mapping
- `src/pages/Review.tsx` — handleReanalysisUpdate
- `src/components/receipts/ReceiptDetailPanel.tsx` — handleReanalysisUpdate (gleiche Änderung)

