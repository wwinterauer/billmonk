

# Fix: MwSt-Konsistenzpruefung und 0%-USt-Regel

## Problem

Bei Rechnung FR5245WLTAEUI erkennt die KI 20% MwSt, obwohl 0% auf der Rechnung steht, und setzt Brutto = Netto (widerspruechlich). Zwei Fehler:
1. Explizit angegebene "0% USt." wird ignoriert
2. Selbst bei falschem Satz fehlt die mathematische Konsistenz zwischen Brutto/Netto/MwSt

## Loesung

Eine Post-Processing-Validierung in `supabase/functions/extract-receipt/index.ts` einfuegen, die nach dem Math.abs()-Block (Zeile 900) und vor dem is_receipt-Check (Zeile 901) greift.

### Validierungsregeln (in dieser Reihenfolge)

**Regel 0 (NEU - Benutzer-Anforderung): Explizite 0% USt. respektieren**
Wenn die KI-Rohantwort Hinweise auf "0% USt", "0,00% MwSt", "0.00% USt" o.ae. enthaelt (Suche im raw content), dann wird vat_rate = 0 erzwungen, unabhaengig davon was die KI als Satz geliefert hat.

**Regel 1: Brutto = Netto und MwSt-Betrag = 0 oder fehlt**
Wenn Brutto und Netto identisch sind und kein MwSt-Betrag vorhanden ist, wird vat_rate auf 0 gesetzt. Die KI hat einen falschen Satz geliefert.

**Regel 2: MwSt-Satz > 0, aber Netto fehlt oder gleich Brutto**
Wenn ein plausibler MwSt-Satz und MwSt-Betrag vorhanden sind, aber Netto fehlt oder gleich Brutto ist: Netto = Brutto - MwSt-Betrag berechnen.

**Regel 3: MwSt-Satz > 0, aber MwSt-Betrag fehlt**
MwSt-Betrag und Netto aus Brutto und Satz ableiten (Netto = Brutto / (1 + Satz/100)).

**Regel 4: Netto < Brutto, aber MwSt-Betrag fehlt**
MwSt-Betrag = Brutto - Netto.

### Pseudo-Code

```text
// Regel 0: Explizite 0% im Dokument-Text erkennen
Pruefe cleanedContent (KI-Rohantwort) auf Muster wie:
  "0% USt", "0,00% USt", "0.00% USt", "0% MwSt", "0,00% MwSt", "0.00% MwSt"
Wenn gefunden UND vat_rate != 0:
  -> vat_rate = 0, vat_amount = 0, amount_net = amount_gross
  -> Log: "0% USt explizit im Dokument gefunden, Satz korrigiert"

// Regel 1: Brutto == Netto und kein MwSt-Betrag
Wenn amount_gross == amount_net UND (vat_amount == 0 ODER vat_amount == null):
  -> vat_rate = 0, vat_amount = 0

// Regel 2: Satz > 0 mit MwSt-Betrag, aber Netto fehlt/falsch
Wenn vat_rate > 0 UND vat_amount > 0 UND (amount_net fehlt ODER amount_net == amount_gross):
  -> amount_net = amount_gross - vat_amount

// Regel 3: Satz > 0, aber MwSt-Betrag fehlt
Wenn vat_rate > 0 UND (vat_amount fehlt ODER vat_amount == 0) UND (amount_net fehlt ODER amount_net == amount_gross):
  -> amount_net = round(amount_gross / (1 + vat_rate/100), 2)
  -> vat_amount = round(amount_gross - amount_net, 2)

// Regel 4: Netto < Brutto, MwSt-Betrag fehlt
Wenn amount_net < amount_gross UND (vat_amount fehlt ODER vat_amount == 0):
  -> vat_amount = round(amount_gross - amount_net, 2)
```

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/extract-receipt/index.ts` | Post-Processing: Konsistenzpruefung nach Zeile 900 einfuegen, inkl. 0%-USt-Erkennung aus Rohtext |

## Erwartetes Ergebnis fuer FR5245WLTAEUI

Die KI liefert 20% MwSt, aber "0% USt." steht im Dokument. Regel 0 erkennt das und korrigiert auf 0%. Brutto = Netto, MwSt = 0. Korrekt.

