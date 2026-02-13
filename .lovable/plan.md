
# "Abgeschlossen" Status in Ausgabenuebersicht sichtbar machen

## Problem

Der Status `completed` (Abgeschlossen) existiert zwar in der Datenbank, ist aber in der Ausgabenuebersicht an mehreren Stellen nicht implementiert:
- Kein Eintrag im Status-Filter-Dropdown
- Keine Farbe/Badge-Darstellung in der Tabelle
- Kein "Abschliessen"-Button in der Bulk-Aktionsleiste
- Kein "Abschliessen"-Button im Einzelbeleg-Bearbeitungspanel
- Nur fuer bereits freigegebene (`approved`) Belege verfuegbar

## Aenderungen

### 1. STATUS_CONFIG erweitern (`src/pages/Expenses.tsx`)

Neuer Eintrag in der Status-Konfiguration (Zeile 135-146):
- `completed`: Label "Abgeschlossen", Farbe Schiefergrau (Slate) - konsistent mit dem dokumentierten Workflow

### 2. Bulk-Aktion "Abschliessen" (`src/pages/Expenses.tsx`)

- `bulkActionLoading`-Typ um `'completed'` erweitern
- Neue Funktion `handleBulkComplete`: Setzt Status auf `completed`, aber **nur fuer Belege mit Status `approved`**. Belege mit anderem Status werden uebersprungen und der User wird informiert.
- Neuer Button "Abschliessen" in der Bulk-Aktionsleiste (zwischen "Ablehnen" und "Tags bearbeiten"), mit Slate-Farbgebung und Archive-Icon
- Umgekehrt: Wenn im Filter `completed` aktiv ist, wird ein Button "Zurueck zu Genehmigt" angezeigt, um den Status wieder auf `approved` zurueckzusetzen

### 3. Einzelbeleg-Panel (`src/components/receipts/ReceiptDetailPanel.tsx`)

- `handleSave`/`handleSaveClick`-Typ um `'completed'` erweitern
- Neuer "Abschliessen"-Button neben "Freigeben" - nur sichtbar wenn der Beleg aktuell `approved` ist
- Wenn Beleg `completed` ist: Button "Zurueck zu Genehmigt" anzeigen, um zurueckzusetzen
- Status-Meldungen um `completed: 'Beleg abgeschlossen'` erweitern

### 4. Sidebar-Zaehler (optional, kein Muss)

Der Sidebar zaehlt aktuell nur `review`-Belege. Ein separater Zaehler fuer `completed` ist nicht noetig, da es sich um einen finalen Status handelt.

## Technische Details

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Expenses.tsx` | STATUS_CONFIG + Bulk-Aktion + Button |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Status-Typ erweitern + Button |

### Logik "Abschliessen"

- Nur Belege mit Status `approved` koennen abgeschlossen werden
- Bei Bulk-Aktion: Nicht-freigegebene Belege werden uebersprungen, Toast zeigt "X von Y abgeschlossen, Z uebersprungen (nicht freigegeben)"
- Abgeschlossene Belege koennen zurueck auf `approved` gesetzt werden
