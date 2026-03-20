

# Umsetzungsplan: Bankanbindung-Tab + Finanz-Dashboard

## Überblick

Zwei Änderungen: (1) "Bankanbindung"-Tab in die zweite Zeile der Einstellungen verschieben, (2) Reconciliation-Seite um KPI-Karten und zwei neue Tabs erweitern.

---

## Teil 1: Settings — Bankanbindung in 2. Zeile

**Datei:** `src/pages/Settings.tsx` (Zeile 463-464)

`bank-live` wird in die `invoiceTabs`-Gruppe aufgenommen, damit der Tab in der zweiten Zeile erscheint.

---

## Teil 2: Reconciliation-Seite erweitern

**Datei:** `src/pages/Reconciliation.tsx` — kompletter Umbau der Seite.

### Neue KPI-Karten (oberhalb der Tabs)

Drei Zusammenfassungskarten mit eigenen `useQuery`-Aufrufen:

1. **Offene Rechnungen** — `invoices` mit `status IN ('sent', 'overdue')` und `paid_at IS NULL` → Anzahl + Gesamtbetrag
2. **Belege ohne Zahlung** — `receipts` mit `status IN ('approved', 'completed')` und `bank_transaction_id IS NULL` → Anzahl + Gesamtbetrag
3. **Zahlungen ohne Beleg** — `bank_transactions` mit `status = 'unmatched'` → Anzahl + Gesamtbetrag (bereits als Query vorhanden)

### Tab-Struktur

Bestehende Transaktionsliste bleibt, wird in Tabs eingebettet:

| Tab | Inhalt |
|-----|--------|
| **Transaktionen** | Bestehende Tabelle (unmatched/matched/ignored) |
| **Offene Rechnungen** | Unbezahlte Ausgangsrechnungen mit Nummer, Kunde, Betrag, Fälligkeitsdatum, Überfällig-Badge. Klick navigiert zu `/invoices/:id/edit`. Feature-gated auf `invoiceModule`. |
| **Fehlende Belege** | Ausgaben-Transaktionen (`is_expense = true`, `status = 'unmatched'`, `receipt_id IS NULL`) ohne Beleg. Zeigt Datum, Beschreibung, Betrag. Button "Beleg zuordnen" öffnet bestehendes Assignment-Modal. |

### Imports hinzufügen

- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` aus `@/components/ui/tabs`
- `Wallet`, `Receipt`, `FileWarning` Icons aus Lucide
- `FeatureGate` für Rechnungs-Tab
- `usePlan` Hook für Feature-Check

### Keine DB-Migration nötig

Alle Daten kommen aus bestehenden Tabellen (`bank_transactions`, `invoices`, `receipts`).

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/Settings.tsx` | 1 Zeile: `bank-live` in invoiceTabs-Filter |
| `src/pages/Reconciliation.tsx` | KPI-Karten, Tab-Struktur, neue Queries für Rechnungen + fehlende Belege |

