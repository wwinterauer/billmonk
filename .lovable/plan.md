# Vendor-Suche im Review

## Ziel
In der Review-Ansicht soll ein einzelnes Suchfeld nach Lieferant/Marke bzw. rechtlichem Firmennamen filtern. Beispiel: Eingabe "Ionos" zeigt nacheinander alle noch zu prüfenden Ionos-Belege an.

## Was wird gebaut

### 1. Filter-Logik in `src/pages/Review.tsx`
- Neuer State `vendorSearch` (mit URL-Param `?vendor=` synchronisiert, damit die Suche beim Neuladen erhalten bleibt).
- `useVendors()` wird bereits importiert und liefert alle Vendoren inkl. `legal_names`.
- `filteredReceipts` per `useMemo` berechnen. Ein Beleg passt, wenn der Suchbegriff (case-insensitive) vorkommt in:
  - `receipt.vendor`
  - `receipt.vendor_brand`
  - zugehöriger Vendor `display_name`
  - einem Eintrag im Vendor-Array `legal_names`
- Navigation, Fortschrittsbalken und "Beleg X von Y" beziehen sich auf `filteredReceipts` statt auf alle `receipts`.
- Wenn die Suche aktiv ist und der aktuelle Beleg nicht mehr passt, wird auf den ersten passenden Beleg gesprungen.
- Leere Suche zeigt weiterhin alle an.

### 2. UI-Elemente
- Suchfeld oberhalb der Fortschrittsanzeige, rechts neben dem Header-Bereich:
  - Placeholder: "Nach Lieferant/Marke suchen…"
  - Lupe-Icon links
  - X-Button zum Zurücksetzen
  - Badge mit Anzahl der passenden Belege
- Keine Treffer: angepasster Empty-State mit "Suche zurücksetzen"-Button.
- Bestehende Tabs (Zu prüfen / Problembelege) bleiben unverändert; die Suche wirkt nur im "Zu prüfen"-Tab.

### 3. Verhalten beim Speichern/Bestätigen
- Nach dem Speichern wird der Beleg aus `receipts` entfernt; `filteredReceipts` aktualisiert sich automatisch.
- Der Review springt zum nächsten passenden Beleg in der gefilterten Liste.
- Wenn der letzte passende Beleg bestätigt wurde, wird der Erfolgs-Empty-State angezeigt.

## Technische Details
- Keine Backend-Änderung nötig; Filterung erfolgt clientseitig auf den bereits geladenen Review-Belegen.
- `useVendors()` liefert die rechtlichen Namen; kein zusätzlicher Supabase-Join erforderlich.
- URL-Sync via `useSearchParams`, sodass der Zustand bookmark- und reload-fähig ist.

## Dateien
- `src/pages/Review.tsx` – Filter-State, `filteredReceipts`, Such-UI, Navigation auf gefilterte Liste umstellen.
