

# SEO-Optimierung der gesamten Seite

## Aktuelle Defizite

1. **Kein `sitemap.xml`** — Google kann die Seitenstruktur nicht crawlen
2. **`robots.txt` ohne Sitemap-Verweis** und ohne Disallow für geschützte Routen
3. **Keine dynamischen Meta-Tags pro Seite** — alle Seiten teilen den gleichen `<title>` und `<meta description>` aus `index.html`
4. **Keine strukturierten Daten** (JSON-LD Schema.org)
5. **Keine semantischen HTML-Tags** (`<article>`, `<nav aria-label>`, `<main>`, `role` Attribute) in Landing-Komponenten
6. **OG-Image ist nur ein Icon** — kein richtiges Social-Sharing-Bild
7. **Keine `canonical` URL** definiert
8. **Kein `hreflang`** für deutsche Inhalte
9. **Keine `alt`-Texte** auf dekorativen Elementen, fehlende `aria-label`s auf Navigations-Buttons
10. **Keine `<h1>`-Hierarchie-Kontrolle** — mehrere Seiten könnten ohne h1 sein

---

## Umsetzungsplan

### 1. SEO-Helfer-Komponente `PageMeta`
Neue Komponente die per `document.title` und dynamischen `<meta>`-Tags pro Seite den Title/Description setzt. Kein `react-helmet` nötig — einfacher `useEffect`-Hook.

Wird auf jeder öffentlichen Seite eingebunden: Index, Pricing, Beta, Datenschutz, Login, Register.

### 2. `public/sitemap.xml`
Statische Sitemap mit allen öffentlichen Routen:
- `/`, `/pricing`, `/beta`, `/datenschutz`, `/login`, `/register`

### 3. `public/robots.txt` erweitern
```
Sitemap: https://billmonk.lovable.app/sitemap.xml
Disallow: /dashboard
Disallow: /upload
Disallow: /review
Disallow: /settings
Disallow: /admin
...
```

### 4. `index.html` — Basis-SEO verbessern
- `<link rel="canonical">` hinzufügen
- `<meta name="robots" content="index, follow">`
- `<meta property="og:url">` mit absoluter URL
- `<meta property="og:locale" content="de_AT">`
- OG-Image auf absolute URL setzen
- `<html lang="de">` ist bereits korrekt

### 5. JSON-LD Structured Data
Auf der Startseite: `SoftwareApplication` + `Organization` Schema.
Auf der Pricing-Seite: `Product` mit `Offer`-Schemas pro Plan.
Auf der FAQ-Seite: `FAQPage` Schema.

### 6. Semantisches HTML in Landing-Komponenten
- `Header.tsx`: `<nav aria-label="Hauptnavigation">`
- `Footer.tsx`: `<nav aria-label="Footer-Navigation">`
- `Hero.tsx`: Sicherstellen dass `<h1>` korrekt ist
- `Features.tsx`, `FAQ.tsx`, `Pricing.tsx`: Passende `aria-label` und Heading-Hierarchie
- `alt`-Texte auf Logo-Images verbessern (bereits "BillMonk" — okay)

### 7. Performance-Hinweise in `index.html`
- `<link rel="preload">` für das Logo-Asset
- Font-Display `swap` ist bereits gesetzt — gut

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/PageMeta.tsx` | Neue Komponente: dynamischer Title + Meta pro Seite |
| `src/pages/Index.tsx` | PageMeta einbinden + JSON-LD (SoftwareApplication + FAQPage) |
| `src/pages/PricingPage.tsx` | PageMeta + JSON-LD (Product/Offer) |
| `src/pages/Beta.tsx` | PageMeta |
| `src/pages/Datenschutz.tsx` | PageMeta |
| `src/pages/Login.tsx` | PageMeta |
| `src/pages/Register.tsx` | PageMeta |
| `public/sitemap.xml` | Neue Datei |
| `public/robots.txt` | Sitemap-Verweis + Disallow geschützter Routen |
| `index.html` | Canonical, og:url, og:locale, robots meta |
| `src/components/landing/Header.tsx` | `aria-label` auf nav |
| `src/components/landing/Footer.tsx` | `aria-label` auf nav |
| `src/components/landing/FAQ.tsx` | JSON-LD FAQPage Schema |

