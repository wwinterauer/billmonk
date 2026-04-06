

# Pricing-Texte & Buttons anpassen

## Änderungen

### 1. `src/components/landing/Pricing.tsx`
- **Label im Formular**: "Welchen Plan möchtest du nutzen?" → "Für welchen Plan würdest du dich interessieren?"
- **CTA-Buttons ausgegraut**: Alle "30 Tage gratis testen"-Buttons werden `disabled` mit Tooltip/Hinweis "Derzeit nur über Beta-Bewerbung verfügbar"
- **Free-Plan Button**: "Kostenlos starten" ebenfalls disabled mit gleichem Hinweis
- **Checkout-Logik bleibt** im Code, wird aber nicht mehr ausgelöst (Buttons disabled)
- Unter den disabled Buttons statt "danach €X/Monat..." → "Zugang über Beta-Bewerbung"

### 2. `src/pages/Beta.tsx` (Zeile 306)
- Label ändern: "Welchen Plan möchtest du nutzen?" → "Für welchen Plan würdest du dich interessieren?"

### Dateien
| Datei | Änderung |
|-------|----------|
| `src/components/landing/Pricing.tsx` | Buttons disabled + Hinweistext, kein Checkout |
| `src/pages/Beta.tsx` | Label-Text anpassen |

