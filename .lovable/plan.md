## Ziel

Im "Beleg zuordnen"-Dialog (auf der Reconciliation-Seite) eine dritte Option ergänzen: **"Als Ausgabe erfassen"**. Damit kann eine Bankbuchung direkt in eine vollwertige Ausgabe umgewandelt und im gewohnten Detail-Fenster (wie aus dem Review) komplett befüllt werden – inkl. Lieferant, Rechnungsnummer, Kategorien, Steuersatz, Split-Buchung usw.

## UX-Flow

1. User klickt in der Reconciliation-Tabelle auf "Beleg zuordnen" einer unmatched Buchung.
2. Im Modal-Footer erscheinen **drei** Aktionen statt zwei:
   - Bestehenden Beleg auswählen (Standardliste, wie heute)
   - **Als Ausgabe erfassen** (neu)
   - Neuen Beleg hochladen (wie heute)
3. Klick auf "Als Ausgabe erfassen":
   - Erzeugt sofort einen neuen `receipts`-Eintrag mit den Daten der Buchung (siehe unten).
   - Verknüpft Buchung ↔ Beleg (`bank_transactions.receipt_id`, `bank_transactions.status='matched'`).
   - Schließt das Zuordnungs-Modal und öffnet direkt das **ReceiptDetailPanel** für den neuen Beleg – die gleiche Vollmaske wie im Review-Fenster.
4. User vervollständigt Lieferant, Rechnungsnummer, Kategorie, Steuer, ggf. Split-Buchung und speichert. Status wird beim Speichern wie üblich auf `approved` gesetzt.

## Vorbelegung der neuen Ausgabe

| Feld | Wert aus Bankbuchung |
|---|---|
| `user_id` | aktueller User |
| `receipt_date` | `bank_transactions.transaction_date` |
| `amount_gross` | `Math.abs(bank_transactions.amount)` |
| `vendor` | aus `description` extrahiert (heuristisch: "Empfänger: X" / "Auftraggeber: X" / sonst erster sinnvoller Token) |
| `currency` | `EUR` (Default) |
| `payment_method` | `bank_transfer` |
| `status` | `review` (User muss vervollständigen) |
| `source` | `bank_import` (bestehender erlaubter Wert) |
| `is_no_receipt_entry` | `true` (kein PDF/Bild) |
| `bank_transaction_reference` | `bank_transactions.description` (gekürzt) |
| `file_url` / `file_path` | `null` |

Optional: Wenn die Buchung ein `bank_import_keywords`-Treffer ist, werden `category`, `tax_rate` und `description` aus der Vorlage vorbelegt (gleiche Logik wie beim Bank-Import "Ohne Rechnung").

## Technische Umsetzung

### 1. `ReceiptAssignmentModal.tsx`
- Neue Prop `onCreateAsExpense: (transactionId: string) => void`.
- Im Footer (sowohl Leer-Zustand als auch normaler Zustand) Button **"Als Ausgabe erfassen"** mit Icon `Plus` einfügen, zwischen "Hochladen" und "Zuordnen".
- Kurzer Hilfetext: *"Ohne Original-Beleg direkt erfassen"*.

### 2. `src/pages/Reconciliation.tsx`
- Neue Handler-Funktion `handleCreateAsExpense(transactionId)`:
  1. Bankbuchung aus State holen.
  2. `vendor` aus Description parsen (kleine Helper-Funktion `extractVendorFromDescription`, kann später wiederverwendet werden).
  3. Optional: Keyword-Match gegen `bank_import_keywords` → Defaults übernehmen.
  4. `INSERT` in `receipts` mit obigen Defaults; `select().single()` liefert neue `id`.
  5. `UPDATE bank_transactions SET receipt_id = neu.id, status = 'matched' WHERE id = transactionId`.
  6. `queryClient.invalidateQueries(['bank-transactions'])` + Toast.
  7. `setShowAssignModal(false)`; `setSelectedReceiptId(neu.id)`; `setShowReceiptPanel(true)`.
- Prop `onCreateAsExpense={handleCreateAsExpense}` an das Modal weiterreichen.

### 3. `ReceiptDetailPanel.tsx`
- Keine strukturellen Änderungen nötig – das Panel akzeptiert bereits beliebige Receipt-IDs und kann Belege ohne Datei anzeigen (PDF-Viewer wird leer/ausgeblendet).
- Falls noch nicht vorhanden: kleiner Hinweis-Badge "Ohne Original-Beleg" wenn `is_no_receipt_entry === true` (optional, kosmetisch).

### 4. Keine Migration nötig
- Spalten `source='bank_import'`, `is_no_receipt_entry`, `bank_transaction_reference`, `bank_transactions.receipt_id` existieren bereits.
- Status `review` ist im bestehenden Check-Constraint.

### 5. Edge-Cases
- Wenn Buchung bereits gematcht ist → Button "Als Ausgabe erfassen" wird ausgeblendet (Modal wird heute eh nur für unmatched geöffnet).
- Negative Beträge (Ausgaben) → `Math.abs`; positive Beträge (Einnahmen) → später separater Flow, hier vorerst gleich behandeln, aber Hinweis "Achtung: Einnahme" anzeigen wenn `amount > 0`.
- Fehler beim Insert → Toast + Modal bleibt offen.

## Was sich **nicht** ändert
- Auto-Reconcile-Logik, Split-Line-Matching, Bank-Import-Workflow, Review-Seite – alles unverändert.
- Keine neuen Tabellen, keine RLS-Änderungen.

## Dateien (geschätzt)
- `src/components/bank-import/ReceiptAssignmentModal.tsx` (neuer Button + Prop)
- `src/pages/Reconciliation.tsx` (Handler + State-Übergabe)
- `src/components/receipts/ReceiptDetailPanel.tsx` (optionaler Badge)
- ggf. `src/lib/bank-description-parser.ts` (kleine Helper für Vendor-Extraktion, falls noch nicht existiert)
