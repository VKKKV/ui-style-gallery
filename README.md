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

## Hallmark Test Quality

Each page has been rewritten to match the Hallmark test format:

- **Self-contained** — every page carries its entire design system in a `:root` block with exact OKLCH tokens, font stack, and spacing scale. No external CSS dependencies beyond `assets/css/base.css` for shared reset and keyframes.
- **Typography-driven** — layout is built from type scale, measure, and leading, not from arbitrary margin/pixel values. Each theme uses a unique display + body font pairing that reinforces brand voice.
- **Minimal CSS** — pages average ~150–200 lines of inline `<style>`, scoped to the sections they need. No unused classes, no framework bloat.
- **Coherent brand** — every page is a landing page for a distinct fictional brand with real copy (not filler), consistent masthead → hero → sections → colophon structure, and a clear narrative arc.
- **Pre-emit stamp** — the first line of every page's CSS block carries a `/* Hallmark · theme: <name> · pre-emit: P4 H4 E4 S4 R4 V4 */` comment.
- **Accessibility** — every page includes a `prefers-reduced-motion` block that disables animations and transitions.

| Page | Theme | Brand | Display | Body |
|------|-------|-------|---------|------|
| `pages/editorial.html` | editorial | Verbatim (digital magazine) | Inter Tight | Source Serif 4 |
| `pages/carnival.html` | carnival | Cold Snap (record label) | Big Shoulders Display | DM Sans |
| `pages/lumen.html` | lumen | Cinder (reasoning engine) | Instrument Serif | Space Grotesk |
| `pages/hum.html` | hum | Bubble (sourdough app) | Plus Jakarta Sans | Plus Jakarta Sans |
| `pages/cobalt.html` | cobalt | Distil (extraction API) | Space Grotesk | Inter |
| `pages/garden.html` | garden | Hollowback Apiary (honey farm) | Fraunces | Inter |
| `pages/riso.html` | riso | Off-Register (print fair) | Public Sans | Source Serif 4 |
| `pages/terminal.html` | terminal | Canonical (infra monitoring) | JetBrains Mono | JetBrains Mono |
| `pages/aurora.html` | aurora | Aether (orbital tracking) | Space Grotesk | Inter |
| `pages/newsprint.html` | newsprint | The Broadsheet (slow journalism) | Playfair Display | Source Serif 4 |
| `pages/bloom.html` | bloom | Petiole (botanical studio) | Instrument Serif | Inter |
| `pages/coral.html` | coral | Drift (coastal research) | DM Sans | DM Sans |
| `pages/specimen.html` | specimen | Specimen (editorial workshop) | Fraunces | Inter |
| `pages/midnight.html` | midnight | Streampipe (data pipelines) | Space Grotesk | Inter |
| `pages/brutal.html` | brutal | Foundry (compliance) | Bebas Neue | Inter |
| `pages/manifesto.html` | manifesto | TraceJam (observability) | Anton | Inter |
| `pages/atelier.html` | atelier | Alma (textile atelier) | Playfair Display | Inter |
| `pages/almanac.html` | almanac | Anya Park (design portfolio) | Hanken Grotesk | Inter |
| `pages/sport.html` | sport | Coyote (trail running) | Inter Tight | Inter |
| `pages/studio.html` | studio | Terrain (landscape arch) | Fraunces | Inter |

## Design System

- Colors use `oklch()` throughout — each theme has three base tokens: `--paper`, `--ink`, `--accent`
- Typography: 20 distinct display + body font pairings
- Shared structure: `.page-header` (fixed nav), `.section`, `.content`, `.section-header`, prefers-reduced-motion
- No build tools, no framework — vanilla HTML/CSS/JS

## Source

Hallmark design rules extracted from [nutlope/hallmark](https://github.com/nutlope/hallmark) (MIT).
