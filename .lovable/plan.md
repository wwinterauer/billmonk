# Warum die beiden Würth-Belege nicht als Duplikat erkannt wurden

**Datenlage in der DB:**

| Feld | Beleg A (12:57:11) | Beleg B (12:57:16) |
|---|---|---|
| Lieferant | `Würth Hochenburger` | `W H` |
| Rechnungsnr. | `08/9445535` | `08/9445535` |
| Datum | 22.04.2026 | 22.04.2026 |
| Betrag | 2515,78 | 2515,78 |
| File-Hash | unterschiedlich | unterschiedlich |

**Zwei Probleme verursachen das Versagen:**

### 1. Race Condition bei parallelem Upload (Hauptursache)
Die Duplikatsprüfung in `useReceiptUpload.ts` läuft **nach** der AI-Extraktion. Beide Belege wurden aber in 5 Sekunden Abstand parallel verarbeitet. Als Beleg B seine Prüfung gestartet hat, war Beleg A noch nicht final mit `invoice_number` in der DB — Stufe 5 (Rechnungsnummer-only-Match) hat daher nichts gefunden. Nach Abschluss beider Belege findet **kein Recheck** mehr statt.

### 2. Lieferant „W H" statt „Würth Hochenburger"
Die AI hat bei einem der beiden Scans den Lieferanten verstümmelt. Damit greifen die Stufen 2–4 (vendor-gebundene Matches) nicht. Stufe 5 würde noch greifen — wäre da nicht die Race Condition.

---

# Lösungsplan

### A) Race-Condition beheben (Kern-Fix)

**`supabase/functions/extract-receipt/index.ts`** — am Ende der Verarbeitung, nachdem `invoice_number`/`vendor`/`amount_gross`/`receipt_date` final gespeichert wurden:

1. SELECT auf andere Belege desselben Users mit gleicher `invoice_number` (oder gleichem Betrag+Datum), die in den letzten z. B. 10 Minuten erstellt/aktualisiert wurden und nicht der aktuelle Beleg sind.
2. Falls Treffer → den **neueren** Beleg als `is_duplicate=true, duplicate_of=<älterer>` markieren.

Damit wird bidirektional erkannt: egal welcher von beiden zuletzt fertig wird, der spätere markiert sich selbst.

### B) Vendor-Matching robuster machen

In `duplicateDetectionService.ts` → `applyVendorFilter`:
- Statt strenger `eq` für kurze Namen (<6 Zeichen) → `ilike` mit dem ersten Token, plus normalisierte Variante (Leerzeichen/Sonderzeichen entfernt).
- Bei sehr kurzen/abgekürzten Namen (z. B. „W H") zusätzlich Fallback auf Stufe 5 (Rechnungsnr.-only) garantieren — das passiert heute schon, scheitert aber nur an A).
- Optional: über `vendor_id` joinen statt über String — wenn beide Belege später demselben Lieferanten-Datensatz zugeordnet sind, ist das viel zuverlässiger.

### C) Konkretes Aufräumen für die zwei bestehenden Belege

Einmaliges Markieren des neueren Belegs (`970aa00c…`, „W H") als Duplikat von `1574e2ca…` per Migration oder UI-Action „Als Duplikat markieren".

### D) (Optional, empfohlen) DB-Schutz

Partieller Unique-Index als zusätzliches Sicherheitsnetz:
```sql
CREATE UNIQUE INDEX receipts_user_vendor_invoice_uniq
  ON receipts (user_id, vendor_id, invoice_number)
  WHERE invoice_number IS NOT NULL
    AND vendor_id IS NOT NULL
    AND status NOT IN ('rejected','not_a_receipt');
```
Greift erst, sobald `vendor_id` zugewiesen ist — verhindert echte Duplikate hart.

---

# Technische Details

- **Datei-Änderungen:** `supabase/functions/extract-receipt/index.ts` (Post-Save-Recheck), `src/services/duplicateDetectionService.ts` (Vendor-Filter lockern, optional `vendor_id`-Pfad).
- **Keine UI-Änderungen** nötig — der bestehende Duplikat-Banner/Filter zeigt das Ergebnis automatisch.
- **Migration** nur falls D) gewünscht.

Soll ich A) + B) + C) umsetzen, und D) zur Wahl stellen?
