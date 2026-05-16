## Ziel

Beleg im Review-Flow und im `ReceiptDetailPanel` als **"Keine Rechnung"** markieren können – ohne Umweg über Löschen oder eine Kategorie. Der Beleg wird dabei als "kein Rechnungsbeleg" gekennzeichnet, aus dem Review-Workflow entfernt, bleibt aber als Eintrag (z. B. für Bank-Abgleich) erhalten.

## Lösung

Neuer Button **"Keine Rechnung"** in beiden Action-Footern (zwischen *Ablehnen* und *Überspringen* bzw. *Überprüfen*). Klick setzt:
- `is_no_receipt_entry = true`
- `status = 'approved'` (raus aus Review/Pending)
- `category = 'Keine Rechnung'` (Konstante `NO_RECEIPT_CATEGORY` aus `src/lib/constants.ts`)

Damit verhält sich der Eintrag konsistent zur "Manuelle Ausgabe ohne Beleg"-Erfassung (`ManualExpenseDialog`), die genau diese Felder bereits so setzt.

### 1. `src/pages/Review.tsx`
- Im Action-Footer (um Zeile 1834–1881) neuen `Button variant="outline"` **"Keine Rechnung"** einfügen, Icon `FileX` (oder `Receipt`-mit-Strich), zwischen *Ablehnen* und *Überspringen*.
- Handler `markAsNoReceipt()`: ruft eine kleine Variante von `saveReceipt('approved')` auf, die zusätzlich `is_no_receipt_entry: true` und `category: NO_RECEIPT_CATEGORY` mit in den Update-Payload nimmt, danach `goToNext()` wie bei `approved`.
- Bestätigungs-Toast: "Als 'Keine Rechnung' markiert".

### 2. `src/components/receipts/ReceiptDetailPanel.tsx`
- Im Footer (Zeile 1889–1937) neuen `Button variant="outline"` **"Keine Rechnung"** in der rechten Button-Gruppe, vor *Ablehnen*.
- Klick → `handleSaveClick('approved')` aufrufen, vorher Formular-State um `is_no_receipt_entry = true` und `category = NO_RECEIPT_CATEGORY` ergänzen (gleiches Pattern wie die bestehenden Save-Aufrufe).
- Wenn `receipt.is_no_receipt_entry === true` bereits gesetzt ist, Button als *aktiv/disabled* anzeigen ("Bereits markiert").

### 3. Keine weiteren Änderungen
- Kein DB-Migration nötig (`is_no_receipt_entry`, `NO_RECEIPT_CATEGORY` existieren).
- Keine Änderung an Filtern/Listen – die Konstante wird in `Expenses`, `Reports`, `Reconciliation` bereits berücksichtigt.
- Keine Änderungen am AI-Lernen (Belege mit `is_no_receipt_entry` fließen nicht in Vendor-Learning ein – schon bestehend).

## Dateien
- `src/pages/Review.tsx`
- `src/components/receipts/ReceiptDetailPanel.tsx`
