## Ziel

Eine eigenständige, geschützte Seite **`/newsletter-status`** (oder Detail-Variante `/newsletter-status/:id`) hinzufügen, die alle Newsletter-Versände auflistet und pro Eintrag Empfänger-Status + Fehlerdetails zeigt. Die Dashboard-Karte und der Dialog-Button verlinken direkt dorthin.

## Umsetzung

### 1. Neue Page `src/pages/NewsletterStatus.tsx`

Im `DashboardLayout` eingebettet, geschützt via `ProtectedRoute`. Inhalt:

- **Header** mit Titel „Newsletter-Status" + Zurück-Link aufs Dashboard.
- **Übersichtsstats** (Stat-Cards, kompakt):
  - Anzahl Newsletter gesamt
  - Versendet (Status `sent`)
  - Fehlgeschlagen (Status `failed`)
  - Gesamte Empfänger / Erfolgsrate (%)
- **Liste aller Newsletter** (über `useNewsletters`-Hook, sortiert nach `sent_at`/`created_at` desc), pro Eintrag:
  - Betreff, Status-Badge, Datum, Counter `sent / total · X fehlgeschlagen`
  - Klick öffnet Inline-Detailbereich (oder navigiert zu `?id=...`) mit:
    - Tabelle aller Empfänger: Name, E-Mail, Status-Icon, Zeitpunkt
    - Bei `failed`: rote Fehlermeldung (volltextfähig, scrollbar)
    - Filter-Tabs: **Alle / Nur Fehler / Nur Erfolgreich**
- **Auto-Scroll/Highlight**: Wenn URL-Param `?id=<uuid>` vorhanden ist, wird genau dieser Eintrag automatisch geöffnet und in den Viewport gescrollt.
- Such-Input für Betreff (Client-side Filter).
- Empty-State, wenn noch nichts versendet wurde.

### 2. Route registrieren

In `src/App.tsx` neue Route ergänzen:
```tsx
<Route path="/newsletter-status" element={<ProtectedRoute><NewsletterStatus /></ProtectedRoute>} />
```

### 3. Dashboard-Karte verlinken

`src/components/dashboard/LastNewsletterCard.tsx` anpassen:
- „Alle"-Button im Header verlinkt jetzt auf `/newsletter-status` (statt `/settings?tab=newsletter`).
- Button **„Fehlerdetails anzeigen"**: ersetze den Inline-Dialog durch einen `Link` nach `/newsletter-status?id=<newsletter.id>`. Dadurch entfällt die Dialog-State-Logik komplett — saubere Navigation auf die dedizierte Seite.
- Klick auf den Betreff/die Karte selbst → ebenfalls Link zur Detail-Seite mit `?id=`.

### 4. Datenzugriff

Wiederverwendung der bestehenden:
- `useNewsletters()` für die Liste (RLS-geschützt).
- `fetchRecipients(newsletterId)` für die Detail-Empfänger.

Keine neuen DB-Tabellen, keine Edge-Function-Änderung.

### 5. Design

- Konsistent mit Dashboard: `Card border-border/50`, `Badge`-Komponente, semantische Tokens (`text-destructive`, `text-muted-foreground`, `text-green-600`/`text-red-600` analog zu bestehenden Status-Badges im Projekt).
- Mobile-First: Stat-Cards `grid-cols-2 lg:grid-cols-4`, Empfänger-Tabelle wird auf Mobile zu Cards.

## Was sich NICHT ändert

- `NewsletterHistory` in den Settings bleibt unverändert (für den Composer-Workflow weiterhin sinnvoll).
- DB, Edge Functions, Versand-Flow.

## Risiko

Niedrig — additive Frontend-Route mit bestehenden Hooks.
