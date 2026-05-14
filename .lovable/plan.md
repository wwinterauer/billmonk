## Problem

Wer schon einen Beta-Code hat (z. B. `is_beta_user = true` im Profil), aber auf einem neuen Gerät/Browser ist, hat **kein** `localStorage.beta_access`. Klickt er im Header auf **Login**, leitet `BetaGate` ihn auf `/beta` um, statt das Login-Fenster zu zeigen — er kommt nicht rein, ohne erneut einen Code einzugeben.

Ursache: In `src/components/BetaGate.tsx` enthält `EXEMPT_ROUTES` nur `/beta`, `/datenschutz`, `/unsubscribe`, `/share-receive`. `/login`, `/register`, `/reset-password` sind durch das Gate blockiert.

## Lösung

### 1. `src/components/BetaGate.tsx`
- `EXEMPT_ROUTES` erweitern um `/login`, `/register`, `/reset-password`, `/forgot-password` — Auth-Seiten müssen immer erreichbar sein.
- Nach erfolgreicher Auth-Erkennung im `useEffect`: wenn `profile.is_beta_user === true` und (kein `beta_expires_at` oder noch gültig), **automatisch** `localStorage.beta_access = 'true'` und Cookie setzen. So wird ein bestehender Beta-User auf neuem Gerät beim ersten Login automatisch freigeschaltet, ohne dass er den Code erneut eingeben muss.
- Wenn `is_beta_user === false` und kein lokaler Beta-Zugang: weiterhin auf `/beta` umleiten (für geschützte Routen).

### 2. Keine DB-Änderungen nötig.

## Effekt

- Header-Login funktioniert immer (auch ohne lokalen Beta-Cookie).
- Bereits freigeschaltete Beta-User werden nach Login automatisch wieder freigeschaltet.
- Neue Besucher ohne Beta-Code werden weiter auf `/beta` geleitet, wenn sie geschützte App-Routen aufrufen.
