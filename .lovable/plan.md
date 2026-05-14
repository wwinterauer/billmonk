## Bug: Einheitliche VAT-Rate aus Line Items wird nicht als Truth übernommen

### Beobachtung am Beispiel Thodi (Receipt `dc39b0fb…`)
- AI-Aggregat: `vat_rate=0`, `vat_amount=0`, `amount_net=623.82` — falsch.
- AI granular (richtig): `line_items` alle mit `tax_rate=20`, `tax_rate_details=[{rate:20, net:519.85, tax:103.97}]`.
- Edge-Function-Log: `[VAT Consistency] Rule 0: Explicit 0% found, correcting from 20%`. Die Regex `0[,.]?0{0,2}\s*%\s*(USt|MwSt…)` matched z.B. eine „0,00 %"-Zwischenzeile (Versand, ig. Lieferung, Hinweis) und überschreibt alles auf 0 %.

Das verstößt gegen die Core-Regel **„Truth from Line Items"**.

## Fix in `supabase/functions/extract-receipt/index.ts`

### 1) Single-Rate-Truth aus Line Items
Im Block ab Zeile 757 (`if (validLineItems.length > 0)`) auch den Fall `rateKeys.length === 1` behandeln:
- Wenn alle Line Items denselben Steuersatz haben → diesen als `vat_rate` setzen, `is_mixed_tax_rate=false`, `tax_rate_details=null`, `amount_net` und `vat_amount` aus `gross / (1 + r/100)` neu berechnen (verwende die summierte Brutto-Summe der Line Items als Validierung; falls deren Summe innerhalb 1 % von `extractedData.amount_gross` liegt, das AI-`amount_gross` belassen, sonst Line-Item-Summe als `amount_gross` setzen).
- Ergebnis: `vat_detection_method='line_items'`, `vat_confidence=1.0`.

### 2) Rule 0 absichern
- Vor Anwendung der Regex prüfen: wenn `validLineItems` existieren UND mind. ein Line-Item `tax_rate > 0` hat → **Rule 0 überspringen** (Truth aus Line Items dominiert die Volltextsuche).
- Zusätzlich (Defense-in-depth): Wenn `tax_rate_details` einen Eintrag mit `rate > 0` enthält → ebenfalls Rule 0 überspringen.
- Rule 0 bleibt aktiv für Belege ohne Line-Item-Daten (z.B. einfache Quittungen ohne Aufschlüsselung).

### 3) Bestehender Receipt
Empfehlung an den User: betroffenen Beleg im Review öffnen und MwSt manuell auf 20 % stellen — der Fix wirkt nur bei zukünftigen Extraktionen / „Erneut analysieren".

## Geänderte Datei
- `supabase/functions/extract-receipt/index.ts` (zwei kleine Logik-Änderungen, keine DB/Schema-Änderungen).

OK, soll ich umsetzen?