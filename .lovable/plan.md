

# Responsive UI Audit — Alle Seiten & Komponenten

## Kritisches Hauptproblem: Sidebar & DashboardLayout

Das **gravierendste Problem** betrifft ALLE Dashboard-Seiten: Die `DashboardLayout` verwendet eine fixe Sidebar mit `ml-64` / `ml-16` Margin, hat aber **keinerlei Mobile-Handling**. Auf Screens unter 768px wird die Sidebar abgeschnitten und der Content ist nicht erreichbar.

**Betroffene Seiten (alle mit DashboardLayout):**
Dashboard, Upload, Review, Expenses, BankImport, Reconciliation, Reports, Settings, Checklists, Invoices, InvoiceEditor, Quotes, DeliveryNotes, OrderConfirmations, Account

---

## Befunde im Detail

### 1. DashboardLayout + Sidebar — KRITISCH
- `Sidebar` ist `fixed left-0 w-64` ohne mobile Breakpoint
- `DashboardLayout` setzt `ml-64` / `ml-16` ohne `md:` Prefix
- **Fix:** Mobile: Sidebar als Off-Canvas Sheet (wie die vorhandene `ui/sidebar.tsx`-Komponente), Hamburger-Button im Header, `ml-0` auf Mobile

### 2. Review-Seite — HOCH
- Zweispaltiges Layout (`grid lg:grid-cols-2`) funktioniert auf Tablet, aber auf Mobile gibt es Probleme:
  - Navigation-Buttons (Prev/Next) + Counter sind eng
  - Action-Buttons unten (`flex flex-wrap gap-3`) könnten überlappen auf kleinen Screens
  - Lightbox Dialog `max-w-4xl h-[90vh]` ist okay

### 3. Expenses-Seite — HOCH
- Datatable mit vielen Spalten: Kein horizontales Scrolling auf Mobile
- Filter-Leiste (`flex flex-wrap items-end gap-3`) könnte auf Mobile zu eng werden
- Bulk-Actions Bar scrollt nicht
- **Fix:** `overflow-x-auto` auf Table-Container, Column-Visibility Default für Mobile anpassen

### 4. Settings-Seite — MITTEL
- TabsList mit `flex flex-wrap` ist grundsätzlich okay
- Tab-Labels sind `hidden sm:inline` — auf Mobile nur Icons, das funktioniert
- Einige innere Forms haben fixe Breiten (z.B. `w-[280px]` SelectTrigger)

### 5. InvoiceEditor — MITTEL
- `grid grid-cols-1 xl:grid-cols-[1fr_400px]` — Preview-Panel nur auf XL sichtbar nebeneinander
- Meta-Grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` ist korrekt responsiv
- Line-Items Table braucht horizontales Scrolling

### 6. Invoices/Quotes/DeliveryNotes/OrderConfirmations — MITTEL
- Tabellen ohne `overflow-x-auto` Wrapper
- Filter/Header-Buttons könnten auf Mobile überlappen

### 7. Reconciliation — MITTEL
- Tabelle ohne horizontales Scrolling
- Ähnliche Probleme wie Expenses

### 8. Reports — MITTEL
- Charts mit `ResponsiveContainer` sind okay
- Export-Tabellen brauchen Scroll-Container

### 9. Landing-Seiten (Index, Beta, Pricing) — NIEDRIG
- Verwenden `container`-Klasse, grundsätzlich responsiv
- Beta-Header hat `hidden md:flex` für Desktop-Nav, okay
- Hero/Features/Pricing nutzen responsive Grids

### 10. Auth-Seiten (Login, Register, ForgotPassword, ResetPassword) — OK
- `max-w-md` zentriert, `px-4` padding — korrekt responsiv

### 11. Onboarding — OK
- Einfaches Card-Layout, zentriert, responsive

### 12. Admin-Seite — NIEDRIG
- TabsList mit vielen Tabs könnte überlaufen
- Nur für Admins relevant

---

## Umsetzungsplan

### Schritt 1: Mobile Sidebar (DashboardLayout + Sidebar) — behebt ALLE Dashboard-Seiten
- `DashboardLayout`: Auf Mobile (`< md`) die Sidebar ausblenden, einen Top-Header mit Hamburger-Menü hinzufügen
- `Sidebar`: Auf Mobile als Sheet/Drawer rendern statt fixed
- `main` Container: `ml-0` auf Mobile, `md:ml-64` / `md:ml-16` auf Desktop

### Schritt 2: Tabellen-Scrolling
- In `Expenses`, `Invoices`, `Reconciliation`, `Reports`, `Checklists` die `<Table>` in einen `<div className="overflow-x-auto">` Wrapper setzen

### Schritt 3: Kleinere Responsive-Fixes
- Review: Action-Buttons responsive Stack auf Mobile
- Settings: Fixe Breiten durch `w-full sm:w-[280px]` ersetzen
- InvoiceEditor: Line-Items Table Scroll-Container
- Admin: TabsList scrollbar machen

### Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/dashboard/DashboardLayout.tsx` | Mobile Header + Sheet-Sidebar + responsive margins |
| `src/components/dashboard/Sidebar.tsx` | Mobile-Modus als Sheet, Hamburger-Toggle |
| `src/pages/Expenses.tsx` | Table overflow-x-auto |
| `src/pages/Invoices.tsx` | Table overflow-x-auto |
| `src/pages/Reconciliation.tsx` | Table overflow-x-auto |
| `src/pages/Reports.tsx` | Table overflow-x-auto |
| `src/pages/Checklists.tsx` | Table overflow-x-auto |
| `src/pages/Review.tsx` | Action-Buttons responsive |
| `src/pages/Settings.tsx` | Fixe Breiten entfernen |
| `src/pages/InvoiceEditor.tsx` | Line-Items Table scroll |
| `src/pages/Admin.tsx` | TabsList scrollbar |

