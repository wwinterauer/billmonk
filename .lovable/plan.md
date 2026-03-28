
# Splitbuchungen — Phasenweise Umsetzung

## Phase 1: Datenmodell + Feature-Toggle + Plan-Gating ✅
- DB: `receipt_split_lines` Tabelle + RLS ✅
- DB: `receipts.is_split_booking` boolean ✅
- DB: `profiles.split_booking_enabled` boolean ✅
- `planConfig.ts`: `splitBooking: 'business'` ✅
- `usePlan.ts`: `splitBookingEnabled` exponiert ✅
- Settings: Toggle unter Business-Plan-Check ✅

## Phase 2: Split-Editor UI
- `SplitBookingEditor.tsx` (Brutto/Netto editierbar, bidirektional)
- Integration in `Review.tsx` + `ReceiptDetailPanel.tsx`
- Alles hinter `splitBookingEnabled`-Check

## Phase 3: Ausgaben, Dashboard, Reports ✅
- Split-Badges in Expenses-Tabelle (nur wenn aktiviert) ✅
- Kategorie-Aggregation über Split-Lines in Dashboard ✅
- Kategorie-Aggregation über Split-Lines in Reports ✅

## Phase 4: Export-Vorlagen + Steuerexport ✅
- Split-Spalten in Vorlagen-Editor (conditional) ✅
- Checkbox "Splitbuchungen aufteilen" in Export-Dialog ✅
- DATEV/BMD: N Buchungszeilen pro Split-Beleg ✅
- CSV/Excel/PDF: Split-Zeilen mit Positionsnummer ✅

## Phase 5: KI-Integration ✅
- Rechnungspositionen-Extraktion im AI-Prompt (line_items mit Kategorie pro Position) ✅
- line_items_raw in DB gespeichert ✅
- "KI-Vorschläge" Button im SplitBookingEditor ✅
