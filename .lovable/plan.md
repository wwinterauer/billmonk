

# Bulk-Aktionsleiste: Invoices an Expenses angleichen

## Problem

In **Expenses** ist die Bulk-Aktionsleiste ein inline-Element oberhalb der Tabelle (`bg-muted/50 rounded-lg, mb-4`), das sanft eingeblendet wird wenn Belege markiert sind. In **Invoices** ist sie dagegen als `fixed bottom-0` am unteren Bildschirmrand fixiert — inkonsistentes UI.

## Änderung

### `src/pages/Invoices.tsx` — Zeile 584-609

Die fixierte Leiste (`fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg`) wird ersetzt durch das Expenses-Pattern:

```text
Vorher:  <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg p-3">
Nachher: <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
           className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
```

- `Badge variant="secondary"` mit Anzahl statt einfachem `<span>`
- Gleiche Button-Größen und Farbgebung wie bei Expenses (grün für positive Aktionen, orange/rot für destruktive)
- Positionierung: direkt über der Tabelle, nach den Stats-Cards
- Animation: `motion.div` mit height-Animation wie bei Expenses
- Import `motion` von `framer-motion` hinzufügen

Gleiche Anpassung wird dann auch bei `Quotes.tsx`, `OrderConfirmations.tsx` und `DeliveryNotes.tsx` im nächsten Schritt übernommen.

### Dateien
- `src/pages/Invoices.tsx`

