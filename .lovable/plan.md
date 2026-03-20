

## Plan: Enable Banking Integration

### Schritt 1: Secrets hinterlegen
Im Implementierungsmodus werde ich die Secret-Eingabe für folgende zwei Werte starten:
- **ENABLE_BANKING_APP_ID** — `ce4e141e-a44f-49b8-a1cd-eedaaf5f89ab`
- **ENABLE_BANKING_PRIVATE_KEY** — Dein RSA Private Key (PEM-Format, vollständig)

Die Secrets werden erst abgefragt, bevor Code-Änderungen beginnen.

### Schritt 2: Edge Function `bank-connect/index.ts` umschreiben
- GoCardless-Token-Logik entfernen
- JWT-Generierung mit RSA Private Key (RS256, kid=APP_ID) implementieren
- API-Endpunkte auf `api.enablebanking.com` umstellen:
  - `list-institutions` → GET `/aspsps?country=`
  - `create-requisition` → POST `/auth` (Start-Autorisierung)
  - `callback` → POST `/sessions` (Code gegen Session tauschen)
  - `delete-connection` → DELETE `/sessions/{id}`

### Schritt 3: Edge Function `sync-bank-live/index.ts` umschreiben
- GoCardless-Token durch Enable Banking JWT ersetzen
- Transaktions-Abruf auf `GET /accounts/{id}/transactions` umstellen
- Feld-Mapping anpassen (PSD2-Format ist weitgehend identisch)

### Schritt 4: Frontend `LiveBankSettings.tsx` anpassen
- Callback-Parameter von `gc_callback` auf `eb_callback` ändern
- Institution-Daten-Mapping für Enable Banking API anpassen
- Texte/Referenzen von GoCardless auf Enable Banking aktualisieren

### Schritt 5: DB-Migration
- `bank_connections_live.provider` Default von `'gocardless'` auf `'enablebanking'` ändern
- `requisition_id` wird für Enable Banking `session_id` wiederverwendet

### Schritt 6: Plan-Datei aktualisieren
- `.lovable/plan.md` auf Enable Banking umstellen

### Keine Änderungen nötig
- `auto-reconcile/index.ts` — arbeitet nur mit normalisierten `bank_transactions`
- `bank_transactions`-Tabelle — Format bleibt gleich
- Reconciliation/BankImport UI — arbeiten mit normalisierten Daten

### Technische Details

**JWT-Signierung (Deno Web Crypto API):**
```text
Header:  { alg: "RS256", kid: APPLICATION_ID }
Payload: { iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat+3600 }
Signiert mit: ENABLE_BANKING_PRIVATE_KEY (RSA PEM)
```

**Enable Banking API Flow:**
```text
1. GET  /aspsps?country=AT           → Bankliste
2. POST /auth { aspsp, redirect_url } → Redirect-URL für User
3. User autorisiert bei Bank → Redirect mit ?code=
4. POST /sessions { code }           → session_id + accounts
5. GET  /accounts/{uid}/transactions  → Transaktionen
```

