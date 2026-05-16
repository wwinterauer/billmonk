# Auto-Freigabe absichern

Die Auto-Approve-Pfade in `useReceiptProcessing.ts` prüfen bereits Duplikate und Splitting, aber die **retroaktive** Auto-Freigabe in `useVendors.ts` (wenn Auto-Freigabe für einen Lieferanten in den Einstellungen oder im Review aktiviert wird) prüft nur `is_duplicate` — nicht `needs_splitting` oder Mehrfachrechnungen. Außerdem ist das `status='duplicate'` Filtering inkonsistent.

## Änderungen

### 1. `src/hooks/useVendors.ts` (retroaktive Freigabe, ~Zeile 400–450)
- SELECT erweitern: zusätzlich `status, split_suggestion` laden (sowohl bei linked als auch unlinked).
- Statusfilter: statt `.eq('status', 'review')` zusätzlich `needs_splitting` und `duplicate` ausschließen — d.h. nur `status = 'review'` bleibt, also passt. Aber: ein Beleg in `review` kann trotzdem `split_suggestion.contains_multiple_invoices === true` haben.
- Eligibility-Check ergänzen: ein Receipt nur dann freigeben wenn:
  - `!is_duplicate`
  - `status !== 'needs_splitting'` (sicherheitshalber, falls Filter umgangen)
  - `!(split_suggestion?.contains_multiple_invoices === true)`

### 2. `src/hooks/useReceiptProcessing.ts` (Pfad 1, ~Zeile 256–268)
- `isDuplicate` zusätzlich über `updateData.status === 'duplicate'` absichern (aktuell nur `updateData.is_duplicate === true`, sollte zwar auch passen, aber doppelt hält besser).
- Logik bleibt sonst gleich.

### 3. Keine Änderungen
- Pfad 2 in `useReceiptProcessing.ts` (Zeile 397–423) prüft bereits korrekt `is_duplicate` und `needs_splitting`/`contains_multiple_invoices` — bleibt unverändert.

## Effekt
- Belege mit Duplikat-Markierung oder Mehrfachrechnungs-Hinweis werden niemals automatisch freigegeben — weder direkt nach AI-Extraktion, nach manueller Vendor-Auswahl, noch beim nachträglichen Aktivieren von Auto-Freigabe für einen Lieferanten.
