# UI Style Gallery

A static gallery with 38 demo pages: 20 Hallmark-inspired visual themes, 14 interaction experiments, and 4 legacy styles. Theme pages showcase fictional brands; interaction pages demonstrate browser techniques. The index is an additional page.

## Run locally

No build step or application dependencies. From this directory:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. Basic pages can also be opened directly via `index.html`.

Google Fonts, Swiper, and Lenis load from external services; blocked/offline resources use system fonts, manual carousel navigation, or native scrolling. Particle Morph uses local Canvas 2D and native WebGL, with a Canvas fallback. The new interaction studies use local Canvas 2D, CSS timelines, the native View Transition API, and pointer effects with progressive fallbacks.

This is a design reference, not a set of production products. Brand CTAs, download links, dashboard numbers, and installation snippets are illustrative; do not treat them as live services or verified installation instructions.

## Stats

- **38** pages total
- **20** Hallmark visual themes (Specimen, Midnight, Brutal, Garden, Atelier, Newsprint, Terminal, Manifesto, Almanac, Sport, Studio, Riso, Bloom, Coral, Cobalt, Aurora, Editorial, Carnival, Lumen, Hum)
- **14** interaction effects (Opening Animation, ShuffleText, Infinite Marquee, Scroll Animations, Custom Cursor, Carousel + Lightbox, Particle Morph Lab, Ink Bleed, Fluid X-ray, Flowmap, Noise Block Reveal, View Transition, Scroll-driven Motion, Mouse Stalker)
- **4** legacy retained (Tactical HUD, Dark Swiss, Apple / Spatial, Nous / Hermes)

## Structure

```
index.html              — gallery index with hero + 38-card grid
assets/
  css/base.css          — shared reset, easing variables, keyframes
  js/                   — shared JavaScript modules plus standalone interaction demos
pages/
  [theme-name].html     — standalone visual themes and interaction demos
scripts/verify-gallery.py — structure, links, JS syntax, optional browser smoke
```

Theme pages carry a Hallmark pre-emit design note in their CSS (a self-assessment, not an automated test result):

```css
/* Hallmark · theme: <name> · pre-emit: P4 H4 E4 S4 R4 V4 */
```

## Design approach

The Hallmark visual themes use these conventions; legacy and interaction demos keep their own layouts:

- **Local tokens** — visual themes define OKLCH colors, font stacks, and spacing in `:root`. Shared reset, navigation, and keyframes live in `assets/css/base.css`; Carousel also uses Swiper CSS.
- **Typography-driven** — display/body font combinations, measure, and leading reinforce each theme. Some themes intentionally share a font pairing.
- **No application framework** — page layouts and tokens stay in inline CSS, with shared JavaScript modules for reusable effects.
- **Coherent brand** — visual themes use fictional brand copy and a masthead → hero → sections → colophon structure.
- **Accessibility** — reduced-motion styles, visible keyboard focus, and return-to-gallery links are part of the baseline. Interaction demos also guard JavaScript motion; these checks do not constitute a full WCAG audit.

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
- `pages/studio.html` | studio | Terrain (landscape arch) | Fraunces | Inter |

The interaction reference set also includes `pages/mousestalker.html`, a local interpretation of the delayed halo cursor and drifting bubble field observed on [Aitsuki Nakuru's official site](https://aitsukinakuru.com/). It does not copy the source site's assets or code.

## Design System

- Hallmark themes use `--color-paper`, `--color-ink`, and `--color-accent`; several other demos use the shorter `--paper`, `--ink`, `--accent` convention and hex/RGB colors.
- Typography: theme-specific display/body combinations with system fallbacks.
- Visual themes use `.page`, `.masthead`, `.hero`, and `.colophon`; legacy demos retain their own structure. Shared gallery card rules are scoped to `.gallery-index`.
- No build tools, no framework — vanilla HTML/CSS/JS

## Verification

```sh
python scripts/verify-gallery.py
python scripts/verify-gallery.py --browser
python scripts/verify-interactions.py
```

Static checks need Python 3 and Node.js. The optional browser suite needs Python Playwright and its Chromium browser (`python -m pip install playwright`, then `python -m playwright install chromium`). Tests serve the current working tree on a temporary loopback port.

The static suite checks every index link, local asset/fragment, page return link, document shell, duplicate ID, card number, and JavaScript syntax. Browser smoke blocks external services deliberately and checks 320/375/1440px reduced-motion layouts plus 375px normal-motion layouts, runtime errors, missing images, keyboard focus, and shared-style isolation. The interaction suite exercises carousel/lightbox keyboard behavior, rapid text input, cursor fallback, replay interruption, marquee pause, particle targets and resize state, plus forced renderer failures. These suites do not replace online third-party integration or real-device GPU testing.

## Source

Hallmark design rules extracted from [nutlope/hallmark](https://github.com/nutlope/hallmark) (MIT).
