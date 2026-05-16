## Ziel

Im "Lieferanten zusammenführen"-Dialog sollen zwei Dinge möglich werden:

1. **Richtung wählen**: Welcher Lieferant bleibt erhalten (Ziel) und welcher wird gelöscht (Quelle) — austauschbar per Klick.
2. **Rechtlichen Firmennamen wählen/eingeben**: Im Bereich „Ergebnis nach Zusammenführung" soll ein primärer Rechtlicher Firmenname festgelegt werden können (Auswahl aus den vorhandenen Legal Names beider Lieferanten oder Freitext).

## Änderungen in `src/components/settings/VendorManagement.tsx`

### 1. Richtungswechsel im Dialog
- Im Vergleichsbereich (Zeilen 1945–1983) einen **„Tauschen"-Button** (ArrowLeftRight-Icon) zwischen / über den beiden Karten einbauen.
- Klick tauscht `mergeSource` ↔ `mergeTarget` und berechnet `mergePreview` neu (gleiche Logik wie `openMergePairDialog`, ausgelagert in `recomputeMergePreview(source, target, primaryLegalName?)`).
- Display-Name im Preview wird standardmäßig vom neuen Target übernommen (falls Nutzer nichts manuell geändert hat).

### 2. Primärer Rechtlicher Firmenname
- `MergePreview` um Feld `primary_legal_name: string | null` erweitern.
- Im Abschnitt „Rechtliche Firmennamen" (Zeilen 2003–2016):
  - Liste als klickbare Badges darstellen — die ausgewählte Badge wird hervorgehoben (z. B. `variant="default"`), die anderen bleiben `secondary`.
  - Darunter Input-Feld „Eigenen Namen eingeben" mit Plus-Button: fügt einen neuen Namen zur `legal_names`-Liste hinzu UND setzt ihn als primären.
  - X-Button auf jeder Badge zum Entfernen aus der Liste (analog zu detected_names).
- Beim Speichern in `executeMerge`:
  - `legal_names` so sortieren, dass `primary_legal_name` an erster Stelle steht (Konvention im Projekt: erstes Element = primärer Name; siehe `vendor_brand`-Memory).
  - Wenn kein primärer Name gewählt: bisheriges Verhalten.

### 3. Hinweistext anpassen
- Warntext (Zeile 2060) dynamisch: nutzt aktuelle `mergeSource`/`mergeTarget`-Werte (passiert automatisch durch State).

## Technische Hinweise

- `recomputeMergePreview` als Helper-Funktion oberhalb `openMergePairDialog` extrahieren; sowohl beim Öffnen als auch beim Richtungswechsel aufrufen.
- Beim Tauschen: User-Edits am `display_name` gehen verloren (akzeptabel, da Tauschen explizite Aktion ist) — alternativ: nur sortieren, Edits beibehalten. **Empfehlung: zurücksetzen mit Toast „Vorschau aktualisiert".**
- Keine DB-Schema-Änderungen nötig — `vendors.legal_names` ist bereits `text[]`.

## Validierung

- Manuell im Dialog: Lieferanten tauschen, Legal Name auswählen, eigenen Namen hinzufügen, Merge ausführen.
- Prüfen, dass nach Merge der korrekte Vendor erhalten bleibt und `legal_names[0]` der gewählte primäre Name ist.
