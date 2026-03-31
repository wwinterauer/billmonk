

# Plan: Dynamischer `useVatRates` Hook

## Übersicht
Neuer Hook `src/hooks/useVatRates.ts`, der DACH-Steuersätze nach User-Land sortiert, aus bestehenden Belegen weitere Sätze erkennt und 0%/Gemischt anhängt. Ersetzt die hardcodierten `VAT_RATE_GROUPS`/`VAT_RATES` in 3 Dateien.

## Neuer Hook: `src/hooks/useVatRates.ts`

**Rückgabewerte:**
- `vatRateGroups`: Gruppierte Sätze für Select-Dropdowns mit `<SelectGroup>`/`<SelectLabel>`
- `vatRates`: Flache Liste aller Sätze (Abwärtskompatibilität)
- `loading`: Boolean

**Logik:**
1. User-Land aus `profiles.country` laden (Default: `'AT'`)
2. DACH-Gruppen definieren (AT, DE, CH) — User-Land als erste Gruppe sortieren
3. Alle einzigartigen `tax_rate`-Werte aus `receipts` des Users laden (Status approved/completed, nicht null/unknown/mixed)
4. Sätze filtern die nicht in DACH enthalten sind → als Gruppe "Weitere erkannte Sätze" hinzufügen
5. Abschluss-Gruppe "Sonstige" mit `0% (Steuerfrei)` und `Gemischt (mehrere)` anhängen
6. Query via `useQuery` mit `staleTime: 5min`

**Typen:**
```typescript
interface VatRate { value: string; label: string }
interface VatRateGroup { label: string; rates: VatRate[] }
```

## Änderungen in bestehenden Dateien

### `src/pages/Review.tsx`
- Hardcodierte `VAT_RATE_GROUPS` (Z. 84-117) und `VAT_RATES` (Z. 120) entfernen
- `const { vatRateGroups, vatRates } = useVatRates()` im Component verwenden
- `VAT_RATE_GROUPS` Referenzen (Z. 1271) durch `vatRateGroups` ersetzen
- `VAT_RATES` Referenzen durch `vatRates` ersetzen

### `src/components/receipts/ReceiptDetailPanel.tsx`
- Hardcodierte `VAT_RATE_GROUPS` (Z. 108-141) und `VAT_RATES` (Z. 144) entfernen
- `const { vatRateGroups, vatRates } = useVatRates()` verwenden
- Referenzen (Z. 1572) entsprechend ersetzen

### `src/components/receipts/SplitBookingEditor.tsx`
- Hardcodierte `VAT_RATES` (Z. 21-28) entfernen
- `const { vatRates } = useVatRates()` verwenden (nutzt nur die flache Liste, keine Gruppen)
- Select-Rendering (Z. 393) bleibt gleich, nur Variable umbenannt

## Technische Details
- Keine DB-Migration nötig — `profiles.country` und `receipts.tax_rate` existieren bereits
- React Query für Caching der Receipt-Sätze
- `useAuth()` für User-ID
- Fallback auf `'AT'` wenn kein Land im Profil gesetzt

