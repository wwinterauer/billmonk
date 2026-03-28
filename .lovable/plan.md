

# Plan: Community Intelligence - Plattform-weites Lern-System

## Konzept

Anonymisierte Aggregation von User-Korrekturen zu plattformweiten Mustern. Jeder User trägt bei, Admin verwaltet und sieht den Fortschritt. Free-User können nicht opt-outen (ihr "Beitrag" ist Teil des Free-Plans). Zahlende User können in den Einstellungen opt-outen.

## Datenbank-Änderungen

### Neue Tabelle: `community_patterns`
Speichert aggregierte, anonymisierte Muster:

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | uuid | PK |
| pattern_type | text | `vendor_category`, `keyword_category`, `vendor_vat_rate` |
| vendor_name_normalized | text | Normalisierter Lieferantenname (lowercase, trimmed) |
| keyword | text | Optional - für keyword-basierte Muster |
| suggested_category | text | Vorgeschlagene Kategorie |
| suggested_vat_rate | numeric | Optional - für MwSt-Muster |
| country | text | Länderspezifisch (AT/DE/CH) |
| contributor_count | integer | Anzahl verschiedener User die dieses Muster bestätigt haben |
| total_confirmations | integer | Gesamtzahl Bestätigungen |
| is_verified | boolean | Admin-verifiziert oder Schwelle erreicht |
| verification_threshold | integer | Default 3 |
| admin_reviewed | boolean | Vom Admin geprüft |
| admin_notes | text | Admin-Notizen |
| created_at, updated_at | timestamptz | |

RLS: Admin kann alles, Service-Role kann inserieren/updaten. Normale User: SELECT nur `is_verified = true`.

### Neue Tabelle: `community_contributions`
Trackt welche User beigetragen haben (für contributor_count Berechnung), ohne den konkreten Inhalt zu speichern:

| Spalte | Typ |
|---|---|
| id | uuid |
| user_id | uuid |
| pattern_id | uuid → community_patterns |
| contributed_at | timestamptz |

RLS: Service-Role only (kein direkter User-Zugriff).

### Neue Tabelle: `platform_learning_settings`
Admin-Einstellungen (1 Row):

| Spalte | Typ | Default |
|---|---|---|
| id | integer | 1 |
| is_active | boolean | true |
| verification_threshold | integer | 3 |
| auto_verify | boolean | true |
| updated_at | timestamptz | |

### Profiles-Erweiterung
- `community_opt_out` (boolean, default false) - nur für zahlende User nutzbar

## Admin-Dashboard: Neuer Tab "KI-Plattform"

Neuer Admin-Tab mit Brain-Icon, aufgeteilt in 3 Bereiche:

### 1. Übersicht & Einstellungen (oben)
- **Toggle**: Community Learning aktiv/inaktiv
- **Schwellwert-Slider**: Ab wie vielen Usern ein Muster als verifiziert gilt (1-10)
- **Auto-Verify Toggle**: Automatische Verifikation wenn Schwelle erreicht
- **KPI-Cards**: Gesamt-Muster | Verifiziert | Wartend auf Review | Beitragende User | Opt-Out-Rate

### 2. Fortschritts-Visualisierung (mitte)
- **Progress-Ring/Donut**: Verifizierte vs. unverifizierte Muster
- **Top-Kategorien-Balkendiagramm**: Welche Kategorien die meisten Community-Muster haben
- **Länder-Verteilung**: AT/DE/CH Aufteilung der Muster
- **Timeline**: Wachstum der Muster über Zeit (letzte 30 Tage)

### 3. Muster-Tabelle (unten)
- Durchsuchbare/filterbare Tabelle aller Community-Muster
- Spalten: Lieferant/Keyword | Kategorie | Land | Bestätigungen | Status (Badge: verifiziert/wartend/abgelehnt)
- Admin-Aktionen pro Zeile: Verifizieren, Ablehnen, Bearbeiten, Notiz hinzufügen
- Bulk-Aktionen: Alle wartenden verifizieren

## User-seitige Anzeige

### Settings-Seite (Account)
- Info-Banner: "Deine anonymisierten Korrekturen helfen, die Erkennung für alle Nutzer zu verbessern."
- **Zahlende User**: Toggle "Plattform-Lernen deaktivieren" mit Hinweis
- **Free User**: Gleicher Text, aber Toggle ist disabled mit Tooltip "Im kostenlosen Plan tragen deine Korrekturen zur Verbesserung der Plattform bei."

### Beim Speichern von Korrekturen
Im bestehenden `useCorrectionTracking` Hook: Nach dem Speichern einer Korrektur wird asynchron (fire-and-forget) eine Edge Function aufgerufen, die das Muster in `community_patterns` aggregiert - sofern der User nicht opted-out hat.

## Edge Function: `aggregate-community-pattern`

Wird nach jeder Korrektur aufgerufen:
1. Prüft ob User opt-out hat
2. Normalisiert Vendor-Name
3. Upsert in `community_patterns` (contributor_count hochzählen wenn neuer User)
4. Insert in `community_contributions`
5. Prüft ob Schwelle erreicht → auto-verify

## Integration in Extraktion

In `extract-receipt/index.ts` wird vor dem AI-Call geprüft:
1. Lade verifizierte `community_patterns` für das Land des Users
2. Füge als zusätzlichen Prompt-Block ein: "Plattform-Erfahrung: Diese Lieferanten werden typischerweise so zugeordnet: ..."
3. Priorität: User-eigene Regeln > Community-Muster > KI-Hinweise

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| **Neue Dateien** | |
| `src/components/admin/CommunityLearning.tsx` | Admin-Tab Komponente |
| `supabase/functions/aggregate-community-pattern/index.ts` | Aggregations-Logik |
| **Bestehende Dateien** | |
| `src/pages/Admin.tsx` | Neuen Tab hinzufügen |
| `src/hooks/useCorrectionTracking.ts` | Edge Function Call nach Korrektur |
| `src/pages/Account.tsx` oder `src/pages/Settings.tsx` | Opt-out Toggle + Info-Banner |
| `supabase/functions/extract-receipt/index.ts` | Community-Muster in Prompt laden |
| DB-Migration | 3 neue Tabellen + profiles Spalte |

## Phasen-Vorschlag

1. **DB + Edge Function** - Tabellen, Aggregations-Function, profiles.community_opt_out
2. **Admin-Dashboard** - CommunityLearning Komponente mit KPIs, Tabelle, Einstellungen
3. **User-Integration** - Opt-out Toggle, Info-Banner, Correction-Hook Anbindung
4. **Extraktion** - Community-Muster in extract-receipt Prompt einbauen

