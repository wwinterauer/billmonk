# Limberger/WeTi: warum zwei Buchungen offen bleiben

## Befund aus den Daten

Die beiden offenen Buchungen sind:
- 10.04.2026, 18,90 € – Verwendungszweck enthält `INET2602889`
- 08.05.2026, 39,90 € – Verwendungszweck enthält `INET2603766`

Die passenden Belege existieren, sind aber **falsch verknüpft** — die Zuordnung ist um einen Monat verschoben:

```text
Beleg INET2602889 (08.04., 18,90) -> Buchung 08.05. (INET2603698)   falsch
Beleg INET2603698 (06.05., 18,90) -> Buchung 11.06. (INET2604509)   falsch
Beleg INET2603766 (06.05., 39,90) -> Buchung 11.06. (INET2604576)   falsch
```

Dadurch bleiben die Buchungen vom 10.04. und 08.05. ohne freien Beleg übrig.

**Ursache 1 – Rechnungsnummer wird nicht erkannt:** Die Belegnummern sind als `INET2602889/08.04.2026` gespeichert (mit angehängtem Datum). Der Referenz-Abgleich prüft, ob die Belegnummer im Buchungstext vorkommt — mit dem Datumssuffix schlägt das fehl. Also greift nur der Betrags-/Datums-Abgleich, der bei monatlich gleichen Beträgen den zeitlich nächsten Beleg nimmt: die Buchung kommt aber immer ~2–4 Tage *nach* dem Belegdatum bzw. beim nächsten Lauf auch mal davor, und so verrutscht die Kette.

**Ursache 2 – neuere WeTi-Belege haben den Nettobetrag als Bruttobetrag:** Die Belege ab Juni sind mit 15,75 € und 33,25 € erfasst; die zugehörigen Buchungen lauten auf 18,90 € und 39,90 € (= netto + 20 % USt). Diese Belege können über den Betrag also gar nicht gefunden werden.

## Was geändert wird

**1. Rechnungsnummer-Abgleich robust machen**
- Belegnummern werden vor dem Vergleich normalisiert: angehängte Datums-/Suffixteile (`/08.04.2026`), Leerzeichen und Sonderzeichen werden entfernt; verglichen wird der reine Nummernkern (`INET2602889`).
- Zusätzlich wird umgekehrt geprüft: alle Referenz-Token aus dem Buchungstext (Muster wie `INET…`, `RE…`, längere Zahlen-/Buchstabenfolgen) werden gegen die Belegnummern geprüft.
- Ein Referenztreffer schlägt den Datumsabgleich immer: Wenn Beleg und Buchung dieselbe Nummer tragen, wird diese Paarung fest gesetzt, bevor Betrags-/Datumspaarungen gebildet werden.

**2. Falsche Verschiebungen verhindern**
- Bei mehreren gleich hohen Beträgen desselben Lieferanten wird zuerst über Referenznummern zugeordnet, erst der Rest chronologisch.
- Buchungen werden bevorzugt Belegen zugeordnet, deren Datum **vor** der Buchung liegt (Zahlung folgt der Rechnung); ein Beleg nach dem Buchungsdatum wird nur bei fehlender Alternative genutzt.

**3. Bestehende Fehlzuordnungen korrigieren**
- Einmaliger Korrekturlauf für die betroffenen WeTi/Limberger-Verknüpfungen, sodass jeder Beleg an der Buchung mit derselben `INET`-Nummer hängt und die beiden offenen Buchungen ihren richtigen Beleg bekommen.

**4. Netto-statt-Brutto bei WeTi**
- Prüfung und Korrektur der betroffenen Belege (Juni/Juli/August: 15,75 / 33,25) auf den Bruttobetrag inkl. 20 % USt, damit auch diese Buchungen künftig automatisch gefunden werden.
- Zusätzlich Hinweis im Abgleich: Wenn ein Beleg exakt dem Buchungsbetrag geteilt durch 1,2 / 1,1 / 1,13 entspricht, wird er als Vorschlag mit dem Hinweis „vermutlich Netto erfasst“ angezeigt statt gar nicht.

## Technische Details

- `supabase/functions/_shared/reconcileHelpers.ts`
  - Neu `normalizeRef(value)` und `extractRefTokens(description)`; `referenceKey`-Vergleich beidseitig und auf normalisierten Kernen.
  - Referenz-Pass läuft vor Gruppen-/Datumspass und blockiert bereits gepaarte IDs.
  - Datumsauswahl bevorzugt `receipt_date <= transaction_date` (Fenster wie bisher, Fallback auf spätere Belege).
  - Netto-Heuristik in `buildSuggestions`: Kandidat gilt als Treffer, wenn `amount_gross * (1 + r)` für r ∈ {0,10; 0,13; 0,20} dem Buchungsbetrag entspricht (Konfidenz „mittel“, Grund ausgewiesen).
- `supabase/functions/reconcile-with-skonto/index.ts` und `auto-reconcile`: nutzen die erweiterten Helper, Deploy beider Funktionen.
- `src/components/reconciliation/SkontoReconcileDialog.tsx`: neuer Grund-Badge „Rechnungsnummer“ bzw. „Netto/Brutto“.
- Datenkorrektur per gezieltem Update auf `receipts.bank_transaction_id` / `bank_transactions.receipt_id` + `status` für die betroffenen WeTi-Datensätze; keine Schemaänderung.
