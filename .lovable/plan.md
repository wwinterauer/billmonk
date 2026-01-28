
# Plan: Checklisten-Funktion für XpenzAI

## Zusammenfassung
Implementierung einer Checklisten-Funktion mit der Möglichkeit, mehrere Checklisten anzulegen (z.B. pro Quartal), Positionen mit abhakbaren Items zu verwalten und Links/Notizen hinzuzufügen.

## Vorgehensweise

### Schritt 1: Datenbank-Schema erstellen

Zwei neue Tabellen werden angelegt:

**Tabelle `checklists`:**
- id, user_id, name, description, color, icon, is_archived, created_at, updated_at
- Row-Level Security für benutzerspezifischen Zugriff

**Tabelle `checklist_items`:**
- id, checklist_id, user_id, name, notes, links (JSONB), is_completed, completed_at, sort_order, created_at, updated_at
- Row-Level Security für benutzerspezifischen Zugriff

**Zusätzliche Datenbankfunktion:**
- `reset_checklist(p_checklist_id UUID)` - Setzt alle Items einer Checkliste zurück (alle Haken entfernen)

### Schritt 2: Neue Seite erstellen

**Datei: `src/pages/Checklists.tsx`**

Funktionen:
- Übersicht aller Checklisten mit Fortschrittsanzeige
- Checklisten erstellen, bearbeiten, löschen
- Checklisten-Positionen hinzufügen, bearbeiten, löschen, abhaken
- Links und Notizen pro Position
- Farbauswahl für visuelle Unterscheidung
- Zurücksetzen einer kompletten Checkliste

UI-Komponenten:
- Aufklappbare Checklisten-Karten mit Fortschrittsbalken
- Checkbox-Items mit optionalen Notizen und Links
- Dialoge für Erstellen/Bearbeiten von Listen und Positionen
- Bestätigungsdialog für Zurücksetzen

### Schritt 3: Route hinzufügen

In `src/App.tsx`:
- Import der neuen Checklists-Komponente
- Neue geschützte Route `/checklists`

### Schritt 4: Navigation erweitern

In `src/components/dashboard/Sidebar.tsx`:
- Neuer Menüpunkt "Checklisten" mit ClipboardList-Icon
- Position im Menü: nach "Berichte", vor "Einstellungen"

---

## Technische Details

### Datenbank-Migration SQL

```sql
-- Tabelle: checklists
CREATE TABLE IF NOT EXISTS public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6',
  icon TEXT DEFAULT 'clipboard-list',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabelle: checklist_items  
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES public.checklists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  links JSONB DEFAULT '[]',
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indizes
CREATE INDEX idx_checklists_user ON public.checklists(user_id, is_archived);
CREATE INDEX idx_checklist_items_checklist ON public.checklist_items(checklist_id, sort_order);

-- RLS aktivieren
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own checklists" ON public.checklists
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checklists" ON public.checklists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checklists" ON public.checklists
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checklists" ON public.checklists
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own checklist items" ON public.checklist_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checklist items" ON public.checklist_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checklist items" ON public.checklist_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checklist items" ON public.checklist_items
  FOR DELETE USING (auth.uid() = user_id);

-- Funktion zum Zurücksetzen einer Checkliste
CREATE OR REPLACE FUNCTION public.reset_checklist(p_checklist_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.checklist_items
  SET 
    is_completed = false,
    completed_at = NULL,
    updated_at = now()
  WHERE checklist_id = p_checklist_id
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Komponenten-Struktur

```text
src/pages/Checklists.tsx
├── Checklisten-Übersicht mit Cards
├── Fortschrittsbalken pro Checkliste
├── Expandable Items mit Checkboxen
├── Dialog: Neue/Bearbeiten Checkliste
├── Dialog: Neue/Bearbeiten Position
└── AlertDialog: Zurücksetzen bestätigen
```

### Sidebar Navigation Update

Neuer Eintrag im `navigation` Array:
```typescript
{ name: 'Checklisten', href: '/checklists', icon: ClipboardList }
```

Position: Nach "Berichte" (index 6), vor "Einstellungen" (index 7)

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/[timestamp].sql` | Neue Migration für Tabellen |
| `src/pages/Checklists.tsx` | Neue Seite (ca. 600 Zeilen) |
| `src/App.tsx` | Route hinzufügen |
| `src/components/dashboard/Sidebar.tsx` | Menüpunkt hinzufügen |
