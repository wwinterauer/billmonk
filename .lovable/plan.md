

## Plan: Erweitertes Rechnungsmodul -- Gesamtübersicht

Dieses Feature-Paket umfasst alle zuvor genehmigten Punkte plus die neuen Ergänzungen (Kunden-Adressen, Angebotsmodul). Die Umsetzung erfolgt in logischen Blöcken.

---

### Block 1: Datenbank-Migration

**Neue Tabelle `company_settings`**:
- user_id, company_name, street, zip, city, country (DEFAULT 'AT'), uid_number, company_register_court, company_register_number, phone, email, logo_path, bank_name, iban, bic, account_holder, is_small_business (DEFAULT false), small_business_text, created_at, updated_at
- RLS: User CRUD own rows

**ALTER `invoice_settings`**:
- ADD default_discount_percent numeric DEFAULT 0
- ADD default_discount_days integer DEFAULT 0
- ADD layout_variant text DEFAULT 'classic'
- ADD customer_number_prefix text DEFAULT 'KD'
- ADD customer_number_format text DEFAULT '{prefix}-{seq}'
- ADD next_customer_number integer DEFAULT 1

**ALTER `customers`** (Rechnungs- + Lieferanschrift):
- Bestehende Felder (street, zip, city, country) werden zur Rechnungsanschrift
- ADD shipping_street, shipping_zip, shipping_city, shipping_country text DEFAULT NULL
- ADD has_different_shipping_address boolean DEFAULT false

**ALTER `invoices`**:
- ADD version text DEFAULT NULL
- ADD parent_invoice_id uuid DEFAULT NULL
- ADD copied_from_id uuid DEFAULT NULL
- ADD discount_percent numeric DEFAULT 0
- ADD discount_days integer DEFAULT 0
- ADD discount_amount numeric DEFAULT 0
- ADD shipping_address_mode text DEFAULT 'same' (same / customer / custom)
- ADD shipping_street, shipping_zip, shipping_city, shipping_country text DEFAULT NULL
- ADD document_type text DEFAULT 'invoice' (invoice / quote / order_confirmation)

**ALTER `invoice_line_items`**:
- ADD group_name text DEFAULT NULL
- ADD is_group_header boolean DEFAULT false
- ADD show_group_subtotal boolean DEFAULT false

---

### Block 2: Firmendaten-Tab (CompanySettings)

- Neuer Hook `useCompanySettings.ts` (CRUD analog zu useInvoiceSettings)
- Neue Komponente `src/components/settings/CompanySettings.tsx`:
  - Logo-Upload (Storage Bucket `avatars` oder neuer Bucket `company-logos`)
  - Firmenname, Adresse, UID, Firmenbuchgericht/-nummer, Telefon, E-Mail
  - Bankverbindung (Bank, IBAN, BIC, Kontoinhaber)
  - Kleinunternehmerregelung Toggle + Pflichttext
    - AT-Default: "Umsatzsteuerbefreit -- Kleinunternehmer gem. SS 6 Abs. 1 Z 27 UStG"
    - DE-Default: "Gem. SS 19 UStG wird keine Umsatzsteuer berechnet."
- In `Settings.tsx` neuen Tab "Firmendaten" unter Rechnungs-Gruppe einfuegen

---

### Block 3: Rechnungsvorlage erweitern (InvoiceTemplateSettings)

- Bankdaten-Sektion entfernen (kommt aus Firmendaten)
- Skonto-Felder: Prozent + Tage
- Layout-Varianten (Select mit 4 Optionen): classic, modern, minimal, compact
- Kundennummernkreis: Praefix, Format, naechste Nr.

---

### Block 4: Kundenverwaltung erweitern

- `CustomerManagement.tsx`: Rechnungsanschrift + Lieferanschrift Felder im Dialog
- Checkbox "Abweichende Lieferanschrift" zeigt zweites Adressfeld-Set
- Auto-Kundennummer bei Neuanlage (aus invoice_settings Nummernkreis, ueberschreibbar)
- `useCustomers.ts`: addCustomer generiert Kundennummer wenn leer

---

