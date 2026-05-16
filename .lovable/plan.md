# Duplikat-Erkennung — False-Positive bei energy hero

## Befund (live aus DB)

Drei Belege, alle 49,00 € / 2026-02-24 / Lieferant „energy hero" bzw. „Digital Hero GmbH":

| ID-kurz | Rechnungs-Nr. | Vendor | is_duplicate | duplicate_of |
|---|---|---|---|---|
| b31185a3 | RE-EH-**998525** | Digital Hero GmbH | true | 1aeffb93 |
| 1aeffb93 | RE-EH-**998527** | energy hero | true | b31185a3 |
| 1257d8ad | RE-EH-**998530** | energy hero | true | b31185a3 |

Zwei Probleme:
1. **Falsch-positiv:** 998525 ↔ 998527 ↔ 998530 sind echte, unterschiedliche Monatsrechnungen (verschiedene Rechnungsnummern, laut User auch verschiedene Adressen). Dürfen niemals als Duplikat markiert werden.
2. **Zirkulärer Verweis:** b31185a3.duplicate_of → 1aeffb93 und 1aeffb93.duplicate_of → b31185a3. Das „Original" zeigt aufs „Duplikat" zurück.

## Ursache

In `src/services/duplicateDetectionService.ts`:

- **Pfad 3** (Betrag + Datum + Lieferant → Score 90) und **Pfad 6** (Betrag + Datum → 60) filtern Kandidaten nur dann nach Rechnungsnummer, wenn die **neue** Quittung eine `invoice_number` hat. Die Erstprüfung läuft beim Upload — vor der AI-Extraktion. Zu dem Zeitpunkt ist `invoice_number` meist `null`, der Filter `invoice_number.eq.X,invoice_number.is.null` wird übersprungen, und jede Quittung mit gleichem Betrag/Datum/Vendor matched.
- **Pfad 5** (Rechnungs-Nr only → 70): symmetrisch ok, aber tut hier nichts.
- Nach AI-Extraktion wird **nicht automatisch neu geprüft** → `is_duplicate=true` bleibt hängen, obwohl der dann bekannte Rechnungsnummern-Unterschied das Match aufheben würde.
- `applyVendorFilter` nimmt nur das erste Token mit ≥3 Zeichen (z. B. `energy`) — Abo-Rechnungen vom gleichen Anbieter über mehrere Monate mit identischem Betrag triggern das systematisch.
- Beim Markieren wird die Richtung nicht geprüft (älteres = Original), daher der zirkuläre Verweis.

## Lösung

### 1. `src/services/duplicateDetectionService.ts` — strengere Negativ-Regel

In Pfad 3 und Pfad 6 zusätzlich abfragen: **wenn der Kandidat eine `invoice_number` hat und die neue Quittung eine andere `invoice_number` hat → kein Duplikat**. Konkret: Den `.or(invoice_number.eq.X,invoice_number.is.null)`-Block beibehalten, aber zusätzlich explizit nachfiltern in JS, falls der Kandidat eine abweichende Nummer hat (Belt-and-Suspenders, da PostgREST `.or` in Verbindung mit anderen `.eq` selten Edge-Cases hat). Außerdem: Kandidaten-Liste mit `.limit(5)` statt `.maybeSingle()` laden, dann das beste Match clientseitig wählen (überspringt false positives).

Zusätzlich: Wenn `receiptData.invoice_number` `null` ist **und** der Kandidat eine `invoice_number` hat → Score von Pfad 3 von 90 auf z. B. 65 absenken (kein definitives Match möglich) und Match-Reason klar benennen („Rechnungsnummer noch nicht extrahiert").

### 2. Re-Check nach AI-Extraktion

In `src/hooks/useReceiptProcessing.ts` (Pfad 2, nach erfolgreicher Extraktion): wenn der Beleg bereits `is_duplicate=true` ist und jetzt eine `invoice_number` extrahiert wurde, automatisch `checkForDuplicates` mit den frischen Daten erneut aufrufen. Bei keinem Treffer: `is_duplicate=false, duplicate_of=null, duplicate_score=null` setzen.

### 3. Zirkulären Verweis verhindern

In `markAsDuplicate` (oder im Aufrufer): vor dem Update prüfen, ob `duplicateOfId` selbst auf `receiptId` zeigt — wenn ja, **keine** Markierung vornehmen (Konflikt → manuelle Prüfung). Außerdem als Original immer den älteren `created_at` wählen (`duplicate` → neuerer, `duplicate_of` → älterer). Falls der vermeintliche Kandidat jünger ist, Rollen tauschen.

### 4. Bereinigung der drei Bestandsdatensätze

Migration: für die drei betroffenen IDs (`b31185a3`, `1aeffb93`, `1257d8ad`) `is_duplicate=false, duplicate_of=null, duplicate_score=null, duplicate_checked_at=now()` setzen. (Generisches Aufräumen über alle User wäre riskant — wir beschränken uns auf diese drei.)

## Nicht im Scope

- Adressvergleich als zusätzliches Signal — würde Extraktion einer strukturierten Adresse je Beleg erfordern und ist eigene Story.
- Strengerer Vendor-Match (z. B. ≥2 Tokens) — separat zu evaluieren, ggf. später.

## Dateien

- `src/services/duplicateDetectionService.ts` — Pfad 3/6 härten, Score absenken bei fehlender Rechnungs-Nr, Zirkular-Schutz in `markAsDuplicate`.
- `src/hooks/useReceiptProcessing.ts` — Re-Check nach AI-Extraktion.
- Migration — Bereinigung der drei Bestandsdatensätze.
