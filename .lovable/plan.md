

## Plan: Einnahmen-Ansicht Fix und FeatureGate-Vorschau

### Problem
1. **Daten-Query blockiert**: Die Invoices-Query hat `enabled: ... && showIncome` (Zeile 191). Wenn `usePlan()` initial noch `loading` ist, wird `effectivePlan` auf `'free'` gesetzt, `showIncome` ist `false`, und die Query wird nie aktiviert. Selbst nach Plan-Update kann es zu Race Conditions kommen.
2. **Vorschau fehlt**: Für Nicht-Business-Nutzer sollte die FeatureGate eine echte Vorschau (mit echten Daten, aber nicht interaktiv) zeigen. Aktuell werden die Daten gar nicht geladen wenn `showIncome = false`.

### Lösung in `src/pages/Reports.tsx`

1. **`showIncome`-Gate von der Query entfernen**: Die Invoices-Query soll IMMER Daten laden (unabhängig vom Plan). So kann die FeatureGate-Vorschau echte Daten anzeigen.
   - Zeile 191: `enabled: !!user && !!dateRange.from && !!dateRange.to` (ohne `&& showIncome`)

2. **FeatureGate bleibt**: Der FeatureGate-Wrapper um den Income-Content (Zeile 2021) bleibt bestehen. Für Business-Nutzer wird er transparent durchgereicht, für andere zeigt er die verschwommene Vorschau mit Upgrade-Overlay.

3. **`incomeStats`-Memo**: Ebenfalls die `showIncome`-Abhängigkeit entfernen, damit die Daten immer berechnet werden (für die Vorschau).

### Betroffene Änderungen
- Zeile 191: `showIncome` aus `enabled` entfernen
- Ggf. `showIncome`-Variable komplett entfernen (wird nicht mehr benötigt, da FeatureGate die Gating-Logik übernimmt)
- Die Vorjahres-Invoices-Query ebenfalls von `showIncome` befreien (falls vorhanden)

