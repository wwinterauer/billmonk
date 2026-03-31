

# Plan: Buchungsarten-Sektion auf bestehende System-Kategorien zurückführen

## Problem

Die Buchungsarten-Sektion in den Einstellungen zeigt aktuell eine einfache Liste aus `TAX_TYPES` (10 generische Einträge) via `useBookingTypes`. Vorher wurden länderspezifische Steuerkategorien aus der `categories`-Tabelle angezeigt (`is_system=true`, mit `country`, `tax_code`, Info-Tooltips aus `taxCategoryInfo.ts`). Diese Funktionalität soll wiederhergestellt werden.

## Änderungen

### 1. CategoryManagement.tsx — Buchungsarten-Sektion

**Ersetze** die aktuelle `useBookingTypes`-basierte Buchungsarten-Tabelle durch die alte Logik:

- Lade System-Kategorien aus `categories` WHERE `is_system = true`
- Filtere nach User-Land (aus `useCompanySettings`) — zeige nur Kategorien mit `country = userCountry`
- Zeige pro Eintrag: Icon, Name, `tax_code` Badge, Info-Tooltip (aus `TAX_CATEGORY_INFO`), Eye/EyeOff Toggle
- Standard-Kategorien (ohne `country`, z.B. "Büromaterial") bleiben in der oberen "Meine Kategorien"-Sektion als System-Einträge sichtbar
- Länderspezifische Steuerkategorien (`country IS NOT NULL`) erscheinen in der unteren Buchungsarten-Sektion
- Behalte die "Buchungsart hinzufügen"-Funktion für benutzerdefinierte Einträge (via `useBookingTypes` für custom types)
- Business-Plan: Buchungsschlüssel-Feld bleibt erhalten

### 2. Datenfluss

- `fetchCategories()` erweitern: Lade **alle** Kategorien (nicht nur `is_system = false`)
- Trenne in zwei Listen:
  - `personalCategories`: `is_system === false` (oben)
  - `taxCategories`: `is_system === true AND country IS NOT NULL` (unten, gefiltert nach User-Land)
  - `systemCategories`: `is_system === true AND country IS NULL` (allgemeine System-Kategorien, oben mit anzeigen)
- User-Land aus `useCompanySettings()` → `settings?.country || 'AT'`

### 3. Buchungsarten-Tabelle (untere Sektion)

Spalten:
- Icon + Name
- Steuercode (`tax_code`) als Badge
- Info-Button mit Tooltip/Popover aus `TAX_CATEGORY_INFO`
- Sichtbarkeit-Toggle (Eye/EyeOff)
- Für Business-Plan: Buchungsschlüssel-Feld (aus `useBookingTypes.updateBookingKey`)

**Keine Lösch-Option** für System-Steuerkategorien — nur ausblenden.

### 4. useBookingTypes Anpassung

Der Hook bleibt bestehen für:
- Custom Booking Types (benutzerdefinierte Buchungsarten)
- Buchungsschlüssel-Verwaltung
- Hidden-State Tracking

Aber die **Anzeige** in der Einstellungs-Sektion nutzt primär die `categories`-Tabelle für System-Steuerkategorien, nicht die `TAX_TYPES`-Konstante.

### 5. Review/Expenses Dropdowns

Die Dropdowns für "Buchungsart" in Review.tsx, Expenses.tsx, ReceiptDetailPanel.tsx bleiben bei `visibleBookingTypes` aus `useBookingTypes` — das ist die korrekte Quelle für die Auswahl beim Beleg. Die Einstellungs-Seite zeigt nur die detailliertere Verwaltungsansicht.

## Betroffene Dateien

- `src/components/settings/CategoryManagement.tsx` — Hauptänderung: Buchungsarten-Sektion auf DB-Kategorien umstellen
- Keine anderen Dateien betroffen

## Technische Details

- `useCompanySettings` wird importiert für die Ländererkennung
- `TAX_CATEGORY_INFO` wird importiert für Info-Tooltips
- System-Kategorien mit `country` werden per Supabase-Query geladen und nach User-Land gefiltert
- Toggle-Sichtbarkeit nutzt bestehende `supabase.from('categories').update({ is_hidden })` Logik

