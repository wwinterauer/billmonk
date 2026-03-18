

## Plan: Berichte mit Einnahmen/Ausgaben-Umschalter

### Konzept
Statt den Einnahmen-Bereich am Ende der Seite anzuhängen, wird oben neben der Zeitraum-Auswahl ein Toggle "Ausgaben / Einnahmen" eingefügt. Je nach Auswahl werden die gleichen Analyse-Abschnitte gezeigt, aber mit den jeweiligen Daten befüllt.

### Struktur

```text
┌─────────────────────────────────────────┐
│ Berichte & Auswertungen    [Export] [🖨] │
│                                         │
│ [Ausgaben] [Einnahmen🔒]   Zeitraum: .. │
│                                         │
│ ── Bei "Ausgaben" (wie bisher): ──      │
│ KPI-Cards, Kategorie-Pie/Bar,           │
│ Kategorie-Tabelle, Tags, MwSt,         │
│ Zeitverlauf, Lieferanten                │
│                                         │
│ ── Bei "Einnahmen" (FeatureGate): ──    │
│ KPI-Cards (Einnahmen, Netto, USt,       │
│   Offene RE, Gewinn/Verlust)            │
│ Einnahmen nach Kategorie (Pie + Bar)    │
│ Top Kategorien                          │
│ Einnahmen nach Tags                     │
│ Einnahmen nach Kunde                    │
│ Zeitverlauf                             │
└─────────────────────────────────────────┘
```

### Technische Umsetzung

1. **Neuer State**: `viewMode: 'expenses' | 'income'` (default `'expenses'`)

2. **Toggle-UI**: Zwei Buttons oder `Tabs` direkt unter dem Header. Der "Einnahmen"-Button zeigt ein Lock-Icon wenn Plan < Business. Beim Klick auf "Einnahmen" wird der gesamte Content-Bereich in `FeatureGate` gewrappt.

3. **Invoices-Query erweitern**: Tags laden via `invoice_tags(tag:tags(id, name, color))`, damit Tag-Analyse möglich wird.

4. **Einnahmen-Daten berechnen** (analog zu Ausgaben):
   - `incomeCategoryData`: Pie + Bar + Tabelle nach Kategorie (mit Farben aus `categories`)
   - `incomeTagData`: Tag-Tabelle analog zu `tagData`
   - `incomeTimeSeriesData`: Zeitverlauf nach Monat
   - `incomeByCustomer`: Bar-Chart Top Kunden (bereits vorhanden)
   - KPIs: Gesamteinnahmen, Netto, USt, Offene RE, Gewinn/Verlust

5. **Rendering**: `{viewMode === 'expenses' ? <AusgabenContent /> : <FeatureGate feature="invoiceModule"><EinnahmenContent /></FeatureGate>}`

6. **Einnahmen-Abschnitte** (spiegeln Ausgaben):
   - KPI-Cards (5 Stück: Gesamteinnahmen, Netto, USt, Offene RE, Gewinn/Verlust)
   - Einnahmen nach Kategorie (Pie-Chart + Horizontal-Bar)
   - Kategorie-Detail-Tabelle
   - Einnahmen nach Tags (Tabelle)
   - Einnahmen nach Kunde (Bar-Chart + Tabelle)
   - Zeitverlauf (Line-Chart)

7. **Export anpassen**: Export-Funktionen (PDF/Excel/CSV) sollen je nach `viewMode` die richtigen Daten exportieren.

### Betroffene Datei
- `src/pages/Reports.tsx` — Refactoring der bestehenden ~1990 Zeilen, altes `FeatureGate`-Section am Ende entfernen, durch den neuen Toggle-Ansatz ersetzen.

