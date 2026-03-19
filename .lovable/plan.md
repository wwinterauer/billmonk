

## Plan: Einnahmen-Abschnitte immer anzeigen + fehlende Sektionen ergänzen

### Problem
Die meisten Einnahmen-Sektionen sind in `{condition.length > 0 && (...)}` gewrappt und werden bei leeren Daten komplett ausgeblendet. Die Ausgaben-Seite zeigt dagegen immer alle Abschnitte mit "Keine Daten"-Hinweis.

### Fehlende Sektionen
1. **Trend-Indikatoren** (Höchste/Niedrigste Einnahmen + Monatsdurchschnitt) -- analog zu Zeilen 1826-1886
2. **USt-Hinweisbox** (blauer Info-Kasten unter der USt-Tabelle) -- analog zu Zeilen 1684-1700

### Zu ändernde Conditional Renders (immer anzeigen, mit Empty State)
- Zeile 2122: `{incomeStats.byCategory.length > 0 && (` -- Kategorie Pie+Bar
- Zeile 2182: `{incomeStats.byCategory.length > 0 && (` -- Kategorie Detail-Tabelle
- Zeile 2294: `{incomeStats.byVatRate.length > 0 && (` -- USt-Übersicht
- Zeile 2340: `{incomeStats.timeSeries.length > 0 && (` -- Zeitverlauf
- Zeile 2402: `{incomeStats.byCustomer.length > 0 && (` -- Top 10 Kunden

### Umsetzung in `src/pages/Reports.tsx`

1. **Alle `length > 0` Guards entfernen** und durch Empty-State-Pattern ersetzen (wie bei Ausgaben: immer Card rendern, bei leeren Daten "Keine Daten für den gewählten Zeitraum")

2. **Trend-Indikatoren einfügen** nach dem Zeitverlauf-Chart:
   - "Höchste Einnahmen" (Monat + Betrag, grün)
   - "Niedrigste Einnahmen" (Monat + Betrag)
   - "Monatsdurchschnitt" (Durchschnitt aus `incomeStats.timeSeries`)

3. **USt-Hinweisbox** nach der USt-Tabelle einfügen:
   - Blauer Info-Kasten: "Die Umsatzsteuer von **€X** muss in der UVA für den Zeitraum ... abgeführt werden."

### Datei
- `src/pages/Reports.tsx`

