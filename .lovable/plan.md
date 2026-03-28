

# Fix: Info-Icons erscheinen nicht bei Steuer-Kategorien

## Problem
Die Kategorienamen in der Datenbank enthalten Länderkürzel in Klammern (z.B. `"Bewirtung 50% (AT)"`), aber die Schlüssel im `TAX_CATEGORY_INFO`-Objekt haben keine solchen Suffixe (z.B. `"Bewirtung 50%"`). Dadurch schlägt der Lookup `TAX_CATEGORY_INFO[category.name]` immer fehl und das Info-Icon wird nie angezeigt.

## Lösung
Die Schlüssel in `taxCategoryInfo.ts` an die tatsächlichen DB-Namen anpassen, also mit Länderkürzel in Klammern.

## Änderungen

### `src/components/settings/taxCategoryInfo.ts`
Alle Keys umbenennen, damit sie exakt den DB-Namen entsprechen:

| Aktuell (falsch) | Korrekt (wie in DB) |
|---|---|
| `"Bewirtung 50%"` | `"Bewirtung 50% (AT)"` |
| `"Reisekosten"` | `"Reisekosten (AT)"` |
| `"KFZ-Kosten"` | `"KFZ-Kosten (AT)"` |
| `"Büromaterial & Verbrauch"` | `"Büromaterial & Verbrauch (AT)"` |
| ... (alle 15 AT-Einträge) | ... |
| `"Bewirtung 70%"` | `"Bewirtung 70% (DE)"` |
| `"Reisekosten DE"` | `"Reisekosten (DE)"` |
| ... (alle 15 DE-Einträge) | ... |
| `"Verpflegung & Repräsentation"` | `"Geschäftsbewirtung (CH)"` |
| `"Reisekosten CH"` | `"Reisekosten (CH)"` |
| ... (alle 13 CH-Einträge) | ... |

Alle 43 Keys werden so umbenannt, dass sie exakt mit den in der Migration eingefügten Kategorienamen übereinstimmen.

Keine anderen Dateien betroffen — der Lookup-Code in `CategoryManagement.tsx` ist korrekt, nur die Keys stimmen nicht.

