## Ziel
Lieferantenverwaltung erweitern um:
1. **Lieferantennummer** (frei vergebbar, optional eindeutig pro User)
2. **Excel-Import** einer Lieferantenliste (für Neukunden / Migration aus Altsystem)

---

## 1. Datenmodell

Neue Spalte in `vendors`:
- `vendor_number text` (nullable)
- Unique-Index pro User: `UNIQUE (user_id, vendor_number) WHERE vendor_number IS NOT NULL`

Migration via Supabase-Tool.

---

## 2. Lieferantennummer in der UI (`VendorManagement.tsx`)

- **Vendor-Dialog (Anlegen/Bearbeiten):** Neues Feld "Lieferantennummer" (Input, optional). Validierung: max. 50 Zeichen, Trim, Duplikat-Check beim Speichern (Toast bei Konflikt).
- **Vendor-Tabelle:** Neue Spalte "Nr." (sortierbar, links neben Anzeigename). Bei leerem Wert „–".
- **Suchfeld:** Suche zusätzlich nach `vendor_number`.
- Automatische Vergabe wird **nicht** eingebaut (rein manuell, freie Vergabe).

`useVendors.ts`: Typ + Insert/Update um `vendor_number` erweitern.

---

## 3. Excel-Import

Neuer Button "Excel importieren" oben in der Vendor-Verwaltung neben dem bestehenden „Neuer Lieferant"-Button.

### Flow
1. **Vorlage herunterladen** (Button im Dialog): generiert `.xlsx` mit Spaltenköpfen + 2 Beispielzeilen via `xlsx` (bereits installiert).
2. **Datei wählen** (`.xlsx`/`.xls`/`.csv`), wird clientseitig mit `xlsx` geparst.
3. **Vorschau-Tabelle** mit Mapping & pro Zeile Status:
   - `Neu` – wird angelegt
   - `Update` – existiert (Match per Lieferantennummer ODER Anzeigename, case-insensitive) → optional aktualisieren (Checkbox „Bestehende überschreiben")
   - `Fehler` – Validierung fehlgeschlagen (z. B. fehlender Name, doppelte Nummer in Datei)
4. **Importieren**-Button: führt `upsert` in Batches (50 pro Request) aus, zeigt Fortschritt + Ergebnis-Toast.

### Unterstützte Spalten (Header-Erkennung tolerant, DE/EN)
| Header (Beispiele) | Feld |
|---|---|
| Lieferantennummer, Nr., Nummer, Number | `vendor_number` |
| Anzeigename, Name, Display Name | `display_name` (Pflicht) |
| Rechtsname, Legal Names (kommagetrennt) | `legal_names[]` |
| Website, URL | `website` |
| Notizen, Notes | `notes` |
| Kategorie | Match auf `categories.name` → `default_category_id` |
| MwSt-Satz, VAT | `default_vat_rate` (Zahl 0–100) |
| Steuerart, Tax Type | `default_tax_type` |
| Extraktions-Stichwörter (kommagetrennt) | `extraction_keywords[]` |

Unbekannte Spalten werden ignoriert (Hinweis in Vorschau).

### Validierung
- `display_name` Pflicht, ≤ 200 Zeichen
- `vendor_number` ≤ 50 Zeichen, in der Datei eindeutig
- `default_vat_rate` numerisch, 0–100
- Kategorie-Name muss existieren, sonst leer (mit Warnung)

---

## 4. Geänderte/neue Dateien
- **Migration:** Spalte `vendor_number` + Unique-Index
- `src/hooks/useVendors.ts` – Typ + CRUD
- `src/components/settings/VendorManagement.tsx` – neues Feld in Dialog + Tabellenspalte + Suche
- `src/components/settings/VendorImportDialog.tsx` (neu) – Excel-Parser, Vorschau, Upsert
- (optional) `src/lib/vendorImport.ts` (neu) – Header-Mapping & Validierungs-Helpers

## Nicht enthalten
- Keine automatische fortlaufende Nummerierung
- Kein Re-Import-Verlauf / Undo
- Keine Änderung an Belegen oder Vendor-Matching-Logik
- Kein Export (besteht bei Bedarf separat)
