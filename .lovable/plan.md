

## Rechnungs-Layout-Vorschau mit echten Firmendaten

### Ansatz
Eine rein clientseitige HTML/CSS-Vorschau direkt unter der Layout-Auswahl, die das gewählte Layout mit den echten Firmen- und Beispieldaten des Users visualisiert. Kein Edge-Function-Aufruf nötig – die Vorschau wird als gestylte React-Komponente gerendert, die die vier Layouts (classic, modern, minimal, compact) nachbildet.

### Datenquellen
- **Firmendaten**: `useCompanySettings()` (Name, Adresse, UID, Logo)
- **Rechnungseinstellungen**: bereits im `form`-State vorhanden (Nummernformat, Fußzeile, Skonto)
- **Beispiel-Kunde/Positionen**: Hardcoded Musterdaten (z.B. "Max Mustermann GmbH", 2-3 Beispielpositionen)

### Änderungen

**Neue Komponente: `src/components/settings/InvoiceLayoutPreview.tsx`**
- Props: `layoutVariant`, `companySettings`, `invoiceSettings` (Nummernvorschau, Fußzeile etc.)
- Rendert eine skalierte A4-Vorschau (~60% Größe) mit:
  - **Classic**: Logo links, Absender links, Empfänger rechts
  - **Modern**: Logo zentriert, farbige Akzentlinie
  - **Minimal**: Kein Logo-Header, nur Text
  - **Compact**: Engere Abstände, kleinere Schrift
- Enthält: Absenderblock, Empfängerblock, Rechnungstitel + Nummer, Mini-Positionstabelle (2-3 Zeilen), Summenblock, Fußzeile
- Logo wird über `getLogoUrl(companySettings.logo_path)` eingebunden

**`src/components/settings/InvoiceTemplateSettings.tsx`**
- `useCompanySettings()` importieren und aufrufen
- `InvoiceLayoutPreview` unterhalb des Layout-Selects einbinden
- Props: aktuelles `form.layout_variant`, Company-Settings, Rechnungsnummer-Vorschau

### UI-Verhalten
- Vorschau aktualisiert sich sofort beim Wechsel der Layout-Variante
- Skalierter A4-Rahmen mit Schatten, zentriert unter dem Select
- Falls keine Firmendaten hinterlegt: Platzhalter-Firmendaten anzeigen

### Umfang
- 1 neue Datei: `InvoiceLayoutPreview.tsx` (~150-200 Zeilen)
- 1 bestehende Datei: `InvoiceTemplateSettings.tsx` (Import + Integration, ~10 Zeilen)

