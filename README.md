# Solar Scorch

An interactive demo where a magnifying glass focuses sunlight onto a paragraph of text, scorching the paper and causing characters to detach as rising ember particles while the remaining text reflows in real time.

![Glass2-ezgif com-video-to-gif-converter](https://github.com/user-attachments/assets/8e286141-c12d-49b1-8eae-e81e00584c27)


## How it works

Hold a magnifying glass over text on a warm paper background. When held still, the focused light begins to burn — characters darken, detach as glowing embers that tumble and fade, and the remaining text reflows around the growing scorch marks.

### Features

- **Real-time text reflow** — text continuously reorganizes around burn zones using [Pretext](https://github.com/chenglou/pretext)'s `layoutNextLine()` API with variable widths per line
- **Ember particle system** — burned characters float upward as glowing embers with physics-based motion, color lifecycle (orange-yellow to grey ash), and tumble rotation
- **Per-pixel lens effects** — magnification, edge displacement, variable blur, and chromatic aberration inside the magnifying glass
- **Scorch progression** — paper yellows before burning, scorch marks grow with realistic color gradients (yellow fringe to dark center)
- **Animated caustics** — dancing light pattern at the focal point, simulating sunlight through curved glass
- **Procedural paper texture** — subtle noise-based grain for a physical paper feel

## Tech stack

- **[Pretext](https://github.com/chenglou/pretext)** (`@chenglou/pretext`) — DOM-free text measurement and layout
- **Canvas 2D** — all rendering (no DOM text, no WebGL)
- **Vanilla TypeScript** — no framework
- **Vite** — dev server and build

## Getting started

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Production build
bun run build

# Type check
bun run typecheck
```

Open the browser, move your magnifying glass over the text, and hold still to burn.

## Project structure

```
src/
  main.ts       — render loop, state management, canvas setup
  layout.ts     — Pretext integration, reflow logic, exclusion zones
  glass.ts      — magnifying glass (PNG image + per-pixel lens effects)
  scorch.ts     — scorch zone state, growth, color progression
  particles.ts  — ember particle system (spawn, physics, rendering)
  input.ts      — mouse tracking, focus duration, burn triggering
```

## How Pretext is used

This demo exercises Pretext's core differentiator: DOM-free text layout with per-line variable widths, recomputed every frame.

- `prepareWithSegments()` — called once when text changes (character removal), not every frame
- `layoutNextLine()` — called in a loop each frame with a different `maxWidth` per line, based on which scorch zones intersect that line's vertical band

The reflow is structural — every frame, the paragraph layout is genuinely recomputed around the burn zones.
