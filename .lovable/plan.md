# SEO-Optimierung: BillMonk auffindbar machen

## Analyse

Die Seite hat bereits gute Grundlagen (PageMeta-Komponente, OG/Twitter-Tags, robots.txt, sitemap.xml, JSON-LD). Es gibt jedoch kritische Lücken, die die Auffindbarkeit in Google und Social Media bremsen.

---

## Massnahmen

### 1. Doppelte Canonical-URL beheben (Kritisch)
**Problem:** In `index.html` ist eine statische `<link rel="canonical" href="https://billmonk.lovable.app/">` hinterlegt. Die `PageMeta`-Komponente setzt zwar client-seitig eine neue Canonical pro Seite, aber statische Crawler (und Googlebot im ersten Render) sehen beide URLs. Das führt zu Duplicate-Content-Problemen.

**Loesung:**
- Statische `canonical` aus `index.html` entfernen.
- Statische `og:url` aus `index.html` entfernen (wird ebenfalls client-seitig per PageMeta gesetzt).
- So bleiben nur die Fallback-Tags in `index.html`, die per Seite dynamisch ueberschrieben werden.

### 2. OG/Twitter-Bild optimieren (Kritisch)
**Problem:** Das aktuelle OG-Image (`/icons/icon-512x512.png`) ist ein quadratisches App-Icon. Social-Plattformen (LinkedIn, Facebook, Twitter) erwarten ein 1200x630 Landschaftsbild fuer bessere Darstellung.

**Loesung:**
- Ein professionelles OG-Social-Image (1200x630) generieren mit Logo, Claim und Markenfarben.
- In `index.html` als Fallback, PageMeta erweitern um `og:image` Unterstuetzung.

### 3. Sitemap erweitern
**Problem:** Die Sitemap enthaelt nur 6 URLs. Oeffentliche Seiten wie `/login`, `/register` und `/unsubscribe` fehlen.

**Loesung:**
- `/unsubscribe` mit niedriger Prioritaet hinzufuegen.
- Optional: `/login` und `/register` ergaenzen (auch wenn sie nur fuer nicht-eingeloggte Nutzer sichtbar sind).
- `lastmod` ergaenzen fuer aktuellere Signale.

### 4. Meta-Tags auf allen oeffentlichen Seiten
**Problem:** Login und Register haben keine `<PageMeta>`-Tags. Diese Seiten koennen in Google fuer Brand-Suchanfragen erscheinen und sollten eindeutige Titel/Descriptions haben.

**Loesung:**
- `Login.tsx`: Eindeutigen Titel + Description hinzufuegen.
- `Register.tsx`: Eindeutigen Titel + Description hinzufuegen.
- `NotFound.tsx`: `noindex`-Tag setzen.

### 5. Semantic HTML & Heading-Struktur pruefen
**Status:** Die Landing-Page hat bereits korrekte H1/H2-Hierarchie (Hero = H1, Sections = H2).

**Keine Aenderung noetig.**

### 6. Alt-Texte auf Bilder pruefen
**Problem:** `logo-teal.png` im Hero hat keinen Alt-Text oder einen generischen.

**Loesung:**
- Alt-Texte auf allen Bildern pruefen und korrigieren.

### 7. Breadcrumb JSON-LD (optional, aber empfohlen)
**Loesung:** BreadcrumbList fuer die Landing-Page ergaenzen (Home > Pricing, Home > Beta etc.).

---

## Technische Details

### Files to edit:
- `index.html` — statische canonical/og:url entfernen, OG-Image aktualisieren
- `public/sitemap.xml` — URLs ergaenzen
- `src/pages/Login.tsx` — PageMeta hinzufuegen
- `src/pages/Register.tsx` — PageMeta hinzufuegen
- `src/pages/NotFound.tsx` — PageMeta mit noindex hinzufuegen
- `src/components/PageMeta.tsx` — og:image Unterstuetzung ergaenzen
- `src/components/landing/Hero.tsx` — Alt-Text pruefen
- `public/og-image.jpg` — Neues Social-Image generieren

### Resultat:
- Keine doppelten Canonicals mehr
- Professionelles Social-Preview-Bild
- Vollstaendige Meta-Tags auf allen oeffentlichen Seiten
- Aktualisierte Sitemap
