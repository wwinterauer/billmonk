
# Fix: Multi-Invoice-Erkennung beim Upload funktioniert nicht

## Ursache (Root Cause)

Der Upload-Prozess nutzt zwei verschiedene Wege zur KI-Analyse:

- **Weg A (Upload)**: `processReceiptWithAI` → `aiService.extractReceiptData(file)` → sendet `imageBase64 + mimeType` an die Edge Function (KEIN `receiptId`)
- **Weg B (Re-Analyse)**: Sendet `receiptId` direkt an die Edge Function

Der Multi-Invoice Check in der Edge Function befindet sich **ausschliesslich im Weg B** (Zeile 297). Sobald die Funktion `imageBase64 + mimeType` empfaengt (Weg A), springt sie direkt zur Extraktion – kein Seitencount, kein Multi-Check.

Das erklaert auch warum `page_count = NULL` in der Datenbank steht: Der Seitencount wird ebenfalls nur im Weg B gespeichert.

Beweis aus der Datenbank:
- "TEST RECHNUNG MIT 2 Rechnungen.pdf" → `page_count: NULL`, `split_suggestion: NULL`, `status: review`

## Loesung

Der Upload-Prozess muss auf Weg B umgestellt werden: `processReceiptWithAI` soll die `receiptId` an die Edge Function uebergeben statt die Datei als base64 zu senden. Die Datei liegt dann bereits in Storage – die Edge Function kann sie selbst herunterladen.

### Technische Aenderungen

**1. `src/services/aiService.ts`** – Neue Funktion hinzufuegen

Eine neue exportierte Funktion `extractReceiptDataById(receiptId)` die die Edge Function mit `{ receiptId }` aufruft statt mit `imageBase64`. Diese Funktion prueft ob die Antwort `needs_splitting: true` enthaelt und gibt das entsprechend zurueck.

```text
export async function extractReceiptDataById(receiptId: string): Promise<{
  result?: ExtractionResult;
  needs_splitting?: boolean;
  invoice_count?: number;
}>
```

**2. `src/hooks/useReceipts.ts`** – `processReceiptWithAI` umstellen

Statt `extractReceiptData(file)` wird `extractReceiptDataById(receiptId)` aufgerufen. Das receipt ist bereits in Storage vorhanden, wenn diese Funktion aufgerufen wird.

Wenn die Antwort `needs_splitting: true` zurueckgibt:
- Kein weiteres Processing (DB wird bereits von der Edge Function auf `needs_splitting` gesetzt)
- Das Receipt-Objekt aus der DB neu laden und zurueckgeben
- `aiSuccess: false` da keine Extraktion stattfand

**Ablauf nach dem Fix:**

```text
Upload -> Datei in Storage -> receiptId in DB (status: processing)
       -> Edge Function mit receiptId
            -> Datei aus Storage laden
            -> Seitencount berechnen + in DB speichern
            -> pageCount > 1? -> Multi-Invoice Check
                 -> Mehrere erkannt? -> status: needs_splitting, split_suggestion gesetzt -> fertig
                 -> Einzeln? -> KI-Extraktion -> status: review
```

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/services/aiService.ts` | Neue Funktion `extractReceiptDataById(receiptId)` |
| `src/hooks/useReceipts.ts` | `processReceiptWithAI` nutzt `extractReceiptDataById` statt `extractReceiptData(file)` |

## Erwartetes Ergebnis

Beim naechsten Upload einer PDF mit mehreren Rechnungen:
1. Seitencount wird korrekt ermittelt und gespeichert
2. Multi-Invoice Check wird ausgefuehrt
3. Status wechselt zu `needs_splitting` mit `split_suggestion`
4. In der Review-Ansicht erscheint die Multi-Invoice-Warnung und der "PDF aufteilen"-Dialog
