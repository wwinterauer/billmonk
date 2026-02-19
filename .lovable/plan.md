

# Standard-Tag fuer Lieferanten

## Uebersicht

Lieferanten koennen kuenftig einen Standard-Tag erhalten, der -- analog zur Standard-Kategorie -- automatisch bei der Lieferantenauswahl auf neue Belege angewandt wird.

## Aenderungen

### 1. Datenbank: Neue Spalte `default_tag_id` auf `vendors`

- Migration: `ALTER TABLE public.vendors ADD COLUMN default_tag_id uuid REFERENCES public.tags(id) ON DELETE SET NULL;`
- Kein Pflichtfeld, Standard ist NULL.

### 2. Hook: `useVendors.ts`

- `Vendor`-Interface erhaelt `default_tag_id: string | null`.
- `addVendor` Options erhalten `defaultTagId?: string`.
- `updateVendor` Partial-Pick wird um `default_tag_id` erweitert.

### 3. VendorManagement: Formular erweitern (`src/components/settings/VendorManagement.tsx`)

- `formData` erhaelt `default_tag_id: string`.
- Im Edit-Dialog wird unter "Standard-Kategorie" ein neues Select-Feld "Standard-Tag" eingefuegt, das die aktiven Tags (aus `useTags()`) als Auswahl anbietet -- mit farbigem Punkt analog zur Kategorie-Auswahl.
- Speichern/Anlegen uebergibt `default_tag_id` an den Hook.
- MergePreview erhaelt ebenfalls `default_tag_id`.

### 4. Einzelbelegerkennung: Tag automatisch zuweisen (`src/components/receipts/ReceiptDetailPanel.tsx`)

- `VendorAutocomplete` und `handleVendorSelect` erhalten `default_tag_id` im Vendor-Datenobjekt.
- Wenn ein Lieferant mit Standard-Tag ausgewaehlt wird und der Beleg diesen Tag noch nicht hat, wird `assignTag(receiptId, default_tag_id)` aufgerufen und "Tag" in die Toast-Liste aufgenommen.
- Dafuer wird `useTags()` (bzw. `assignTag`) im Panel importiert.

### 5. VendorAutocomplete: Query erweitern (`src/components/receipts/VendorAutocomplete.tsx`)

- Das Supabase-Select wird um `default_tag_id` erweitert.
- Das `VendorWithCategory`-Interface erhaelt `default_tag_id: string | null`.

## Technische Details

### Migration SQL

```text
ALTER TABLE public.vendors
  ADD COLUMN default_tag_id uuid REFERENCES public.tags(id) ON DELETE SET NULL;
```

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| Migration (SQL) | Neue Spalte `default_tag_id` |
| `src/hooks/useVendors.ts` | Interface + addVendor/updateVendor erweitern |
| `src/components/settings/VendorManagement.tsx` | Tag-Select im Dialog, formData, Merge |
| `src/components/receipts/VendorAutocomplete.tsx` | Query + Interface um `default_tag_id` |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Tag zuweisen bei Lieferantenauswahl |

