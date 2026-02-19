

# Extraktions-Hinweise + Duplikat-Schutz

## Uebersicht

Zwei Erweiterungen:
1. **Freitext-Hinweis pro Lieferant** ("Extraktions-Hinweis"): Der User kann der KI lieferantenspezifische Regeln mitgeben, z.B. "Betraege in Klammern sind Kosten" oder "Nur EUR-Betraege beruecksichtigen". Dieses Feld ist ein einfaches Textfeld neben den Keywords.
2. **Duplikat-Schutz im Prompt**: Die KI wird angewiesen, identische Betraege auf der Rechnung nicht doppelt zu zaehlen, sondern die tatsaechliche Anzahl der Zeilen zu respektieren.

---

## Aenderungen

### 1. Datenbank: Neue Spalte

```text
ALTER TABLE vendors ADD COLUMN extraction_hint text DEFAULT '';
```

Ein Freitext-Feld fuer beliebige Extraktions-Anweisungen pro Lieferant.

### 2. Vendor-Hook (`src/hooks/useVendors.ts`)

- `extraction_hint: string` zum Interface hinzufuegen
- In fetch/update mitlesen/-schreiben

### 3. VendorManagement.tsx -- zwei Fixes + neues Feld

**Fix 1: JSX-Verschachtelung reparieren**
Der "Nur Ausgaben extrahieren"-Block (ab Zeile 1401) ist aktuell innerhalb des `{formData.auto_approve && (...)}` Blocks eingeschlossen (durch falsche Einrueckung bei Zeile 1399). Die schliessenden Tags bei Zeilen 1493-1496 muessen korrigiert werden, damit der Expenses-Only-Block **unabhaengig** von der Auto-Approve-Einstellung sichtbar ist.

**Fix 2: Neues Textarea-Feld** unterhalb der Keywords (nur wenn "Nur Ausgaben extrahieren" aktiv):

```text
[x] Nur Ausgaben extrahieren
    Schlagwoerter: [Transaktionsgebuehr x] [Betreiber-Abo x]
    [____________________] [+ Hinzufuegen]

    Extraktions-Hinweis fuer die KI (optional):
    [Betraege in Klammern wie (0,51) sind Kosten.    ]
    [Bitte als positive Werte behandeln.              ]
```

Label: "Extraktions-Hinweis fuer die KI (optional)"
Placeholder: "z.B. Betraege in Klammern sind Kosten und sollen als positive Werte behandelt werden"
Max 500 Zeichen, 3 Zeilen Textarea.

### 4. ReanalyzeOptions.tsx

- Neues Prop `vendorExtractionHint?: string`
- Im "Nur Ausgaben extrahieren"-Dialog: Textarea fuer den Hinweis anzeigen (editierbar, initialisiert mit Vendor-Wert)
- Bei "Fuer diesen Lieferanten merken": Hint zusammen mit Keywords speichern
- Hint als `extractionHint: string` an die Edge Function mitschicken

### 5. Edge Function (`extract-receipt/index.ts`)

**Neuer Body-Parameter:** `extractionHint: string`

**Vendor-Lookup erweitern:** `extraction_hint` zusaetzlich laden

**Prompt-Logik erweitern:**

Wenn Keywords vorhanden, wird der Prompt um zwei Bloecke ergaenzt:

```text
GEZIELTE POSITIONS-EXTRAKTION:
Suche NUR nach Zeilen die folgende Begriffe enthalten:
- "Transaktionsgebuehr"
- "Betreiber-Abonnement"

WICHTIG - DUPLIKAT-VERMEIDUNG:
- Zaehle jede Zeile auf der Rechnung genau EINMAL
- Wenn der gleiche Betrag mehrfach in einer Zusammenfassung/Summenzeile 
  wiederholt wird, erfasse nur die Einzelposition, NICHT die Summenzeile
- Orientiere dich an den tatsaechlichen Einzelposten/Detailzeilen, 
  nicht an Zwischensummen oder Gesamtsummen die diese Positionen enthalten

LIEFERANTEN-SPEZIFISCHER HINWEIS:
Betraege in Klammern wie (0,51) sind Kosten. 
Bitte als positive Werte behandeln.
```

Der "Lieferanten-spezifischer Hinweis"-Block wird nur angehaengt wenn `extractionHint` nicht leer ist (aus Body ODER Vendor-DB, Body hat Vorrang).

Die Duplikat-Vermeidungsregel wird immer angehaengt wenn Keywords vorhanden sind.

### 6. Review.tsx + ReceiptDetailPanel.tsx

- `vendorExtractionHint` aus dem Vendor-Objekt laden und an ReanalyzeOptions weiterreichen
- Handler erweitern: bei "merken" auch den Hint via updateVendor speichern

---

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| Datenbank (Migration) | `extraction_hint text DEFAULT ''` auf `vendors` |
| `src/hooks/useVendors.ts` | `extraction_hint` in Interface + fetch/update |
| `src/components/settings/VendorManagement.tsx` | JSX-Fix + Textarea fuer Hint |
| `src/components/receipts/ReanalyzeOptions.tsx` | Hint-Prop + Textarea im Dialog + an Edge Function senden |
| `supabase/functions/extract-receipt/index.ts` | Hint laden, Duplikat-Regel + Hint-Block in Prompt einbauen |
| `src/pages/Review.tsx` | Hint an ReanalyzeOptions weiterreichen + bei merken speichern |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Hint an ReanalyzeOptions weiterreichen + bei merken speichern |
