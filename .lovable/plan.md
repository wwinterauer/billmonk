

# Cleanup: Debug-Logs entfernen, Post-Processing behalten

## Analyse

Die Änderungen lassen sich in zwei Kategorien aufteilen:

### Kein Token-Einfluss (behalten)
- **Line-Items Post-Processing** (Zeilen 744-801): Läuft NACH dem AI-Call, verbraucht null zusätzliche Tokens. Ist eine wertvolle mathematische Absicherung.
- **Mixed-Tax Guard** bei VAT Consistency (Zeile 803): Verhindert Überschreiben korrekter Werte, null Token-Kosten.

### Aufräumen
- **Debug console.logs** (Zeilen 746, 752, 780, 798): Unnötig in Produktion, sollten entfernt werden.
- **Expenses-Only Prompt** (Zeilen 204-239): Wurde deutlich erweitert (~200 Tokens mehr als nötig). Die detaillierten Berechnungsanweisungen (MwSt-Formel, Validierung ±0.05€) sind überflüssig, weil das Post-Processing die Mathematik ohnehin korrigiert. Kann auf die wesentlichen Filterregeln gekürzt werden.

## Änderungen

**Datei: `supabase/functions/extract-receipt/index.ts`**

1. **4 Debug-Logs entfernen** (Zeilen 746, 752, 780, 798)
2. **Expenses-Only Prompt kürzen**: Berechungsanweisungen (Zeilen 218-221, 228-229) entfernen — das Post-Processing macht das zuverlässiger. Kernregeln (Filterregel, Duplikat-Vermeidung, Beträge positiv) bleiben.

### Token-Einsparung
Ca. 150-200 Tokens pro Expenses-Only-Aufruf weniger. Kein funktionaler Verlust, da die mathematische Korrektheit durch Post-Processing garantiert wird.

