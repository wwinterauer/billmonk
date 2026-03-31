

# Fix: Netto/MwSt bei gemischten Steuersätzen aus line_items neu berechnen

## Problem

Die KI liefert in `tax_rate_details` falsche aggregierte Netto/MwSt-Werte (z.B. 20%-Gruppe: Netto €6.00 statt €15.91). Das Post-Processing summiert diese falschen Werte nur auf, statt sie zu korrigieren.

Die KI liefert aber auch `line_items` mit korrekten Brutto-Beträgen (`total`) und `tax_rate` pro Position. Diese werden aktuell komplett ignoriert.

## Lösung

Nach dem Parsen der AI-Antwort (nach `mapSchemaToResult`, vor den VAT consistency rules): wenn `line_items` vorhanden sind und mehrere Steuersätze enthalten, `tax_rate_details` komplett aus den `line_items` neu berechnen.

### Logik

```text
1. Filtere line_items mit gültigem total und tax_rate
2. Gruppiere nach tax_rate
3. Pro Gruppe:
   - gross = Summe aller totals
   - Parst tax_rate als Zahl (z.B. "20" → 20)
   - net = gross / (1 + rate/100)  (bei 0%: net = gross)
   - vat = gross - net
4. Ersetze tax_rate_details mit den neu berechneten Gruppen
5. Setze amount_net = Summe aller net, vat_amount = Summe aller vat
6. Setze is_mixed_tax_rate = true wenn > 1 Gruppe
```

### Änderungen

**Datei: `supabase/functions/extract-receipt/index.ts`**

1. `mapSchemaToResult()` erweitern: `line_items` aus `raw` mit durchreichen (neues Feld oder temporär am Objekt)

2. Nach Zeile 742 (nach abs-Korrektur), VOR der bestehenden `detailRates`-Logik (Zeile 744): neuen Block einfügen der `line_items` → `tax_rate_details` Neuberechnung durchführt

3. Die bestehende Logik ab Zeile 744 (detailRates-Ableitung + Summenberechnung) bleibt als Fallback, greift aber nur wenn keine line_items vorhanden waren

### Vorteile

- Nutzt die granularen Daten die die KI bereits liefert
- Mathematische Korrektheit durch Formel statt AI-Vertrauen
- Funktioniert für beliebige Steuersatz-Kombinationen
- Fallback auf bisherige Logik wenn keine line_items vorhanden

