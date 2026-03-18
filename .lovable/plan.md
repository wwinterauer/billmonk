

## Plan: Fehlende Einnahmen-Abschnitte ergänzen

### Ist-Zustand
Die Einnahmen-Ansicht hat bereits: KPI-Cards, Kategorie (Pie + Bar + Detail-Tabelle), Tags, Kunden (Top 10 Bar + Tabelle), Zeitverlauf.

### Fehlend gegenüber Ausgaben
1. **USt-Übersicht** (Ausgaben hat "Vorsteuer-Übersicht" nach MwSt-Satz) -- Einnahmen braucht eine "Umsatzsteuer-Übersicht" gruppiert nach Steuersatz
2. **Monatsvergleich** (aktuelles Jahr vs. Vorjahr als BarChart) -- fehlt komplett bei Einnahmen
3. **Alle Kunden** durchsuchbar (analog zu "Alle Lieferanten" mit Suchfeld) -- aktuell zeigt die Kunden-Tabelle alle, aber ohne Suchfeld

### Umsetzung in `src/pages/Reports.tsx`

1. **`incomeStats` erweitern**: 
   - `byVatRate` Map berechnen (gruppiert nach `vat_rate` aus invoice line items -- da invoices nur `vat_total` haben, nutzen wir stattdessen die Gesamtwerte und schätzen anhand der Kategorie; alternativ einfacher: wir gruppieren nach dem Verhältnis `vat_total/subtotal` pro Rechnung als effektiven Steuersatz)
   - Da wir keine Line-Items in der Query haben, berechnen wir den effektiven USt-Satz pro Rechnung: `Math.round((vat_total / subtotal) * 100)` und gruppieren danach
   - Vorjahres-Einnahmen via separatem Query laden (analog zu `previousReceipts`)

2. **Vorjahres-Invoice-Query**: Neuer `useQuery` für `previous-invoices` mit dem `previousPeriodRange`

3. **Neue Abschnitte rendern** (nach Tags, vor Kunden):
   - **Umsatzsteuer-Übersicht**: Tabelle mit Spalten: Steuersatz, Netto, USt, Brutto, Anzahl (analog zur Vorsteuer-Übersicht bei Ausgaben)
   - **Einnahmen-Monatsvergleich**: BarChart mit aktuellem vs. Vorjahr (analog zum Ausgaben-Monatsvergleich)
   - **Kunden-Suchfeld**: `vendorSearch`-äquivalent (`customerSearch` State) + Filter auf die Kunden-Tabelle

### Reihenfolge der Einnahmen-Abschnitte (nach Änderung)
1. KPI-Cards
2. Kategorie Pie + Bar
3. Kategorie Detail-Tabelle
4. Tags-Tabelle
5. **Umsatzsteuer-Übersicht** (NEU)
6. Zeitverlauf
7. **Monatsvergleich** (NEU)
8. Top 10 Kunden (Bar)
9. **Alle Kunden** mit Suchfeld (ERWEITERT)

