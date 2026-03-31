

# Plan: V2-Prompt mit Structured Output + ~50-60% Token-Reduktion

## Übersicht

Der aktuelle `extract-receipt/index.ts` hat ~1537 Zeilen mit einem massiven User-Prompt (~300 Zeilen, ~5000+ Tokens). Durch Structured Output (`response_format: json_schema`) und Prompt-Komprimierung wird der Token-Verbrauch um ca. 50-60% reduziert.

## Änderungen

### 1. Structured Output Schema im API-Call (Zeile ~1169-1192)

Das vollständige `response_format` Schema mit allen Extraktionsfeldern wird dem API-Call hinzugefügt. Die gesamte JSON-Strukturbeschreibung im Prompt (Zeilen ~882-906, ~1127-1161 — ca. 1200 Tokens) wird entfernt. Das Schema erzwingt die Feldnamen und Typen automatisch.

**Wichtig:** Das Schema muss zur bestehenden `ExtractionResult`-Interface passen. Da `json_schema` mit `strict: true` keine `null`-Werte in `number`-Feldern erlaubt, werden nicht-required numerische Felder als `number` mit Default 0 gehandhabt, und das Post-Processing mappt 0 → null wo nötig.

Schema-Felder: `is_financial_document` (→ mappt auf `is_receipt`), `document_type`, `vendor_name` (→ `vendor`), `vendor_brand`, `vendor_address`, `vendor_uid`, `vendor_legal_form`, `vendor_country`, `receipt_date`, `due_date`, `receipt_number` (→ `invoice_number`), `total_amount` (→ `amount_gross`), `net_amount` (→ `amount_net`), `tax_amount` (→ `vat_amount`), `tax_rate`, `is_mixed_tax_rate`, `tax_rate_details`, `currency`, `payment_method`, `category`, `description`, `line_items`, `confidence`, `vat_confidence`, `vat_detection_method`, `special_vat_case`, `notes`

### 2. System-Prompt komprimieren (Zeile ~612-614)

**Vorher:** ~50 Tokens
**Nachher:** `"Dokumentenanalyse-Experte. Prüfe ob Finanzbeleg. Antworte NUR mit validem JSON, kein Markdown."` (~15 Tokens)

### 3. User-Prompt komprimieren (Zeilen ~866-1161)

**Rechtsform-Listen (Zeilen ~925-972, ~800 Tokens):**
Komprimieren zu einer Zeile: `"Rechtsform erkennen: GmbH/AG/KG/OG/e.U./EU/UG/Ltd./LLC/Inc./S.à r.l./B.V./S.r.l. etc."`

**MwSt-Erkennungsregeln (Zeilen ~985-1068, ~1200 Tokens):**
Komprimieren auf Telegram-Stil:
```
MwSt-Erkennung: Suche explizite %-Angaben. Berechne: MwSt = Brutto × Satz/(100+Satz).
Validiere: Netto + MwSt = Brutto (±0.05€). Wenn nicht erkennbar: tax_rate='unknown'.
Steuerraten DACH: AT=20/13/10%, DE=19/7%, CH=8.1/2.6/3.8%
Gemischte Sätze: is_mixed_tax_rate=true, tax_rate_details ausfüllen.
0% ist gültig bei Kleinunternehmer/Reverse Charge/IG-Lieferung.
```

**JSON-Ausgabeformat + Beispiele (Zeilen ~1127-1161, ~400 Tokens):**
Komplett entfernen — wird durch `response_format` erzwungen.

**Geschätzte Einsparung:** ~2400 Tokens von ~5000 = ~48% nur im User-Prompt

### 4. expensesOnlyPrompt deduplizieren (Zeilen ~640-748)

Die 4 fast identischen Varianten (mit Keywords/ohne, via DB/via Body) werden zu einer Funktion `buildExpensesOnlyPrompt(keywords: string[], hint: string)` konsolidiert. Reduziert ~200 Zeilen auf ~50 Zeilen.

### 5. DB-Queries konsolidieren

Aktuell gibt es für `receiptId`-Pfade mehrere separate Queries auf `receipts`:
- Zeile 489: `select('*')` — Datei-Download
- Zeile 621: `select('vendor_id, user_id')` — expenses-only Check
- Zeile 756: `select('vendor_id')` — Hint-Check
- Zeile 791: `select('user_id')` — Kategorie-Query
- Zeile 1371: `select('user_id, vendor_id')` — Post-Processing

**Lösung:** Die erste Query (Zeile 489) liefert bereits `select('*')`, also alle Felder. Alle nachfolgenden Receipt-Queries werden eliminiert und nutzen stattdessen die bereits geladene Variable `receipt`.

Ebenso wird der doppelte Vendor-Query (Zeile 629 + 763) zu einem konsolidiert.

### 6. Community Patterns limitieren (Zeile 848)

`.limit(50)` → `.limit(15)` — reduziert Prompt-Tokens und DB-Last.

### 7. max_tokens reduzieren (Zeile 1189)

`4096` → `2048` — mit Structured Output wird die Antwort kompakter.

### 8. Schema-Test-Code entfernen (Zeilen 310-471)

Die ~160 Zeilen Test-Code werden entfernt, da Structured Output jetzt im Produktiv-Pfad aktiv ist.

### 9. V2-Prompt in prompt_versions speichern

Nach dem Refactoring wird der neue komprimierte Prompt als Version `v2` in die `prompt_versions`-Tabelle eingefügt (`is_active: true`), und `v1` wird auf `is_active: false` gesetzt. Im Receipt-Update (Zeile ~1469) wird `prompt_version: 'v2'` geschrieben.

### 10. Feld-Mapping im Post-Processing

Da das Schema andere Feldnamen hat als das `ExtractionResult`-Interface (z.B. `vendor_name` → `vendor`, `total_amount` → `amount_gross`), wird nach dem JSON-Parse ein Mapping-Schritt eingefügt, der die Schema-Felder auf die bestehenden internen Feldnamen mappt. Bestehender Post-Processing-Code (MwSt-Konsistenz, Betrags-Korrekturen) bleibt unverändert.

## Technische Details

- **Datei:** `supabase/functions/extract-receipt/index.ts` — komplett refactored
- **DB-Insert:** `prompt_versions` Tabelle bekommt V2-Eintrag via Insert-Tool
- **DB-Update:** `prompt_versions` V1 → `is_active: false` via Insert-Tool
- **Kein Schema-Change nötig** — `receipts.prompt_version` existiert bereits mit Default `'v1'`
- **Abwärtskompatibel:** Das `ExtractionResult`-Interface und die Response-Struktur der Edge Function bleiben identisch
- Alle Consumer (Frontend, andere Edge Functions) bleiben unverändert

## Risiko-Minimierung

- V1-Prompt ist in `prompt_versions`-Tabelle gesichert
- Bestehende Belege behalten `prompt_version: 'v1'`
- Post-Processing (MwSt-Konsistenz, Betrags-Fixes, Category/VAT Learning) bleibt komplett erhalten
- Rollback möglich durch Wiederherstellen des alten Codes

