# Bankabgleich mit Splitbuchungen

Aktuell wird 1 Bankbuchung ↔ 1 ganzer Beleg gematcht. Splitbelege (z.B. Lohnabrechnung mit Splitzeilen für Diemut, Ivana, ÖGK …) können nicht zugeordnet werden, weil die Bank N getrennte Überweisungen zeigt, deren Beträge jeweils nur einer **Zeile** entsprechen.

## Ziel
Eine Bankbuchung kann an eine **einzelne Splitzeile** eines Belegs gebunden werden. Mehrere Bankbuchungen können zum selben Belegelternteil gehören, jeweils zu unterschiedlichen Zeilen.

## DB-Änderung
- `bank_transactions.receipt_split_line_id uuid` (FK → `receipt_split_lines.id`, `ON DELETE SET NULL`).
- Bestehende Spalte `bank_transactions.receipt_id` bleibt = Eltern-Beleg.
- `receipts.bank_transaction_id` bleibt für „klassische" 1:1-Belege. Bei Splitbelegen wird sie nicht mehr verwendet – die Wahrheit liegt auf der Bank-Tx-Seite (`receipt_id` + `receipt_split_line_id`).
- Index auf `(receipt_split_line_id)` für schnellen Lookup.

## Helper
- View / DB-Funktion `unpaid_match_candidates(user_id)` ist optional – einfacher: in den Edge Functions die Splitzeilen pro Beleg im Kandidatenpool als virtuelle Einträge auflisten:
  ```text
  candidate = {
    id: split_line.id || receipt.id,
    type: 'split' | 'whole',
    receipt_id, split_line_id,
    amount: split_line.amount_gross || receipt.amount_gross,
    receipt_date: receipt.receipt_date,
    vendor: receipt.vendor,
    invoice_number: receipt.invoice_number,
    description: split_line.description || receipt.description
  }
  ```
- Belegung-Regel: Ein Beleg ohne Splitzeilen verhält sich wie heute. Bei einem Beleg mit Splitzeilen wird **nicht** der Ganz-Beleg in den Pool gegeben, sondern N Splitzeilen. Eine Zeile gilt als verbraucht, wenn schon eine `bank_transactions` Zeile mit dieser `receipt_split_line_id` existiert.

## Edge Functions
`auto-reconcile` und `reconcile-with-skonto`:
1. Beim Kandidatenpool-Aufbau zusätzlich `receipt_split_lines` für die geladenen Belege joinen.
2. Pool aus „Ganz-Belegen ohne Splits" + „Splitzeilen von Splitbelegen" zusammensetzen.
3. Vorhandene 3-Stage-Logik (High-Confidence / Exact / Skonto) bleibt unverändert, arbeitet aber auf dem erweiterten Pool.
4. Beim Anwenden des Matches:
   - `bank_transactions`: `status='matched'`, `receipt_id=parent`, `receipt_split_line_id=line` (oder NULL bei Ganz-Beleg).
   - `receipts.bank_transaction_id`: nur setzen, wenn Ganz-Beleg-Match (kein Split). Sonst NULL lassen.
5. Splitzeilen-Vendor-Token: Zeile-Description wird der Eltern-Beleg-Beschreibung vorangestellt für Text-Matching (z.B. „Diemut Winterauer Gehalt 03/2026").

## UI – `Reconciliation.tsx`
- Spalte „Zugeordneter Beleg" zeigt bei Split-Match zusätzlich die Zeile, z.B. `Lohnabrechnung 03 — Diemut Winterauer (1 234,00 €)`.
- Manuelle Zuordnung über `ReceiptAssignmentModal`: wenn der gewählte Beleg Splitzeilen hat, wird ein zweiter Schritt eingeblendet → Auswahl der Zeile, deren Betrag zur Bankbuchung passt. Zeilen, die bereits einer anderen Bank-Tx zugeordnet sind, werden ausgegraut.
- „Receipts ohne Zahlung" KPI / Liste: ein Splitbeleg gilt als bezahlt, wenn **alle** Splitzeilen zugeordnet sind; sonst als teilweise bezahlt (kleines „n/N bezahlt"-Badge).

## Hilfsbereich – `useReceipt`-Hook
- Beim Lesen eines Belegs zusätzlich die `bank_transactions`-Einträge mit `receipt_id=<id>` laden, um „teilweise bezahlt" sauber anzeigen zu können (außerhalb des Reconciliation-Screens nur Hinweis, keine Kernlogik dieser Änderung).

## Out of Scope
- Auto-Erkennung, dass die Summe von N Bankbuchungen exakt einem Ganz-Beleg ohne Splitzeilen entspricht (Kombi-Matching) – das wäre ein eigenes Feature.

## Dateien
- **Migration** (neu): Spalte + Index.
- `supabase/functions/auto-reconcile/index.ts`, `supabase/functions/reconcile-with-skonto/index.ts` – Pool erweitern, Match-Apply anpassen.
- `src/components/bank-import/ReceiptAssignmentModal.tsx` – Zeilenauswahl.
- `src/pages/Reconciliation.tsx` – Spalten-Anzeige.
- Optional `src/hooks/useReceipt*` – teilweise-bezahlt-Status.

Soll ich es so umsetzen?
