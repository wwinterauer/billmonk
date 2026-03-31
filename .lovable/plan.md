

# AI-Confidence Dot für Buchungsart

## Übersicht

Der Confidence-Dot (farbiger Punkt: grün/gelb/rot/grau) wird bereits bei allen Feldern in Review.tsx angezeigt, fehlt aber beim Buchungsart-Dropdown. In ReceiptDetailPanel.tsx wird ein anderes Pattern verwendet (LearnableField), dort fehlt der Dot ebenfalls.

## Änderungen

### 1. `src/pages/Review.tsx` — Confidence-Dot bei Buchungsart ergänzen

**Zeilen 1162-1164**: Das Label `<Label>Buchungsart</Label>` wird erweitert um den gleichen Tooltip+Dot wie bei Kategorie (Zeilen 1131-1143):

```tsx
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Label>Buchungsart</Label>
    <Tooltip>
      <TooltipTrigger>
        <div className={cn(
          'h-2 w-2 rounded-full',
          getConfidenceColor(getFieldConfidence(currentReceipt?.tax_type, currentReceipt?.ai_confidence))
        )} />
      </TooltipTrigger>
      <TooltipContent>
        {currentReceipt?.tax_type ? 'Von KI erkannt' : 'Nicht erkannt'}
      </TooltipContent>
    </Tooltip>
  </div>
  <Select ...>
```

Wenn `tax_type` leer/null ist → grauer Dot ("Nicht erkannt"). Wenn AI einen Wert gesetzt hat → farbiger Dot basierend auf `ai_confidence`.

### 2. `src/components/receipts/ReceiptDetailPanel.tsx` — Buchungsart in LearnableField wrappen

**Zeilen 1487-1502**: Das Buchungsart-Dropdown wird analog zum Kategorie-Feld (Zeilen 1466-1485) in eine `LearnableField`-Komponente gewrappt. Das zeigt automatisch "Gelernt"/"Geändert"-Badges und den Reset-Button:

```tsx
<LearnableField
  fieldName="tax_type"
  label="Buchungsart"
  value={taxType}
  originalValue={originalReceipt?.tax_type}
  vendorLearning={vendorLearning}
  onReset={() => setTaxType(originalReceipt?.tax_type || '')}
>
  <Select value={taxType} onValueChange={setTaxType}>
    ...
  </Select>
</LearnableField>
```

### Dateien
- `src/pages/Review.tsx` — Confidence-Dot bei Buchungsart-Label
- `src/components/receipts/ReceiptDetailPanel.tsx` — LearnableField-Wrapper für Buchungsart

