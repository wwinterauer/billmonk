## Ziel

In der Ausgabenübersicht (`/expenses`) sollen Rechnungen mit Splitbuchung (`is_split_booking = true`) zwei neue Funktionen bekommen:

1. **Aufklappbare Tabellenzeilen**, die die einzelnen Buchungssätze (Splitlines) direkt in der Tabelle zeigen.
2. **Ein Filter**, mit dem nur Rechnungen mit Splitbuchungen angezeigt werden können.

## Darstellungs-Konzept (Aufklappen)

- In der ersten Spalte (Checkbox-Spalte) bekommt jede Zeile eines Splitbuchungs-Belegs zusätzlich einen kleinen **Chevron-Button** (▶ / ▼) links neben oder anstelle eines kleinen Indikators. Nur sichtbar wenn `is_split_booking === true`.
- Klick auf Chevron toggelt einen lokalen `expandedIds: Set<string>` State.
- Beim Aufklappen wird **direkt unter** der Belegzeile eine zusätzliche `<TableRow>` mit einer einzigen `<TableCell colSpan={...}>` eingefügt. Innerhalb dieser Zelle wird eine **kompakte Sub-Tabelle** der Splitlines gerendert (leicht eingerückt, dezenter Hintergrund `bg-muted/30`, schmalerer Text).
- Spalten der Sub-Tabelle:
  - Beschreibung
  - Kategorie
  - Buchungsart (Tax Type)
  - MwSt %
  - Netto
  - MwSt
  - Brutto
  - Privat-Badge (wenn `is_private`)
- Daten kommen aus dem bereits vorhandenen Hook `useSplitLines` (siehe `src/hooks/useSplitLines.ts`). Wir laden die Splitlines für **alle aktuell sichtbaren Splitbuchungs-Belege auf der Seite** in einem Query (`receiptIds` = IDs der `paginatedReceipts` mit `is_split_booking`), damit das Aufklappen sofort funktioniert ohne Nachladen.
- Falls für einen Beleg keine Splitlines gefunden werden, zeigt die Sub-Zeile einen dezenten Hinweis "Keine Buchungssätze gefunden".

## Filter

- Neuer Filter-State `splitFilter: 'all' | 'split' | 'no_split'` (Default `'all'`).
- Neues Dropdown in der Filterleiste neben dem bestehenden „Rechnungsnr."-Filter mit Optionen:
  - Alle Belege
  - Nur mit Splitbuchung
  - Nur ohne Splitbuchung
- Anwendung in `filteredReceipts`-Memo (Standard-Filter-Pattern wie bestehende Filter).
- Filter wird in den Reset-Effekt für `currentPage` aufgenommen.
- Filter ist nur sichtbar/aktivierbar wenn `splitBookingEnabled` (Feature-Flag aus `usePlan`).

## Technische Details

**Datei:** `src/pages/Expenses.tsx`

- Neuer State: `const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())`.
- Neuer State: `const [splitFilter, setSplitFilter] = useState<'all'|'split'|'no_split'>('all')`.
- IDs der sichtbaren Split-Belege per Memo:
  ```ts
  const visibleSplitReceiptIds = useMemo(
    () => paginatedReceipts.filter(r => (r as any).is_split_booking).map(r => r.id),
    [paginatedReceipts]
  );
  ```
- `useSplitLines(splitBookingEnabled && visibleSplitReceiptIds.length > 0, visibleSplitReceiptIds)` zum Laden.
- Im `paginatedReceipts.map`-Render-Block: nach der `<TableRow>` ggf. eine zweite `<TableRow>` mit Sub-Tabelle ausgeben, wenn `expandedIds.has(receipt.id)`. ColSpan = `1 (checkbox) + orderedVisibleColumns.length + 1 (actions)`.
- Chevron-Toggle in der Checkbox-Zelle als kleines Icon links neben der Checkbox (nur wenn Splitbuchung). Verwendung `ChevronRight` / `ChevronDown` aus lucide-react.
- Splitlines pro Beleg gruppieren via `useMemo` `Map<receiptId, SplitLine[]>`.
- `filteredReceipts`-Memo um Split-Filter erweitern und `splitFilter` zur Dependency-Liste hinzufügen.
- Page-Reset-Effekt um `splitFilter` ergänzen.

**Keine Schemaänderungen, keine Backend-Änderungen.** Reine UI-Erweiterung auf vorhandenen Daten (`receipts.is_split_booking`, Tabelle `receipt_split_lines` via `useSplitLines`).
