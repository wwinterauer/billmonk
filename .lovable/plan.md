
# Bug-Fix: Doppelter Lösch-Button in der Duplikate-Ansicht

## Problem

In der Bulk-Aktionsleiste werden bei aktivem Duplikat-Filter zwei Lösch-Buttons gleichzeitig angezeigt:

1. **"Löschen"** (grauer Outline-Button) → öffnet `bulkDeleteOpen` Dialog
2. **"Duplikate löschen"** (roter Destructive-Button) → ruft `bulkDeleteDuplicates()` direkt auf

Beide löschen letztendlich die markierten Belege. Das ist redundant und verwirrend.

## Lösung

Der normale **"Löschen"**-Button soll im Duplikat-Filter (`statusFilter === 'duplicate'`) **ausgeblendet** werden, da der spezialisierte **"Duplikate löschen"**-Button diese Funktion bereits übernimmt.

Alternativ könnten beide zusammengeführt werden – aber da der "Duplikate löschen"-Button einen eigenen direkten Flow hat (ohne Bestätigungsdialog über `bulkDeleteOpen`) und semantisch klarer für den Kontext ist, ist das Ausblenden des redundanten Buttons die sauberste Lösung.

### Änderung in `src/pages/Expenses.tsx`

**Aktuelle Logik (Zeile 2043-2053):**
```tsx
<div className="h-4 w-px bg-border" />
{/* Delete */}
<Button 
  size="sm" 
  variant="outline" 
  className="text-destructive hover:text-destructive hover:bg-destructive/10"
  onClick={() => setBulkDeleteOpen(true)}
  disabled={bulkActionLoading !== null}
>
  <Trash2 className="h-4 w-4 mr-1" />
  Löschen
</Button>
```

**Neue Logik:**
```tsx
<div className="h-4 w-px bg-border" />
{/* Delete - nur anzeigen wenn NICHT im Duplikat-Filter (dort gibt es "Duplikate löschen") */}
{statusFilter !== 'duplicate' && (
  <Button 
    size="sm" 
    variant="outline" 
    className="text-destructive hover:text-destructive hover:bg-destructive/10"
    onClick={() => setBulkDeleteOpen(true)}
    disabled={bulkActionLoading !== null}
  >
    <Trash2 className="h-4 w-4 mr-1" />
    Löschen
  </Button>
)}
```

Außerdem soll der Trenner (`<div className="h-4 w-px bg-border" />`) vor dem Löschen-Button ebenfalls nur erscheinen wenn der Button sichtbar ist (da er sonst einen leeren Separator zeigt).

## Betroffene Datei

| Datei | Zeilen | Änderung |
|-------|--------|----------|
| `src/pages/Expenses.tsx` | 2042-2053 | Normalen "Löschen"-Button mit `statusFilter !== 'duplicate'` bedingen; Trenner mitbedingen |
