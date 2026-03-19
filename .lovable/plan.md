


## ✅ Business-Preis + DATEV/BMD Steuerberater-Export (umgesetzt)

### Änderungen

1. **Business-Plan Preis angehoben**: €9,99 → €14,99/Monat, €95,90 → €143,90/Jahr
2. **Pricing-Seite aktualisiert**: Neue Features "Angebote, AB & Lieferscheine" und "DATEV/BMD Export" hinzugefügt
3. **DATEV-Export**: Vollständiger Buchungsstapel (EXTF) mit Header, BU-Schlüssel-Mapping, Semikolon-CSV, UTF-8 BOM
4. **BMD NTCS Export**: Fleximport-CSV mit ER/AR Buchungssymbolen und Steuercodes
5. **TaxExportDialog**: Konfigurierbar (Berater-Nr, Mandanten-Nr, SK-Länge, Konten, Zeitraum), Settings persistent in localStorage
6. **Integration**: Steuerberater-Export in Ausgaben, Rechnungen und Berichte-Seiten eingebaut
7. **Feature-Gate**: `taxExport` als Business-Feature registriert

### Betroffene Dateien
- `src/lib/planConfig.ts` — Preis + Feature-Gate
- `src/lib/taxExportFormats.ts` — DATEV/BMD Export-Logik (NEU)
- `src/components/exports/TaxExportDialog.tsx` — Dialog-Komponente (NEU)
- `src/components/landing/Pricing.tsx` — Feature-Liste
- `src/pages/Expenses.tsx` — Export-Menü erweitert
- `src/pages/Invoices.tsx` — Export-Button hinzugefügt
- `src/pages/Reports.tsx` — Export-Menü erweitert

### Hinweis
Stripe-Preise müssen im Stripe-Dashboard separat angepasst werden.
