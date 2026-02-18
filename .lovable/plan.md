

# "Automatisch freigegeben" Badge in der Ausgabenuebersicht

## Zusammenfassung

Automatisch freigegebene Belege erhalten in der Ausgabenuebersicht ein zusaetzliches Badge "Automatisch freigegeben", damit der Nutzer sofort erkennen kann, welche Belege ohne manuellen Review freigegeben wurden.

## Voraussetzung

Da die Auto-Approve-Funktion noch nicht implementiert ist, wird diese Aenderung zusammen mit der gesamten Auto-Approve-Implementierung umgesetzt. Ein neues Feld in der `receipts`-Tabelle speichert, ob ein Beleg automatisch freigegeben wurde.

## Aenderungen

### 1. Datenbank: Neues Feld in `receipts`

| Spalte | Typ | Default | Beschreibung |
|--------|-----|---------|--------------|
| `auto_approved` | boolean | false | Markiert ob der Beleg automatisch freigegeben wurde |

Dieses Feld wird beim Auto-Approve-Vorgang auf `true` gesetzt und bleibt dauerhaft erhalten -- auch wenn der Status spaeter geaendert wird.

### 2. Datenbank: Neue Spalten in `vendors`

Wie im vorherigen Plan:

| Spalte | Typ | Default |
|--------|-----|---------|
| `auto_approve` | boolean | false |
| `auto_approve_min_confidence` | numeric | 0.8 |

### 3. Kern-Logik (`src/hooks/useReceipts.ts`)

Bei `processReceiptWithAI` und `finalizeReceiptWithVendor`:
- Wenn alle Auto-Approve-Bedingungen erfuellt sind (Vendor aktiv, Konfidenz erreicht, kein Duplikat, kein Multi-Invoice):
  - `status = 'approved'`
  - `auto_approved = true`

### 4. Badge in Ausgabenuebersicht (`src/pages/Expenses.tsx`)

In der Status-Spalte der Tabelle (Zeile ~2282), direkt nach dem Status-Badge:

```text
[Genehmigt] [Automatisch freigegeben]
```

- Gruen mit Zap-Icon (Blitz-Symbol fuer "automatisch")
- Nur sichtbar wenn `receipt.auto_approved === true` UND Status `approved` oder `completed`
- Wird neben dem normalen Status-Badge angezeigt, nicht als Ersatz

### 5. Lieferanten-Verwaltung (`src/components/settings/VendorManagement.tsx`)

- Switch "Automatische Freigabe" + Konfidenz-Slider im Dialog
- Hinweis zu Ausschluessen (Duplikate, Multi-Rechnungen)
- Badge in der Lieferanten-Tabelle

### 6. Upload-Seite (`src/pages/Upload.tsx`)

- "Auto-freigegeben" Badge bei automatisch freigegebenen Belegen

### 7. Vendor-Hook (`src/hooks/useVendors.ts`)

- Interface und CRUD um `auto_approve` und `auto_approve_min_confidence` erweitern

## Dateien

| Datei | Aenderung |
|-------|-----------|
| Migration (SQL) | `auto_approved` auf `receipts`, `auto_approve` + `auto_approve_min_confidence` auf `vendors` |
| `src/hooks/useVendors.ts` | Interface + CRUD |
| `src/hooks/useReceipts.ts` | Auto-Approve-Logik + `auto_approved`-Flag setzen |
| `src/pages/Expenses.tsx` | Badge "Automatisch freigegeben" in Status-Spalte |
| `src/components/settings/VendorManagement.tsx` | Switch + Slider + Hinweis |
| `src/pages/Upload.tsx` | Badge bei Auto-Freigabe |

