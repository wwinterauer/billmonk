

# Cloud-Backup Erweiterung: Export-Vorlagen, Deduplizierung und Benennung

## Zusammenfassung

Die Backup-Einstellungen werden um folgende Funktionen erweitert:
- Excel/CSV-Export nach auswaehlbarer Export-Vorlage (aus den bestehenden Vorlagen unter Einstellungen > Export)
- Korrekte Status-Filter (die aktuellen Labels stimmen nicht mit den DB-Werten ueberein)
- Inkrementelles Backup: Nur Belege die noch nie per Cloud-Backup exportiert wurden (manueller Export wird ignoriert)
- Konfigurierbare ZIP-Benennung und Ordnerstruktur

## Aenderungen im Detail

### 1. Status-Filter korrigieren

Die aktuellen Labels in `CloudStorageSettings.tsx` sind falsch:
- "Geprueft" -> war `review`, korrekt ist: "Zur Pruefung"
- "Genehmigt" -> `approved`, korrekt
- "Ausstehend" -> `pending`, korrekt

Neue vollstaendige Liste:

| DB-Wert | Label |
|---------|-------|
| `pending` | Ausstehend |
| `processing` | In Verarbeitung |
| `review` | Zur Pruefung |
| `approved` | Genehmigt |
| `rejected` | Abgelehnt |
| `completed` | Abgeschlossen |

### 2. Export-Vorlage auswaehlen (Excel/CSV)

- Neues Dropdown in den Backup-Einstellungen: "Export-Vorlage"
- Laedt die bestehenden `export_templates` des Users
- Option "Keine Zusammenfassung" um nur PDFs zu sichern
- Option "Standard-CSV (alle Felder)" als Fallback
- Die Datenbank hat bereits die Spalte `backup_template_id` in `cloud_connections`
- Neuer Switch: "Excel-Export" und "CSV-Export" (eines oder beide)

### 3. Inkrementelles Backup (Deduplizierung)

Das bestehende System nutzt bereits `cloud_backup_at IS NULL` auf der `receipts`-Tabelle. Das bedeutet:
- Nur Belege die noch NIE per Cloud-Backup exportiert wurden, werden eingeschlossen
- Manuelle Exports (Download-Button) setzen `cloud_backup_at` NICHT - sie sind unabhaengig
- Das ist bereits korrekt implementiert, nur die Dokumentation/UI muss das klarer kommunizieren

Erweiterung: Auch die Excel/CSV-Zusammenfassung enthaelt nur die neuen (noch nicht gesicherten) Belege - keine Duplikate.

### 4. ZIP-Benennung und Ordnerstruktur

Neue Einstellungen in der UI:
- **ZIP-Dateiname-Muster**: z.B. `{prefix}_{datum}` -> `XpenzAI-Backup_2026-02-13`
  - Platzhalter: `{prefix}`, `{datum}`, `{zeit}`, `{anzahl}`, `{monat}`, `{jahr}`
- **Ordnerstruktur in Google Drive**: 
  - Flach (alles in einen Ordner)
  - Nach Monat (`2026/02/`)
  - Nach Kategorie

### 5. Edge Function `backup-to-drive` erweitern

Die Edge Function muss erweitert werden um:
- Export-Vorlage aus DB laden (`backup_template_id`)
- Excel-Datei generieren (mit den Spalten/Formatierung der Vorlage)
- CSV-Datei generieren (mit den Spalten der Vorlage)
- ZIP-Archiv erstellen statt Einzeldateien hochladen
- Ordnerstruktur in Drive anlegen falls konfiguriert
- ZIP-Dateiname nach Muster generieren

## Technische Details

### Geaenderte Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/settings/CloudStorageSettings.tsx` | Status-Filter korrigieren, Export-Vorlage-Dropdown, ZIP-Benennung, Ordnerstruktur-Optionen |
| `supabase/functions/backup-to-drive/index.ts` | Vorlage laden, Excel/CSV nach Vorlage generieren, ZIP bauen, Ordnerstruktur |

### Datenbank-Migration

Neue Spalten in `cloud_connections`:
- `backup_include_excel` (boolean, default true) - Excel-Datei einschliessen
- `backup_include_csv` (boolean, default true) - CSV-Datei einschliessen
- `backup_zip_pattern` (text, default `'{prefix}_{datum}_{zeit}'`) - ZIP-Dateiname-Muster
- `backup_folder_structure` (text, default `'flat'`) - Ordnerstruktur (flat, monthly, category)

### CloudConnection Interface erweitern

Neue Felder:
- `backup_template_id` (bereits in DB vorhanden, fehlt im Interface)
- `backup_include_excel`
- `backup_include_csv`
- `backup_zip_pattern`
- `backup_folder_structure`

### Edge Function: Excel-Generierung

Da die Edge Function in Deno laeuft, wird eine einfache XLSX-Generierung ohne externe Library implementiert (oder alternativ CSV mit BOM fuer Excel-Kompatibilitaet). Die Spalten und Formatierung werden aus der Export-Vorlage uebernommen.

