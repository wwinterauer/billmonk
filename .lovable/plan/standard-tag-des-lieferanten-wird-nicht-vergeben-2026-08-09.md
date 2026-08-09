# Standard-Tag des Lieferanten wird nicht vergeben

## Was tatsächlich passiert

Bei Spusu, Stripe und HoT ist der Standard-Tag korrekt hinterlegt (alle drei zeigen denselben Tag "Alle FeWo's") und `auto_approve` ist aktiv. Trotzdem fehlt der Tag auf den Belegen:

- spusu: 7 von 7 Belegen ohne den Tag
- Stripe: 2 von 7 ohne
- HoT: 1 von 6 ohne
- WeTi: 16 von 16 ohne, Meta 8 von 11 ohne

Grund: Der Standard-Tag wird derzeit **nur im Frontend** gesetzt — im Belegdetail, wenn man den Lieferanten manuell auswählt, und beim Speichern von Lieferanten-Einstellungen (nachträgliche Zuweisung an Review-Belege). Die serverseitige Verarbeitung (`extract-receipt`), die den Lieferanten automatisch zuordnet und den Beleg bei Auto-Freigabe direkt auf "approved" setzt, vergibt **keinen** Tag. Genau die automatisch freigegebenen Belege laufen also am Tagging vorbei.

## Lösung

1. **Server-seitig taggen**: In der Belegverarbeitung nach der Lieferantenzuordnung den Standard-Tag des Lieferanten lesen und – falls noch nicht vorhanden – dem Beleg zuweisen. Das gilt für alle Belege mit erkanntem Lieferanten, unabhängig davon ob sie automatisch freigegeben oder zur Prüfung gelegt werden.
2. **Nachträglich nachziehen**: Einmalig alle bestehenden Belege, deren Lieferant einen Standard-Tag hat und bei denen der Tag fehlt, mit dem Tag versehen (betrifft aktuell u. a. spusu, WeTi, Meta, Stripe, HoT).

## Technische Details

- `supabase/functions/extract-receipt/index.ts`: beim Laden der Lieferantendaten zusätzlich `default_tag_id` selektieren; nach dem erfolgreichen `receipts`-Update ein Insert in `receipt_tags` (`onConflict: 'receipt_id,tag_id', ignoreDuplicates`) für `resolvedVendorId` → `default_tag_id`. Fehler dabei nur loggen, nicht die Verarbeitung abbrechen.
- Backfill über ein Daten-Update: `INSERT INTO receipt_tags (receipt_id, tag_id) SELECT r.id, v.default_tag_id FROM receipts r JOIN vendors v ON v.id = r.vendor_id WHERE v.default_tag_id IS NOT NULL ON CONFLICT DO NOTHING`.
- Keine Schemaänderung nötig.
