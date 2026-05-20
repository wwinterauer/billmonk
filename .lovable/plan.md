
# Frontpage Redesign – Bento Edition

Neue Landing Page, die alle bestehenden Inhalte transportiert, aber in einem modernen Bento-Grid-Layout mit reichhaltigen Animationen, einem Produkt-Demo-Video und einem starken Hero-Moment präsentiert. Bestehende Farben (Teal Primary, Success, Warning, gradient-hero/gradient-primary) und Fonts bleiben **unverändert** – die Wirkung kommt aus Komposition, Tiefe, Bewegung und Hierarchie.

## Look & Feel

- **Bento-Grid** als roter Faden: jede Sektion (Hero, How it works, Features, Use Cases, Workflow, Pricing) wird zu einem Raster aus unterschiedlich großen, abgerundeten „Kacheln" (große Hero-Kachel + kleinere Info-Tiles).
- Tiefe durch sanfte Gradients (`gradient-hero`, `gradient-primary`), subtilen Innenschatten, Glas-/Noise-Hauch und farbige Glows an den Kachelrändern.
- **Mehr Bewegung**: Scroll-getriggerte Reveal-Animationen (framer-motion `whileInView`), gestaffelte Stagger-Effekte, leichte Parallax-Hintergrund-Blobs, dezenter Magnetic-Hover für CTAs, Number-Counter beim Sichtbarwerden, Marquee mit „Vertraut von…"-Logos/Initialen.
- **Hero-Demo-Video**: Wir nutzen die bereits vorhandene Remotion-Komposition (`remotion/`) → einmalig in MP4 gerendert und in `src/assets/` abgelegt, dann als auto-play/muted/loop-Background-Video in der zentralen Hero-Bento-Kachel mit poster-Frame und sanftem Overlay.
- Kein Stilbruch: Tokens (`bg-card`, `text-primary`, `border-border`, `gradient-hero`, `shadow-primary` …) werden konsequent verwendet, damit Dark/Light & Brand erhalten bleiben.

## Inhalte (alle bleiben erhalten – nur neu komponiert)

```text
┌──────────────────────────── HERO BENTO ────────────────────────────┐
│  Big Tile: Headline + CTA + Trust    │  Tile: Demo-Video (Remotion)│
│  Tile: KI-Genauigkeit (Counter 94%)  │  Tile: Belege 247 (Counter) │
│  Tile: Mini-Receipt-Stream (animiert)│  Tile: AT-Made / DSGVO Badges│
└─────────────────────────────────────────────────────────────────────┘

How it works   → 3-Step-Bento (Upload • KI erkennt • Export Steuerberater)
Problem/Lösung → Split-Bento „Vorher / Nachher"
Use Cases      → 2 große Tiles: Privat | Business (mit Icon-Wall)
Features       → Bento mit 6–8 Kacheln (groß: KI-Extraktion, klein: Bank-Import, Rechnungen, OCR, Tags, Recurring, Export, PWA)
Business Flow  → horizontaler animierter Pipeline-Stream
Testimonials   → Bento mit 1 großer + 2 kleinen Karten, sanftes Auto-Scroll
Pricing        → bestehender <Pricing/> (3 Tiles) erhält Bento-Rahmen
FAQ + CTA      → unverändert, leicht angepasste Hülle
```

Nichts wird entfernt: alle aktuellen Sektionen aus `src/pages/Index.tsx` bleiben sichtbar, jedoch in neuer Hülle.

## Technische Umsetzung

1. **Neue Komponenten** unter `src/components/landing/bento/`:
   - `BentoTile.tsx` (Wrapper: variants `lg | md | sm | feature | video`, Hover-Glow, Reveal)
   - `HeroBento.tsx` – ersetzt aktuellen `Hero`
   - `HowItWorksBento.tsx`, `FeaturesBento.tsx`, `UseCasesBento.tsx`, `TestimonialsBento.tsx`, `WorkflowStream.tsx`
   - `AnimatedCounter.tsx`, `LogoMarquee.tsx`, `MagneticButton.tsx`
2. **`src/pages/Index.tsx`** → importiert die neuen Bento-Komponenten in gleicher Reihenfolge (Hero → ProblemSolution → HowItWorks → UseCases → Features → Workflow → Testimonials → Pricing → FAQ → CTA). Alte Files bleiben vorerst liegen (rollback-fähig), werden aber nicht mehr gerendert.
3. **Animationen**: `framer-motion` (bereits installiert) – `whileInView`, `staggerChildren`, `useReducedMotion` respektieren.
4. **Demo-Video**:
   - `cd remotion && bun install && bun run scripts/render-remotion.mjs` → MP4 + WebM nach `src/assets/landing-demo.{mp4,webm}` + Poster `landing-demo.jpg`.
   - In `HeroBento` als `<video autoPlay muted loop playsInline poster=…>` (mobil: nur Poster + Play-Button, kein Autoplay über Mobilfunk-Heuristik).
5. **Performance**:
   - Video `preload="metadata"`, lazy mount via IntersectionObserver.
   - Bilder mit `loading="lazy"` + `decoding="async"`.
   - Reveal-Animationen einmalig (`viewport={{ once: true, margin: '-80px' }}`).
6. **Accessibility/SEO**:
   - Eine `<h1>` bleibt im Hero, `<section aria-labelledby>` pro Block, semantische Reihenfolge unverändert.
   - Bestehende `PageMeta` + JSON-LD bleiben.
   - `prefers-reduced-motion` → Animationen werden auf simple Fades reduziert.
7. **Responsive**:
   - Mobile: Bento-Grid kollabiert zu einer Spalte, Hero-Video schrumpft auf 16:9-Tile unter der Headline.
   - `lg:grid-cols-6` Grid mit `col-span`-Mix für Bento-Größen.

## Out of scope

- Dashboard, Auth, andere Seiten (Pricing-Page, Beta etc.) bleiben unberührt – `<Pricing/>` wird zwar in Bento-Hülle gerendert, aber die innere Komponente nicht umgeschrieben.
- Keine Änderung an Farb-Tokens, Fonts oder `tailwind.config.ts`.
- Keine Backend-/DB-Änderungen.

## Validierung

- Lokales Render-Check des Videos (kurzer QA: Datei < 8 MB, 1080p, loop-tauglich).
- Preview öffnen, Scroll durchspielen, Console/Network auf Fehler prüfen.
- Lighthouse-Spotcheck (LCP-Bild = Hero-Poster, Video lazy).
