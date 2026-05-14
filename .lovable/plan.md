# Bug: Kategorie-Dropdown zeigt UUID statt Name

## Ursache

Die `receipts.category`-Spalte speichert den **Namen** der Kategorie (z. B. `"Blumen & Dekoration"`), nicht die ID. In `src/hooks/useReceiptProcessing.ts` wird beim Anwenden der Vendor-Defaults aber an drei Stellen direkt die UUID `vendor.default_category_id` in `updateData.category` geschrieben, ohne den Namen aufzulösen:

- Zeile 142–144 (Vendor-Auto-Match)
- Zeile 176–178 (Legacy-Pfad `matchOrCreateVendor`)
- Zeile 316–318 (`finalizeReceiptWithVendor`)

Bestätigte falsche Daten in der DB:
- 6× Stripe/PayPal mit `category = ac5bf110-...` → korrekt: **Zahlungsdienstleister**
- 3× Naturwerkstatt mit `category = af1b199b-...` → korrekt: **Blumen & Dekoration**

Im Review-Dropdown erscheint nur die rohe UUID, weil sie keiner Kategorie-Option entspricht.

## Plan

### 1. `src/hooks/useReceiptProcessing.ts` — Helper + 3 Fixes
- Kleinen Helper hinzufügen, der zu einer `default_category_id` den Kategorienamen aus `categories` lädt (`select name`, `eq id`, `maybeSingle`).
- An allen drei Stellen statt `updateData.category = vendor.default_category_id` den aufgelösten **Namen** schreiben. Ist die Kategorie nicht (mehr) auffindbar, `category` nicht setzen.

### 2. Bestehende fehlerhafte Receipts reparieren (Daten-Update)
```sql
UPDATE receipts r
SET category = c.name
FROM categories c
WHERE r.category ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND r.category::uuid = c.id;

-- UUIDs ohne passende Kategorie -> NULL
UPDATE receipts
SET category = NULL
WHERE category ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```
Effekt: Naturwerkstatt-Belege → "Blumen & Dekoration", Stripe/PayPal → "Zahlungsdienstleister".

### Out of Scope
- `extract-receipt` Edge Function: löst Namen bereits korrekt auf — keine Änderung.
- `Review.tsx` Vendor-Wechsel-Logik: bereits korrekt, bleibt unverändert.
- Keine UI-/Vendor-Management-Änderungen.
