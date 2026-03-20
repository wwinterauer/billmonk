

## Problem

Dein `profiles.plan` steht auf `"free"` in der Datenbank. Der Admin-Override (`admin_view_plan`) wirkt nur im Frontend (usePlan Hook), aber serverseitig (Edge Functions wie `bank-connect`) wird direkt `profiles.plan` gelesen. Die `check-subscription` Function setzt den Plan nicht zurueck wenn kein Stripe-Abo existiert, also ist eine manuelle Zuweisung persistent.

## Loesung (2 Schritte)

### 1. Dein Profil auf Business setzen

Direkt in der Datenbank dein `profiles.plan` auf `'business'` setzen. Da `check-subscription` manuell gesetzte Plaene nicht ueberschreibt (Zeile 77: "Don't reset plan"), bleibt das persistent.

### 2. Edge Function `bank-connect` absichern

Zusaetzlich die Plan-Pruefung in `bank-connect/index.ts` (Zeilen 126-133) erweitern, damit Admin-User mit `admin_view_plan` auch serverseitig den richtigen effectivePlan bekommen:

- `admin_view_plan` mit aus dem Profil selektieren
- `user_roles` auf Admin-Rolle pruefen
- `effectivePlan` berechnen (wie im Frontend-Hook)

So funktioniert auch der Plan-Switcher serverseitig korrekt fuer Tests.

### Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| DB: `profiles` | `plan = 'business'` fuer deinen User |
| `supabase/functions/bank-connect/index.ts` | Admin-aware Plan-Check |

