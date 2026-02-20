
# Direkte Löschmöglichkeit in der Review-Ansicht

## Was wird hinzugefügt

Ein Löschen-Button mit Bestätigungsdialog direkt in der Review-Seite – identisch zum Verhalten in der Einzelbelegbearbeitung (`ReceiptDetailPanel`).

## Technische Umsetzung

### Datei: `src/pages/Review.tsx`

**1. Imports ergänzen**

- `deleteReceipt` aus `useReceipts` destructuren (bereits im Hook verfügbar und exportiert)
- `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` aus `@/components/ui/alert-dialog` importieren
- `Trash2` Icon aus `lucide-react` importieren

**2. State hinzufügen**

```text
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
```

**3. Handler-Funktion hinzufügen**

```text
const handleDelete = async () => {
  if (!currentReceipt) return;
  setSaving(true);
  try {
    await deleteReceipt(currentReceipt.id);
    
    // Sofort aus lokaler Liste entfernen (identisch zu saveReceipt mit Status)
    const newReceipts = receipts.filter((_, i) => i !== currentIndex);
    setReceipts(newReceipts);
    if (newReceipts.length > 0) {
      const nextIndex = Math.min(currentIndex, newReceipts.length - 1);
      setCurrentIndex(nextIndex);
      populateForm(newReceipts[nextIndex]);
      loadImage(newReceipts[nextIndex]);
    }
    
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
    window.dispatchEvent(new CustomEvent('refresh-review-count'));
    
    toast({ title: 'Beleg gelöscht' });
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Fehler beim Löschen',
      description: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  } finally {
    setSaving(false);
    setDeleteDialogOpen(false);
  }
};
```

**4. Löschen-Button in der Action-Button-Leiste** (ca. Zeile 1369, neben "Ablehnen")

Der Button wird als kleiner, dezenter Icon-Button am rechten Ende der Aktionsleiste platziert – ähnlich wie in der Einzelansicht, aber optisch klar getrennt (z.B. mit `ml-auto`) damit er nicht versehentlich geklickt wird:

```text
[Bestätigen & Weiter] [Speichern] [Ablehnen] [Überspringen]     [🗑 Löschen]
```

**5. AlertDialog für Bestätigung**

Identisch zum ReceiptDetailPanel – zeigt Dateiname und warnt vor dauerhafter Löschung:

```text
"Beleg wirklich löschen?"
"[Dateiname] wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
[Abbrechen] [Löschen]
```

## Betroffene Datei

| Datei | Änderung |
|-------|-----------|
| `src/pages/Review.tsx` | Import `deleteReceipt` + `Trash2` + `AlertDialog`-Komponenten; neuer State `deleteDialogOpen`; neue Funktion `handleDelete`; Löschen-Button in der Aktionsleiste; AlertDialog-Bestätigungsdialog |

## Verhalten nach dem Fix

1. Nutzer sieht in der Review einen dezenten "Löschen"-Button am rechten Ende der Aktionsleiste
2. Klick öffnet Bestätigungsdialog mit Dateiname
3. Nach Bestätigung: Beleg wird aus Storage + Datenbank entfernt
4. Ansicht springt sofort zum nächsten Beleg (oder zeigt "Alle überprüft")
5. Sidebar-Badge und Cache werden aktualisiert

**Hinweis:** Dieser Plan enthält auch die bereits zuvor beschlossene Verbesserung (sofortige UI-Aktualisierung nach Split + Dubletten-Prüfung beim Split). Alle drei Fixes werden gemeinsam implementiert.
