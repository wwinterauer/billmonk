

# Feature-Listen synchronisieren

## Änderungen

### 1. `src/components/landing/Pricing.tsx` — Feature-Listen aktualisieren
- **Starter**: "Bank-Import (CSV)" hinzufügen
- **Business**: "250 Dokumente/Monat" ergänzen, redundante "Live-Bankanbindung" entfernen (bereits in "Alles aus Pro")

### 2. `src/components/settings/SubscriptionSettings.tsx` — UPGRADE_PLANS aktualisieren
- **Starter**: "Bank-Import (CSV)" hinzufügen
- **Pro**: "Priority Support" entfernen, "Live-Bankanbindung (1 Konto)" präzisieren
- **Business**: "Dedicated Support" entfernen, "250 Dokumente/Monat" und "Angebote, AB & Lieferscheine" hinzufügen

### Finale Feature-Listen (beide Dateien konsistent)

| Free | Starter | Pro | Business |
|------|---------|-----|----------|
| 10 Belege/Monat | 30 Belege/Monat | 100 Belege/Monat | 250 Belege/Monat |
| KI-Erkennung | Kontoabgleich | Alles aus Starter | 250 Dokumente/Monat |
| Beleg-Umbenennung | Bank-Import (CSV) | Cloud-Backup | Alles aus Pro |
| E-Mail Support | E-Mail Import | Live-Bankanbindung (1 Konto) | Rechnungsmodul |
| | Rollover-Guthaben | | Angebote, AB & Lieferscheine |
| | | | DATEV/BMD Export |

### Betroffene Dateien
- `src/components/landing/Pricing.tsx`
- `src/components/settings/SubscriptionSettings.tsx`

