

# Plan: Kategorien-Verwaltung trennen — Meine Kategorien vs. Buchungsarten

## Übersicht

Die bestehende `CategoryManagement.tsx` wird umgebaut: Oben "Meine Kategorien" (persönliche, `is_system === false`), Trennlinie, unten "Buchungsarten" (steuerliche Einordnung, basierend auf `TAX_TYPES` aus `constants.ts`). Buchungsarten werden in einer eigenen Tabelle verwaltet — die Standard-Buchungsarten sind nicht löschbar, nur ausblendbar. Business-Plan-User sehen zusätzlich ein Buchungsschlüssel-Feld.

## 1. DB-Migration — Buchungsarten-Tabelle

Neue Tabelle `booking_types` für benutzerdefinierte Buchungsarten:

```sql
CREATE TABLE public.booking_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  is_system boolean DEFAULT true,
  is_hidden boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  booking_key text DEFAULT null,  -- DATEV/BMD Buchungsschlüssel
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.booking_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own booking types" ON public.booking_types
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own booking types" ON public.booking_types
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own booking types" ON public.booking_types
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete non-system booking types" ON public.booking_types
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND is_system = false);
```

**Seed default booking types** via a trigger on `profiles` insert (or populate on first load in the frontend). The 10 standard TAX_TYPES are seeded as `is_system = true`.

## 2. CategoryManagement.tsx — Umstrukturierung

**Oberer Bereich: "Meine Kategorien"**
- Header: "Meine Kategorien" + Button "Neue Kategorie"
- Hinweistext: "Deine persönlichen Kategorien zur Organisation deiner Belege."
- Tabelle zeigt nur `is_system === false` Kategorien (persönliche)
- Bestehende CRUD-Logik bleibt, nur gefiltert auf eigene Kategorien
- Steuer-Kategorien-Toggle (Länderwahl) wird entfernt aus diesem Bereich

**Trennlinie:**
```tsx
<Separator className="my-8" />
<h3 className="text-lg font-semibold">Buchungsarten</h3>
<p className="text-sm text-muted-foreground">
  Steuerliche Einordnung deiner Belege. Wird in Exporten und für den Steuerberater verwendet.
</p>
```

**Unterer Bereich: "Buchungsarten"**
- Tabelle mit den Buchungsarten aus `booking_types` (oder fallback auf `TAX_TYPES` Konstante)
- Standard-Buchungsarten: nicht löschbar, nur ausblendbar (Eye/EyeOff Toggle)
- User kann weitere hinzufügen oder vorhandene umbenennen
- Für Business-Plan: zusätzliche Spalte "Buchungsschlüssel" als editierbares Inline-Feld
- `usePlan()` prüft `effectivePlan === 'business'` für die Anzeige

## 3. Alternativer Ansatz — Ohne neue DB-Tabelle

Statt einer neuen Tabelle könnten Buchungsarten auch über das bestehende `profiles`-Feld als JSON gespeichert werden (z.B. `booking_type_settings`). Das vermeidet eine Migration:

```sql
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS booking_type_settings jsonb DEFAULT '{}';
```

Struktur: `{ "hidden": ["Sonstige"], "custom": [{"name": "Meine Art", "key": "1234"}], "keys": {"Betriebsausgabe": "4400"} }`

Die `TAX_TYPES` Konstante bleibt die Quelle für die Standardwerte. Das JSON trackt nur Abweichungen (ausgeblendet, umbenannt, Buchungsschlüssel, benutzerdefinierte Einträge).

**Empfehlung: Ansatz 3 (profiles JSON)** — einfacher, keine neue Tabelle, keine RLS-Komplexität.

## 4. Umsetzungsdetails (mit profiles JSON)

**Migration:**
```sql
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS booking_type_settings jsonb DEFAULT '{}';
```

**Hook `useBookingTypes.ts`:**
- Lädt `booking_type_settings` aus `profiles`
- Merged mit `TAX_TYPES` Konstante
- Returns: `bookingTypes[]`, `updateBookingKey()`, `toggleHidden()`, `addCustomType()`, `renameType()`

**CategoryManagement.tsx:**
- Split in zwei Sections
- Oben: Eigene Kategorien (bestehende Logik, gefiltert auf `!is_system`)
- Unten: Buchungsarten (neuer `useBookingTypes` Hook)
- Business-Plan: Buchungsschlüssel-Input pro Zeile

**Dropdowns in Review/Expenses:**
- "Buchungsart" Dropdown liest aus `useBookingTypes` statt direkt aus `TAX_TYPES` (damit ausgeblendete Typen nicht erscheinen)

## Technische Details

- Keine Änderung an `tax_type` auf `receipts`/`receipt_split_lines` — bleibt Text-Feld
- Buchungsschlüssel werden in `booking_type_settings.keys` gespeichert und im DATEV/BMD-Export berücksichtigt
- Standard-Buchungsarten kommen aus `TAX_TYPES` Konstante, User-Overrides aus dem JSON
- `usePlan()` wird für Feature-Gating des Buchungsschlüssel-Feldes verwendet

