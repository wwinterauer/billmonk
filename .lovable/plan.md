

# Plan: Split-Buchungen um tax_type, payment_method und Vendor-Learning erweitern

## 1. DB-Migration

```sql
ALTER TABLE public.receipt_split_lines 
  ADD COLUMN IF NOT EXISTS tax_type text DEFAULT null,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT null;
```

## 2. SplitBookingEditor.tsx — Interface & Logik

**SplitLine Interface erweitern:**
- `tax_type: string` und `payment_method: string` hinzufügen

**Props erweitern:**
- `vendorId?: string | null` — für Vendor-Defaults und Learning

**Neue Imports:**
- `TAX_TYPES` aus `@/lib/constants`
- `useVendorFieldDefaults` aus `@/hooks/useVendorFieldDefaults`
- `PAYMENT_METHODS` als lokale Konstante (gleich wie in Review.tsx)

**createEmptyLine:** tax_type und payment_method mit `''` initialisieren

**Laden bestehender Lines:** `tax_type` und `payment_method` aus DB mappen

**Speichern:** `tax_type` und `payment_method` in Insert-Objekt aufnehmen

**AI-Vorschläge (handleLoadAiSuggestions):** `tax_type` aus `item.tax_type` mappen falls vorhanden

**Vendor-Defaults beim Aktivieren:** Wenn `vendorId` vorhanden, `getFieldDefaults()` aufrufen und `payment_method`, `tax_type`, `category` als Defaults für neue Lines vorausfüllen

**Vendor-Learning beim Speichern:** Für jede Line `trackFieldChange` aufrufen wenn `category`, `tax_type`, `payment_method` oder `vat_rate` (als `tax_rate`) gesetzt sind

## 3. UI pro Split-Zeile

Zwischen Beschreibung und Brutto-Zeile eine neue Zeile mit 3 Dropdowns einfügen:

```
[Kategorie ▼]  [Buchungsart ▼]  [Zahlungsart ▼]
```

- **Kategorie**: Bestehend, Placeholder "Nicht zugeordnet", Leer-Option hinzufügen
- **Buchungsart**: `TAX_TYPES` aus constants, Placeholder "Offen", Leer-Option
- **Zahlungsart**: `PAYMENT_METHODS`, Placeholder "Keine", Leer-Option, kein AI-Vorschlag

Grid-Layout: `grid-cols-3` für die 3 Selects.

## 4. useSplitLines.ts — Interface anpassen

`tax_type` und `payment_method` zum `SplitLine` Interface hinzufügen.

## 5. Aufrufer anpassen

**Review.tsx & ReceiptDetailPanel.tsx:** `vendorId` als Prop an `SplitBookingEditor` übergeben (bereits verfügbar aus dem Receipt/Vendor-State).

## Technische Details

- `PAYMENT_METHODS` wird als shared Konstante in `constants.ts` verschoben (wird in Review.tsx, ReceiptDetailPanel.tsx und SplitBookingEditor.tsx verwendet)
- Vendor-Learning: `trackFieldChange` wird pro Line und pro geändertem Feld aufgerufen — identisches Verhalten wie beim Hauptbeleg
- Keine Änderung an der extract-receipt Edge Function nötig — `line_items_raw` kann optional `tax_type` enthalten

