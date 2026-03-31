

# Plan: Kategorie vs. Buchungsart (tax_type) Trennung

## Übersicht

Neues Feld `tax_type` (steuerliche Einordnung) zur `receipts`-Tabelle hinzufügen, von der bestehenden `category` (persönliche Organisation) trennen. AI-Extraktion wird um `tax_type` erweitert. UI in Review, ReceiptDetailPanel und Expenses wird angepasst.

## 1. DB-Migration

```sql
ALTER TABLE public.receipts ADD COLUMN tax_type text DEFAULT null;
```

## 2. Edge Function `extract-receipt/index.ts`

**Schema erweitern:**
- `tax_type: { type: "string" as const }` zum `extractionSchema.properties` hinzufügen
- `tax_type` NICHT in die `required`-Liste aufnehmen
- `category` aus der `required`-Liste entfernen

**Prompt erweitern** (nach KATEGORIE-Block):
```
BUCHUNGSART (tax_type): Steuerliche Einordnung nach DACH-Steuerrecht.
Mögliche Werte: Betriebsausgabe, GWG bis 1.000€, Bewirtung 50%, Bewirtung 100%, Vorsteuer abzugsfähig, Reisekosten, Kfz-Kosten, Repräsentation, Abschreibung, Sonstige.
Regeln: Gerät/Hardware >1.000€ netto → Abschreibung. Gerät ≤1.000€ → GWG bis 1.000€. Restaurant → Bewirtung 50%. Nur wenn eindeutig erkennbar, sonst "".
```

**mapSchemaToResult:** `tax_type` aus raw mappen (→ `null` wenn leer)

**DB-Update:** `tax_type: extractedData.tax_type || null` in den Update-Block aufnehmen

## 3. Frontend — Review.tsx

**FormData erweitern:**
- `tax_type: string` hinzufügen (default `''`)
- `populateForm`: `tax_type` aus Receipt laden
- `saveReceipt`: `tax_type` in `updateData` aufnehmen
- `trackFieldChange` für `tax_type` hinzufügen

**UI:** Neues Select-Feld "Buchungsart" zwischen Kategorie und Split-Booking einfügen mit den definierten Optionen und Placeholder "Offen".

## 4. Frontend — ReceiptDetailPanel.tsx

- Neuer State `taxType` + `setTaxType`
- Laden aus Receipt-Daten, Speichern in Update-Objekt
- UI: Select-Feld "Buchungsart" nach Kategorie einfügen
- Kategorie-Placeholder von "Kategorie wählen" auf "Nicht zugeordnet" ändern

## 5. Frontend — Expenses.tsx

- `tax_type` als optionale Spalte in `COLUMN_CONFIG` aufnehmen (`defaultVisible: false`)
- Badge-Darstellung in der Tabelle
- Optional: Filter für Buchungsart

## 6. Konstanten

Neue Konstante `TAX_TYPES` in `src/lib/constants.ts`:
```ts
export const TAX_TYPES = [
  { value: 'Betriebsausgabe', label: 'Betriebsausgabe' },
  { value: 'GWG bis 1.000€', label: 'GWG bis 1.000€' },
  { value: 'Bewirtung 50%', label: 'Bewirtung 50% abzugsfähig' },
  { value: 'Bewirtung 100%', label: 'Bewirtung 100% abzugsfähig' },
  { value: 'Vorsteuer abzugsfähig', label: 'Vorsteuer abzugsfähig' },
  { value: 'Reisekosten', label: 'Reisekosten' },
  { value: 'Kfz-Kosten', label: 'Kfz-Kosten' },
  { value: 'Repräsentation', label: 'Repräsentation nicht abzugsfähig' },
  { value: 'Abschreibung', label: 'Abschreibung' },
  { value: 'Sonstige', label: 'Sonstige' },
];
```

## 7. Vendor Field Defaults

`tax_type` ist bereits in `TRACKED_FIELDS` und `FieldDefaultSuggestion` enthalten — funktioniert automatisch mit dem neuen Feld.

## Technische Details

- Keine Breaking Changes — `tax_type` ist nullable, bestehende Belege haben `null`
- `category` bleibt unverändert für persönliche Organisation
- AI kann `tax_type` optional vorschlagen, User kann es überschreiben
- Reports/Exports: `tax_type` wird vorerst nicht in Reports eingebaut (kann als Folgeschritt ergänzt werden)

