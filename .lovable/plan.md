# Automatische Berechnung Netto/MwSt im Beleg-Editor

## Ziel

Im Review/Detail-Panel sollen sich Netto- und MwSt-Betrag wechselseitig automatisch berechnen, sobald der Brutto-Betrag eingegeben ist:

- Brutto + MwSt-Betrag → Netto wird berechnet
- Brutto + Netto → MwSt-Betrag wird berechnet
- Brutto + MwSt-Satz (wie bisher) → beide werden berechnet

Berechnete Werte werden — wie heute — als Placeholder mit Zusatz "(berechnet)" im grauen Feld angezeigt und beim Speichern verwendet, solange der User das Feld nicht selbst überschrieben hat.

## Scope

Nur Frontend, eine Datei:
- `src/components/receipts/ReceiptDetailPanel.tsx`

Keine DB-Änderungen, keine Edge-Function-Änderungen, keine Änderungen an Speicher-Payload (`amountNetOverride` / `vatAmountOverride` werden bereits beim Speichern berücksichtigt).

## Änderungen

### 1. `calculatedValues` (≈ Zeile 230) erweitern

Aktuell:
- Mixed Tax: aus `taxRateDetails`
- Sonst: `net = gross / (1 + rate/100)`, `vat = gross - net`

Neu (Reihenfolge bestimmt Priorität):

```text
1. Mixed Tax → wie bisher
2. Wenn vatAmountOverride gesetzt UND amountNetOverride leer:
     net = gross - vatOverride
     vat = vatOverride
3. Wenn amountNetOverride gesetzt UND vatAmountOverride leer:
     net = netOverride
     vat = gross - netOverride
4. Wenn beide Overrides gesetzt: keine Berechnung (User hat alles selbst)
5. Sonst (nur gross + vat_rate): wie bisher (net = gross/(1+rate/100))
```

Negative Ergebnisse oder gross=0 → fallback auf 0 (keine "(berechnet)" Anzeige).

### 2. Placeholder-Logik in den beiden Input-Feldern (≈ Zeile 1668–1701)

Bleibt unverändert in Form: Placeholder zeigt `calculatedValues.net` bzw. `calculatedValues.vat` mit Suffix "(berechnet)". Da die neuen Fälle 2/3 jeweils das jeweils andere Feld berechnen, taucht "(berechnet)" automatisch nur im noch leeren Feld auf.

Kleine UX-Verbesserung: wenn der User den Override eines Feldes wieder löscht, soll das andere Feld zurück in den "berechnet"-Modus fallen — das passiert mit der neuen Logik automatisch, weil `calculatedValues` reagiert.

### 3. Speichern (≈ Zeile 754–788 / 655)

Bereits korrekt: beim Save wird `amountNetOverride ? parseFloat(...) : calculatedValues.net` verwendet. Da `calculatedValues` jetzt auch die neuen Fälle abdeckt, funktioniert der bestehende Save-Pfad ohne Anpassung.

Eine Sicherheitsprüfung: falls beide Overrides leer sind, aber `calculatedValues` aus Fall 5 (gross+rate) leer wäre (rate=0), bleibt das Verhalten wie heute (null gespeichert).

## Technische Details

- Keine neuen Imports nötig.
- `useMemo`-Deps werden um `amountNetOverride` und `vatAmountOverride` erweitert.
- Toleranz: Wenn `Math.abs(gross - net - vat) > 0.01` und beide Overrides gesetzt sind, wird trotzdem nicht automatisch korrigiert — User-Eingaben haben Vorrang.
- Numerik: kleine negative Differenzen (z.B. -0.001 durch Rundung) auf 0 clampen.

## Was sich für den User ändert

Vorher: Eingabe von Brutto + MwSt-Betrag → Netto-Feld bleibt leer (Placeholder "—").
Nachher: Netto-Feld zeigt automatisch `(berechnet)`-Vorschlag = Brutto − MwSt. Analog umgekehrt.
