

## Konzept: Gesperrte Features sichtbar machen + Umbenennung + visuelle Gruppierung

### 1. Umbenennung "Rechnungen" → "Ausgangsrechnungen"
- **Sidebar.tsx** Zeile 59: Label ändern

### 2. Feature-Min-Plan Mapping (planConfig.ts)
Neue Map hinzufügen, die pro Feature den Mindest-Plan definiert:
```typescript
export const FEATURE_MIN_PLAN: Record<string, PlanType> = {
  reconciliation: 'starter',
  bankImport: 'starter',
  emailImport: 'starter',
  cloudBackup: 'pro',
  invoiceModule: 'business',
};
```

### 3. Sidebar: Alle Items immer zeigen, gesperrte mit Lock
- Statt `filteredNavigation` (Zeile 130) alle Items rendern
- Gesperrte Items: `opacity-60`, Lock-Icon (12px) neben dem Namen, `cursor-not-allowed`
- Klick auf gesperrtes Item: `e.preventDefault()` + Toast mit Text wie *"Verfügbar ab dem Starter-Abo"* und Action-Button "Upgraden" → `/account?tab=subscription`
- Im collapsed-Zustand: nur Lock-Icon als Overlay auf dem Feature-Icon

### 4. Settings-Tabs: Alle Tabs immer zeigen, gesperrte mit Lock
- Statt `visibleTabs` Filter (Zeile 447-449) alle Tabs rendern
- Gesperrte Tabs: `opacity-60` + kleines Lock-Icon im Tab-Label
- Klick auf gesperrten Tab ist erlaubt (Tab öffnet sich), aber der **Tab-Content** zeigt statt der Einstellungen eine **Upgrade-Karte**:
  - Zentrierte Card mit Lock-Icon, kurzer Feature-Beschreibung, Plan-Name, und Button "Jetzt upgraden" → `/account?tab=subscription`
  - So sieht der User, was ihn erwartet, kann aber nichts konfigurieren

### 5. Settings: Invoice-Tabs visuell abgrenzen
- Vor den Invoice-Tabs (Kunden, Artikel, Rechnung, Fakturierung) einen vertikalen Separator (`|`) oder eine kleine Lücke + dezente Gruppenbezeichnung einfügen
- Die Invoice-Tabs erhalten einen leicht anderen Hintergrund-Stil (z.B. `border-l-2 border-primary/20` als Gruppe oder `bg-primary/5` auf dem TabsTrigger)

### 6. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/lib/planConfig.ts` | `FEATURE_MIN_PLAN` Map + Feature-Beschreibungen |
| `src/components/dashboard/Sidebar.tsx` | Umbenennung, Lock-Pattern statt Filter |
| `src/pages/Settings.tsx` | Tabs immer zeigen, Lock-UX, Upgrade-Karte, Invoice-Gruppierung |

