

## Konzept: Gesperrte Features als Vorschau anzeigen + Tab-Layout verbessern

### Probleme
1. **Sidebar**: Gesperrte Menüpunkte zeigen nur einen Toast — der User sieht die Seite gar nicht
2. **Settings-Tabs**: Gesperrte Tabs zeigen nur eine generische Upgrade-Card — nicht die echte UI
3. **Tab-Layout**: "Ausgangsrechnungen" als Gruppenbezeichnung nimmt zu viel Platz ein

### Lösung

#### 1. Sidebar: Gesperrte Items navigieren zur Seite
- Klick auf gesperrte Items navigiert normal zur Seite (kein `e.preventDefault()` mehr, kein Toast)
- Lock-Icon und `opacity-60` bleiben als visuelle Markierung
- Die Seiten selbst (Reconciliation, BankImport, Invoices) prüfen den Plan und zeigen bei fehlendem Zugang ein **Overlay/Banner** über dem echten Content:
  - Echte UI wird gerendert aber mit `pointer-events-none`, `opacity-50` und `select-none` (nicht interagierbar)
  - Darüber liegt eine halbtransparente Upgrade-Card mit Feature-Beschreibung und Upgrade-Button
  - So sieht der User was möglich wäre, kann aber nichts tun

**Umsetzung**: Neue `FeatureGate`-Wrapper-Komponente die in den betroffenen Seiten genutzt wird:
```text
<FeatureGate feature="bankImport">
  <BankImportContent />   ← wird gerendert aber nicht interagierbar
</FeatureGate>
```

#### 2. Settings-Tabs: Echte UI als Vorschau statt Upgrade-Card
- Gesperrte Tabs zeigen die **echte Komponente** (z.B. `CustomerManagement`, `EmailImportSettings`), aber eingewickelt in den gleichen `FeatureGate`-Wrapper
- Content wird sichtbar aber nicht interagierbar (`pointer-events-none`, `opacity-50`)
- Upgrade-Overlay darüber mit Upgrade-Button

#### 3. Tab-Layout verbessern
Statt "Ausgangsrechnungen" als Text-Label im Menüband:
- Nur ein **vertikaler Strich** (`|`) als Separator zwischen Expense- und Invoice-Tabs
- Invoice-Tabs bekommen ein subtiles visuelles Unterscheidungsmerkmal: ein kleines `FileText`-Icon (4px) vor der Gruppe oder einfach nur den Separator
- Kein Text-Label → spart Platz

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/FeatureGate.tsx` | **Neu** — Wrapper-Komponente: rendert children als Vorschau mit Upgrade-Overlay wenn Feature gesperrt |
| `src/components/dashboard/Sidebar.tsx` | Gesperrte Items navigieren normal (Link auf echte URL statt `#`) |
| `src/pages/Settings.tsx` | Tab-Layout: "Ausgangsrechnungen"-Text entfernen, nur Separator behalten. Gesperrte TabsContent: echte Komponente in FeatureGate statt UpgradeCard |
| `src/pages/Reconciliation.tsx` | Content in `<FeatureGate feature="reconciliation">` wrappen |
| `src/pages/BankImport.tsx` | Content in `<FeatureGate feature="bankImport">` wrappen |
| `src/pages/Invoices.tsx` | Content in `<FeatureGate feature="invoiceModule">` wrappen |

### FeatureGate Komponente (Konzept)
```text
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │  ← relative container
│  │  Echte UI (opacity-50,        │  │
│  │  pointer-events-none,         │  │
│  │  select-none, blur-[1px])     │  │
│  └───────────────────────────────┘  │
│  ┌─────────────────┐               │  ← absolute overlay, centered
│  │ 🔒 Feature-Name │               │
│  │ Beschreibung    │               │
│  │ [Jetzt upgraden]│               │
│  └─────────────────┘               │
└─────────────────────────────────────┘
```

