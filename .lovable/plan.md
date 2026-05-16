## Befund

Die drei Diemut-Winterauer-Buchungen (3× 467,64 €) **sind** in der Datenbank bereits korrekt der jeweiligen Splitzeile zugeordnet (`bank_transactions.status='matched'`, `receipt_id` + `receipt_split_line_id` gesetzt). Die Auto-Reconcile-Logik funktioniert also.

Das Problem ist die **Anzeige**:

1. In Spalte „Zugeordneter Beleg" wird nur der Eltern-Beleg angezeigt: `Winterauer Wilfried u. Julia (1.175,66 €)`. Da der Betrag (1.175,66) nicht zum Bank-Betrag (467,64) passt, wirkt das wie eine falsche Zuordnung – obwohl die Zeile korrekt zugewiesen ist.
2. Im KPI „Belege ohne Zahlung" und in der Liste werden Splitbelege immer als „unbezahlt" gezählt, weil dort nur `receipts.bank_transaction_id IS NULL` geprüft wird – Splitbelege setzen dieses Feld bewusst nicht.
3. `ReceiptAssignmentModal` lädt die Splitzeile beim Trennen / Neu-Zuordnen nicht zurück (Schritt 2 startet leer).

## Änderungen (nur Frontend)

### A) `Reconciliation.tsx` – Spalte „Zugeordneter Beleg"
- Query um `receipt_split_line_id` und Join `receipt_split_lines:receipt_split_line_id ( id, description, amount_gross )` erweitern.
- Anzeige:
  - Whole-Match (keine Zeile): wie heute.
  - Split-Match: `Vendor — Linienbeschreibung (Linienbetrag)`, z. B. `Winterauer Wilfried u. Julia — WINTERAUER, Diemuth (467,64 €)`.
- `handleUnmatch` zusätzlich `receipt_split_line_id: null` setzen (steht schon in Z. 559, prüfen dass es überall greift).

### B) KPI „Belege ohne Zahlung" + Tab „Fehlende Belege" – split-aware
- Neue Query lädt alle Belege mit `is_split_booking=true` plus deren Splitzeilen plus zugehörige `bank_transactions.receipt_split_line_id`.
- Ein Splitbeleg gilt als **bezahlt**, wenn jede Splitzeile in `bank_transactions` mit `status='matched'` referenziert ist. Sonst **teilweise bezahlt** – zählt mit (Anzahl offener Zeilen, Summe offener Zeilenbeträge) in das KPI.
- Whole-Belege: weiterhin nur `bank_transaction_id IS NULL` zählen.
- KPI-Label bleibt; Zahl und Gesamtsumme spiegeln die neue Logik wider.

### C) `ReceiptAssignmentModal.tsx` – Re-Assign / Vorauswahl
- Beim Öffnen für eine bereits gematchte Transaktion: aktuelle `receipt_split_line_id` als Default in Schritt 2 vorauswählen.
- Bereits durch **andere** Bank-Tx belegte Zeilen bleiben deaktiviert (bestehende Logik).

### D) `useSplitLines` ist bereits vorhanden – wiederverwenden
- Für KPI-Aggregation und Anzeige derselbe Hook bzw. eine kleine Helferfunktion `isSplitReceiptFullyPaid(receipt, lines, matchedLineIds)`.

## Out of Scope
- Keine Änderung an `auto-reconcile` / `reconcile-with-skonto` – Matching funktioniert.
- Kein Kombi-Matching (N Banktx → 1 Ganz-Beleg).
- Keine DB-Migration nötig.

## Dateien
- `src/pages/Reconciliation.tsx` (Query erweitern, KPI-Query split-aware, Spalten-Anzeige).
- `src/components/bank-import/ReceiptAssignmentModal.tsx` (Vorauswahl bestehender Splitzeile).
- ggf. kleine Helferfunktion in `src/hooks/useSplitLines.ts`.

Soll ich das so umsetzen?
