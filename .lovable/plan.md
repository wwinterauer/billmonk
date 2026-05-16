## Ziel

Im „Lieferant bearbeiten"-Dialog (`VendorManagement.tsx`) sollen die fünf Dropdowns
- Standard-Kategorie
- Standard-Tag
- Standard MwSt-Satz
- Standard-Buchungsart
- Standard-Zahlungsart

eine **Suchfunktion** bekommen und es muss möglich sein, **„keine Auswahl"** zu wählen (Feld auf leer/null zurücksetzen).

## Lösung

Die bestehende Komponente `src/components/ui/searchable-select.tsx` bietet bereits beides (`CommandInput`-Suche + `allowClear`). Die 5 shadcn-`<Select>`-Blöcke (Zeilen ~1325–1448) werden durch `<SearchableSelect>` ersetzt.

### Pro Dropdown
- Optionen aus den jeweiligen Quellen (`categories`, `tags`, `vatRates`, lokalisierte Tax-Kategorien, hartkodierte Zahlungsarten) in `{ value, label }`-Form mappen.
- `value`, `onChange` an den vorhandenen `formData`-Pfad anbinden. Beim Clear → leerer String (bestehende Logik wandelt das beim Save passend in `null`).
- `allowClear` auf `true` mit `clearLabel="— Keine Vorgabe —"`.
- `placeholder` / `searchPlaceholder` / `emptyText` deutsch.

### Spezialfall „Standard-Buchungsart"
- Hier existiert bereits ein `__none__`-Item. Wird durch `allowClear` ersetzt; Save-Logik (vermutlich Mapping `__none__` → null) entsprechend bereinigen, falls vorhanden.

### Spezialfall „MwSt-Satz"
- Wert ist als String gespeichert. Mapping `{ value: rate.value, label: rate.label }` bleibt.

## Nicht im Scope
- Filter-Selects oben im Header (Alle Kategorien, Sortierung, weitere Filter) bleiben unverändert – das ist nicht der Edit-Bearbeiten-Bereich.
- Andere Komponenten/Dialoge.

## Validierung
- Edit-Dialog öffnen, in jedem Dropdown tippen → Liste filtert.
- „— Keine Vorgabe —" wählen → Wert wird leer, Speichern persistiert null.
- Bestehende Werte werden korrekt angezeigt.
