# Summenzeilen stärker gewichten als Positionsrechnungen

## Was aktuell schiefgeht

Bei der Samsung-Rechnung AT260621-14176203 steht in der Datenbank brutto 902,75. Die Positionen lauten:

```text
49" ViewFinity S9      785,00
Versandkosten            0,00
Rabatt                -117,75
```

Zwei bestätigte Ursachen:

1. **Rabatte werden zu Aufschlägen.** In der Line-Item-Auswertung von `extract-receipt` werden die Positionssummen mit `Math.abs()` addiert. Aus `785,00 + 0,00 + |−117,75|` wird 902,75 statt 667,25. Genau dieser Wert steht im Datensatz — inklusive `vat_detection_method: "line_items"` und `vat_confidence: 1.0`.
2. **Die Positionssumme sticht die Summenzeile.** Weicht die Positionssumme um mehr als 1 % vom KI-Aggregat ab, überschreibt sie den Gesamtbetrag bedingungslos — auch wenn auf dem Beleg eine eindeutig beschriftete Zeile "Gesamtbetrag" / "Summe inkl. MwSt." steht.

Die IKEA-Rechnung ATINV26000000647047 zeigt eine dritte, schwerere Variante: gespeichert sind 693,93 brutto / 578,28 netto, obwohl der Beleg "Gesamtbetrag 3.055,23", "Gesamtsumme 3.055,23" und "Nettobetrag 2.546,03" ausweist. Hier hat bereits die KI selbst 693,93 als Aggregat geliefert — passend zur Summe der nur 16 erfassten Positionen. Die Positionsliste ist also unvollständig, und niemand hat gegen die beschriftete Summenzeile geprüft: es gibt aktuell keinerlei Abgleich "Positionssumme vs. ausgewiesener Gesamtbetrag".


## Was gebaut wird

### 1. Beschriftete Summenzeilen als eigene, gewichtete Datenquelle

Die KI liefert künftig nicht nur Zahlen, sondern die zugehörige Beschriftung und deren Fundort:

- neue Felder `total_amount_label`, `net_amount_label`, `tax_amount_label` (der wörtliche Text der Zeile, z. B. "Summe EUR inkl. MwSt.")
- eine Liste `totals_block` aller Summenzeilen im Summenblock (Label + Betrag)

Der Prompt bekommt eine klare Rangfolge: Ein Betrag aus einer beschrifteten Summenzeile ("Gesamtbetrag", "Rechnungsbetrag", "Zu zahlen", "Summe inkl. MwSt.", "Total incl. VAT" für brutto; "Nettobetrag", "Summe netto", "Total ohne MwSt." für netto) ist immer stärker als eine selbst gerechnete Positionssumme. Nur wenn gar keine Summenzeile existiert, wird aus Positionen summiert.

### 2. Gewichtung im Post-Processing

Statt "Positionen gewinnen immer" gilt eine Konfidenz-Reihenfolge:

```text
1. Beschriftete Brutto-Summenzeile (Label erkannt)      -> gewinnt
2. Netto-Summenzeile + Steuerzeile (netto + MwSt)       -> gewinnt
3. Positionssumme                                        -> nur ohne 1 und 2
```

Die Positionssumme wird dabei weiter als **Kontrollrechnung** genutzt: Weicht sie von der Summenzeile ab, wird die Summenzeile übernommen, aber `vat_confidence` gesenkt und der Beleg für die Review markiert, statt still überschrieben zu werden.

### 3. Vorzeichen-Bug beheben

`Math.abs()` fällt bei den Positionssummen weg: Rabatt-, Gutschrift- und Storno-Zeilen bleiben negativ und werden korrekt abgezogen. Nur das Endergebnis wird auf positiv normalisiert (für Gutschriftbelege insgesamt).

### 4. Vollständigkeits-Check der Positionen

Liegt eine beschriftete Gesamtsumme vor und die Positionssumme liegt deutlich darunter (> 2 % Abweichung), gilt die Positionsliste als unvollständig: Der Gesamtbetrag kommt aus der Summenzeile, die Positionen werden nur noch informativ gespeichert, `is_mixed_tax_rate`/`tax_rate_details` werden nicht mehr daraus abgeleitet, und der Beleg wird als prüfbedürftig markiert (kein Auto-Approve).

### 5. Bestandsdaten prüfen

Zwei Suchläufe über die vorhandenen Belege:

- Belege mit negativen Positionen, deren `amount_gross` der Summe der Absolutwerte entspricht (Vorzeichen-Bug) — neu berechnen ohne KI-Aufruf, u. a. Samsung auf 667,25 / 556,04 / 111,21.
- Belege mit `vat_detection_method = "line_items"`, bei denen der Verdacht auf unvollständige Positionen besteht — diese werden mit dem neuen Prompt neu extrahiert, beginnend mit der IKEA-Rechnung ATINV26000000647047.

Vor der Massenkorrektur gibt es eine Vorher-/Nachher-Liste zur Kontrolle.

## Technische Details

- `supabase/functions/extract-receipt/index.ts`
  - JSON-Schema um `total_amount_label`, `net_amount_label`, `tax_amount_label`, `totals_block` erweitern (alle Felder required, nullable — Strict-Schema-Vorgabe)
  - Prompt-Block "BETRÄGE" um die Rangfolge und Label-Pflicht ergänzen; zusätzlich Pflichthinweis, dass die Positionsliste vollständig sein muss und gegen die Summenzeile zu prüfen ist
  - Block ab Zeile 838 (`validLineItems`): `Math.abs` entfernen, `useLineItemGross` nur noch true, wenn keine beschriftete Brutto-/Netto-Summenzeile vorliegt
  - Bei Abweichung Positionssumme vs. Summenzeile > 2 %: `vat_confidence` auf max. 0,6 und `vat_detection_method: "totals_line_conflict"`
- Review-UI: Belege mit `totals_line_conflict` bekommen den bestehenden Warn-Badge, damit sie nicht auto-approved werden
- Einmalige Korrektur der Bestandsbelege per Skript, mit Vorher-/Nachher-Liste zur Kontrolle

