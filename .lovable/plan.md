

# Landing Page: Feature-Darstellung umstrukturieren

## Problem

Die Features-Sektion behandelt XpenzAi als reine "Belegverwaltung". Große KMU-Features wie der vollständige Verkaufs-Workflow (Angebot → AB → Lieferschein → Rechnung), Live-Bankanbindung mit Auto-Abgleich, wiederkehrende Rechnungen, DATEV-Export und CRM-Kundenverwaltung gehen in einem flachen Grid unter. Die Landing Page spricht aktuell nur Freelancer an, nicht KMUs.

## Lösung: Features in thematische Blöcke + neue KMU-Sektion

Statt einem flachen Grid: **3 prominente Feature-Blöcke** mit je eigenem visuellen Stil, plus eine neue **"Für KMU"**-Sektion die den Verkaufs-Workflow zeigt.

## Neue Seitenstruktur

```text
Landing Page (/)
├── Hero (bleibt)
├── ProblemSolution (bleibt)
├── HowItWorks (bleibt)
├── Features (umstrukturiert in 3 Blöcke)
│   ├── Block 1: "Belegverwaltung" (KI, Upload, E-Mail, Duplikate, Review)
│   ├── Block 2: "Banking & Abgleich" (CSV-Import, Live-Bank, Auto-Reconciliation, Schlagwörter)
│   └── Block 3: "Rechnungen & Verkauf" (AG→AB→LS→RE, CRM, Wiederkehrend, PDF)
├── KMU-Workflow (NEU: visueller Workflow AG→AB→LS→RE mit Beschreibung)
├── Testimonials (bleibt, mehr Testimonials)
├── Pricing (bleibt)
├── FAQ (bleibt)
├── CTA (bleibt)
└── Footer
```

## Konkrete Änderungen

### 1. `Features.tsx` komplett umstrukturieren
Drei thematische Blöcke statt flachem Grid:

**Block 1 — Intelligente Belegverwaltung** (Kernfunktion)
- Lernende KI-Erkennung
- Multi-Upload (PDF, Foto, Kamera)
- E-Mail Import (Gmail/Outlook)
- Duplikaterkennung
- Review-Workflow mit Tastatur-Nav
- Flexible Exporte (CSV/Excel/PDF/DATEV/BMD)
- Cloud-Backup (Google Drive)

**Block 2 — Banking & Kontoabgleich** (ab Starter)
- Bank-Import (CSV/Kontoauszüge)
- Schlagwort-Automatisierung (regelmäßige Ausgaben)
- Live-Bankanbindung (Open Banking, Echtzeit)
- Auto-Reconciliation (Belege ↔ Buchungen)

**Block 3 — Rechnungen & Geschäftsdokumente** (Business)
- Ausgangsrechnungen mit PDF-Versand
- Angebote, Auftragsbestätigungen, Lieferscheine
- Dokumenten-Umwandlung (AG→AB→LS→RE)
- CRM & Kundenverwaltung mit Nummernkreis
- Wiederkehrende Rechnungen & Mahnwesen
- Anzahlungs-, Teil- & Schlussrechnungen

Jeder Block bekommt einen eigenen Header mit Icon, Beschreibung und Plan-Badge.

### 2. Neue Sektion: `BusinessWorkflow.tsx`
Zwischen Features und Testimonials. Zeigt visuell den Dokumenten-Workflow:

```text
Angebot → Auftragsbestätigung → Lieferschein → Rechnung
```

- 4 Schritte horizontal mit Pfeilen/Connector-Lines
- Kurzbeschreibung: "Vom Angebot bis zur bezahlten Rechnung — alles aus einer Oberfläche"
- Badge "Business-Tarif"
- Erwähnung von Teil-/Schlussrechnungen und automatischem Mahnwesen

### 3. `Testimonials.tsx` erweitern
- 1-2 KMU-bezogene Testimonials ergänzen (z.B. "Endlich Angebote und Rechnungen an einem Ort" von einem KMU)
- Insgesamt 4-5 Testimonials statt 3

### 4. `ProblemSolution.tsx` erweitern
Zusätzliche Schmerzpunkte/Lösungen die KMU-relevanter sind:
- Problem: "Angebote in Word, Rechnungen in Excel — kein System"
- Lösung: "Kompletter Verkaufs-Workflow in einer Plattform"

### 5. `Index.tsx` aktualisieren
- `BusinessWorkflow` zwischen Features und Testimonials einbinden

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `src/components/landing/Features.tsx` | Komplett umstrukturieren in 3 thematische Blöcke |
| `src/components/landing/BusinessWorkflow.tsx` | **NEU** — Visueller AG→AB→LS→RE Workflow |
| `src/components/landing/ProblemSolution.tsx` | KMU-Schmerzpunkte ergänzen |
| `src/components/landing/Testimonials.tsx` | KMU-Testimonials hinzufügen |
| `src/pages/Index.tsx` | BusinessWorkflow einbinden |

