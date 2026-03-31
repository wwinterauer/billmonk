

# Plan: Vendor-Kontext im A/B-Test + payment_method entfernen

## Übersicht

Zwei Änderungen: (1) Vendor-spezifische Extraktions-Einstellungen (Keywords + Freitext-Hint) in den A/B-Test injizieren. (2) `payment_method` aus Vergleich und UI entfernen.

## 1. Edge Function `run-ab-test/index.ts`

**payment_method entfernen:**
- `COMPARISON_FIELDS` (Z. 84-86): `"payment_method"` aus Array streichen → 6 Felder

**`buildExpensesOnlyPrompt` als lokale Funktion duplizieren** (aus `extract-receipt`, ~40 Zeilen, inkl. Keywords + Hint-Block)

**Vendor-Kontext in `processBatch` laden (Z. 168-169):**
- Receipt-Query erweitern: `.select("file_url, file_type, file_name, user_id, vendor_id")`
- Wenn `vendor_id` vorhanden: Query auf `vendors` für `expenses_only_extraction, extraction_keywords, extraction_hint`
- Wenn `expenses_only_extraction === true`: `buildExpensesOnlyPrompt(keywords, hint)` aufrufen
- Den Expenses-Only-Block an **beide** User-Prompts (V1 Z. 204, V2 Z. 233) anhängen

## 2. Frontend `ABTestManager.tsx`

**payment_method entfernen aus:**
- `FIELD_LABELS` Map (Z. 38)
- `V1_FIELD_MAP` (Z. 48)
- `V2_FIELD_MAP` (Z. 58)
- Receipt-Select-Query (Z. 140): `payment_method` weglassen
- `original_data` beim Erstellen (Z. 173): `payment_method` Zeile entfernen

## Technische Details

- `buildExpensesOnlyPrompt` wird dupliziert (Edge Functions können nicht cross-importieren)
- Beide Prompt-Versionen erhalten identischen Vendor-Kontext → fairer Test
- Bestehende Testergebnisse bleiben, neue Runs nutzen 6-Feld-Vergleich
- `extraction_hint` (Freitext) wird als `LIEFERANTEN-HINWEIS: ...` an den Prompt angehängt — identisch zur Produktion

