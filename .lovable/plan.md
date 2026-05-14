## Anpassungen an SearchableSelect & Review-Dropdowns

### 1) Leeren erlauben (Kategorie & Buchungsart)
In `SearchableSelect` einen optionalen `allowClear`-Modus + festen Eintrag „— Keine Auswahl —" am Anfang der Liste, der `onChange("")` auslöst. Im Review für beide Dropdowns aktivieren, sodass bestehende Auswahl gelöscht werden kann (analog Toggle-Verhalten beim Click auf bereits gewählten Eintrag, das es bereits gibt).

### 2) Neue Kategorie direkt aus dem Kategorie-Dropdown anlegen
Analog `VendorAutocomplete` „… als neuen Lieferanten":
- Wenn kein exakter Treffer im Suchfeld existiert, am Ende der Liste einen Eintrag „+ ‚<Suchbegriff>' als neue Kategorie anlegen" anzeigen.
- Klick → ruft `addCategory(name)` aus `useCategories` auf, setzt danach `formData.category = name`, schließt Popover.
- Toast bei Erfolg / Fehler.

Damit das generisch bleibt, bekommt `SearchableSelect` einen optionalen Prop `onCreate?: (label: string) => Promise<void> | void` plus `createLabel?: (q: string) => string`. Buchungsart bleibt ohne `onCreate` (länderspezifische, fixe Liste — kein User-Anlegen).

### Technische Details
- Datei `src/components/ui/searchable-select.tsx`: Props erweitern (`allowClear`, `clearLabel`, `onCreate`, `createLabel`); Render-Logik für Clear-Item oben und Create-Item unten; Suchstate aus `CommandInput` per `value`/`onValueChange` selber halten, damit der aktuelle Suchbegriff für `onCreate` verfügbar ist.
- Datei `src/pages/Review.tsx`: 
  - Kategorie-`SearchableSelect`: `allowClear` + `onCreate={async (name) => { const cat = await addCategory(name); setFormData(prev => ({ ...prev, category: cat.name })); }}`. `addCategory` aus `useCategories` destrukturieren.
  - Buchungsart-`SearchableSelect`: nur `allowClear`.
- Keine Änderungen an DB, Edge Functions, anderen Komponenten.

OK, soll ich umsetzen?