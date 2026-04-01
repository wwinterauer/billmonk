

# Import-Adresse: Prefix von "receipts+" auf "rechnungen+" ändern

## Änderung

Zwei Stellen in `src/hooks/useEmailImport.ts` anpassen:

- **Zeile 224**: `receipts+${token}@import.billmonk.ai` → `rechnungen+${token}@import.billmonk.ai`
- **Zeile 278**: `receipts+${token}@import.billmonk.ai` → `rechnungen+${token}@import.billmonk.ai`

## Kompatibilität

Die Webhook-Funktion extrahiert den Token via Regex `/\+([a-z0-9]+)@/` — der Prefix vor dem `+` wird ignoriert. Bestehende Adressen mit `receipts+` funktionieren weiterhin. Nur neu erstellte/regenerierte Adressen verwenden `rechnungen+`.

### Dateien
- `src/hooks/useEmailImport.ts` — 2 Zeilen ändern

