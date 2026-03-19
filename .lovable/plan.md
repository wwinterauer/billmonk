

## Plan: Live-Bankanbindung via GoCardless + Auto-Abgleich

### Status: ✅ Implementiert

### Umgesetzt
1. **DB-Migration**: `bank_connections_live` Tabelle + `source`, `external_id`, `invoice_id` auf `bank_transactions`
2. **Edge Functions**: `bank-connect` (GoCardless OAuth), `sync-bank-live` (Transaktions-Sync), `auto-reconcile` (Matching)
3. **planConfig.ts**: `liveBankConnection` Feature-Flag (nur Business)
4. **Settings UI**: Neuer "Bankanbindung" Tab mit Bank-Suche, Verbindungsverwaltung, Sync
5. **Invoices**: Bezahlt-Badge mit Tooltip bei `paid_at`
6. **Auto-Reconciler**: Matcht Ausgaben↔Belege und Eingänge↔Rechnungen automatisch

### Offene Voraussetzung
- GoCardless API-Zugangsdaten (`GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`) müssen als Secrets hinterlegt werden
