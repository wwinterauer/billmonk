

# Import-Adresse benutzerfreundlicher gestalten

## Problem

Aktuell: `receipts+a8k3x9m2p7...@import.billmonk.ai` (32 Zeichen Zufallsstring) — nicht merkbar.

## Lösung

Format ändern zu: `receipts+vorname.nachname.XXXX@import.billmonk.ai`

- Vorname + Nachname aus dem Profil (lowercase, Umlaute/Sonderzeichen bereinigt)
- 4 Zeichen Zufalls-Suffix für Eindeutigkeit und Sicherheit
- Beispiel: `receipts+max.mustermann.a7k2@import.billmonk.ai`
- Falls kein Name vorhanden: Fallback auf Email-Prefix (vor dem @)

Der Token bleibt intern weiterhin der komplette Teil nach `receipts+` (z.B. `max.mustermann.a7k2`) — die Webhook-Funktion matcht darüber.

## Sicherheitsaspekt

Der Token wird kürzer, aber:
- Die Webhook-Funktion validiert den Token gegen die DB
- Rate-Limiting ist bereits implementiert
- 4 Zeichen Suffix = 1.679.616 Kombinationen — ausreichend da kein Login-Mechanismus

## Änderungen

### `src/hooks/useEmailImport.ts`

**generateToken** aufteilen in zwei Funktionen:

1. `generateShortSuffix()` — 4 Zeichen alphanumerisch
2. `generateUserToken(user)` — baut `vorname.nachname.XXXX` zusammen:
   - `user.user_metadata.first_name` + `user.user_metadata.last_name` holen
   - Lowercase, Umlaute ersetzen (ä→ae, ö→oe, ü→ue, ß→ss), Sonderzeichen entfernen
   - Fallback: Email-Prefix vor `@`
   - Zusammen: `${sanitized_first}.${sanitized_last}.${suffix}`

**createConnectionMutation** (Zeile 185): `generateToken()` → `generateUserToken(user)`

**regenerateTokenMutation** (Zeile 239): Gleiche Änderung — beim Regenerieren wird ein neuer Suffix generiert, aber der Name bleibt

### Bestehende Verbindungen

Bestehende Adressen bleiben unverändert — nur neue Verbindungen und Regenerierungen verwenden das neue Format.

### Dateien
- `src/hooks/useEmailImport.ts`

