

# CRM-Erweiterung: Kontakte-Modul mit konfigurierbaren Typen + Mitglieder + Newsletter

## Konzept

Statt einer starren "Mitglieder"-Tabelle wird ein **flexibles Kontakttyp-System** gebaut. Der User definiert selbst seine Kontakttypen (z.B. "Kunde", "Premium-Kunde", "Vereinsmitglied", "Members-Club", "Lieferant"). Jeder Kontakttyp kann eigene Zusatzfelder haben.

Die bestehende `customers`-Tabelle bleibt erhalten. Daneben entsteht eine neue `members`-Tabelle mit einem **frei konfigurierbaren `member_type`**-Feld, das der User selbst benennen kann.

```text
┌─────────────────────────────────┐
│         Kontakte (CRM)          │
├─────────┬───────────┬───────────┤
│ Kunden  │ Mitglieder│ Newsletter│
│(besteh.)│  (neu)    │  (neu)    │
└─────────┴───────────┴───────────┘
           │
           ▼
  member_type = frei wählbar:
  "Vereinsmitglied", "Premium-Kunde",
  "Members-Club", "Sponsor", etc.
```

---

## Datenbank

### Neue Tabelle `members`
```sql
create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  display_name text not null,
  first_name text,
  last_name text,
  email text,
  phone text,
  street text, zip text, city text, country text default 'AT',
  member_number text,
  member_type text default 'Mitglied',  -- frei wählbar
  membership_fee numeric default 0,
  joined_at date,
  is_active boolean default true,
  newsletter_opt_out boolean default false,
  notes text,
  custom_fields jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: user_id = auth.uid() für alle Operationen
```

### Neue Tabelle `crm_field_config`
```sql
create table public.crm_field_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type text not null default 'customer', -- 'customer' | 'member'
  visible_fields jsonb default '[]',
  list_columns jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entity_type)
);
```

### Neue Tabelle `member_types` (User-definierte Typen)
```sql
create table public.member_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,          -- "Premium-Kunde", "Vereinsmitglied", etc.
  color text default '#8B5CF6',
  icon text default 'users',
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique(user_id, name)
);
-- Default-Einträge werden beim ersten Laden im Frontend erstellt
```

### Neue Tabellen `newsletters` + `newsletter_recipients`
Wie im vorherigen Plan beschrieben.

### Spalte auf `customers` hinzufügen
```sql
alter table customers add column newsletter_opt_out boolean default false;
```

---

## Frontend-Komponenten

### 1. `src/components/settings/MemberManagement.tsx`
- Analog zu `CustomerManagement.tsx`
- Dropdown für `member_type` mit den user-definierten Typen
- Filterbar nach Typ, Status (aktiv/inaktiv)
- Mitgliedsspezifische Felder: Mitgliedsnummer, Beitritt, Beitrag, Typ

### 2. `src/components/settings/MemberTypeConfig.tsx`
- Kleine Verwaltung der Kontakttypen (Name, Farbe, Icon)
- Inline im MemberManagement-Header oder als eigener Sub-Bereich
- Vorgeschlagene Defaults: "Mitglied", "Premium-Kunde", "Members-Club"

### 3. `src/components/settings/CrmFieldConfig.tsx`
- Checkboxen pro Entity-Typ: welche Felder in Liste/Formular sichtbar
- Getrennt für Kunden und Mitglieder konfigurierbar

### 4. `src/components/settings/NewsletterComposer.tsx`
- Betreff + Textarea (HTML-fähig)
- Empfänger: Alle Kunden / Alle Mitglieder / Nach Typ filtern / Manuell
- Versand-Button → Edge Function

### 5. `src/components/settings/NewsletterHistory.tsx`
- Tabelle mit vergangenen Newslettern, Status, Empfängerzahl

### 6. Hooks
- `useMembers.ts` — CRUD für members
- `useMemberTypes.ts` — CRUD für member_types
- `useCrmFieldConfig.ts` — Feldkonfiguration laden/speichern
- `useNewsletters.ts` — Newsletter CRUD + Versand triggern

### 7. `src/pages/Settings.tsx`
- Neue Tabs in der Invoice-Gruppe: "Mitglieder", "Newsletter"
- Bestehender "Kunden"-Tab bleibt, bekommt Feldkonfigurations-Toggle

### 8. `supabase/functions/send-newsletter/index.ts`
- Empfänger laden, `newsletter_opt_out` prüfen
- Resend API direkt ansprechen (Rate-Limiting 10/s)
- Status pro Empfänger tracken

---

## Dateien

| Datei | Änderung |
|-------|----------|
| Migration | `members`, `member_types`, `crm_field_config`, `newsletters`, `newsletter_recipients` + RLS; `customers.newsletter_opt_out` |
| `src/hooks/useMembers.ts` | Neuer Hook |
| `src/hooks/useMemberTypes.ts` | Neuer Hook |
| `src/hooks/useCrmFieldConfig.ts` | Neuer Hook |
| `src/hooks/useNewsletters.ts` | Neuer Hook |
| `src/components/settings/MemberManagement.tsx` | Neue Komponente |
| `src/components/settings/MemberTypeConfig.tsx` | Neue Komponente |
| `src/components/settings/CrmFieldConfig.tsx` | Neue Komponente |
| `src/components/settings/NewsletterComposer.tsx` | Neue Komponente |
| `src/components/settings/NewsletterHistory.tsx` | Neue Komponente |
| `src/components/settings/CustomerManagement.tsx` | Feldkonfig + newsletter_opt_out |
| `src/pages/Settings.tsx` | Neue Tabs: Mitglieder, Newsletter |
| `supabase/functions/send-newsletter/index.ts` | Edge Function für Versand |

