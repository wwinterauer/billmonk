

# Manuelle Abfrage bis Datum X für E-Mail-Sync

## Übersicht

Der User möchte bei einem E-Mail-Konto (IMAP/Gmail/Microsoft) eine einmalige manuelle Abfrage starten, die alle E-Mails bis zu einem frei wählbaren Datum durchsucht. Duplikate werden über den bestehenden `file_hash`-Mechanismus automatisch übersprungen.

## Änderungen

### 1. Edge Functions: `syncSince`-Parameter akzeptieren

**`supabase/functions/sync-imap-emails/index.ts`**
- Body-Parameter `syncSince` (ISO-Datum-String) akzeptieren neben `accountId` und `resync`
- In `processEmails`: Wenn `syncSince` gesetzt, IMAP-Suchkriterium `SINCE {datum}` verwenden (statt 7-Tage-Resync oder UNSEEN)
- Mehr Nachrichten verarbeiten: `maxToProcess = 100` bei `syncSince`
- Duplikate werden bereits über `file_hash` in der Import-Pipeline gefiltert

**`supabase/functions/sync-gmail/index.ts`**
- Body-Parameter `syncSince` akzeptieren
- In `buildGmailQuery`: Wenn `syncSince` gesetzt, `after:{datum}` verwenden statt `last_sync_at`
- Mehr Messages fetchen: `maxResults=100`

**`supabase/functions/sync-microsoft/index.ts`**
- Body-Parameter `syncSince` akzeptieren
- In `buildGraphFilter`: Wenn `syncSince` gesetzt, `receivedDateTime` Filter auf das Datum setzen

### 2. `src/hooks/useEmailImport.ts`

- `syncEmailAccount` Mutation: `syncSince?: string` Parameter zum Body hinzufügen
- An Edge Function weitreichen: `body: { accountId, resync, syncSince }`

### 3. `src/components/settings/EmailImportSettings.tsx`

- Pro Account-Karte: Neben "Sync" und "Resync" einen dritten Button "Historisch abrufen" (Calendar-Icon)
- Klick öffnet ein Popover mit:
  - Text: "Alle E-Mails seit einem bestimmten Datum durchsuchen. Bereits importierte Belege werden übersprungen."
  - Datepicker (Calendar-Komponente) für das Start-Datum
  - "Abrufen"-Button
- Bei Klick auf "Abrufen": `syncEmailAccount({ accountId, syncSince: date.toISOString() })` aufrufen
- Popover schließt sich, normaler Sync-Status wird angezeigt

### Dateien
- `supabase/functions/sync-imap-emails/index.ts`
- `supabase/functions/sync-gmail/index.ts`
- `supabase/functions/sync-microsoft/index.ts`
- `src/hooks/useEmailImport.ts`
- `src/components/settings/EmailImportSettings.tsx`

