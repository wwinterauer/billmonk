## Problem

Die Option **„Splitbuchungen aufteilen"** existiert bereits im Export-Dialog. Aktuell werden Split-Belege zwar in mehrere Zeilen aufgeteilt, aber die **Split-Werte landen nur in separaten Spalten** (`split_amount_gross`, `split_category`, `split_description`, …). Die Standard-Spalten (Betrag, Kategorie, USt., Beschreibung) zeigen weiter den **Gesamtwert des Hauptbelegs** — also auf jeder Split-Zeile derselbe Bruttobetrag. Das ist für Excel-Exports unbrauchbar (Summen wären falsch).

## Vorschlag

Wenn „Splitbuchungen aufteilen" aktiv ist, **überschreiben** wir auf jeder erzeugten Zeile die Standard-Belegfelder mit den Werten der jeweiligen Split-Zeile. Header-Daten (Rechnungsnummer, Datum, Lieferant, Zahlungsart, Notiz) bleiben auf allen Zeilen identisch — genau wie vom User beschrieben.

### Welche Felder werden pro Split-Zeile überschrieben?

| Feld | Quelle |
|------|--------|
| `amount_gross` | `split_line.amount_gross` |
| `amount_net` | `split_line.amount_net` |
| `vat_rate` | `split_line.vat_rate` |
| `vat_amount` | `split_line.vat_amount` |
| `category` | `split_line.category` |
| `description` | `split_line.description` (falls vorhanden, sonst Original) |
| `tax_type` | `split_line.tax_type` |

### Welche Felder bleiben gleich (Header-Daten)?

`receipt_date`, `vendor`, `vendor_brand`, `invoice_number`, `payment_method`, `currency`, `notes`, `file_name`, `status` — also alles, was den **Beleg an sich** identifiziert.

### Zusätzlich

- Eine **Spalte „Pos."** (Split-Position 1, 2, 3, …) bleibt verfügbar, damit man die Zeilen einer Buchung erkennen kann.
- Die alten `split_*`-Felder bleiben als separate Spalten verfügbar (Rückwärtskompatibilität für bestehende Templates).
- Beschreibungstext der Beschreibungs-UI-Hilfe wird präzisiert: „Split-Belege erzeugen mehrere Zeilen — Betrag, Kategorie und USt. werden pro Zeile überschrieben."

## Technische Umsetzung

In `src/components/exports/ExportFormatDialog.tsx`, Funktion die Split-Expansion macht (Zeile ~588–610): beim Erzeugen der `expanded`-Einträge nicht nur `_split_*`-Hilfsfelder setzen, sondern die echten Receipt-Felder mit den Split-Werten überschreiben:

```ts
expanded.push({
  ...receipt,
  amount_gross: line.amount_gross,
  amount_net: line.amount_net,
  vat_rate: line.vat_rate,
  vat_amount: line.vat_amount,
  category: line.category ?? receipt.category,
  description: line.description ?? receipt.description,
  tax_type: line.tax_type ?? receipt.tax_type,
  // Helper-Felder weiter mitgeben
  _split_position: idx + 1,
  _split_description: line.description,
  _split_category: line.category,
  _split_amount_gross: line.amount_gross,
  _split_amount_net: line.amount_net,
  _split_vat_rate: line.vat_rate,
  _split_vat_amount: line.vat_amount,
  _split_is_private: line.is_private,
  _split_tax_type: line.tax_type,
} as any);
```

Keine DB-Migration, keine Änderung an Templates oder anderen Exportpfaden nötig.

## Alternative (falls gewünscht)

Eine **Summenzeile pro Beleg** oben drüber, gefolgt von Split-Zeilen mit Einrückung. Das macht den Export aber unbrauchbar für maschinelle Weiterverarbeitung (DATEV/Steuerberater), daher würde ich davon abraten.