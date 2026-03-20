

# Features-Sektion basierend auf Feature-Overview aktualisieren

## Problem

Die Feature-Overview listet 60+ Features in 7 Kategorien. Aktuell zeigt die Landing Page nur ~22 davon. Fehlende Highlights: PDF-Splitting, Auto-Approval, Absender-Filter, KPI-Dashboard, Gutschriften, Nummernkreise, Skonto/Rabatt, Artikelgruppen, ZIP-Download, DATEV/BMD-Details, PWA-Installation, Onboarding.

## Ansatz

Die bestehende 3-Block-Struktur bleibt, wird aber auf **5 Blöcke** erweitert (analog zur Overview-Struktur). Jeder Block bekommt mehr Features. Die Cross-Features werden ebenfalls erweitert.

## Neue Block-Struktur

```text
Block 1: "Intelligente Belegverwaltung" (Free+)
  - KI-Erkennung (OCR) mit Vendor-Learning
  - Multi-Upload & Kamera-Scan (PWA)
  - PDF-Splitting (mehrseitige PDFs aufteilen)
  - Duplikat-Erkennung
  - Review-Workflow & Auto-Approval
  - Manuelle Einträge (Barbelege)
  - Individuelle Dateinamen & Beschreibungsvorlagen
  - Tags & Kategorien

Block 2: "Import-Kanäle" (ab Starter)
  - E-Mail-Import (Webhook-Adresse)
  - Gmail & Outlook OAuth-Sync
  - IMAP-Import (beliebiger Provider)
  - CSV-Bankimport
  - Live-Bankanbindung (Open Banking) [Pro]
  - Absender-Filter & Blockierung

Block 3: "Banking & Kontoabgleich" (ab Starter)
  - Automatisches Beleg-↔-Bank Matching
  - Auto-Reconciliation (KI-basiert)
  - Bank-Schlagwörter (Regelbasierte Zuordnung)
  - KPI-Dashboard & Berichte

Block 4: "Rechnungen & Verkaufs-Workflow" (Business)
  - Angebote → AB → Lieferschein → Rechnung
  - Teilrechnungen (Anzahlung/Teil/Schluss)
  - Wiederkehrende Rechnungen (Cron)
  - Gutschriften mit Referenz
  - Konfigurierbare Nummernkreise
  - PDF-Generierung mit Logo & Layout
  - Skonto, Rabatt & Lieferzeiten
  - Artikelgruppen mit Zwischensummen & Bildern

Block 5: "CRM & Stammdaten" (Business)
  - Kundenverwaltung (Kontakt, UID, Lieferadresse)
  - Artikelvorlagen (Preis, Einheit, USt)
  - Firmendaten für Rechnungskopf

Cross-Features (alle Tarife):
  - DSGVO-konform (EU-Hosting)
  - PWA (installierbar, offline-fähig)
  - Responsive Design
  - Flexible Exporte (CSV/Excel/PDF/ZIP)
  - DATEV/BMD Export [Business Badge]
  - Cloud-Backup mit Zeitplan [Pro Badge]
  - Onboarding-Assistent
```

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `src/components/landing/Features.tsx` | Komplett überarbeiten: 5 Blöcke statt 3, Features aus Overview |
| `src/components/landing/PricingComparison.tsx` | Fehlende Features ergänzen (PDF-Split, Auto-Approval, etc.) |

## Technische Details

- `featureBlocks` Array wird von 3 auf 5 Einträge erweitert
- Neue Icons importieren: `Scissors` (PDF-Split), `CheckCheck` (Auto-Approval), `Filter` (Absender-Filter), `Ban` (Blockierung), `BarChart3` (Dashboard), `PenLine` (Gutschriften), `Hash` (Nummernkreise), `Palette` (Layout), `Percent` (Skonto), `Package` (Artikelgruppen), `Image` (Artikelbilder), `UserPlus` (Kundenverwaltung), `Briefcase` (Firmendaten), `Timer` (Wiederkehrend), `Download` (ZIP), `Wifi` (IMAP)
- Plan-Badges korrekt setzen: Starter, Pro, Business
- `crossFeatures` erweitert um Export-Details, Onboarding, PWA
- PricingComparison-Tabelle um fehlende Zeilen ergänzen

