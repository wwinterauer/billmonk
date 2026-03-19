

## Erweiterter Dokumenten-Workflow mit Lieferschein, Teilzahlungen und kaskadierenden Konditionen

### Übersicht

Erweiterung des bestehenden Belegsystems um den vollständigen Workflow (Angebot → AB → Lieferschein → Rechnung), Anzahlungs-/Teilzahlungsrechnungen und kaskadierende Rabatt-/Skonto-/Zahlungsziel-Logik.

### 1. Datenbank-Migrationen

**Migration 1: Kunden-Konditionen + Firmen-Defaults + Lieferzeiten + Nummernkreise**
```sql
-- Kunden: Rabatt, Skonto, Zahlungsziel
ALTER TABLE customers ADD COLUMN default_discount_percent numeric DEFAULT 0;
ALTER TABLE customers ADD COLUMN default_skonto_percent numeric DEFAULT 0;
ALTER TABLE customers ADD COLUMN default_skonto_days integer DEFAULT 0;

-- Firmen-Standard-Rabatt + AB/LS-Präfixe
ALTER TABLE invoice_settings ADD COLUMN default_rabatt_percent numeric DEFAULT 0;
ALTER TABLE invoice_settings ADD COLUMN order_confirmation_prefix text DEFAULT 'AB';
ALTER TABLE invoice_settings ADD COLUMN delivery_note_prefix text DEFAULT 'LS';

-- Lieferzeiten (Freitext)
ALTER TABLE invoices ADD COLUMN delivery_time text;
ALTER TABLE invoices ADD COLUMN rabatt_percent numeric DEFAULT 0;
ALTER TABLE invoice_line_items ADD COLUMN delivery_time text;
ALTER TABLE invoice_items ADD COLUMN default_delivery_time text;
```

**Migration 2: Teilzahlungen**
```sql
-- Rechnungsart (normal, Anzahlung, Teilzahlung, Schlussrechnung)
ALTER TABLE invoices ADD COLUMN invoice_subtype text DEFAULT 'normal';
-- Verknüpfung zu übergeordnetem Auftrag/AB
ALTER TABLE invoices ADD COLUMN related_order_id uuid REFERENCES invoices(id);
```

### 2. Code-Änderungen

**`src/hooks/useInvoices.ts`**
- `Invoice` Interface: `delivery_time`, `rabatt_percent`, `invoice_subtype`, `related_order_id`
- `InvoiceInsert`: gleiche Felder
- `LineItemInsert`: `delivery_time`
- `convertDocument()`: erweitern um `delivery_note` Typ, Präfix aus Settings (AB/LS) laden
- Neue Methode `createPartialInvoice(sourceId, subtype: 'deposit'|'partial'|'final', lineItems)` — erstellt Teilrechnung mit Verweis auf Quell-AB/Rechnung

**`src/hooks/useCustomers.ts`**
- Interface erweitern: `default_discount_percent`, `default_skonto_percent`, `default_skonto_days`

**`src/hooks/useInvoiceSettings.ts`**
- Interface erweitern: `default_rabatt_percent`, `order_confirmation_prefix`, `delivery_note_prefix`

**`src/pages/InvoiceEditor.tsx`**
- Kaskadierende Defaults beim Kundenauswahl:
  - Zahlungsziel: Settings → Kunde → manuell
  - Skonto: Settings → Kunde → manuell
  - Rabatt: Settings → Kunde → manuell
- Lieferzeit-Felder (Gesamt + pro Position) bei Angebot/AB
- Lieferschein-Modus: Preise ausblenden
- Neuer "Dokumenttyp"-Hinweis wenn `?type=delivery_note`
- Teilzahlungs-UI: Bei Rechnungen aus AB → Option "Anzahlung"/"Teilzahlung"/"Schlussrechnung", Betrag/Positionen auswählbar
- Rabatt-Feld (Gesamtrabatt %) im Summenblock

**Neue Seite: `src/pages/DeliveryNotes.tsx`**
- Analog zu `Quotes.tsx`, filtert `document_type === 'delivery_note'`
- Kein Betrag in Tabelle, nur Positionen/Mengen
- Status: Entwurf → Versendet → Zugestellt
- Aktionen: In Rechnung umwandeln, Kopieren, Löschen

**`src/pages/Quotes.tsx`**
- Dropdown-Aktion "In Lieferschein umwandeln" hinzufügen

**`src/pages/Invoices.tsx`**
- Dropdown-Aktion "Teilrechnung erstellen" hinzufügen
- Anzeige von `invoice_subtype` (Anzahlung/Teil/Schluss) als Badge

**`src/App.tsx`**
- Route `/delivery-notes` → `DeliveryNotes`

**`src/components/dashboard/Sidebar.tsx`**
- Neuer Eintrag "Lieferscheine" mit Truck-Icon

**`src/components/settings/CustomerManagement.tsx`**
- Neue Sektion "Konditionen" im Dialog: Rabatt %, Skonto %, Skonto-Tage

**`src/components/settings/InvoiceTemplateSettings.tsx`**
- AB-Präfix und LS-Präfix Eingabefelder

**`supabase/functions/generate-invoice-pdf/index.ts`**
- Lieferschein-Layout: keine Preisspalten, kein MwSt-Block, kein Skonto
- Titel "LIEFERSCHEIN" / "AUFTRAGSBESTÄTIGUNG"
- Lieferzeiten anzeigen (gesamt + pro Position)
- Rabatt-Zeile im Summenblock
- Teilrechnungs-Hinweis (z.B. "Anzahlungsrechnung" im Titel, Verweis auf AB-Nr.)

### 3. Workflow-Kette

```text
Angebot (AG) 
  → "In AB umwandeln" → Auftragsbestätigung (AB)
    → "In Lieferschein umwandeln" → Lieferschein (LS, ohne Preise)
    → "Rechnung erstellen" → Rechnung (RE)
    → "Anzahlungsrechnung" → Rechnung (RE, subtype=deposit)
    → "Teilrechnung" → Rechnung (RE, subtype=partial)
    → "Schlussrechnung" → Rechnung (RE, subtype=final)
```

Alle Umwandlungen setzen `copied_from_id` auf das Quelldokument. Teilrechnungen setzen zusätzlich `related_order_id` auf die AB.

### 4. Kaskadierungs-Logik

```text
Zahlungsziel:  invoice_settings.default_payment_terms_days
               → customer.payment_terms_days (wenn gesetzt)
               → Beleg-Eingabe (überschreibt)

Skonto:        invoice_settings.default_discount_percent/days
               → customer.default_skonto_percent/days (wenn > 0)
               → Beleg-Eingabe

Rabatt:        invoice_settings.default_rabatt_percent
               → customer.default_discount_percent (wenn > 0)
               → Beleg-Eingabe (rabatt_percent)
```

### Umfang
- 2 DB-Migrationen
- 1 neue Seite (DeliveryNotes)
- ~10 bestehende Dateien anpassen
- PDF-Edge-Function erweitern

