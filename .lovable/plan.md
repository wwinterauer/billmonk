

# Aktualisierter Gesamtplan: Splitbuchungen

## Zwei zentrale Ergänzungen

### 1. Vollständige Unsichtbarkeit wenn deaktiviert

Wenn `profiles.split_booking_enabled = false` (oder User nicht im Business-Plan), wird nirgends ein Split-Button, Split-Badge, Split-Spalte oder Split-Hinweis angezeigt. Das betrifft:

| Bereich | Verhalten wenn deaktiviert |
|---|---|
| `Review.tsx` | Kein "Aufteilen"-Button neben Kategorie |
| `ReceiptDetailPanel.tsx` | Kein Split-Editor, keine Split-Anzeige |
| `Expenses.tsx` | Keine "N Positionen"-Badges, keine expandierbaren Split-Zeilen |
| `Dashboard.tsx` / `Reports.tsx` | Normale Aggregation über Hauptbeleg |
| Export-Vorlagen | Keine Split-spezifischen Spalten sichtbar |
| Settings | Toggle nur sichtbar wenn Business-Plan (via FeatureGate) |

**Technisch**: Der `usePlan`-Hook liefert bereits `effectivePlan`. Zusätzlich wird `profiles.split_booking_enabled` im Hook oder separat geladen. Alle Split-UI-Elemente werden mit `{splitBookingEnabled && (...)}` gewrapped.

### 2. Export-Vorlagen mit Split-Unterstützung

Wenn Splitbuchung aktiviert ist, werden in den Export-Vorlagen zusätzliche Optionen verfügbar:

**Neue verfügbare Spalten** (nur sichtbar wenn Feature aktiv):

| Feld | Label | Typ |
|---|---|---|
| `split_position` | Split-Position | number |
| `split_description` | Positions-Beschreibung | text |
| `split_category` | Positions-Kategorie | text |
| `split_amount_gross` | Positions-Brutto | currency |
| `split_amount_net` | Positions-Netto | currency |
| `split_vat_rate` | Positions-MwSt-Satz | percent |
| `split_vat_amount` | Positions-MwSt-Betrag | currency |
| `split_is_private` | Privatanteil | text |

**Neue Export-Option** (Checkbox in ExportFormatDialog):
- "Splitbuchungen aufteilen" — wenn aktiv, erzeugt Split-Belege N Zeilen statt einer. Wenn inaktiv, wird wie bisher nur die Hauptzeile exportiert (Gesamtbeträge).

**Betroffene Dateien**:

| Datei | Änderung |
|---|---|
| `useExportTemplates.ts` | `DEFAULT_COLUMNS` um Split-Felder erweitern (conditional), `FIELD_TYPES` ergänzen |
| `ExportTemplateSettings.tsx` | Split-Spalten nur anzeigen wenn Feature aktiv |
| `ExportFormatDialog.tsx` | Checkbox "Splitbuchungen aufteilen", Export-Logik für Split-Zeilen |
| `ExportTemplateEditor.tsx` | Split-Spalten conditional anzeigen |
| `taxExportFormats.ts` | `receiptToRow` → bei Split-Belegen N Rows generieren |
| `useExportPreview.ts` | Preview berücksichtigt Split-Lines |

## Aktualisierte Phasen-Übersicht

### Phase 1: Datenmodell + Feature-Toggle + Plan-Gating
- DB: `receipt_split_lines` Tabelle + RLS
- DB: `receipts.is_split_booking` boolean
- DB: `profiles.split_booking_enabled` boolean
- `planConfig.ts`: `splitBooking: 'business'`
- `usePlan.ts`: `split_booking_enabled` mitlesen und exponieren
- Settings: Toggle unter FeatureGate

### Phase 2: Split-Editor UI
- `SplitBookingEditor.tsx` (Brutto/Netto editierbar, bidirektional)
- Integration in `Review.tsx` + `ReceiptDetailPanel.tsx`
- Alles hinter `splitBookingEnabled`-Check

### Phase 3: Ausgaben, Dashboard, Reports
- Split-Badges und expandierbare Zeilen (nur wenn aktiviert)
- Kategorie-Aggregation über Split-Lines

### Phase 4: Export-Vorlagen + Steuerexport
- Split-Spalten in Vorlagen-Editor (conditional)
- Checkbox "Splitbuchungen aufteilen" in Export-Dialog
- DATEV/BMD: N Buchungszeilen pro Split-Beleg
- CSV/Excel: Split-Zeilen mit Positionsnummer

### Phase 5: KI-Integration
- Kategorie-Vorschläge pro Rechnungsposition

**Soll ich mit Phase 1 starten?**

