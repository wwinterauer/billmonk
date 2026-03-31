

# BUGFIX: payment_method aus A/B-Test Schema entfernen

## Änderungen

### `supabase/functions/run-ab-test/index.ts`

1. **Zeile 47 entfernen**: `payment_method: { type: "string" as const },` aus `properties`
2. **Zeile 78**: `"payment_method"` aus dem `required`-Array entfernen

Das bringt das Schema in Einklang mit `extract-receipt/index.ts`.

