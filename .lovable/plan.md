## Problem

Wenn beim Bankimport ein Stichwort (z.B. "Kartenentgelt", "Kontoführung") greift, wird automatisch ein "no-receipt"-Beleg angelegt. Dabei wird als `description` aktuell nur das `description_template` des Keywords gespeichert (z.B. einfach "Kontoführungsgebühr") — die individuelle, vollständige Bankbuchungsbeschreibung geht verloren.

Folge: Zwei Buchungen mit demselben Template, gleichem Betrag und ähnlichem Datum sehen für die Duplikat-Erkennung identisch aus, obwohl der Originaltext der Bankbuchung sich unterscheidet.

## Lösung

In `src/pages/BankImport.tsx` (Zeilen 352–373) beim Anlegen des Belegs die volle Original-Bankbeschreibung mit aufnehmen:

- `description` = `template` vorhanden → `"<template> – <tx.description>"`, sonst `tx.description`
- `bank_transaction_reference` bleibt wie bisher die rohe `tx.description` (Backup)

Damit unterscheiden sich die Belege textuell wieder und die Duplikatprüfung schlägt nicht mehr fälschlich an.

## Scope

- Nur diese eine Stelle in `src/pages/BankImport.tsx` ändert sich.
- Keine DB-Migration, keine Logikänderung an der Duplikaterkennung selbst.
- Bestehende Belege bleiben unverändert (nur Neuimporte profitieren).