### Block 5: InvoiceEditor erweitern

- **Lieferanschrift-Auswahl**: Nach Kundenauswahl Radio/Select: "Lieferanschrift = Rechnungsanschrift" / "Aus Kundendaten" / "Freitext"
- **Positionsgruppen**: Button "Gruppe hinzufuegen" fuer Header-Zeilen, optionale Zwischensummen
- **Kleinunternehmer-Logik**: Wenn company_settings.is_small_business, MwSt-Spalte ausblenden, alle vat_rate auf 0 setzen
- **Skonto**: Skonto-Felder aus Settings vorbelegen, auf Rechnung anzeigen

---

### Block 6: Kopieren + Versionierung (Invoices.tsx + useInvoices.ts)

- **Kopieren**: Neuer Menuepunkt im Dropdown, erstellt Draft-Kopie mit neuer Rechnungsnummer, Kunde ueberschreibbar
- **Korrektur erstellen**: Erstellt Version mit Suffix -A, -B, -C; Original auf "korrigiert"; parent_invoice_id gesetzt
- `useInvoices.ts`: Neue Funktionen `copyInvoice(id)` und `createCorrectionVersion(id)`
- Versions-Badge + "Kopiert von"-Info in der Liste

---

### Block 7: Angebotsmodul (Vorbereitung)

- `document_type` Feld auf invoices (quote / order_confirmation / invoice)
- Neue Seite `/quotes` (analog Invoices) mit eigenem Nummernkreis (z.B. AN-2025-0001)
- Workflow: Angebot -> "In Auftragsbestaetigung umwandeln" -> "In Rechnung umwandeln"
- Jeder Schritt kopiert den Datensatz mit neuem document_type und neuer Nummer
- Rueckverweis via copied_from_id
- Sidebar-Eintrag "Angebote" unter Rechnungen
- Route in App.tsx

---

### Block 8: PDF-Generator anpassen

- Firmendaten aus company_settings statt profiles
- Logo einbetten wenn vorhanden
- Kleinunternehmer: Keine MwSt-Spalte, Pflichttext
- Layout-Variante beruecksichtigen
- Skonto-Hinweis
- Gruppenheader + Zwischensummen
- Lieferanschrift wenn abweichend
- document_type-spezifische Titel (Angebot / Auftragsbestaetigung / Rechnung)

---

### Betroffene Dateien

| Datei | Aktion |
|---|---|
| Migration SQL | Neue Tabelle + ALTER TABLE x4 |
| `src/hooks/useCompanySettings.ts` | NEU |
| `src/components/settings/CompanySettings.tsx` | NEU |
| `src/components/settings/InvoiceTemplateSettings.tsx` | Erweitern |
| `src/hooks/useInvoiceSettings.ts` | Interface erweitern |
| `src/pages/Settings.tsx` | Neuen Tab einfuegen |
| `src/components/settings/CustomerManagement.tsx` | Adressen + Kundennr. |
| `src/hooks/useCustomers.ts` | Auto-Kundennummer |
| `src/pages/InvoiceEditor.tsx` | Gruppen, Lieferanschrift, Skonto, Kleinunternehmer |
| `src/pages/Invoices.tsx` | Kopieren, Versionierung |
| `src/hooks/useInvoices.ts` | copyInvoice, createVersion, document_type |
| `src/pages/Quotes.tsx` | NEU (Angebotsmodul) |
| `src/App.tsx` | Route /quotes |
| `src/components/dashboard/Sidebar.tsx` | Menuepunkt Angebote |
| `supabase/functions/generate-invoice-pdf/index.ts` | Alle PDF-Aenderungen |

### Implementierungsreihenfolge

1. DB-Migration (alle Schema-Aenderungen)
2. CompanySettings Hook + UI
3. InvoiceTemplateSettings erweitern
4. CustomerManagement (Adressen + Kundennr.)
5. InvoiceEditor (Gruppen, Lieferanschrift, Skonto, Kleinunternehmer)
6. Invoices (Kopieren + Versionierung)
7. Quotes-Seite + Workflow
8. PDF-Generator anpassen

