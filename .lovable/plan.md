## Problem

Du wirst nach Login auf `/beta` umgeleitet, weil `BetaGate` nur `localStorage`/Cookie + `profiles.is_beta_user` prüft. Beide fehlen bei dir (Admin, Plan `business`, `is_beta_user=false`). Außerdem: wer einmal einen Beta-Code eingegeben hat, sollte serverseitig für 180 Tage freigeschaltet bleiben – aktuell wird `beta_expires_at` nur gesetzt, wenn der Code selbst ein Ablaufdatum hat, und ein neues Gerät ohne lokales Flag wäre dann trotzdem gesperrt.

## Fix 1 — `src/pages/Beta.tsx` (Beta-Code-Einlösung)

Beim erfolgreichen Einlösen für eingeloggte User immer ein User-spezifisches 180-Tage-Ablauf in `profiles.beta_expires_at` schreiben (nicht das Code-Ablauf-Datum übernehmen):

```ts
updateData.beta_expires_at = new Date(Date.now() + 180*24*60*60*1000).toISOString();
```

Damit ist der User serverseitig 180 Tage als Beta-User markiert; `BetaGate` setzt das lokale Flag auf neuen Geräten automatisch nach Login (`is_beta_user`-Zweig existiert bereits).

## Fix 2 — `src/components/BetaGate.tsx` (Bestandskunden & Admins nicht aussperren)

`checkExpiry`-Effect erweitern:

1. Zusätzlich `plan` aus `profiles` laden.
2. Parallel `user_roles` auf `role='admin'` für den User abfragen.
3. Grant-Bedingung erweitern auf:
   `isAdmin || plan ∈ {starter, pro, business} || (is_beta_user && !expired)`
4. Wenn Grant → wie bisher `localStorage` + Cookie (180 Tage) setzen und `setHasAccess(true)`.
5. Revoke-Zweig bleibt: nur wenn `expired && !isAdmin && plan==='free'`.

## Sofortmaßnahme für dich

Bis der Fix live ist – in der DevTools-Konsole auf `https://billmonk.lovable.app`:

```js
localStorage.setItem('beta_access','true'); location.href='/dashboard';
```

## Nicht angefasst

- Auth-Flow / Login
- Beta-Code-Validierung (Aktiv-Status, Max-Uses, Ablauf)
- DB-Schema