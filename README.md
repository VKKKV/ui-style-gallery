# UI Style Gallery

A 30-page design gallery showcasing the full Hallmark theme system — 20 visual themes + 6 interaction effects + 4 legacy themes. Every page is a standalone landing page for a fictional brand, using exact OKLCH tokens from Hallmark's design system.

**Live**: open `index.html` in any browser. No build step.

## Stats

- **30** pages total
- **20** Hallmark visual themes (Specimen, Midnight, Brutal, Garden, Atelier, Newsprint, Terminal, Manifesto, Almanac, Sport, Studio, Riso, Bloom, Coral, Cobalt, Aurora, Editorial, Carnival, Lumen, Hum)
- **6** interaction effects (Opening Animation, ShuffleText, Infinite Marquee, Scroll Animations, Custom Cursor, Carousel + Lightbox)
- **4** legacy retained (Tactical HUD, Dark Swiss, Apple / Spatial, Nous / Hermes)

## Structure

```
index.html              — gallery index with hero + 30-card grid
assets/
  css/base.css          — shared reset, easing variables, keyframes
  js/                   — shared JS modules (ShuffleText, ScrollReveal, CustomCursor)
pages/
  [theme-name].html     — each theme is a self-contained landing page
```

Every page carries a Hallmark pre-emit stamp at the top of its CSS:

```css
/* Hallmark · theme: <name> · pre-emit: P4 H4 E4 S4 R4 V4 */
```

## Design System

- Colors use `oklch()` throughout — each theme has three base tokens: `--paper`, `--ink`, `--accent`
- Typography: 20 distinct display + body font pairings
- Shared structure: `.page-header` (fixed nav), `.section`, `.content`, `.section-header`, prefers-reduced-motion
- No build tools, no framework — vanilla HTML/CSS/JS

## Source

Hallmark design rules extracted from [nutlope/hallmark](https://github.com/nutlope/hallmark) (MIT).
