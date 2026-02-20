
# Bug-Fix: KI-Neu-Analyse überschreibt Felder sofort wieder

## Ursache

Die Neu-Analyse in der Einzelbelegbearbeitung (`ReceiptDetailPanel`) leidet unter einem Race Condition / Overwrite-Problem mit **zwei unabhängigen Fehlerquellen**.

### Fehlerquelle 1: `onReanalyzeComplete` überschreibt die gerade gesetzten Werte

Der Ablauf in `ReanalyzeOptions.tsx` ist:

1. `onFieldsUpdated(updates)` wird aufgerufen → setzt React-State in-memory (z.B. vendor = "Shen Zhen...", vat_rate = "0")
2. Danach sofort: `onReanalyzeComplete?.()` wird aufgerufen

In `ReceiptDetailPanel.tsx` ist `onReanalyzeComplete` (Zeile 1114-1144) so implementiert:
```typescript
onReanalyzeComplete={async () => {
  // Reload receipt data and re-populate form
  if (receiptId) {
    // Fetches OLD data from DB (AI hasn't saved to DB yet!)
    const { data: r } = await supabase.from('receipts').select(...)...
    // Overwrites everything with DB values!
    setVendor(r.vendor || '');
    setVatRate(r.vat_rate !== null ? r.vat_rate.toString() : '20');
    // ...etc
  }
}}
```

Das Problem: `reanalyzeFields` in `ReanalyzeOptions.tsx` schreibt die extrahierten Werte **nie in die Datenbank** — es ruft nur `onFieldsUpdated` (in-memory) auf. Der anschließende DB-Fetch in `onReanalyzeComplete` liest daher die alten Werte und überschreibt die soeben gesetzten.

### Fehlerquelle 2: Vendor-Feld bei `null` wird nicht überschrieben (sekundär)

In `ReanalyzeOptions.tsx` Zeile 165:
```typescript
if (shouldUpdate('vendor') && normalized.vendor) {
```
Der `&& normalized.vendor`-Check verhindert, dass ein leerer/null-Vendor (der in `onFieldsUpdated` via `??` den alten Wert beibehält) gesetzt wird — das ist eigentlich gewollt, aber bei `vat_rate = 0` gibt es ein ähnliches Muster.

### Fehlerquelle 3: VAT-Rate 0% (Null-Check korrekt, aber Folgeberechnung falsch)

In `Review.tsx` Zeile 382-383:
```typescript
const vatRate = parseFloat(formData.vat_rate) || 0;
const net = gross / (1 + vatRate / 100);
```
`parseFloat("0") || 0` ergibt korrekt `0`, aber dann ist `net = gross / 1 = gross` und `vat = 0`. Das stimmt — aber in `populateForm` Zeile 287:
```typescript
const vatRateVal = receipt.vat_rate !== null && receipt.vat_rate !== undefined ? receipt.vat_rate : 20;
```
Das ist korrekt für 0%. Das Problem liegt woanders.

## Lösung

### Strategie

Die `onReanalyzeComplete`-Callback in `ReceiptDetailPanel.tsx` soll **keinen vollständigen Form-Reload** mehr durchführen. Stattdessen genügt es, `onUpdate()` zu rufen (damit die übergeordnete Liste den aktualisierten Status sieht) und den Receipt-State partiell zu aktualisieren — aber **ohne** die Felder, die gerade vom AI-Update gesetzt wurden, zu überschreiben.

Die einfachste und sicherste Lösung: Den vollständigen Re-Populate in `onReanalyzeComplete` entfernen. Das `onFieldsUpdated` setzt bereits alle relevanten Felder. `onReanalyzeComplete` muss nur `onUpdate()` rufen, um das Parent über die Änderung zu informieren.

### Änderung 1: `src/components/receipts/ReceiptDetailPanel.tsx`

**Zeile 1114-1144** – `onReanalyzeComplete` Callback vereinfachen:

```typescript
// VORHER: lud alle Felder aus DB neu und überschrieb onFieldsUpdated-Werte
onReanalyzeComplete={async () => {
  if (receiptId) {
    const { data: r } = await supabase.from('receipts')...
    setVendor(r.vendor || '');       // ← überschreibt onFieldsUpdated!
    setVatRate(r.vat_rate...);       // ← überschreibt 0% mit altem Wert!
    // ... alle anderen Felder ...
    onUpdate();
  }
}}

// NACHHER: nur onUpdate für Parent-Benachrichtigung, kein Overwrite
onReanalyzeComplete={() => {
  onUpdate();
}}
```

**Warum das sicher ist:** `onFieldsUpdated` (direkt davor aufgerufen) setzt bereits alle Felder, die die KI aktualisiert hat. Ein erneutes Laden aus der DB ist zu diesem Zeitpunkt nicht nötig — die KI-Extraktion schreibt die Werte in `reanalyzeFields` ohnehin nicht in die DB (das passiert erst beim expliziten Speichern durch den Nutzer). Der `onUpdate()`-Aufruf genügt, um die übergeordnete Komponente (z.B. Expenses-Liste) zu informieren.

### Änderung 2: `src/pages/Review.tsx`

Der `onReanalyzeComplete` in Review.tsx (Zeile 822-836) lädt ebenfalls die Receipt-Daten aus der DB neu:
```typescript
onReanalyzeComplete={async () => {
  if (currentReceipt) {
    const { data } = await supabase.from('receipts').select('*').eq('id', currentReceipt.id).maybeSingle();
    if (data) {
      const updatedReceipts = [...receipts];
      updatedReceipts[currentIndex] = data as Receipt; // überschreibt lokalen State!
      setReceipts(updatedReceipts);
    }
  }
}}
```

Diese DB-Reload-Logik muss ebenfalls entfernt werden, da die in-memory Updates durch `handleReanalysisUpdate` (den `onFieldsUpdated`-Callback) bereits korrekt gesetzt wurden.

```typescript
// NACHHER: leer lassen oder Query-Cache invalidieren (ohne setReceipts)
onReanalyzeComplete={() => {
  // Kein DB-Reload nötig – handleReanalysisUpdate hat bereits alle Felder aktualisiert
  queryClient.invalidateQueries({ queryKey: ['receipts'] });
}}
```

### Zusammenfassung der Änderungen

| Datei | Zeile | Änderung |
|-------|-------|----------|
| `src/components/receipts/ReceiptDetailPanel.tsx` | 1114-1144 | `onReanalyzeComplete`: vollständigen DB-Reload und Form-Re-Populate entfernen, nur `onUpdate()` behalten |
| `src/pages/Review.tsx` | 822-836 | `onReanalyzeComplete`: DB-Reload und `setReceipts` entfernen, nur Cache-Invalidierung behalten |

## Erwartetes Verhalten nach dem Fix

**Szenario "Komplett neu" / "Intelligent" Analyse:**
1. KI analysiert den Beleg
2. `onFieldsUpdated` setzt alle extrahierten Felder in-memory (vendor = "Shen Zhen...", vat_rate = "0")
3. `onReanalyzeComplete` ruft nur `onUpdate()`/Cache-Invalidierung – **kein Overwrite mehr**
4. Alle Felder zeigen korrekt die KI-Werte
5. Nutzer kann prüfen und manuell speichern

**Szenario MwSt 0%:**
- `normalized.vat_rate = 0` → `"0" !== null` → wird in `updates.vat_rate` geschrieben → `"0"` ist nicht `undefined` → `handleReanalysisUpdate` setzt `vat_rate: "0"` korrekt
- Kein Overwrite mehr durch `onReanalyzeComplete`
- Das Feld zeigt "0%" korrekt
