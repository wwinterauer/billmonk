

# Admin-Link in der Sidebar

## Änderung

In `src/components/dashboard/Sidebar.tsx` wird ein Admin-Link (`/admin`, Shield-Icon, Text "Admin") eingefügt, der **nur sichtbar ist wenn `isAdmin` true ist**. Platzierung: **ganz oben** in der Navigation, vor "Dashboard".

## Umsetzung

**Datei:** `src/components/dashboard/Sidebar.tsx`

1. Im Render-Bereich der Navigation (wo über `navigation.map(...)` iteriert wird) **vor** der Liste einen separaten Admin-Eintrag einfügen:
   - Icon: `Shield` (bereits importiert)
   - Text: "Admin"
   - Link: `/admin`
   - Bedingung: `{isAdmin && (...)}`
   - Styling: gleich wie andere Nav-Items, aktiver Zustand wenn `location.pathname === '/admin'`

Keine neuen Dateien, keine DB-Änderungen — nur eine kleine Ergänzung in der bestehenden Sidebar.

