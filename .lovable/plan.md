

## Artikel mit Bildern, Symbolen und Artikelgruppen

### Übersicht
Drei Erweiterungen: (1) Artikelgruppen zur Organisation, (2) Icon-Auswahl pro Artikel (nur UI-Übersicht), (3) Bild-Upload pro Artikel (wird auch in PDFs angezeigt).

### Datenbank-Änderungen

**1. Neue Tabelle `item_groups`**
- `id`, `user_id`, `name`, `sort_order`, `created_at`
- RLS: User can CRUD own groups

**2. Tabelle `invoice_items` erweitern**
- `icon text` – Lucide-Icon-Name (nur für Settings-UI)
- `image_path text` – Storage-Pfad zum Artikelbild (für PDFs)
- `item_group_id uuid` – FK zu `item_groups`

### Storage
- Neuer Bucket `item-images` (private) für Artikelbilder
- RLS: User kann eigene Dateien hochladen/lesen/löschen (Pfad: `{user_id}/{filename}`)

### Code-Änderungen

**`src/hooks/useInvoiceItems.ts`**
- Interface erweitern um `icon`, `image_path`, `item_group_id`

**Neuer Hook: `src/hooks/useItemGroups.ts`**
- CRUD für `item_groups` (Name, Sortierung)

**`src/components/settings/InvoiceItemManagement.tsx`** – Hauptumbau:
- Artikelgruppen-Verwaltung oben (erstellen/bearbeiten/löschen)
- Artikel nach Gruppen gruppiert anzeigen (+ "Ohne Gruppe")
- Im Artikel-Dialog: Icon-Picker (Lucide-Icons, ähnlich CategoryManagement), Bild-Upload (Supabase Storage), Gruppen-Select
- Bild-Vorschau im Dialog und in der Artikelliste

**`src/pages/InvoiceEditor.tsx`**
- Artikelvorlagen im Select nach Gruppen gruppiert anzeigen (SelectGroup)
- Artikelbild-Info beim Hinzufügen in `EditorLineItem` speichern (neues Feld `image_path`)

**`src/hooks/useInvoices.ts`**
- `LineItemInsert` um `image_path` erweitern

**`invoice_line_items` Tabelle** (Migration):
- Neue Spalte `image_path text` – damit das Bild pro Position in der Rechnung gespeichert wird

**`supabase/functions/generate-invoice-pdf/index.ts`**
- Beim Rendern der Positionen: Falls `image_path` vorhanden, Bild aus `item-images` laden und links neben der Beschreibung einbetten (klein, ca. 30x30px)
- Zeilenhöhe bei Bild-Positionen erhöhen

### UI-Details
- Icon-Picker: Grid mit ~20 relevanten Icons (Package, Wrench, Paintbrush, Truck, Monitor, etc.)
- Bild-Upload: Drag & Drop oder Klick, max 2MB, JPG/PNG/WEBP
- Artikelgruppen: Einfache Liste mit Name, editierbar inline oder per Dialog
- Artikel-Liste: Gruppiert mit Gruppen-Headern (aufklappbar via Collapsible)

### Umfang
- 2 Migrationen (item_groups Tabelle + invoice_items/invoice_line_items erweitern + Storage Bucket)
- 1 neuer Hook (`useItemGroups`)
- Umbau `InvoiceItemManagement.tsx` (~300 Zeilen)
- Anpassungen in `InvoiceEditor.tsx`, `useInvoices.ts`, `generate-invoice-pdf/index.ts`

