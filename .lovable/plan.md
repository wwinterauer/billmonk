

# Extraction-Keywords fuer Lieferanten

## Uebersicht

Erweiterung des "Nur Ausgaben extrahieren"-Features um benutzerdefinierte **Schlagwoerter** pro Lieferant. Die Keywords steuern, welche Rechnungszeilen die KI extrahiert. Sie koennen sowohl in den Lieferanten-Einstellungen als auch direkt im "Nur Ausgaben extrahieren?"-Dialog der Review/Belegbearbeitung gepflegt werden. Beide Stellen zeigen und bearbeiten dieselben Daten.

---

## Aenderungen

### 1. Datenbank: Neue Spalte

```text
ALTER TABLE vendors ADD COLUMN extraction_keywords text[] NOT NULL DEFAULT '{}';
```

### 2. Vendor-Hook (`src/hooks/useVendors.ts`)

- `extraction_keywords: string[]` zum `Vendor`-Interface hinzufuegen
- In `fetchVendors()` mitlesen (mit Default `[]`)
- In `updateVendor()` mitschreiben

### 3. Lieferanten-Verwaltung (`src/components/settings/VendorManagement.tsx`)

Unterhalb des "Nur Ausgaben extrahieren"-Switches (Zeile ~1412), nur sichtbar wenn Switch aktiv:

- `extraction_keywords` ins `formData` aufnehmen (Default `[]`)
- In `openEditDialog()` und `resetForm()` beruecksichtigen
- In `handleSave()` mitspeichern
- UI: Keyword-Chips mit X-Button zum Entfernen + Input mit "Hinzufuegen"-Button
- Hinweistext: "Die KI extrahiert nur Zeilen die diese Begriffe enthalten. Ohne Schlagwoerter werden allgemein alle Kosten erfasst."

```text
[x] Nur Ausgaben extrahieren
    Schlagwoerter fuer Kosten-Positionen:
    [Transaktionsgebuehr  x] [Betreiber-Abonnement  x]
    [____________________] [+ Hinzufuegen]
```

### 4. ReanalyzeOptions (`src/components/receipts/ReanalyzeOptions.tsx`)

**Props erweitern:**
- `vendorExtractionKeywords?: string[]` -- aktuelle Keywords vom Vendor

**"Nur Ausgaben extrahieren?"-Dialog erweitern (Zeile ~599-640):**
- Keyword-Verwaltung direkt im Dialog: gleiche Chip + Input UI wie in VendorManagement
- Lokaler State fuer Keywords, initialisiert mit `vendorExtractionKeywords`
- Nutzer kann Keywords hinzufuegen/entfernen bevor er "Nur Ausgaben analysieren" klickt
- Bei "Fuer diesen Lieferanten merken": Keywords + Flag werden zusammen gespeichert
- Keywords werden an die Edge Function als Body-Parameter `extractionKeywords: string[]` mitgeschickt

**Callback erweitern:**
- `onExpensesOnlyReanalyze` aendern zu `onExpensesOnlyReanalyze?: (rememberForVendor: boolean, keywords?: string[]) => void`

### 5. Edge Function (`supabase/functions/extract-receipt/index.ts`)

**Neuer Body-Parameter:** `extractionKeywords: string[]`

**Vendor-Lookup erweitern (Zeile ~370):**
- Zusaetzlich `extraction_keywords` laden

**Prompt-Logik (Zeile ~376-401):**
- Wenn Keywords vorhanden (aus Body ODER Vendor-DB): gezielten Prompt verwenden
- Wenn keine Keywords: bisherigen allgemeinen "Nur Ausgaben"-Prompt beibehalten

```text
WENN Keywords vorhanden:
  "Suche NUR nach Zeilen/Positionen die folgende Begriffe enthalten:
   - Transaktionsgebuehr
   - Betreiber-Abonnement
   Erfasse Brutto, Netto, MwSt fuer jede gefundene Position.
   amount_gross = Summe aller gefundenen Positionen.
   Bei verschiedenen MwSt-Saetzen: is_mixed_tax_rate = true"

WENN keine Keywords:
  Bisheriger allgemeiner Prompt bleibt unveraendert
```

### 6. Review.tsx + ReceiptDetailPanel.tsx

- `vendorExtractionKeywords` aus dem Vendor-Objekt laden und an `ReanalyzeOptions` weiterreichen
- `onExpensesOnlyReanalyze`-Handler erweitern: bei `rememberForVendor=true` auch die Keywords via `updateVendor()` speichern

---

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| Datenbank (Migration) | `extraction_keywords text[]` auf `vendors` |
| `src/hooks/useVendors.ts` | Interface + fetch/update |
| `src/components/settings/VendorManagement.tsx` | Keyword-Chips UI unter expenses_only Switch |
| `src/components/receipts/ReanalyzeOptions.tsx` | Keywords im Dialog + an Edge Function senden |
| `supabase/functions/extract-receipt/index.ts` | Keywords laden, gezielten Prompt bauen |
| `src/pages/Review.tsx` | Keywords an ReanalyzeOptions weiterreichen |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Keywords an ReanalyzeOptions weiterreichen |

