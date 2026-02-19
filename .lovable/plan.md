

# Lieferanten-Standardwerte auf Review-Belege uebertragen

## Uebersicht

Wenn ein Lieferant gespeichert wird und sich Standardwerte (Kategorie, MwSt-Satz, Zahlungsart, Tag) geaendert haben, werden diese automatisch auf alle Belege im Status "review" uebertragen, die diesem Lieferanten zugeordnet sind.

## Aenderungen

### 1. `src/hooks/useVendors.ts` - `updateVendor` erweitern

Nach dem bestehenden Namens-Sync-Block (Zeile 206-230) wird ein neuer Block eingefuegt, der die Standardwerte auf Review-Belege uebertraegt:

- **Kategorie**: Wenn `default_category_id` gesetzt ist, wird `category` auf allen Review-Belegen des Lieferanten auf den Kategorienamen gesetzt. Dazu wird der Kategoriename per Supabase-Query aus der `categories`-Tabelle geholt.
- **MwSt-Satz**: Wenn `default_vat_rate` gesetzt ist, wird `vat_rate` auf allen Review-Belegen aktualisiert.
- **Zahlungsart**: Wenn `default_payment_method` gesetzt ist, wird `payment_method` auf allen Review-Belegen aktualisiert.
- **Tag**: Wenn `default_tag_id` gesetzt ist, wird fuer jeden Review-Beleg geprueft, ob der Tag bereits zugewiesen ist. Falls nicht, wird ein Eintrag in `receipt_tags` eingefuegt.

Der Rueckgabewert `syncedReceipts` wird um die Anzahl der aktualisierten Review-Belege erweitert (bzw. in die bestehende Zaehlung integriert).

### 2. `src/components/settings/VendorManagement.tsx` - Toast erweitern

Die bestehende Toast-Nachricht nach `updateVendor` zeigt bereits `syncedReceipts` an. Die neue Logik wird in die gleiche Zaehlung integriert, sodass der Benutzer sieht, wie viele Belege mit den neuen Standardwerten aktualisiert wurden.

## Technische Details

### Sync-Logik in `updateVendor` (nach dem Namens-Sync, vor dem Auto-Approve)

```text
// Pseudocode:
1. Pruefen ob default_category_id, default_vat_rate, default_payment_method oder default_tag_id im Update enthalten sind
2. Falls ja: Review-Belege dieses Lieferanten laden (receipts mit vendor_id = id UND status = 'review')
3. Update-Objekt bauen:
   - category: Kategoriename aus categories-Tabelle (wenn default_category_id gesetzt)
   - vat_rate: default_vat_rate (wenn gesetzt)
   - payment_method: default_payment_method (wenn gesetzt)
4. Batch-Update auf alle Review-Belege ausfuehren
5. Tag-Zuweisung: Fuer default_tag_id bestehende receipt_tags pruefen und fehlende einfuegen
6. syncedReceipts-Zaehler erhoehen
```

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/hooks/useVendors.ts` | Sync-Logik fuer Standardwerte auf Review-Belege in `updateVendor` |
| `src/components/settings/VendorManagement.tsx` | Toast-Nachricht ggf. anpassen (zeigt bereits syncedReceipts) |

