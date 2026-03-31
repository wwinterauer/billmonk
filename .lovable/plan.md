

# Crypto: Per-User Salt

## Übersicht

Aktuell verwendet `getEncryptionKey()` einen fixen Salt für alle User. Neues Format: `salt:iv:ciphertext` (Base64-kodiert, durch Doppelpunkte getrennt). Bestehende Werte ohne Doppelpunkte verwenden den alten fixen Salt als Fallback.

## Änderungen in `supabase/functions/_shared/crypto.ts`

### 1. `getEncryptionKey(salt: Uint8Array)` — Salt als Parameter

Statt intern fixen Salt zu verwenden, nimmt die Funktion den Salt als Parameter entgegen.

### 2. `encryptString()` — Per-User Salt generieren

- 16 Bytes zufälligen Salt generieren (`crypto.getRandomValues`)
- Salt an `getEncryptionKey(salt)` übergeben
- Rückgabe im Format `base64(salt):base64(iv+ciphertext)` (Doppelpunkt als Trenner)

### 3. `decryptString()` — Salt aus gespeichertem Wert parsen

- Prüfe ob der String einen Doppelpunkt enthält
- **Ja (neues Format)**: Split bei `:`, erster Teil = Salt (Base64-dekodiert), zweiter Teil = IV+Ciphertext wie bisher
- **Nein (altes Format)**: Verwende den fixen Salt `"lovable-email-encryption-v1"` als Fallback → volle Rückwärtskompatibilität

### 4. `isAesEncrypted()` — Anpassen

Berücksichtigt das neue Doppelpunkt-Format als gültiges AES-verschlüsseltes Format.

### 5. `decryptPassword()` — Keine Änderung nötig

Ruft `decryptString()` auf, das intern die Format-Erkennung übernimmt. Legacy-Base64-Fallback bleibt.

### Dateien
- `supabase/functions/_shared/crypto.ts`

