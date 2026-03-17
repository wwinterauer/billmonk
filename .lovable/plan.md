

## Plan: Passwort-Funktionalitäten implementieren

### 1. "Passwort vergessen" auf der Login-Seite

- Den aktuell deaktivierten Link "Passwort vergessen?" aktivieren und auf `/forgot-password` verlinken
- **Neue Seite `src/pages/ForgotPassword.tsx`**: E-Mail-Eingabe, ruft `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })` auf, zeigt Bestätigungsmeldung
- **Neue Seite `src/pages/ResetPassword.tsx`**: Prüft URL-Hash auf `type=recovery`, zeigt Formular für neues Passwort + Bestätigung, ruft `supabase.auth.updateUser({ password })` auf
- Beide als öffentliche Routen in `App.tsx` registrieren

### 2. Altes Passwort verifizieren bei Passwortänderung (Account-Seite)

- Im Sicherheits-Tab ein Feld "Aktuelles Passwort" hinzufügen
- Vor dem Ändern wird `supabase.auth.signInWithPassword({ email, password: currentPassword })` aufgerufen um das alte Passwort zu verifizieren
- Erst bei Erfolg wird `supabase.auth.updateUser({ password: newPassword })` ausgeführt
- Passwortstärke-Anforderungen anzeigen (min. 8 Zeichen, Großbuchstabe, Zahl -- analog zur Registrierung)

### 3. Passwort-Validierungsregeln vereinheitlichen

- Gleiche Regeln wie bei der Registrierung: min. 8 Zeichen, 1 Großbuchstabe, 1 Zahl
- Visuelle Indikatoren (Häkchen/Kreuz) für jede Regel im Sicherheits-Tab und auf der Reset-Seite

### Änderungen

| Datei | Aktion |
|-------|--------|
| `src/pages/ForgotPassword.tsx` | Neu: E-Mail-Formular für Passwort-Reset-Link |
| `src/pages/ResetPassword.tsx` | Neu: Neues Passwort setzen nach Reset-Link |
| `src/pages/Login.tsx` | Link "Passwort vergessen?" aktivieren → `/forgot-password` |
| `src/pages/Account.tsx` | Feld "Aktuelles Passwort" + Stärke-Indikatoren hinzufügen |
| `src/App.tsx` | Routen `/forgot-password` und `/reset-password` hinzufügen |

