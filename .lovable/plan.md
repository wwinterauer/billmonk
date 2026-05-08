## Problem

In `src/pages/Settings.tsx` (Zeile 522) filtert `expenseTabs` die Invoice-Module-Tabs heraus, vergisst aber **Mitglieder**, **CRM-Felder** und **Newsletter**. Dadurch erscheinen diese drei Tabs in beiden Tab-Leisten (oben „Belege" und unten „Fakturierung").

## Fix

Die drei fehlenden Werte zur Exclude-Liste in `expenseTabs` hinzufügen, damit sie nur noch in `invoiceTabs` (untere Leiste) auftauchen.

```ts
const expenseTabs = allTabs.filter(t => ![
  'bank-live', 'company', 'customers',
  'members', 'crm-fields', 'newsletter',
  'invoice-items', 'invoice-templates', 'quote-templates', 'invoice-settings'
].includes(t.value));
```

`invoiceTabs` bleibt unverändert. Keine weiteren Änderungen nötig — die TabsContent-Blöcke und das URL-Handling funktionieren weiter, da `activeTab` weiterhin gültige Werte erhält.

## Aufwand
1 Zeile, ca. 30 Sekunden.