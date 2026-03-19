

## Plan: Umstellung von GoCardless auf FinAPI

### Warum FinAPI?

- Spezialisiert auf DACH-Region (AT, DE, CH) — beste Abdeckung österreichischer Banken
- Kostenloser Sandbox-Modus ohne Firmengründung
- Web Form 2.0: FinAPI stellt ein fertiges, einbettbares Bank-Login-Formular bereit (kein eigener OAuth-Flow nötig)
- PSD2/XS2A-konform

### Wie FinAPI funktioniert

```text
┌──────────┐     ┌────────────────┐     ┌──────────────────┐
│ Frontend  │────▸│ Edge Function   │────▸│ FinAPI REST API   │
│ Settings  │     │ bank-connect    │     │ (Sandbox/Prod)    │
└──────────┘     └────────────────┘     └──────────────────┘
                         │
                    Web Form URL ──▸ User öffnet FinAPI Bank-Login
                         │
                    Callback ──▸ Bank Connection importiert
                         │
                    Transactions abrufen ──▸ bank_transactions
```

**Ablauf:**
1. Edge Function erstellt einen FinAPI "Access User" (1:1 pro App-User)
2. Web Form 2.0 wird generiert → User loggt sich bei seiner Bank ein
3. Nach erfolgreichem Login: Accounts + Transactions werden abgerufen
4. Transaktionen fließen wie bisher in `bank_transactions` (source = 'live')
5. Auto-Reconciler läuft danach wie gehabt

### Änderungen

**Secrets (2 neue):**
- `FINAPI_CLIENT_ID` — FinAPI Client ID (aus FinAPI Dashboard)
- `FINAPI_CLIENT_SECRET` — FinAPI Client Secret

**Edge Functions anpassen:**

1. **`bank-connect/index.ts`** — komplett umschreiben:
   - FinAPI OAuth2 Client-Token holen (`/oauth/token`)
   - FinAPI User anlegen/abrufen (`/users`)
   - User-Token generieren
   - Web Form für Bank-Import erstellen (`/api/webForms/bankConnectionImport`)
   - Callback: Accounts + Details abrufen
   - Verbindungen auflisten/löschen

2. **`sync-bank-live/index.ts`** — anpassen:
   - FinAPI `/transactions` Endpoint statt GoCardless
   - Mapping der FinAPI-Transaktionsfelder auf `bank_transactions`

3. **`auto-reconcile/index.ts`** — bleibt unverändert

**UI (`LiveBankSettings.tsx`):**
- Statt Institutionen-Suche → FinAPI Web Form URL öffnen (iframe oder neues Fenster)
- Callback-Handling nach Bank-Login
- Rest (Sync, Löschen, Status) bleibt gleich

**DB:** Keine Schemaänderungen nötig — `bank_connections_live` wird weiterverwendet, `provider` wird auf `'finapi'` gesetzt.

### FinAPI Sandbox

- Registrierung unter `sandbox.finapi.io` — kein Unternehmen nötig
- Test-Banken mit Fake-Credentials verfügbar
- Client ID + Secret sofort nach Registrierung sichtbar

### Umsetzungsreihenfolge

1. FinAPI Sandbox-Account erstellen + Secrets hinterlegen
2. `bank-connect` Edge Function auf FinAPI umschreiben
3. `sync-bank-live` auf FinAPI Transactions anpassen
4. `LiveBankSettings.tsx` UI für Web Form Flow anpassen
5. Testen mit Sandbox-Bank

