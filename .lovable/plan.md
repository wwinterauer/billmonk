

# Plan: Kategorie-Lernen für Lieferanten UND Produkte/Beschreibungen

## Überblick
Wenn ein User eine Kategorie manuell ändert, soll das System sich das auf zwei Ebenen merken:
1. **Lieferant → Kategorie** (existiert teilweise: `vendors.default_category_id`, aber wird bei Korrekturen nicht automatisch aktualisiert)
2. **Produkt/Beschreibung → Kategorie** (neu: eine Tabelle `category_rules` speichert Keyword-basierte Zuordnungen)

Bei künftigen Belegen prüft die Edge Function zuerst die produktbasierten Regeln, dann den Lieferanten-Default.

## 1. Datenbank-Migration

### Neue Tabelle `category_rules`
```sql
CREATE TABLE public.category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  keyword text NOT NULL,
  category_name text NOT NULL,
  match_count integer DEFAULT 1,
  source text DEFAULT 'correction', -- 'correction' | 'manual'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, keyword)
);
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
-- Standard RLS: user can CRUD own rows
```

### Zweck
Wenn ein User bei einem Beleg mit Beschreibung "Batterie AA 4er Pack" die Kategorie auf "Büromaterial" ändert, wird ein Eintrag `keyword: "batterie", category_name: "Büromaterial"` gespeichert. Bei künftigen Belegen mit "Batterie" im Text wird diese Kategorie vorgeschlagen.

## 2. Korrektur-Tracking erweitern

### `useCorrectionTracking.ts`
Wenn `fieldName === 'category'`:
- **Lieferant**: `vendors.default_category_id` auf die neue Kategorie setzen (ID aus `categories` nachschlagen)
- **Produkt**: Keywords aus der Beleg-Beschreibung extrahieren und in `category_rules` upserten (Keyword → neue Kategorie)

Keyword-Extraktion: Die Beschreibung wird in Wörter zerlegt (≥4 Zeichen, keine Stoppwörter), jedes relevante Wort wird als Regel gespeichert. Bei erneutem Match erhöht sich `match_count`.

## 3. Edge Function anpassen

### `extract-receipt/index.ts`
Nach der KI-Extraktion (Kategorie bestimmt):
1. User's `category_rules` laden
2. Beschreibung des Belegs gegen Keywords prüfen
3. Bei Treffer: KI-Kategorie mit der gelernten überschreiben (höchster `match_count` gewinnt)
4. Lieferanten-Default als Fallback (wenn `vendors.default_category_id` gesetzt und KI unsicher)

Priorität: Produkt-Regel > Lieferanten-Default > KI-Vorschlag

## 4. `category` als lernbares Feld registrieren

### `ReanalyzeOptions.tsx`
- `category` zu `REANALYZABLE_FIELDS` hinzufügen
- `category` im `onFieldsUpdated`-Interface und `currentFormData` ergänzen

### `Review.tsx` + `ReceiptDetailPanel.tsx`
- `category` in den `onFieldsUpdated`-Handler und `currentFormData` aufnehmen
- Bei Kategorie-Korrektur: `trackCorrection({ fieldName: 'category', ... })` aufrufen

### `SaveWithLearningDialog.tsx` / `LEARNABLE_FIELDS`
- `category` zu `LEARNABLE_FIELDS` in `types/learning.ts` hinzufügen

## Dateien

| Datei | Änderung |
|---|---|
| Neue Migration | `category_rules` Tabelle + RLS |
| `useCorrectionTracking.ts` | Kategorie-spezifische Logik (Vendor-Default + Produkt-Keywords) |
| `extract-receipt/index.ts` | Gelernte Regeln bei Extraktion anwenden |
| `ReanalyzeOptions.tsx` | `category` als re-analysierbares Feld |
| `Review.tsx` | `category` in Callback + FormData |
| `ReceiptDetailPanel.tsx` | `category` in Callback + FormData |
| `types/learning.ts` | `category` zu `LEARNABLE_FIELDS` |

