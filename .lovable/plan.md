

## Plan: "Keine Kreditkarte" Texte korrigieren

### Problem
In Hero und CTA steht "Keine Kreditkarte nötig" — das stimmt nur für den Free-Plan. Bezahlte Pläne (auch Trials) erfordern eine Kreditkarte.

### Änderungen

**`src/components/landing/Hero.tsx`** (Zeile 49)
- "Keine Kreditkarte nötig" → "30 Tage kostenlos testen"

**`src/components/landing/CTA.tsx`** (Zeile 33)
- "Keine Kreditkarte" → "30 Tage kostenlos testen"

Beide Aussagen bleiben korrekt und werbewirksam, ohne falsche Versprechen.

