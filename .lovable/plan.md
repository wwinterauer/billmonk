# Wiederkehrende Akontobuchungen erkennen

Strom-, Heizungs- und ähnliche Akontobeträge (z.B. Holzwärme 132€ monatlich, Unsere Wasserkraft 139€) werden als immer gleiche Beträge mehrfach abgebucht. Nur die Endabrechnung hat einen Beleg – die Akontobuchungen sollen erkennbar sein und gebündelt als "ignorieren" markierbar werden.

## Erkennungslogik (Frontend, in `Reconciliation.tsx`)

Auf nur unmatched Bank-Transaktionen anwenden:

1. **Gruppierung** über alle unmatched Transaktionen des Users:
   - Schlüssel = `(normalisierter Vendor-Token, Betrag auf 2 Nachkommastellen)`
   - Vendor-Token = erstes signifikantes Wort (≥4 Zeichen, ohne Umlaute/Sonderzeichen) aus dem Zahlungsempfänger/Beschreibung – wir benutzen die bestehende `normalize`/`tokensOf`-Logik aus `reconcile-with-skonto`.
2. **Recurring-Kriterium**: 
   - ≥ 3 Buchungen im Schlüssel, 
   - identischer Betrag (±0,01€), 
   - in einem Zeitraum von ≥ 60 Tagen verteilt,
   - durchschnittlicher Abstand 25–35 Tage (monatlich) ODER 85–95 Tage (quartalsweise).
3. Jede so erkannte Gruppe wird als **Akonto-Vorschlag** angezeigt.

## UI-Erweiterung in `Reconciliation.tsx`

Neuer Panel/Abschnitt oberhalb der Buchungsliste: **"Wiederkehrende Akontobuchungen erkannt"**

Pro Gruppe eine Karte:
```text
Holzwärme – 132,00 €
4 Buchungen, monatlich (Jan–Apr 2026)
[Alle anzeigen] [Alle als Akonto ignorieren] [Verwerfen]
```

- **Alle anzeigen**: Expand/Collapse zeigt die einzelnen Buchungen mit Datum + voller Beschreibung.
- **Alle als Akonto ignorieren**: Setzt `status='ignored'` auf allen Transaktionen der Gruppe (Bestätigungsdialog).
- **Verwerfen**: blendet die Gruppe für diese Session aus (kein DB-Write – wir merken uns die Gruppenhashes im React State).

In der Hauptliste bekommen Buchungen, die zu einer erkannten Gruppe gehören, ein kleines Badge **"wiederkehrend"** mit Tooltip.

## Filter

Im Reconciliation-Filter eine zusätzliche Option **"Ignoriert anzeigen"** (off by default) – damit Akonto-Buchungen nach dem Ignorieren nicht stören, aber jederzeit wieder einsehbar/reaktivierbar sind. Reaktivierung: Button "Wieder als offen markieren" an ignorierten Zeilen.

## Keine Änderungen an

- Reconcile-Edge-Functions (Logik berührt nur Anzeige + Status-Updates).
- DB-Schema (`status='ignored'` existiert bereits).

## Dateien

- `src/pages/Reconciliation.tsx` – neue Detection-Funktion (`detectRecurringGroups`), neuer UI-Block, Badge, Filter-Erweiterung, Bulk-Ignore-Handler.
- Optional: kleiner Helper `src/lib/recurring-detection.ts` mit der reinen Erkennungslogik (testbar).

Soll ich es so umsetzen?
