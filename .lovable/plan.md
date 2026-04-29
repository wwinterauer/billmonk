## Ziel

Auf dem Dashboard eine kompakte Karte einblenden, die den **letzten Newsletter-Versand** zeigt: Status-Badge, Versanddatum, gesendet/fehlgeschlagen-Counter und (bei Fehlern) die zugehörigen Fehlerdetails.

## Datengrundlage

Die `newsletters`-Tabelle enthält bereits alles Nötige:
- `status` (`draft` | `sending` | `sent` | `failed`)
- `sent_at`, `subject`, `total_recipients`, `sent_count`, `failed_count`

Detail-Fehlermeldungen pro Empfänger liegen in `newsletter_recipients` (`status='failed'`, `error_message`). Diese werden bei Bedarf nachgeladen.

## Umsetzung

### 1. Neue Komponente `LastNewsletterCard`
Pfad: `src/components/dashboard/LastNewsletterCard.tsx`

- Lädt via Supabase den letzten Newsletter des aktuellen Users:
  ```
  newsletters
    .select(...)
    .eq('user_id', user.id)
    .neq('status', 'draft')
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
  ```
- Wenn kein Versand vorhanden ist → Karte zeigt freundlichen Empty-State („Noch kein Newsletter versendet") + Link auf Settings → Newsletter.
- Sonst Anzeige von:
  - **Betreff** (truncate)
  - **Status-Badge**: 
    - `sent` → grün („Erfolgreich")
    - `failed` → rot („Fehlgeschlagen")
    - `sending` → gelb („Versand läuft")
  - **Datum**: `sent_at` formatiert (`dd.MM.yyyy HH:mm`, Fallback `created_at`)
  - **Counter**: `sent_count / total_recipients` und bei `failed_count > 0` ein roter Hinweis „X fehlgeschlagen"
- Wenn `failed_count > 0`: Button **„Fehlerdetails anzeigen"** → öffnet einen Dialog/Sheet, der per `fetchRecipients(newsletter.id)` (bereits in `useNewsletters`-Hook vorhanden) die fehlgeschlagenen Empfänger lädt und tabellarisch zeigt: E-Mail, Zeitpunkt, gekürzte Fehlermeldung.
- „Alle Newsletter ansehen" → Link nach `/settings` (Newsletter-Tab).

### 2. Einbindung ins Dashboard
Datei: `src/pages/Dashboard.tsx`

- Komponente importieren und in der unteren Grid-Sektion (`grid lg:grid-cols-3 gap-6`, ab Zeile 334) als zusätzliche Karte einfügen — neben „Letzte Belege". Auf kleineren Viewports volle Breite, auf `lg` ein Drittel.

### 3. Design

- Verwendung der bestehenden `Card`-Variante (`border-border/50`) und `Badge`-Komponente — konsistent mit dem restlichen Dashboard.
- Nur semantische Tokens (`text-success`, `text-destructive`, `text-warning`/`text-muted-foreground`) — keine Hardcoded-Farben.
- Mobile-First: Datum darunter umbrechen, Buttons vollflächig.

## Was sich NICHT ändert

- Keine DB-Schema-Änderung nötig — alle Felder existieren bereits.
- Keine Edge-Function-Änderung.
- Newsletter-Versand-Logik bleibt unberührt.

## Risiko

Sehr niedrig — rein additive Frontend-Änderung mit RLS-geschützter Read-Query auf eigene Daten.
