# Solar Scorch

Interactive Pretext.js demo — magnifying glass focuses sunlight onto text, scorching the paper and turning characters into rising ember particles while remaining text reflows in real time.

See @docs/PRD.md for full product spec. See @BUILDING.md for phased build steps.

## Stack

- Pretext (`@chenglou/pretext`) for text measurement and layout
- Canvas 2D for all rendering (no DOM text, no WebGL)
- Vanilla TypeScript
- Vite for dev server and build

## Architecture

Single canvas, no framework. The render loop runs every frame:

1. Draw paper background + accumulated scorch marks
2. Compute exclusion zones from scorch state
3. Lay out text via `prepareWithSegments()` + `layoutNextLine()` with variable widths per line
4. Draw text with `ctx.fillText()`
5. Draw magnifying glass (clip + blur + magnify)
6. Draw focal point with caustic animation
7. Update + draw ember particles

Target module structure in `src/` (created incrementally per @BUILDING.md):
- `layout.ts` — Pretext integration, reflow logic, exclusion zone width calculation
- `scorch.ts` — scorch zone state, growth, color progression
- `particles.ts` — ember particle system (spawn, physics, lifecycle, rendering)
- `glass.ts` — magnifying glass rendering (lens blur, magnification, focal point, caustics)
- `input.ts` — mouse/touch tracking, focus duration, burn triggering
- `main.ts` — render loop, state management, canvas setup

## Commands

```bash
bun install          # install deps
bun run dev          # start vite dev server
bun run build        # production build
bun run preview      # preview production build
bun run typecheck    # run tsc --noEmit
```

## Code Style

- ES modules, named exports
- Strict TypeScript (`strict: true`), no `any`
- Prefer `const` over `let`; never use `var`
- State is a single plain object passed through the render pipeline — no classes, no OOP
- All rendering functions take `(ctx: CanvasRenderingContext2D, state: State)` as first args
- Keep Pretext calls (`prepareWithSegments`, `layoutNextLine`) isolated to `layout.ts`

## Important Constraints

- IMPORTANT: `prepareWithSegments()` is expensive — only re-call when the text string changes (character removal). Store the prepared handle in state and reuse it across frames
- `layoutNextLine()` is the cheap hot path (~0.001ms) — safe to call every frame in the layout loop
- Ember particle count capped at 60; recycle oldest particles
- The character detach transition (layout-managed → physics particle) MUST be seamless — snapshot exact position from Pretext layout before spawning the particle at that position
- Canvas `filter` for glass blur may be expensive — if FPS drops below 50, render blurred region to an offscreen canvas and cache it

## Workflow

- Run `bun run typecheck` after making changes
- Open the browser and visually confirm rendering changes after each step
- Use Chrome DevTools Performance tab to verify 60fps during interaction
- Test in Chrome and Firefox; Safari Canvas filter support may differ
- When compacting, preserve the current phase (from PRD), list of implemented modules, and any known bugs
