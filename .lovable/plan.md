# Schneller WOW-Pack + Neues Intro-Video

Wir bauen 5 Wirkungs-Boosts auf der Landing Page – inklusive eines **komplett neu produzierten** Remotion-Intro-Videos (die alte 5-Scene-Komposition wird ersetzt, nicht wiederverwendet).

## 1. Neues Intro-Video (Remotion, frisch produziert)

**Format:** 1920×1080, 30 fps, ~15 s (450 frames), MP4 H.264, muted/loop, < 6 MB
**Stil:** „Tech Product / Editorial" – passt zu BillMonk-Brand (Teal Primary, Cream/Paper-Töne, viel Whitespace, ein klarer Akzent)
**Typo:** Inter / Space Grotesk (matched die Site), keine generischen Sans-Serifs

**Storyboard (5 Szenen, jede ~90 frames mit ~15 frame Cross-Transitions):**

```text
Scene 1 (3s) — "Der Schmerz"
  Aufeinander gestapelte Papier-Belege fallen in den Frame,
  bilden chaotischen Stack. Headline: "Schluss mit dem Schuhkarton."

Scene 2 (3s) — "Capture"
  Ein Beleg wird hochgehoben, von Scan-Linie (teal) durchquert.
  UI-Mockup-Karte fliegt ein: Foto → Beleg-Karte mit Feldern.

Scene 3 (3s) — "KI extrahiert"
  Felder (Vendor, Datum, Netto, USt, Kategorie) erscheinen
  staggered, jeweils mit kleinem "✓" und Confidence-Bar (94%).

Scene 4 (3s) — "Pipeline"
  Horizontaler Flow: Beleg → KI → Buchhaltung → Steuerberater.
  Icons gleiten über Verbindungslinie, Zahlen ticken hoch.

Scene 5 (3s) — "Outro"
  BillMonk-Logo fadet ein, Tagline: "KI-Buchhaltung. Made in Austria."
  Subtiler Teal-Glow, langsamer Pull-Back.
```

**Motion-System:**
- Default Entry: `spring({ damping: 200 })` – smooth, kein Bounce
- Accent Entry (Hero-Moments): `spring({ damping: 12 })` – leichter Overshoot
- Scene-Transitions: `fade` + `slide` Mix, je 15 frames
- Persistent Layer: subtiles Noise-Overlay + langsam driftender Gradient-Blob im Hintergrund

**Render-Pipeline:**
- Bestehende `remotion/`-Files (`MainVideo.tsx`, `scenes/Scene1–5.tsx`) **überschreiben** mit neuem Storyboard
- `cd remotion && bun install` (idempotent)
- Compositor-Fix: musl → gnu binary kopieren, ffmpeg/ffprobe symlinken (siehe video-creator skill)
- `node scripts/render-remotion.mjs` → `src/assets/landing-demo.mp4`
- Poster-Frame via `bunx remotion still --frame=15` → `src/assets/landing-demo-poster.jpg`
- Spot-Check: `bunx remotion still` an Frame 0, 90, 225, 420

**Einbau in `HeroBento`:**
- Großes Hero-Tile bekommt `<video autoPlay muted loop playsInline poster={poster} preload="metadata">`
- Sanftes Gradient-Overlay (von unten, für Text-Lesbarkeit, falls Headline drüber liegt)
- Mobile: nur Poster + Play-Button (kein Autoplay über Mobilfunk)
- Lazy mount via `IntersectionObserver` – Video lädt erst, wenn Hero im Viewport

## 2. Animated Gradient-Mesh + Noise hinter dem Hero

- Neue Komponente `src/components/landing/bento/HeroBackdrop.tsx`
- Conic-Gradient aus 3 Brand-Farben (primary, primary-glow, accent), langsam rotierend (~40 s loop) via `@keyframes`
- Darüber 3 % Noise-PNG (oder SVG `<feTurbulence>`) für Editorial-Feel
- `pointer-events-none`, absolute hinter `HeroBento`-Grid

## 3. Magnetic CTA + Tilt-Effekt

- `src/components/landing/bento/MagneticButton.tsx`: Cursor zieht Button um max. 8 px an (mouse-move + spring)
- `src/components/landing/bento/TiltCard.tsx`: HOC für große Bento-Tiles, ±6° Perspektive, smooth lerp
- Nur Desktop (`useMediaQuery('(hover: hover)')`), respektiert `prefers-reduced-motion`
- Anwenden auf: Haupt-CTA „Beta testen" + Hero-Video-Tile + zwei Feature-Highlight-Tiles

