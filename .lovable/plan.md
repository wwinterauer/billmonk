## Problem

Im `DuplicateComparisonModal` ruft der **Details**-Button `handleViewDetails` auf, das per `window.location.href = '/expenses?receipt=...'` auf die Ausgaben-Seite springt. Diese Seite liest den `?receipt=`-Parameter aktuell nicht aus, daher landet der User in der Übersicht statt im Beleg-Detail.

## Lösung

Zwei kleine Änderungen, die zusammen sicherstellen, dass "Details" immer im richtigen Beleg-Detail-Panel landet – auch wenn der Vergleich aus dem Review geöffnet wurde.

### 1. `DuplicateComparisonModal.tsx`
- Neue optionale Prop: `onViewReceipt?: (receiptId: string) => void`.
- `handleViewDetails(receiptId)`:
  - Schließt das Modal (`onOpenChange(false)`).
  - Wenn `onViewReceipt` vorhanden → ruft es mit der ID auf (kein Page-Reload, gleiche Seite).
  - Sonst Fallback: `navigate('/expenses?receipt=…')` via `useNavigate` (statt `window.location.href`, das einen vollen Reload auslöst).

### 2. `src/pages/Expenses.tsx`
- Prop `onViewReceipt={(id) => { setDuplicateComparisonOpen(false); openReceiptDetail(id); }}` an das Modal weiterreichen → öffnet direkt das vorhandene `ReceiptDetailPanel`.
- Beim Mount/URL-Change `?receipt=<uuid>` auslesen (`useSearchParams`) und bei vorhandenem Param `openReceiptDetail(id)` aufrufen + Param wieder aus der URL entfernen. Das deckt den Fall ab, wenn die Navigation aus Review (anderer Seite) kommt.

### 3. `src/pages/Review.tsx`
- Prop `onViewReceipt` **nicht** setzen → es greift der Navigations-Fallback nach `/expenses?receipt=…`, wo Punkt 2 das Detail-Panel automatisch öffnet.

## Was sich **nicht** ändert
- Vergleichs-Logik, Lösch-Logik (`handleDelete`, Promotion eines Duplikats zum Original) bleibt unverändert.
- Keine Migration, keine RLS-Änderung.

## Dateien
- `src/components/receipts/DuplicateComparisonModal.tsx`
- `src/pages/Expenses.tsx`
