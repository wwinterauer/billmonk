## Befund

`Betriebsausgabe` kommt direkt aus der KI-Antwort und ist bereits in `receipts.tax_type` gespeichert. Es ist kein gültiger AT-Wert, kein Dropdown-Eintrag, kein Vendor-Default und keine Lernregel. Die zuletzt eingebaute Backend-Validierung ist im Code vorhanden, aber die Belege wurden offenbar noch über einen Pfad/alte Function-Version gespeichert, in dem der ungültige Wert nicht zuverlässig neutralisiert wurde.

## Plan

1. **Backend-Validierung härten**
   - In `extract-receipt` den validierten Wert einmal zentral berechnen.
   - Den validierten Wert sowohl in der DB (`receipts.tax_type`) als auch in der Function-Antwort (`data.tax_type`) verwenden.
   - Ungültige Werte wie `Betriebsausgabe`, `Sonstiges`, `Aufwand` dadurch immer zu `null` machen.

2. **Frontend-Schutz ergänzen**
   - Beim Normalisieren der KI-Antwort im Frontend `tax_type` gegen die echte Dropdown-Liste validieren.
   - Falls ein Analysepfad die Function-Antwort direkt weiterverarbeitet, kann `Betriebsausgabe` nicht erneut gespeichert werden.

3. **Review-Anzeige absichern**
   - Beim Befüllen des Review-Formulars nur Werte anzeigen, die in `taxCategories` existieren.
   - Ungültige gespeicherte Altwerte werden im Dropdown als `Offen` angezeigt statt als scheinbar gültige Buchungsart.

4. **Bestehende Altwerte bereinigen**
   - Alle aktuell gespeicherten `receipts.tax_type = 'Betriebsausgabe'` auf `NULL` setzen.
   - Optional zusätzlich ungültige `vendor.default_tax_type`, `vendor.field_defaults.tax_type` und `category_rules.tax_type_name` entfernen, falls vorhanden.

## Ergebnis

Danach kann `Betriebsausgabe` weder von der KI, noch von Lernregeln, noch aus Alt-Daten wieder im Review-Dropdown auftauchen. Für EISKG müsste dann manuell `Miete & Betriebskosten (AT)` gewählt werden; nach wiederholten Korrekturen kann das System diesen gültigen Wert lernen.