## 4. Vorher/Nachher-Slider als neue Sektion

- Neue Komponente `src/components/landing/BeforeAfter.tsx`, einsortiert über `HowItWorksBento`
- Linke Hälfte: chaotischer Schuhkarton-Belege-Stack (generiertes Bild via `imagegen`)
- Rechte Hälfte: aufgeräumtes BillMonk-Dashboard (Screenshot oder generiertes Mockup)
- Draggable Trenner (Pointer-Events), Default 50 %, springt sanft zurück bei Release
- Labels: „Vorher" / „Nachher" als kleine Pills
- Mobile: kein Drag, sondern Auto-Animation hin und her (8 s loop)

## 5. Trust-Strip + Sticky Mobile CTA

**Trust-Strip:**
- Schmaler Streifen direkt unter Hero: „🇦🇹 Made in Austria · 🔒 DSGVO-konform · ⏱ 30 Tage testen · 💳 Keine Kreditkarte nötig"
- Subtiler `bg-card/50` mit `border-y`, Icons monochrom

**Sticky Mobile CTA:**
- `src/components/landing/StickyMobileCTA.tsx`
- Erscheint nach 30 % Scroll auf Mobile (`< md`), slide-up von unten
- Ein Button: „Jetzt Beta testen →" (primary, full-width minus padding)
- Dismiss-X rechts, merkt sich Dismiss in `sessionStorage`

---

## Technische Details

**Neue Dateien:**
- `remotion/src/MainVideo.tsx` (überschrieben)
- `remotion/src/scenes/Scene1.tsx` … `Scene5.tsx` (überschrieben)
- `remotion/src/components/PersistentBackdrop.tsx` (neu)
- `src/assets/landing-demo.mp4` (gerendert)
- `src/assets/landing-demo-poster.jpg` (gerendert)
- `src/components/landing/bento/HeroBackdrop.tsx`
- `src/components/landing/bento/MagneticButton.tsx`
- `src/components/landing/bento/TiltCard.tsx`
- `src/components/landing/BeforeAfter.tsx`
- `src/components/landing/StickyMobileCTA.tsx`
- ggf. `src/assets/before-shoebox.jpg` (via imagegen)

**Geänderte Dateien:**
- `src/components/landing/bento/HeroBento.tsx` (Video-Tile + Backdrop + Magnetic CTA + Tilt)
- `src/pages/Index.tsx` + `src/pages/Beta.tsx` (BeforeAfter einbauen, StickyMobileCTA mounten, Trust-Strip)

**Bibliotheken:** framer-motion (bereits da), keine neuen Deps nötig.

**Performance:**
- Video `preload="metadata"`, lazy-mount via IntersectionObserver
- Alle Reveals einmalig (`viewport={{ once: true }}`)
- `prefers-reduced-motion` → Tilt/Magnetic deaktiviert, Video → nur Poster

**Accessibility/SEO:**
- Video hat `aria-hidden="true"` (rein dekorativ), Headline bleibt Text-H1
- BeforeAfter-Slider mit Keyboard-Support (Arrow Keys)
- Bestehende JSON-LD / PageMeta unverändert

---

## Reihenfolge der Umsetzung

1. Remotion-Setup fixen (Compositor + ffmpeg-Symlinks) und neues Storyboard schreiben
2. Video rendern, Spot-Check Frames, Datei nach `src/assets/`
3. `HeroBackdrop` + `MagneticButton` + `TiltCard` bauen
4. `HeroBento` umbauen (Video-Tile + neue Effekte)
5. `BeforeAfter`-Sektion + Trust-Strip einbauen
6. `StickyMobileCTA` einbauen
7. Auf `/` **und** `/beta` mounten, Preview-Check

## Out of Scope

- Kein Backend, keine DB-Änderungen
- Keine neuen Farb-Tokens oder Fonts
- Dashboard, Auth, andere Seiten bleiben unberührt
- Andere Wow-Ideen aus der vorherigen Liste (ROI-Calculator, Live-Demo-Widget, Cursor-Trail) bleiben für später
