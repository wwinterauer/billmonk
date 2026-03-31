

# Email-Einstellungen laden nicht — RLS-Policy fehlt

## Ursache

Die Tabelle `email_accounts` hat keine RLS-Policy für `SELECT` mit der `authenticated`-Rolle. Jeder Request gibt 403 zurück:

```
"permission denied for table email_accounts"
```

Da `isLoading` in `useEmailImport` ein OR aus allen 4 Queries ist (Zeile 638), blockiert die endlos retry'ende `email_accounts`-Query das gesamte UI.

## Lösung (2 Teile)

### 1. RLS-Policy für `email_accounts` erstellen (Migration)

```sql
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email accounts"
  ON public.email_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own email accounts"
  ON public.email_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own email accounts"
  ON public.email_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own email accounts"
  ON public.email_accounts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

### 2. `useEmailImport.ts` — Loading-State robuster machen

Zeile 638: `isLoading` nur auf die zwei primären Queries beschränken, damit ein 403 auf `email_accounts` nicht alles blockiert. Zusätzlich `isError` exposen.

```typescript
isLoading: isLoadingConnection,
isError: isErrorAccounts || isErrorConnection,
```

### 3. `EmailImportSettings.tsx` — Fehlerbehandlung

Zeile 337-345: Bei `isError` statt endlosem Spinner eine Fehlermeldung mit "Erneut laden"-Button anzeigen.

### Dateien
- Migration: RLS-Policies für `email_accounts`
- `src/hooks/useEmailImport.ts`
- `src/components/settings/EmailImportSettings.tsx`

