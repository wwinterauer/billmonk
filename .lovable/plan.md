

# Admin Dashboard Erweiterungen — Plan

## Überblick

Vier neue Tabs im Admin Dashboard, die schrittweise implementiert werden:

1. **System Health** — Fehler-Monitor für fehlgeschlagene Extraktionen und E-Mail-Syncs
2. **Feature-Nutzung** — Welche Features wie stark genutzt werden (pro User)
3. **Aktivitäts-Feed** — Chronologischer Feed der letzten Plattform-Ereignisse
4. **Announcements** — Banner-Nachrichten an alle Nutzer

## Schritt 1: System Health Tab

**Neue Komponente:** `src/components/admin/SystemHealth.tsx`

- KPI-Karten: Fehlgeschlagene Extraktionen (receipts mit `status = 'error'`), E-Mail-Sync-Fehler (email_accounts mit `last_sync_status = 'error'`)
- Tabelle der letzten fehlgeschlagenen Belege (Datum, User, Dateiname, Fehlerstatus)
- Tabelle der E-Mail-Accounts mit Sync-Fehlern

**Backend:** Neue Edge Function `admin-system-health` die mit Service Role diese Daten aggregiert (da RLS user-scoped ist)

## Schritt 2: Feature-Nutzung Tab

**Neue Komponente:** `src/components/admin/FeatureUsage.tsx`

- Aggregierte Statistiken aus bestehenden Tabellen:
  - Belege insgesamt (receipts count)
  - Bank-Import aktiv (bank_connections_live count)
  - E-Mail-Import aktiv (email_accounts count)
  - Cloud-Backup aktiv (cloud_connections count)
  - Rechnungsmodul (invoices count)
- KPI-Karten + Balkendiagramm

**Backend:** Erweitere `admin-system-health` Edge Function um Feature-Nutzungsdaten

## Schritt 3: Aktivitäts-Feed

**Neue DB-Tabelle:** `admin_activity_log`
- `id`, `event_type` (registration, upload, plan_change, cancellation), `user_id`, `user_email`, `details` (jsonb), `created_at`
- RLS: SELECT nur für Admins via `has_role`
- INSERT via Service Role (Edge Functions + DB Triggers)

**Neue Komponente:** `src/components/admin/ActivityFeed.tsx`
- Chronologische Liste der letzten 50 Events mit Icons pro Typ
- Filter nach Event-Typ

**DB Trigger:** Bei `INSERT` auf `profiles` → loggt "registration" Event

## Schritt 4: Announcement-Banner

**Neue DB-Tabelle:** `announcements`
- `id`, `title`, `message`, `type` (info/warning/maintenance), `is_active`, `expires_at`, `created_at`, `created_by`
- RLS: SELECT für alle authentifizierten User, INSERT/UPDATE/DELETE nur für Admins

**Neue Komponenten:**
- `src/components/admin/AnnouncementManager.tsx` — CRUD im Admin Dashboard
- `src/components/AnnouncementBanner.tsx` — Banner oben in der App (in DashboardLayout)

## Änderungen an bestehenden Dateien

- **`src/pages/Admin.tsx`** — 4 neue Tabs hinzufügen (System Health, Features, Aktivität, Announcements)
- **`src/components/dashboard/DashboardLayout.tsx`** — AnnouncementBanner einbinden

## DB-Migrationen

```text
1. Tabelle admin_activity_log + RLS (admin-only SELECT, service-role INSERT)
2. Tabelle announcements + RLS (auth SELECT, admin INSERT/UPDATE/DELETE)  
3. Trigger auf profiles für Registration-Events
```

## Neue Edge Function

`admin-system-health/index.ts`:
- Prüft Admin-Rolle (wie admin-users)
- Queries: receipts mit status='error', email_accounts mit sync-errors, counts für Features
- Returnt aggregierte Health + Usage Daten

## Implementierungsreihenfolge

1. DB-Migration (beide Tabellen + Trigger)
2. Edge Function `admin-system-health`
3. SystemHealth + FeatureUsage Komponenten
4. ActivityFeed Komponente
5. AnnouncementManager + AnnouncementBanner
6. Admin.tsx + DashboardLayout updaten

