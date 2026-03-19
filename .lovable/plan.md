

## Plan: Ausgangsbeleg-Begrenzung einführen

### Konzept
Spiegelbildlich zum bestehenden Eingangsbeleg-Limit (receiptsPerMonth) ein Dokumenten-Limit für Ausgangsbelege (Rechnungen, Angebote, AB, Lieferscheine) einführen. Da nur der Business-Plan das Rechnungsmodul hat, ist das Limit primär dort relevant (Business: 250/Monat).

### 1. Datenbank-Migration
- Neue Spalten in `profiles`: `monthly_document_count` (int, default 0) und `document_credit` (int, default 0)
- Neuer Trigger `increment_document_count`: Bei INSERT auf `invoices` den Zähler hochzählen
- `reset_monthly_credits`-Funktion erweitern: Auch `document_credit` rollover berechnen und `monthly_document_count` zurücksetzen

### 2. planConfig.ts
- `PlanLimits` um `documentsPerMonth: number` erweitern
- Limits: free: 0, starter: 0, pro: 0, business: 250

### 3. usePlan.ts
- `monthly_document_count` und `document_credit` aus `profiles` laden
- Neue Felder im Return: `documentsUsed`, `documentsCredit`, `documentsLimit`, `documentsAvailable`

### 4. Sidebar.tsx
- Zweite Quota-Leiste "Dokumente" unter der bestehenden "Belege"-Leiste anzeigen (nur wenn `documentsLimit > 0`)

### 5. useInvoices.ts
- In `createInvoice` vor dem Erstellen prüfen, ob `documentsAvailable > 0`, sonst Toast mit Upgrade-Hinweis und return null

### 6. SubscriptionSettings.tsx
- Dokument-Kontingent analog zu Beleg-Kontingent anzeigen (nur im Business-Plan)

### Betroffene Dateien
- Migration (neue Spalten + Trigger + Funktion)
- `src/lib/planConfig.ts`
- `src/hooks/usePlan.ts`
- `src/hooks/useInvoices.ts`
- `src/components/dashboard/Sidebar.tsx`
- `src/components/settings/SubscriptionSettings.tsx`

