

## Plan: Live-Bankanbindung via GoCardless + Auto-Abgleich für Ein- und Ausgangsbelege

### Übersicht

Bestehende CSV-Import-Infrastruktur bleibt erhalten. Zusätzlich wird eine direkte Bankanbindung über **GoCardless Bank Account Data** (ehemals Nordigen) eingeführt, die automatisch Transaktionen synchronisiert und sowohl Eingangsbelege als auch Ausgangsrechnungen abgleicht.

### Architektur

```text
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ GoCardless   │────▸│ Edge Function    │────▸│ bank_transactions│
│ Open Banking │     │ sync-bank-live   │     │ (bestehend)      │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │ Auto-Reconciler  │
                                              │ (Edge Function)  │
                                              ├─────────┬────────┤
                                              ▼         ▼
                                          receipts   invoices
                                          (bezahlt?) (bezahlt?)
```

### Teil 1: GoCardless-Integration (Edge Functions)

**Neuer Secret**: `GOCARDLESS_SECRET_ID` und `GOCARDLESS_SECRET_KEY` — GoCardless API-Zugangsdaten (kostenloser Account reicht)

**Neue Edge Function: `bank-connect/index.ts`**
- Endpunkte: `create-requisition` (Bank-Auswahl + Autorisierung starten), `callback` (OAuth-Rückfluss), `list-accounts`, `delete-connection`
- Nutzt GoCardless REST API: Institutionen auflisten, Requisition erstellen, Account-Details abrufen

**Neue Edge Function: `sync-bank-live/index.ts`**
- Holt Transaktionen per GoCardless Account API (`/accounts/{id}/transactions`)
- Schreibt neue Transaktionen in bestehende `bank_transactions`-Tabelle (mit `source = 'live'`)
- Deduplizierung per Transaktions-ID von GoCardless
- Kann manuell oder per Cron (z.B. alle 6 Stunden) getriggert werden

### Teil 2: Datenbank-Erweiterungen

**Neue Tabelle: `bank_connections_live`**
- `id`, `user_id`, `provider` (gocardless), `institution_id`, `institution_name`, `requisition_id`, `account_id`, `iban`, `status`, `last_sync_at`, `created_at`
- RLS: `auth.uid() = user_id`

**Erweiterung `bank_transactions`**:
- Neue Spalte `source` (enum: `csv`, `live`) — Default `csv` für Rückwärtskompatibilität
- Neue Spalte `external_id` (text, nullable) — GoCardless Transaction-ID für Deduplizierung
- Neue Spalte `invoice_id` (uuid, nullable, FK → invoices) — für Ausgangsrechnungs-Abgleich

### Teil 3: Auto-Reconciler

**Neue Edge Function: `auto-reconcile/index.ts`**
- Wird nach jedem Sync aufgerufen
- **Eingangsbelege**: Matcht `bank_transactions` (Ausgaben) gegen `receipts` per Betrag ± 0.01€ und Datum ± 5 Tage
- **Ausgangsrechnungen**: Matcht `bank_transactions` (Eingänge) gegen `invoices` per `total` und optional `payment_reference`/Rechnungsnummer im Verwendungszweck
- Bei Match: Transaction → `status: 'matched'`, Receipt → `receipt_id` gesetzt, Invoice → `paid_at` gesetzt
- Confidence-Score: Exakter Betrag + Rechnungsnr im Text = Auto-Match, sonst Vorschlag

### Teil 4: UI-Komponenten

**Neue Seite/Settings-Bereich: Bankverbindung verwalten**
- Bank suchen (GoCardless Institutionen-Liste mit Logos)
- OAuth-Flow starten → Bank-Login → Konto autorisieren
- Verbundene Konten anzeigen, Sync-Status, Trennen-Button
- Feature-Gate: Business-Plan

**Erweiterung Reconciliation-Seite**:
- Neue Tab/Filter: "Live" vs "CSV"-Transaktionen
- Auto-Match-Vorschläge mit Bestätigungs-Button
- Invoice-Zuordnung zusätzlich zu Receipt-Zuordnung
- Badge "Auto-abgeglichen" vs "Manuell abgeglichen"

**Erweiterung Invoices-Seite**:
- Zahlungsstatus-Badge: "Bezahlt" (grün) wenn `paid_at` gesetzt
- Filter nach Zahlungsstatus
- Info-Tooltip: "Automatisch abgeglichen am ..."

### Teil 5: planConfig.ts

- Neues Feature-Flag: `liveBankConnection: boolean` — nur Business
- `FEATURE_MIN_PLAN.liveBankConnection = 'business'`

### Umsetzungsreihenfolge (empfohlen)

1. **DB-Migration** — Neue Tabelle + Spalten
2. **GoCardless Edge Functions** — Verbindung + Sync
3. **Auto-Reconciler** — Matching-Logik
4. **UI: Bankverbindung verwalten** — Settings-Integration
5. **UI: Reconciliation erweitern** — Invoice-Matching anzeigen
6. **UI: Invoices Zahlungsstatus** — Bezahlt-Badge

### Kosten & Voraussetzungen

- **GoCardless Bank Account Data**: Kostenlos bis 50 Endnutzer-Verbindungen, danach €49/Monat
- **Registrierung**: GoCardless-Account + API-Keys (Secret ID + Secret Key)
- **Sandbox**: GoCardless bietet Sandbox-Modus zum Testen

### Betroffene Dateien

- Neue Edge Functions: `bank-connect/index.ts`, `sync-bank-live/index.ts`, `auto-reconcile/index.ts`
- DB-Migration (neue Tabelle + Spalten)
- `src/lib/planConfig.ts` — Feature-Flag
- `src/pages/Reconciliation.tsx` — Invoice-Matching + Live-Filter
- `src/pages/Invoices.tsx` — Zahlungsstatus
- `src/components/settings/` — Neuer Bankverbindungs-Settings-Bereich
- `src/components/dashboard/Sidebar.tsx` — ggf. neuer Nav-Eintrag

