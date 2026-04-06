

# Beta-Seite Neugestaltung: Landing-Content + Anmeldeformular + Zeitlich begrenzter Beta-Zugang

## Ausgangslage
Die aktuelle `/beta`-Seite zeigt nur ein kleines Teaser-Feld und Code-Eingabe. Sie soll zur vollwertigen "Landingpage" werden mit allen Produktinfos, Preisen, einem Beta-Anmeldeformular (mit Account-Erstellung) und der Code-Eingabe.

## Architektur-Übersicht

```text
Beta-Seite (/beta)
├── Header (Logo + Navigation-Anker)
├── Hero (kompakt, aus Landing)
├── ProblemSolution (aus Landing)
├── HowItWorks (aus Landing)
├── Features (kompakt)
├── Pricing (readonly, zeigt spätere Kosten)
├── Beta-Anmeldeformular (Registrierung + Infos)
│   ├── Vorname, Nachname, Email, Passwort
│   ├── Adresse (Straße, PLZ, Ort, Land)
│   ├── Firma / Verein / Privat (Select)
│   ├── Gewünschtes Abo (Starter/Pro/Business)
│   └── Submit → Account wird erstellt, E-Mail an w.winterauer@billmonk.ai
├── Beta-Code Eingabe (für User die schon Code haben)
└── Footer
```

## Datenbank-Änderungen

### 1. Neue Tabelle `beta_applications`
Speichert die Bewerbungsdaten unabhängig vom User-Account:
- `id`, `user_id` (FK profiles), `email`, `first_name`, `last_name`
- `street`, `zip`, `city`, `country`
- `organization_type` (privat / firma / verein)
- `organization_name`
- `intended_plan` (starter / pro / business)
- `status` (pending / approved / rejected)
- `beta_code_id` (FK beta_codes, gesetzt nach Freigabe)
- `created_at`, `updated_at`
- RLS: User kann eigene lesen, Admin kann alles CRUD

### 2. `beta_codes` erweitern
Neue Spalten:
- `expires_at` (timestamptz, nullable) — individuelles Ablaufdatum
- `assigned_email` (text, nullable) — welchem User der Code zugewiesen ist
- `beta_application_id` (uuid, nullable, FK beta_applications)

### 3. `profiles` erweitern
- `beta_expires_at` (timestamptz, nullable) — wann der Business-Vollzugang abläuft

## Code-Änderungen

### 1. `/beta`-Seite komplett neu (`src/pages/Beta.tsx`)
Zwei-Tab-Layout oder Scroll-Page:
- **Oberer Teil**: Landing-Inhalte (Hero, ProblemSolution, HowItWorks, Features-Zusammenfassung, Pricing-Übersicht)
- **Mitte**: Beta-Anmeldeformular — erstellt Supabase-Account (`signUp`), speichert Zusatzdaten in `beta_applications`, sendet Benachrichtigung an Admin
- **Unten**: Code-Eingabe für User die bereits einen Code erhalten haben
- Die bestehenden Landing-Komponenten werden direkt wiederverwendet (importiert)

### 2. Beta-Anmeldeformular-Logik
- `signUp(email, password, firstName, lastName)` via AuthContext
- Insert in `beta_applications` mit allen Feldern
- E-Mail an `w.winterauer@billmonk.ai` via `send-transactional-email` mit Template `beta-application-notification`
- Toast: "Bewerbung eingegangen! Du erhältst deinen Beta-Code per E-Mail."
- User wird NICHT weitergeleitet (kein Beta-Access ohne Code)

### 3. Beta-Code Einlösung erweitern
- Prüfung auf `expires_at` — abgelaufene Codes werden abgelehnt
- Nach Code-Eingabe: `profiles.beta_expires_at` setzen (basierend auf `expires_at` des Codes)
- `profiles.is_beta_user = true`, `plan = 'business'`

### 4. `check-subscription` Edge Function anpassen
- Prüft `beta_expires_at`: Wenn abgelaufen → `is_beta_user = false`, `plan = 'free'`
- Bestehende Beta-User (ohne `beta_expires_at`) behalten unbegrenzten Zugang

### 5. Admin-Bereich erweitern (`BetaCodeManagement.tsx`)
- Neue Tabelle "Beta-Bewerbungen" anzeigen (Name, E-Mail, Firma, gewünschter Plan, Status)
- Button "Freigeben" pro Bewerbung:
  - Erstellt automatisch einen Beta-Code mit individuellem `expires_at`
  - Setzt `assigned_email`
  - Sendet Freigabe-E-Mail via `send-transactional-email` mit Template `beta-approval`
  - Setzt `beta_applications.status = 'approved'`
- Input für Zugangsdauer (z.B. "30 Tage", "90 Tage", custom Datum)

### 6. Neue E-Mail-Templates

**`beta-application-notification`** (an Admin):
- Betreff: "Neue Beta-Bewerbung: {name}"
- Inhalt: Name, E-Mail, Firma/Typ, gewünschter Plan
- `to: 'w.winterauer@billmonk.ai'` (feste Empfänger-Adresse im Template)

**`beta-approval`** (an User):
- Betreff: "Dein BillMonk Beta-Zugang ist freigeschaltet!"
- Inhalt: Begrüßung, Beta-Code, Zugangs-Zeitraum, Link zur Beta-Seite
- BillMonk-Branding (teal, deutsch)

### 7. `BetaGate` anpassen
- Zusätzlich `beta_expires_at` prüfen: wenn abgelaufen, Cookie/localStorage löschen und zu `/beta` umleiten

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/Beta.tsx` | Komplett neu: Landing-Content + Formular + Code-Eingabe |
| `src/components/admin/BetaCodeManagement.tsx` | Bewerbungs-Tabelle + Freigabe-Button + Ablaufdatum |
| `src/components/BetaGate.tsx` | `beta_expires_at` Prüfung ergänzen |
| `supabase/functions/check-subscription/index.ts` | `beta_expires_at` Ablauf-Logik |
| `supabase/functions/_shared/transactional-email-templates/beta-application-notification.tsx` | Neues Template |
| `supabase/functions/_shared/transactional-email-templates/beta-approval.tsx` | Neues Template |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | 2 Templates registrieren |
| Migration | `beta_applications` Tabelle + `beta_codes` erweitern + `profiles.beta_expires_at` |

