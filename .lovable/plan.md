

# Standard-Zahlungsart fuer Lieferanten

## Uebersicht

Lieferanten erhalten ein neues Feld "Standard-Zahlungsart", das -- analog zu Standard-Kategorie, Standard-Tag und Standard-MwSt-Satz -- automatisch bei der Lieferantenauswahl auf neue Belege angewandt wird.

## Aenderungen

### 1. Datenbank: Neue Spalte `default_payment_method` auf `vendors`

- Migration: `ALTER TABLE public.vendors ADD COLUMN default_payment_method text;`
- Kein Pflichtfeld, Standard ist NULL.
- Kein Foreign Key noetig, da Zahlungsarten als feste Liste (nicht als eigene Tabelle) definiert sind.

### 2. Hook: `useVendors.ts`

- `Vendor`-Interface erhaelt `default_payment_method: string | null`.
- `addVendor` Options erhalten `defaultPaymentMethod?: string`.
- `updateVendor` Partial-Pick wird um `default_payment_method` erweitert.
- Mapping in `fetchVendors` wird um das neue Feld ergaenzt.

### 3. VendorManagement: Formular erweitern (`src/components/settings/VendorManagement.tsx`)

- `formData` erhaelt `default_payment_method: string`.
- Im Edit-/Create-Dialog wird unter "Standard MwSt-Satz" ein neues Select-Feld "Standard-Zahlungsart" eingefuegt mit den bestehenden Zahlungsarten (Ueberweisung, Kreditkarte, Debitkarte, Bar, PayPal, Apple Pay, Google Pay, Lastschrift, Sonstige).
- Speichern/Anlegen uebergibt `default_payment_method` an den Hook.
- MergePreview erhaelt ebenfalls `default_payment_method`.

### 4. Einzelbelegerkennung: Zahlungsart automatisch zuweisen (`src/components/receipts/ReceiptDetailPanel.tsx`)

- Wenn ein Lieferant mit Standard-Zahlungsart ausgewaehlt wird und die aktuelle Zahlungsart des Belegs leer ist, wird `payment_method` automatisch gesetzt und "Zahlungsart" in die Toast-Liste aufgenommen.

### 5. VendorAutocomplete: Query erweitern (`src/components/receipts/VendorAutocomplete.tsx`)

- Das Supabase-Select wird um `default_payment_method` erweitert.
- Das `VendorWithCategory`-Interface erhaelt `default_payment_method: string | null`.

## Technische Details

### Migration SQL

```text
ALTER TABLE public.vendors
  ADD COLUMN default_payment_method text;
```

### Zahlungsarten-Liste (bereits vorhanden, wird wiederverwendet)

Ueberweisung, Kreditkarte, Debitkarte (Karte Debitzahlung), Barzahlung, PayPal, Apple Pay, Google Pay, Lastschrift, Sonstige

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| Migration (SQL) | Neue Spalte `default_payment_method` |
| `src/hooks/useVendors.ts` | Interface + addVendor/updateVendor erweitern |
| `src/components/settings/VendorManagement.tsx` | Zahlungsart-Select im Dialog, formData, Merge |
| `src/components/receipts/VendorAutocomplete.tsx` | Query + Interface um `default_payment_method` |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Zahlungsart zuweisen bei Lieferantenauswahl |

