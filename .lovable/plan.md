

# Landing Page Sektionen nicht sichtbar — Diagnose & Fix

## Problem

Alle Landing-Page-Sektionen zwischen Hero und CTA (ProblemSolution, HowItWorks, Features, BusinessWorkflow, Testimonials, Pricing, FAQ) sind im DOM vorhanden, aber **unsichtbar**. Die framer-motion `whileInView` Animationen (die mit `initial={{ opacity: 0 }}` starten) triggern nicht korrekt.

Das betrifft sowohl die Browser-Automation als auch potenziell echte Nutzer mit langsamen Verbindungen oder bestimmten Browser-Konfigurationen, bei denen der IntersectionObserver nicht sofort feuert.

## Ursache

Jede Sektion nutzt `motion.div` mit:
```text
initial={{ opacity: 0, y: 16 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.2 }}
```

Wenn der IntersectionObserver nicht triggert (z.B. bei schnellem Scroll, SSR-ähnlichen Bedingungen, oder bestimmten Browser-Konfigurationen), bleiben die Elemente permanent bei `opacity: 0`.

## Lösung

Die äußersten `motion.div` Wrapper jeder Sektion sollten **keine opacity-Animation auf Sektionsebene** haben, sondern nur auf den inneren Content-Elementen. Alternativ: den Sektions-Headern und Content-Blöcken einen CSS-Fallback geben, damit sie auch ohne JS/IntersectionObserver sichtbar sind.

**Konkreter Ansatz**: In jeder Landing-Komponente die äußere `<section>` oder den Container-`div` NICHT mit `initial={{ opacity: 0 }}` animieren. Stattdessen nur die Kinder-Elemente (Überschriften, Cards, Listen) animieren. Oder alternativ einen `style={{ opacity: 1 }}` Fallback setzen und die Animation nur als Enhancement nutzen.

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/landing/ProblemSolution.tsx` | Äußeren motion-Wrapper opacity-safe machen |
| `src/components/landing/HowItWorks.tsx` | Äußeren motion-Wrapper opacity-safe machen |
| `src/components/landing/Features.tsx` | Äußeren motion-Wrapper opacity-safe machen |
| `src/components/landing/BusinessWorkflow.tsx` | Äußeren motion-Wrapper opacity-safe machen |
| `src/components/landing/Testimonials.tsx` | Äußeren motion-Wrapper opacity-safe machen |
| `src/components/landing/Pricing.tsx` | Äußeren motion-Wrapper opacity-safe machen |
| `src/components/landing/FAQ.tsx` | Äußeren motion-Wrapper opacity-safe machen |

## Technischer Ansatz

In jeder Komponente: Die `<section>`-Level bleibt ein normales `<section>` (kein `motion`). Nur die inneren Elemente (Header-Text, Cards, einzelne Items) behalten ihre `whileInView`-Animation. So ist die Sektion immer sichtbar, aber die Inhalte animieren elegant rein.

Nach dem Fix können alle Screenshots korrekt erfasst werden.

