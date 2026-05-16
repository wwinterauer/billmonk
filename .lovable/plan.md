# Auszahlungsjournal & andere Nicht-Belege – bessere UX

## Ursache des aktuellen Verhaltens

Die Edge Function `extract-receipt` hat einen vorgeschalteten KI-Filter „Ist das überhaupt ein Beleg?". Bei deinem Dokument (`Auszahlungsjournal Dezember 2025.pdf`) klassifiziert sie:

> `document_type: "Auszahlungsjournal" – Internes Auszahlungsjournal/Lohnliste, kein externer Finanzbeleg.`

Daraufhin liefert sie nur `{ success: true, is_receipt: false, ... }` **ohne** `data`-Feld zurück. Der Frontend-Code prüft aber `if (!data?.success || !data?.data) throw "KI-Erkennung hat keine Daten…"` – daher der nichtssagende Toast. Die Split-Vorschlag-KI baut auf demselben Ergebnis auf → „Keine KI-Positionen".

Das ist also kein Bug der Extraktion, sondern fehlende UX für den Fall „Dokument wurde absichtlich nicht extrahiert".

---

## Was umgesetzt wird

### 1. Klare Fehlermeldung statt generischem Toast
In `src/components/receipts/ReanalyzeOptions.tsx` (Funktion `reanalyzeFields`, ~Zeile 154):
- Fall `data?.success === true && data?.is_receipt === false` gesondert behandeln.
- Toast (warning):
  - **Titel:** „Dokument ist kein klassischer Beleg"
  - **Beschreibung:** `Erkannt als „{document_type}". {reason} – Du kannst die Erkennung trotzdem erzwingen oder die Felder manuell ausfüllen.`
- Selbe Behandlung in `reanalyzeGeneral` und allen anderen Aufrufstellen von `extract-receipt` in derselben Datei.

### 2. Override-Button „Trotzdem extrahieren"
- Im selben Toast (oder im Reanalyze-Dropdown) einen Action-Button **„Trotzdem extrahieren"** anbieten.
- Klick ruft `extract-receipt` erneut auf mit neuem Flag `forceTreatAsReceipt: true`.
- Edge Function `supabase/functions/extract-receipt/index.ts` (~Zeile 958): Wenn `forceTreatAsReceipt === true`, den `is_receipt === false`-Branch überspringen und stattdessen den Datensatz mit den Best-Effort-Feldern (vendor/amount/date falls vorhanden) zurückgeben – inklusive Hinweis im `notes`-Feld, dass die Klassifizierung übersteuert wurde.
- Im Reanalyze-Menü zusätzlich permanent ein neuer Eintrag **„Klassifizierung übersteuern & extrahieren"** für Fälle, in denen der User von Anfang an weiß, dass es funktionieren soll.

### 3. Bestehende „Kein Beleg"-Belege wiederbeleben
Belege, die schon auf `category: 'Keine Rechnung'` stehen, zeigen aktuell nur den Hinweistext. Im Review-Panel (`ReceiptDetailPanel`) zusätzlich anzeigen:
- Banner „Wurde als ‚{document_type}' klassifiziert" mit zwei Buttons:
  - **„Trotzdem KI-Extraktion versuchen"** → ruft Force-Modus
  - **„Manuell ausfüllen"** → entfernt nur das Override-Flag, lässt User Felder selbst befüllen

### 4. Split-Vorschlag-UX
Im Split-Editor: Wenn der Beleg den Status „Keine Rechnung" / `is_receipt=false` hat, zeigen wir statt „Keine KI-Positionen erkannt – Analysiere den Beleg erneut" den Hinweis: „Dieses Dokument wurde nicht als Beleg erkannt. Erzwinge zuerst die KI-Extraktion über den Button oben, dann sind Split-Vorschläge möglich." – kein erneuter Re-Analyse-Loop, der wieder am Filter scheitert.

---

## Betroffene Dateien

- `supabase/functions/extract-receipt/index.ts` – neues `forceTreatAsReceipt`-Flag im Request-Body, Branch bei `is_receipt === false` überspringen.
- `src/services/aiService.ts` – Typ um optionales `forceTreatAsReceipt` erweitern.
- `src/components/receipts/ReanalyzeOptions.tsx` – Fehlerbehandlung, neuer Menüpunkt, Override-Action im Toast.
- `src/components/receipts/ReceiptDetailPanel.tsx` – Banner für bereits klassifizierte Nicht-Belege.
- `src/components/receipts/SplitSuggestionDialog.tsx` (oder entsprechender Split-Vorschlag-Component) – differenzierte Meldung bei `is_receipt=false`.

## Nicht enthalten

- Keine Änderung der Klassifizierungs-Heuristik selbst – Auszahlungsjournale bleiben standardmäßig „kein Beleg", aber per Klick übersteuerbar.
- Kein Backfill bestehender Datensätze.
