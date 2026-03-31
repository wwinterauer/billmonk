

# Buchungsart-Spalte sichtbar machen + Split-Symbol bei Status

## Problem

1. **Buchungsart-Spalte fehlt visuell**: Die Spalte ist im Code vorhanden (`tax_type` in `COLUMN_CONFIG`), aber bei bestehenden Usern nicht sichtbar, weil `localStorage` die alte Spalten-Auswahl (ohne `tax_type`) gespeichert hat. Neue Spalten werden bei existierendem localStorage-Eintrag ignoriert.

2. **Splitbuchung-Symbol**: Aktuell wird ein großes "Splitbuchung"-Badge in der Status-Spalte angezeigt. Stattdessen soll nur ein kompaktes `Layers`-Icon (ohne Text) neben dem Status-Badge erscheinen.

## Änderungen

### 1. `src/pages/Expenses.tsx` — localStorage-Migration für neue Spalten

In der `useState`-Initialisierung (Zeile 282-292): Wenn `tax_type` nicht im gespeicherten Set enthalten ist, automatisch hinzufügen. So sehen bestehende User die neue Spalte sofort.

```typescript
const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
  const saved = localStorage.getItem('expenses-visible-columns');
  if (saved) {
    try {
      const parsed = new Set(JSON.parse(saved) as ColumnKey[]);
      // Migration: neue Spalten automatisch einblenden
      if (!parsed.has('tax_type')) parsed.add('tax_type');
      return parsed;
    } catch {
      return new Set(COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key));
    }
  }
  return new Set(COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key));
});
```

### 2. `src/pages/Expenses.tsx` — Splitbuchung-Badge zu kompaktem Icon

Das bestehende Badge (Zeilen 2496-2505) wird ersetzt durch ein einfaches `Layers`-Icon mit Tooltip, das platzsparend neben dem Status-Badge steht:

```tsx
{splitBookingEnabled && (receipt as any).is_split_booking && (
  <Layers className="w-3.5 h-3.5 text-violet-600" title="Splitbuchung" />
)}
```

### Dateien
- `src/pages/Expenses.tsx` — localStorage-Migration + Split-Icon-Vereinfachung

