
# Nettobetrag/MwSt-Betrag: Alignment-Fix und manuelle Ueberschreibung

## Uebersicht

Zwei Probleme werden behoben:
1. **Alignment**: Nettobetrag und MwSt-Betrag sind nicht auf gleicher Hoehe (fehlendes `items-end` im Grid)
2. **Manuelle Ueberschreibung**: Beide Felder sind aktuell `readOnly` und rein berechnet -- sie muessen editierbar werden, mit der berechneten Variante als Placeholder

Beide Fixes betreffen `src/pages/Review.tsx` und `src/components/receipts/ReceiptDetailPanel.tsx`.

---

## Aenderungen

### 1. Review-Seite (`src/pages/Review.tsx`)

**FormData erweitern** (Zeile ~128-141):
- Neue Felder `amount_net_override: string` und `vat_amount_override: string` hinzufuegen (Standard: leer)
- Beim Laden eines Belegs: Falls `amount_net` oder `vat_amount` in der DB gesetzt sind und vom berechneten Wert abweichen, als Override vorbelegen

**Netto/MwSt-Grid (Zeile 1157-1180)**:
- `items-end` zum Grid hinzufuegen fuer korrekte Ausrichtung
- `readOnly` entfernen, Felder zu editierbaren `Input type="number"` machen
- Berechneten Wert als `placeholder` anzeigen (z.B. `10.00 (berechnet)`)
- `onChange` schreibt in `amount_net_override` / `vat_amount_override`
- Styling: Wenn Override leer (= berechnet), bleibt `bg-muted`; bei manuellem Wert normaler Input-Style

**Save-Logik (Zeile 320-337)**:
- Falls Override vorhanden: diesen Wert als `amount_net` / `vat_amount` speichern
- Falls leer: weiterhin berechneten Wert verwenden

### 2. Beleg-Detail-Panel (`src/components/receipts/ReceiptDetailPanel.tsx`)

**State erweitern** (bei den vorhandenen State-Variablen):
- Neue States `amountNetOverride` und `vatAmountOverride` (String, default leer)
- Beim Laden: Falls DB-Werte von Berechnung abweichen, als Override setzen

**Netto/MwSt-Grid (Zeile 1463-1486)**:
- `items-end` zum Grid hinzufuegen
- Felder editierbar machen mit berechnetem Wert als Placeholder
- Gleiche Override-Logik wie in Review

**Save-Logik (Zeilen 700-738)**:
- Override-Werte bevorzugt als `amount_net` / `vat_amount` speichern

---

## Technische Details

### Alignment-Fix

| Datei | Zeile | Vorher | Nachher |
|-------|-------|--------|---------|
| Review.tsx | 1158 | `grid sm:grid-cols-2 gap-4` | `grid sm:grid-cols-2 gap-4 items-end` |
| ReceiptDetailPanel.tsx | 1464 | `grid grid-cols-2 gap-4` | `grid grid-cols-2 gap-4 items-end` |

### Override-Felder (Review.tsx Beispiel)

```text
Vorher:
  <Input value={calculations.net ? ... : '—'} readOnly className="bg-muted" />

Nachher:
  <Input
    type="number"
    step="0.01"
    value={formData.amount_net_override}
    onChange={...}
    placeholder={calculations.net ? `${calculations.net.toFixed(2)} (berechnet)` : '—'}
    className={formData.amount_net_override ? '' : 'bg-muted'}
  />
```

### Betroffene Dateien

| Datei | Aenderungen |
|-------|------------|
| `src/pages/Review.tsx` | FormData + Override-State, Grid alignment, editierbare Felder, Save-Logik |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Override-State, Grid alignment, editierbare Felder, Save-Logik |
