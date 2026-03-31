

# Plan: Structured Output Test für Lovable AI Gateway

## Kontext

Die Lovable AI Dokumentation empfiehlt für strukturierten Output explizit **Tool Calling** statt `response_format`. Das heißt:
- `response_format: { type: "json_schema" }` wird möglicherweise **nicht** vom Gateway unterstützt
- `response_format: { type: "json_object" }` könnte funktionieren, ist aber nicht dokumentiert
- **Tool Calling** ist der dokumentierte und empfohlene Weg

## Was getestet wird

Drei Varianten in Reihenfolge, mit Fallback-Logik:

### Variante 1: `response_format` mit `json_schema` (dein Vorschlag)
```text
response_format: {
  type: "json_schema",
  json_schema: { name: "receipt_extraction", strict: true, schema: {...} }
}
```

### Variante 2: `response_format` mit `json_object` (einfacher Fallback)
```text
response_format: { type: "json_object" }
```

### Variante 3: Tool Calling (Gateway-dokumentiert)
```text
tools: [{
  type: "function",
  function: {
    name: "extract_receipt_data",
    parameters: { vendor_name, total_amount, currency }
  }
}],
tool_choice: { type: "function", function: { name: "extract_receipt_data" } }
```

## Implementierung

Die Edge Function `extract-receipt/index.ts` wird so angepasst:

1. **Neuer Query-Parameter** `schema_test=true` aktiviert den Testmodus (nur für manuelles Testen, normaler Betrieb bleibt unverändert)

2. Im Testmodus: Alle 3 Varianten werden **sequenziell** mit demselben Bild aufgerufen

3. Jedes Ergebnis wird ausführlich in die **Console geloggt**:
   - Status-Code der API-Antwort
   - Ob valides JSON zurückkam
   - Ob genau die 3 erwarteten Felder vorhanden sind
   - Die tatsächliche Antwort

4. **Response** enthält einen Vergleichsbericht aller 3 Varianten

## Technische Details

- Zeile ~1004-1026: Der bestehende `body: JSON.stringify({...})` Block wird im Testmodus durch 3 separate Calls ersetzt
- Der **normale Produktiv-Pfad bleibt komplett unverändert** — der Test läuft nur bei explizitem Flag
- Alle 3 Calls nutzen einen **vereinfachten Mini-Prompt** ("Extract vendor name, total amount, and currency from this receipt") statt dem vollen Prompt
- Kosten: ~3 AI-Calls für einen einzigen Testbeleg

## Ergebnis

Nach dem Test wissen wir:
- Welche Structured-Output-Methode das Gateway unterstützt
- Ob wir die JSON-Formatbeschreibung aus dem Prompt entfernen können (spart ~1000 Tokens pro Call)
- Ob Tool Calling die bessere Alternative ist

