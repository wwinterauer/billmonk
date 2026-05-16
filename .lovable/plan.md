## Antwort auf deine Frage

Technisch wird der `extraction_hint` bereits **immer** als generischer "LIEFERANTEN-HINWEIS" an die KI mitgegeben — nicht nur für Geldwerte (siehe `extract-receipt/index.ts` Z. 581-603). In der UI ist das Feld aktuell aber **versteckt** unter dem "Nur Ausgaben extrahieren"-Toggle, was den Eindruck erweckt, es gelte nur für die Betragserkennung.

Du kannst also bereits heute Hinweise wie "wenn Zählernummer XX → Tag Gschwandt 54" eintragen — die KI bekommt diese mit. Aber das Feld ist eben unsichtbar, wenn der Toggle aus ist.

## Plan

### 1. `extraction_hint` als eigenes Feld herausziehen
In `src/components/settings/VendorManagement.tsx` (Z. 1583-1597) das Textarea aus dem `expenses_only_extraction`-Block herausnehmen und als **eigenen, immer sichtbaren Abschnitt** „Sonstige Hinweise für die KI" oberhalb des Toggle-Blocks platzieren.

- Label: **„Sonstige KI-Hinweise (Kategorie, Tags, Beschreibung, etc.)"**
- Placeholder mit deinem Beispiel erweitern:
  > z.B. „Wenn Zählernummer 12345 erkannt wird, setze Tag 'Gschwandt 54' und ergänze Beschreibung mit Präfix 'Gschwandt 54 - '." oder „Beträge in Klammern als positive Kosten behandeln."
- Hilfetext: „Diese Hinweise werden der KI bei jeder Analyse dieses Lieferanten mitgegeben — für Kategorisierung, Tag-Auswahl, Beschreibungs-Anpassung oder Betragserkennung."
- 500-Zeichen-Limit bleibt.

### 2. Toggle „Nur Ausgaben extrahieren" umbenennen
In Z. 1497-1503:
- Label: **„Vertiefte Betragserkennung via Hinweis"**
- Beschreibung: **„Aktivieren, wenn auf der Rechnung Einnahmen/Gutschriften mit Ausgaben gemischt sind (z.B. Monta, Marketplace) und nur Kosten extrahiert werden sollen."**

Schlagwort-Chips bleiben innerhalb dieses Blocks (sind nur relevant, wenn aktiv).

### 3. Backend — keine Änderung nötig
`extract-receipt/index.ts` nutzt den Hint bereits generisch. Der Hint wird in beiden Fällen (expenses_only on/off) sauber an den Prompt angehängt.

### 4. Nicht angefasst
- Spalten/Datenbank: kein neues Feld, da `extraction_hint` semantisch bereits passt und der Backend-Code schon korrekt ist.
- Andere Stellen (Review.tsx, ReceiptDetailPanel.tsx) verwenden das Feld bereits — kein Refactor nötig.

### Optional (auf Rückfrage)
Falls du Hint und „Expenses-Only-Hinweis" semantisch trennen möchtest, könnten wir eine neue Spalte `general_ai_notes` einführen und `extraction_hint` ausschließlich für den expenses_only-Kontext lassen. Aktuell halte ich das aber für unnötigen Overhead, weil der KI ein einziger Hinweis-Block reicht.