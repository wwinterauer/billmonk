

# Skonto-Betrag anzeigen + Auto-Reconcile mit Skonto-Erkennung

## Problem

1. Im **InvoiceEditor** und in der **Rechnungsübersicht** fehlt der Zahlbetrag nach Skonto
2. Der **Auto-Reconciler** erkennt nur den vollen Rechnungsbetrag — wenn ein Kunde mit Skonto zahlt (z.B. 485€ statt 500€), wird die Zahlung nicht zugeordnet

## Änderungen

### 1. `src/pages/InvoiceEditor.tsx` — Zahlbetrag nach Skonto anzeigen

Nach der bestehenden Skonto-Zeile (Zeile 833-838) eine neue Zeile einfügen:

```text
Skonto (3% bei Zahlung innerhalb von 14 Tagen)    −€15,00
Zahlbetrag bei Skonto                              €485,00   ← NEU (fett, grün)
```

Berechnung: `totals.total - totals.discountAmount`

### 2. `src/pages/Invoices.tsx` — Betragsspalte erweitern

In der Tabelle (Zeile 483) unter dem Gesamtbetrag bei Rechnungen mit `discount_percent > 0` eine zweite Zeile anzeigen:

```text
€500,00
Skonto: €485,00   ← text-xs text-muted-foreground
```

Berechnung: `inv.total * (1 - inv.discount_percent / 100)`

### 3. `supabase/functions/auto-reconcile/index.ts` — Skonto-Matching

Aktuell matcht der Reconciler nur `inv.total ± 0.02€`. Erweiterung:

- `discount_percent` im SELECT mit abfragen
- Für jede Rechnung **zwei** Beträge prüfen:
  - Voller Betrag (`inv.total`) → Status wird `paid`
  - Skonto-Betrag (`inv.total * (1 - discount_percent/100)`) → Status wird `paid_with_skonto`
- Bei Skonto-Match zusätzlich `discount_amount` berechnen und speichern

```text
Transaktion: €485,00
  → Rechnung RE-2024-001: Gesamt €500,00, Skonto 3% = €485,00
  → Match! → Status: paid_with_skonto, discount_amount: €15,00
```

### Dateien
- `src/pages/InvoiceEditor.tsx` — Zahlbetrag nach Skonto im Totals-Bereich
- `src/pages/Invoices.tsx` — Skonto-Betrag in der Betragsspalte
- `supabase/functions/auto-reconcile/index.ts` — Skonto-Erkennung beim Kontoabgleich

