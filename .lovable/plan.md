

## Fix: Doppelter "Firma"-Tab in Einstellungen

### Problem
Der Tab "Firma" (`value: 'company'`) wird in beiden Tab-Gruppen angezeigt, weil er in Zeile 459 nicht aus den `expenseTabs` ausgeschlossen wird, aber in Zeile 460 explizit in die `invoiceTabs` aufgenommen wird.

### Lösung
In `src/pages/Settings.tsx`, Zeile 459: `company` zum Ausschluss-Array der `expenseTabs` hinzufügen:

```typescript
const expenseTabs = allTabs.filter(t => !['company', 'customers', 'invoice-items', 'invoice-templates', 'invoice-settings'].includes(t.value));
```

### Umfang
- 1 Zeile in `src/pages/Settings.tsx` (Zeile 459)

