## Problem

Wenn man in der Review die "Automatische Freigabe" für einen Lieferanten aktiviert, werden andere bereits in der Review liegende Belege desselben Lieferanten **nicht** rückwirkend freigegeben. Erst das Speichern in den Lieferanteneinstellungen löst das aus.

## Ursache

In `src/pages/Review.tsx` (Switch + Slider, Zeilen 1127–1180) wird direkt `supabase.from('vendors').update(...)` aufgerufen.

In `src/components/settings/VendorManagement.tsx` läuft das Update dagegen über den Hook `updateVendor` aus `src/hooks/useVendors.ts` (Zeilen 382–479). Genau dort steckt die retroaktive Logik: Wenn `auto_approve = true`, sucht der Hook alle passenden Belege im Status `review` (verknüpfte + per Name/Brand erkannte) mit ausreichender Konfidenz, verknüpft sie ggf. mit dem Lieferanten und setzt sie auf `approved` / `auto_approved = true`.

Die Review umgeht diesen Hook → keine retroaktive Freigabe.

## Lösung

Den Switch und den Slider in `Review.tsx` so umbauen, dass sie **dieselbe Funktion** verwenden wie die Lieferantenverwaltung.

### Änderungen in `src/pages/Review.tsx`

1. `useVendors`-Hook importieren und `updateVendor` daraus beziehen.
2. `onCheckedChange` des Switches: statt direktem `supabase.update`
   - `await updateVendor(selectedVendorId, { auto_approve: checked, auto_approve_min_confidence: vendorAutoApproveMinConfidence })`
   - Bei Aktivierung: Toast "Automatische Freigabe aktiviert" + Hinweis, falls Belege rückwirkend freigegeben wurden (z. B. "X Beleg(e) automatisch freigegeben"). Den Count kann `updateVendor` bereits zurückliefern — falls nicht, kleinen Rückgabewert ergänzen oder die offene Liste danach refetchen.
   - Liste der Review-Belege im Anschluss neu laden, damit der zweite Beleg in der UI verschwindet.
3. `onValueChange` des Sliders: ebenfalls über `updateVendor` speichern (damit ein Hochsetzen ggf. neue Belege erfasst, ein Heruntersetzen erfasst keine neuen Belege rückwirkend nicht – Verhalten bleibt wie bisher in der Lieferantenverwaltung).
4. Fehlerbehandlung wie bisher (Toast + State-Rollback bei Fehler).

### Optional (klein)

In `useVendors.ts` `updateVendor` zusätzlich `autoApprovedReceipts` im Rückgabeobjekt mitgeben, falls noch nicht vorhanden, damit der Toast in der Review die Anzahl anzeigen kann ("2 Belege rückwirkend freigegeben").

## Out of Scope

- Keine Änderung an der Auto-Approve-Logik selbst (Konfidenzschwelle, Name-Matching, Duplikatfilter bleiben gleich).
- Keine Änderungen an `VendorManagement.tsx`.
