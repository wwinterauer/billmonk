

## Plan: Business-Preis anpassen + DATEV/BMD Steuerberater-Export

### Teil 1: Business-Preis von €9,99 auf €14,99 anheben

**Dateien:**
- `src/lib/planConfig.ts` — Business monthly: 14.99, yearly: 143.90 (12×14.99 abzgl. ~20% Rabatt)
- `src/components/landing/Pricing.tsx` — Features-Liste um "Angebote, AB & Lieferscheine" und "DATEV/BMD Export" ergänzen

**Stripe**: Die Stripe-Preise (`stripeConfig.ts`) müssen im Stripe-Dashboard separat angepasst werden — der Code referenziert nur die Price-IDs. Bestehende Abonnenten bleiben auf dem alten Preis bis zur nächsten Verlängerung.

---

### Teil 2: Steuerberater-Export (DATEV + BMD NTCS)

#### Machbarkeit: Ja, gut umsetzbar

Beide Formate sind CSV-basiert mit festgelegter Spaltenstruktur. Alle benötigten Daten (Datum, Betrag, MwSt, Konto, Buchungstext) sind bereits in `receipts` und `invoices` vorhanden.

#### DATEV Buchungsstapel-Format (Deutschland/International)
CSV mit 2-Zeilen-Header:
- **Zeile 1**: Metadaten (Format-ID "EXTF", Version, Kategorie 21=Buchungsstapel, Berater-Nr, Mandanten-Nr, WJ-Beginn, Sachkontenlänge, Datum)
- **Zeile 2**: Spaltenüberschriften
- **Pflichtfelder**: Umsatz, Soll/Haben-Kz (S/H), Konto, Gegenkonto, BU-Schlüssel (Steuerschlüssel), Belegdatum, Buchungstext, Belegfeld 1 (Rechnungsnr)

BU-Schlüssel-Mapping:
- 20% → BU 9 (Vorsteuer 19% DE) bzw. Österreich-spezifisch
- 10% → BU 8
- 13% → BU 7

#### BMD NTCS Fleximport-Format (Österreich)
CSV mit Buchungssymbol-Logik:
- **ER** (Eingangsrechnungen/Ausgaben): Konto, Gegenkonto, Betrag, Datum, Buchungstext, Steuercode, Belegnummer
- **AR** (Ausgangsrechnungen/Einnahmen): gleiche Struktur, anderes Symbol
- Personenkonten (Lieferanten/Kunden) als separate Stammdaten-CSV möglich

#### Umsetzung

**Neue Datei: `src/lib/taxExportFormats.ts`**
- DATEV-Header-Generator mit konfigurierbarer Berater-/Mandantennummer und Sachkontenlänge
- BMD-CSV-Generator mit Buchungssymbol ER/AR
- BU-Schlüssel-Mapping für gängige MwSt-Sätze
- Gemeinsame Hilfsfunktionen für Konten-Zuordnung

**Neue Datei: `src/components/exports/TaxExportDialog.tsx`**
- Dialog mit Formatauswahl (DATEV/BMD)
- Konfigurationsfelder: Berater-Nr, Mandanten-Nr, Sachkontenlänge (DATEV) / Buchungssymbol (BMD)
- Auswahl: nur Ausgaben, nur Einnahmen, oder beides
- Zeitraum-Auswahl
- Einstellungen werden in `profiles` oder `localStorage` gespeichert

**Integration in bestehende UI:**
- `Expenses.tsx` — neuer "Steuerberater-Export" Button neben dem bestehenden Export
- `Invoices.tsx` — gleicher Button für Ausgangsrechnungen
- `Reports.tsx` — kombinierter Export beider Seiten
- Optional: `Settings.tsx` — Steuerberater-Einstellungen (Standardwerte für Berater-Nr etc.)

**Feature-Gate**: Steuerberater-Export hinter `business`-Plan (da es Teil des erweiterten Workflows ist)

### Technische Details

- DATEV erwartet Semikolon als Trennzeichen, UTF-8 mit BOM, Dezimalkomma
- BMD erwartet Semikolon, Windows-1252 oder UTF-8, Dezimalkomma
- Kontenrahmen-Zuordnung: User konfiguriert Standardkonten (z.B. Aufwandskonto 5000-6999, Erlöskonto 4000-4999, Bank 2800)
- Export als `.csv`-Datei mit korrekter Benennung (DATEV: `EXTF_Buchungsstapel_JJJJ.csv`, BMD: `ER-Buchungen.csv` / `AR-Buchungen.csv`)

