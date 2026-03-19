

## PDF-Edge-Function Update: Lieferschein, Rabatt, Lieferzeiten, Teilrechnungen

### Übersicht

Die `generate-invoice-pdf/index.ts` wird erweitert um vier fehlende Aspekte: (1) Lieferschein-Layout ohne Preise/MwSt, (2) Rabatt-Zeile im Summenblock, (3) Lieferzeiten-Anzeige, (4) Teilrechnungs-Hinweise.

### Aktuelle Lücken

- `docTitleMap` fehlt `delivery_note: "Lieferschein"`
- Preisspalten werden immer gerendert, auch bei Lieferscheinen
- Kein Rabatt (`rabatt_percent`) im Summenblock
- Lieferzeiten (`delivery_time` auf Beleg- und Positionsebene) werden ignoriert
- Kein Hinweis auf `invoice_subtype` (Anzahlung/Teil/Schlussrechnung)
- Keine Referenz auf verknüpfte AB (`related_order_id`)

### Änderungen in einer Datei

**`supabase/functions/generate-invoice-pdf/index.ts`**

1. **Document Title Map** (Zeile ~97-103)
   - `delivery_note: "Lieferschein"` hinzufügen
   - Subtype-Titel: `deposit` → "Anzahlungsrechnung", `partial` → "Teilrechnung", `final` → "Schlussrechnung"

2. **Lieferschein-Modus** (neue Variable ~Zeile 94)
   - `const isDeliveryNote = documentType === 'delivery_note'`
   - Bei Lieferschein: `showVat = false`, Preisspalten (`Preis`, `MwSt`, `Netto`) ausblenden
   - Spalten-Layout anpassen: nur Pos, Beschreibung, Menge, Einheit + optional Lieferzeit

3. **Positions-Rendering** (Zeile ~292-353)
   - Bei `isDeliveryNote`: kein `unit_price`, kein `vat_rate`, kein `lineNet` rendern
   - Lieferzeit pro Position anzeigen (wenn vorhanden)

4. **Lieferzeit auf Belegebene** (nach Meta-Block ~Zeile 242)
   - Wenn `invoice.delivery_time` vorhanden und Typ = quote/order_confirmation/delivery_note: "Lieferzeit: ..." anzeigen

5. **Summenblock** (Zeile ~369-403)
   - Bei `isDeliveryNote`: gesamten Summenblock überspringen (keine Preise)
   - Rabatt-Zeile einfügen: wenn `invoice.rabatt_percent > 0`:
     ```
     Netto:            € X.XXX,XX
     Rabatt X%:       −€ XXX,XX
     Netto nach Rabatt: € X.XXX,XX
     MwSt ...
     ```
   - Berechnung: `rabattAmount = subtotal * rabatt_percent / 100`, MwSt auf reduziertes Netto

6. **Teilrechnungs-Hinweis** (nach Dokumenttitel ~Zeile 229)
   - Wenn `invoice.invoice_subtype` != 'normal': Subtype als Untertitel
   - Wenn `invoice.related_order_id`: AB-Nummer laden und "Zu Auftrag: AB-XXXX" anzeigen

7. **Bankverbindung bei Lieferschein** (Zeile ~419-428)
   - Bei `isDeliveryNote`: Bankverbindung überspringen

### Technische Details

- Für `related_order_id` wird ein zusätzlicher Supabase-Query benötigt um die AB-Nummer zu laden
- Die Rabatt-Berechnung folgt: Netto → Rabatt abziehen → MwSt auf reduziertes Netto
- Lieferzeit-Spalte bei Lieferschein nutzt den freigewordenen Platz der Preisspalten

