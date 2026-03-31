

# Vendor-Update Race Condition absichern

## Übersicht

Die `updateVendor()`-Funktion in `useVendors.ts` führt mehrere sequenzielle DB-Calls durch. Ein doppelter Klick kann parallele Ausführungen auslösen. Lösung: useRef-basiertes Lock im Hook + Button-Deaktivierung im UI.

**Hinweis:** `VendorManagement.tsx` hat bereits `isSaving`-State und deaktiviert den Button damit. Das Problem ist aber, dass `updateVendor()` selbst kein Guard hat — andere Aufrufer (z.B. programmatische Calls) wären ungeschützt. Der Guard muss also im Hook selbst sitzen.

## Änderungen

### 1. `src/hooks/useVendors.ts`

- `useRef<boolean>(false)` als `isUpdatingRef` hinzufügen (kein useState, da kein Re-Render nötig)
- Zusätzlich `useState<boolean>(false)` als `isUpdatingVendor` für UI-Feedback exportieren
- Am Anfang von `updateVendor()`: Wenn `isUpdatingRef.current === true`, sofort returnen (throw oder return mit Warnung)
- `isUpdatingRef.current = true` + `setIsUpdatingVendor(true)` setzen
- Im `finally`-Block: `isUpdatingRef.current = false` + `setIsUpdatingVendor(false)`
- `isUpdatingVendor` im Return-Objekt exportieren

### 2. `src/components/settings/VendorManagement.tsx`

- `isUpdatingVendor` aus `useVendors()` destrukturieren
- Button (Zeile 1589): `disabled`-Bedingung um `isUpdatingVendor` erweitern: `disabled={isSaving || isUpdatingVendor || !formData.display_name.trim()}`

### Dateien
- `src/hooks/useVendors.ts`
- `src/components/settings/VendorManagement.tsx`

