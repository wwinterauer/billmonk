

# Retroaktive automatische Belegfreigabe bei Aktivierung

## Problem

Die automatische Belegfreigabe wird aktuell nur beim Upload/Verarbeitung neuer Belege geprueft. Wenn ein Nutzer die Einstellung nachtraeglich fuer einen Lieferanten aktiviert, bleiben bestehende Belege im Status "review" liegen.

## Loesung

Beim Speichern eines Lieferanten mit aktivierter Auto-Approve-Einstellung werden alle verknuepften Review-Belege retroaktiv freigegeben, sofern sie die Konfidenz-Schwelle erreichen.

## Technische Umsetzung

### Datei: `src/hooks/useVendors.ts` -- Funktion `updateVendor`

Nach dem erfolgreichen Update des Lieferanten wird geprueft, ob `auto_approve` auf `true` gesetzt wurde. Falls ja:

1. Alle Belege mit `vendor_id = id` und `status = 'review'` laden
2. Filtern: `ai_confidence >= auto_approve_min_confidence`
3. Ausschliessen: Duplikate (`is_duplicate = true`) und Splitting-Belege (`status = 'needs_splitting'`)
4. Batch-Update: `status = 'approved'`, `auto_approved = true`
5. Rueckgabe der Anzahl retroaktiv freigegebener Belege

```text
Pseudo-Code:
if (updates.auto_approve === true || data.auto_approve === true) {
  // Lade Review-Belege dieses Lieferanten
  // Filtere nach Konfidenz >= Schwellenwert
  // Schliesse Duplikate und Splitting aus
  // Setze status = 'approved', auto_approved = true
}
```

### Datei: `src/components/settings/VendorManagement.tsx` -- Funktion `handleSave`

Die bestehende Toast-Nachricht wird erweitert: Neben "X Belege synchronisiert" wird auch "Y Belege automatisch freigegeben" angezeigt, falls retroaktive Freigaben stattfanden.

### Aenderung am Return-Typ von `updateVendor`

Der Rueckgabetyp wird von `{ vendor, syncedReceipts }` auf `{ vendor, syncedReceipts, autoApprovedReceipts }` erweitert.

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/hooks/useVendors.ts` | Retroaktive Freigabe-Logik in `updateVendor` |
| `src/components/settings/VendorManagement.tsx` | Toast-Nachricht mit Anzahl freigegebener Belege |

## Sicherheits-Checks

- Duplikate werden nicht freigegeben
- Belege mit `needs_splitting` werden nicht freigegeben
- Nur Belege mit ausreichender KI-Konfidenz werden freigegeben
- RLS-Policies stellen sicher, dass nur eigene Belege betroffen sind
