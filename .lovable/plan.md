

## Plan: Live-Bankanbindung via Enable Banking + Auto-Abgleich

### Status: ✅ Implementiert

### Umgesetzt
1. **DB-Migration**: `bank_connections_live` Tabelle + `source`, `external_id`, `invoice_id` auf `bank_transactions`
2. **Edge Functions**: `bank-connect` (Enable Banking Auth + JWT RS256), `sync-bank-live` (Transaktions-Sync), `auto-reconcile` (Matching)
3. **planConfig.ts**: `liveBankConnection` Feature-Flag (nur Business)
4. **Settings UI**: Neuer "Bankanbindung" Tab mit Bank-Suche (ASPSP), Verbindungsverwaltung, Sync
5. **Invoices**: Bezahlt-Badge mit Tooltip bei `paid_at`
6. **Auto-Reconciler**: Matcht Ausgaben↔Belege und Eingänge↔Rechnungen automatisch

### Provider
- **Enable Banking** (api.enablebanking.com) mit JWT RS256-Authentifizierung
- Secrets: `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY` (PEM)
