
# Google Drive Integration - Implementierungsplan

## Uebersicht

Die Google Drive Integration ermoeglicht zwei Hauptfunktionen:
1. **Verbindung herstellen** - OAuth-Flow mit Google Drive Scopes
2. **Automatisches Backup** - Inkrementelles Backup von Belegen als ZIP-Archiv nach Google Drive

## Aktueller Stand

- Die Datenbank-Tabelle `cloud_connections` existiert bereits mit allen noetigen Feldern (OAuth-Tokens, Backup-Konfiguration, Zeitplan etc.)
- Google OAuth Credentials (Client ID, Secret, Redirect URI) sind als Secrets konfiguriert
- Der bestehende OAuth-Flow (oauth-start/oauth-callback) behandelt nur E-Mail (Gmail/Microsoft), nicht Google Drive
- Upload-Seite hat Platzhalter-Buttons mit "Coming Soon" Badge
- Settings-Seite hat noch keinen Cloud-Storage-Tab

## Implementierungsschritte

### 1. OAuth-Flow fuer Google Drive erweitern

**Edge Function `oauth-start`**: Provider "google_drive" hinzufuegen mit Drive-spezifischen Scopes:
- `https://www.googleapis.com/auth/drive.file` (Dateien erstellen/lesen die die App erstellt hat)
- `https://www.googleapis.com/auth/userinfo.email`

**Edge Function `oauth-callback`**: Handler fuer "google_drive" Provider hinzufuegen, der die Tokens in `cloud_connections` statt `email_accounts` speichert.

### 2. Neuer Settings-Tab "Cloud-Speicher"

Ein neuer Tab in den Einstellungen (10. Tab mit Cloud-Icon) mit:
- **Verbindungsstatus**: Google Drive verbunden/nicht verbunden, E-Mail-Adresse
- **Verbinden/Trennen Button**: Startet OAuth-Flow oder loescht Verbindung
- **Backup-Konfiguration** (nur sichtbar wenn verbunden):
  - Backup aktivieren/deaktivieren (Switch)
  - Zeitplan: woechentlich oder monatlich
  - Wochentag (bei woechentlich) oder Tag im Monat
  - Uhrzeit
  - Datei-Praefix (Standard: "XpenzAI-Backup")
  - Status-Filter (welche Belege gesichert werden)
  - Dateien einschliessen (PDFs mitschicken)
  - Letztes Backup: Datum, Anzahl Belege, ggf. Fehler

### 3. Settings-Komponente `CloudStorageSettings.tsx`

Neue Komponente die:
- Bestehende `cloud_connections` fuer den User laedt
- OAuth-Flow ueber `oauth-start` Edge Function startet
- Backup-Einstellungen in `cloud_connections` speichert
- Naechstes geplantes Backup berechnet und anzeigt

### 4. Edge Function `backup-to-drive`

Neue Edge Function die:
- Belege findet wo `cloud_backup_at IS NULL` (noch nie gesichert)
- PDFs aus dem Storage-Bucket laedt
- Dateien umbenennt (nach Naming-Settings)
- Zusammenfassung als CSV generiert
- Alles in ein ZIP-Archiv packt
- ZIP nach Google Drive hochlaedt (mit Token-Refresh falls noetig)
- `cloud_backup_at` bei gesicherten Belegen aktualisiert
- Backup-Status in `cloud_connections` aktualisiert

### 5. Upload-Seite aktualisieren

- "Coming Soon" Badge bei Google Drive entfernen
- Button funktional machen: Wenn Verbindung besteht, Ordner-Auswahl anzeigen; sonst zu Settings weiterleiten

## Technische Details

### Neue/geaenderte Dateien

| Datei | Aktion |
|-------|--------|
| `supabase/functions/oauth-start/index.ts` | Erweitern um "google_drive" Provider |
| `supabase/functions/oauth-callback/index.ts` | Erweitern um "google_drive" Handler |
| `supabase/functions/backup-to-drive/index.ts` | Neu erstellen |
| `src/components/settings/CloudStorageSettings.tsx` | Neu erstellen |
| `src/pages/Settings.tsx` | Neuen Tab "Cloud" hinzufuegen |
| `src/pages/Upload.tsx` | Google Drive Button aktivieren |
| `supabase/config.toml` | Neue Edge Function registrieren |

### Datenbank-Migration

- Spalte `cloud_backup_at` in `receipts` Tabelle hinzufuegen (falls nicht vorhanden)
- Redirect-URI fuer den Google Drive OAuth-Callback muss ggf. als neuer Secret oder als bestehende GOOGLE_REDIRECT_URI verwendet werden (gleicher Callback, anderer Provider-Parameter)

### Google Drive API Scopes

Der Drive-OAuth-Flow nutzt eingeschraenkte Scopes (`drive.file`), sodass die App nur auf selbst erstellte Dateien zugreifen kann - nicht auf das gesamte Drive des Users.

### Voraussetzung

Die Google Cloud Console muss die Google Drive API aktiviert haben und die Redirect-URI muss dort hinterlegt sein (laut Memory bereits erledigt fuer `oauth-cloud-callback`). Falls ein separater Callback-Pfad gewuenscht ist, muss eine weitere Redirect-URI eingetragen werden.
