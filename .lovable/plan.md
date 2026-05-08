## Ziel
Alle Belege und davon abgeleitete Daten für deinen Account (`w.winterauer@gmail.com`) löschen, damit du mit einem leeren System startest. Lieferanten (Vendors) bleiben erhalten.

## Korrigierte Anzahl Belege

| Status | Anzahl |
|---|---|
| approved | 67 |
| review | 61 |
| **Gesamt** | **128** |

## Was gelöscht wird (nur dein User-Account)

| Tabelle | Bemerkung |
|---|---|
| `receipts` | alle 128 Belege |
| `receipt_split_lines` | 38 Split-Buchungen |
| `field_corrections` | 101 KI-Korrektur-Einträge |
| `vendor_learning` | 37 gelernte Vendor-Muster (basieren auf Korrekturen) |
| `email_attachments` | 11 importierte Anhänge |
| `bank_transactions.receipt_id` | auf NULL setzen, falls verknüpft (Transaktion selbst bleibt) |
| Storage `receipts/{user_id}/*` | alle hochgeladenen Belegdateien |
| `profiles.monthly_receipt_count` | auf 0 zurücksetzen (steht auf 268) |

## Was NICHT gelöscht wird

- **Vendors / Lieferanten** (128) — bleiben vollständig erhalten
- **Bank-Transaktionen** (128) — bleiben, nur evtl. Belegzuordnung wird entfernt
- Kategorien, Tags, Firmen-/Bank-Einstellungen, Rechnungen, Kunden, CRM, E-Mail-Konten, Cloud-Backups
- Andere User sind nicht betroffen — alles strikt auf `user_id = bb51fc98-...` gefiltert

## Reihenfolge

```text
1. Storage:  receipts/{user_id}/* löschen
2. DB (in Reihenfolge wegen Abhängigkeiten):
   a) UPDATE bank_transactions SET receipt_id=NULL WHERE user_id=...
   b) DELETE receipt_split_lines (über JOIN auf receipts.user_id)
   c) DELETE field_corrections   WHERE user_id=...
   d) DELETE vendor_learning     WHERE user_id=...
   e) DELETE email_attachments   WHERE user_id=...
   f) DELETE receipts            WHERE user_id=...
   g) UPDATE profiles SET monthly_receipt_count=0 WHERE id=...
```

## Hinweis
Die Aktion ist **nicht rückgängig** zu machen (außer per History-Revert vor der Ausführung). Bestätige den Plan, dann führe ich die Löschungen aus.