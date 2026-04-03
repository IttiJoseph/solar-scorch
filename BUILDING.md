# Building Instructions

Step-by-step guide for building Solar Scorch with Claude Code. Each phase is a standalone milestone — verify before moving on.

## Prerequisites

- Node.js 18+ or Bun
- A modern browser (Chrome recommended for Canvas filter support)

## Session Management

- Start a fresh Claude Code session (`/clear`) at the beginning of each Phase
- Within a phase, `/clear` between steps if context is getting noisy (especially after debugging)
- Each step's code block can be pasted directly as a Claude Code prompt
- After completing a step, verify before moving on — don't batch multiple steps

## Phase 1 — Core Loop

The goal is a working reflow demo: text on screen, magnifying glass follows cursor, burning removes characters, text reflows.

### Step 1: Scaffold

```
Initialize a Vite + TypeScript project. Single index.html with a full-viewport canvas.
No framework. Install @chenglou/pretext. Set up the module structure from CLAUDE.md.
```

Verify: `bun run dev` serves a blank canvas. `bun run typecheck` passes.

### Step 2: Static text layout

```
Render a paragraph of text onto the canvas using Pretext.
Use prepareWithSegments() + layoutWithLines() to lay out text at a fixed width.
Draw each line with ctx.fillText(). Use 18px Inter (or system sans-serif fallback), 26px line height.
Paper-colored background (#FAF6F0 or similar warm off-white). Dark text (#2A2A2A).
```

Verify: a paragraph of text renders on a warm background. Resize the browser — text should re-layout to the new canvas width.

### Step 3: Magnifying glass (basic)

```
Draw a circle that follows the cursor. Simple stroke circle + a short angled handle line.
Hide the default cursor over the canvas. Track mouse position in input.ts.
No glass effect yet — just the geometric shape.
```

Verify: a circle with a handle follows the mouse. No lag, 60fps.

### Step 4: Focal point + burn trigger

```
Add a small bright dot (radial gradient, warm white) inside the magnifying glass circle.
Track how long the mouse has been roughly stationary (focusDuration in state).
After ~0.5s of near-stillness, start "burning": mark characters near the focal point for removal.
```

Verify: hold the mouse still over text — after a brief delay, something should visually change at the focal point.

### Step 5: Character removal + reflow

```
When a character is "burned," remove it from the text string and add a scorch zone at its position.
Re-call prepareWithSegments() with the new text.
Switch the layout loop from layoutWithLines() to layoutNextLine() with variable widths.
For each line, compute available width by checking which scorch zones intersect that line's Y band.
Draw scorch marks as dark circles/ellipses on the scorch layer.
```

Verify: hold the glass still — characters disappear, a dark mark appears, and the remaining text reflows around the scorch. This is the critical milestone. If the reflow looks correct, Phase 1 is done.

---

## Phase 2 — Physics and Polish

### Step 6: Ember particles

```
When a character detaches, snapshot its exact (x, y) from the Pretext layout.
Spawn a particle at that position: { char, x, y, vx: 0, vy: -initialSpeed, rotation, seed, age, maxAge }.
Each frame: apply upward deceleration (vy *= 0.98), lateral sine-wave drift, slow rotation.
Color lifecycle: orange-yellow → red-orange → grey → fade opacity.
Render with ctx.fillText() of the single character, applying rotation + scale + color per frame.
Cap at 60 particles; recycle oldest.
```

Verify: characters float upward as glowing embers, tumble, cool to grey, and fade. No visible "pop" at the moment of detachment — the particle starts exactly where the character was.

### Step 7: Scorch visual refinement

```
Replace simple dark circles with radial gradients: dark center → brown edge → subtle yellow fringe.
Paper under the focal point should yellow before characters detach.
Scorch radius should expand slowly while the glass is held still.
Moving the glass should leave a scorched trail.
```

Verify: the burn area looks like scorched paper, not just black dots. There's a visible yellowing → browning → blackening progression.

### Step 8: Glass effect

```
Implement the frosted glass lens:
1. Copy pixels under the lens circle to an offscreen canvas
2. Apply ctx.filter = 'blur(4px) saturate(1.2) brightness(1.1)'
3. Draw back at ~1.15x scale (magnification) within a circular clip
4. Overlay a faint white radial gradient (glass surface)
5. Add a thin bright arc on one edge (specular highlight)
```

Verify: text under the magnifying glass looks slightly blurred, brighter, and larger. The glass feels like a physical object. Check FPS — if it drops below 50, cache the blurred region on an offscreen canvas and only re-render when the glass moves.

### Step 9: Caustic focal point

```
Replace the static radial gradient focal point with an animated caustic pattern.
Use layered sine waves or simplex noise to create a slowly dancing light pattern.
Small, intense, warm-white. Should look like sunlight passing through curved glass.
```

Verify: the focal point shimmers and dances subtly. It looks like focused sunlight.

---

## Phase 3 — Refinement

### Step 10: Paper texture

```
Add a subtle paper texture to the background. Can be procedural (noise-based)
or a tiling texture image. Keep it very subtle — it should feel like paper
without distracting from the text.
```

Verify: the background has a faint texture visible on zoom. Text readability is unaffected. The texture tiles seamlessly if image-based.

### Step 11: Performance

```
Profile with Chrome DevTools Performance tab.
- Ensure prepareWithSegments() is NOT called every frame (only on text change)
- If glass blur is expensive, render to offscreen canvas and cache
- Particle rendering should use save/restore sparingly
- Target: 60fps with 10+ scorch zones and 40+ active particles
```

Verify: burn 10+ spots across the paragraph with 40+ particles active. DevTools Performance tab shows consistent 60fps (no frames over 20ms).

### Step 12: Touch support

```
Map touch events to the same input system as mouse.
Single finger = magnifying glass position.
Touch-and-hold triggers the focus/burn sequence.
```

Verify: test on a mobile device or Chrome DevTools device emulation. Touch-and-hold burns text. The magnifying glass follows the finger.

### Step 13: Polish

```
- Add a heat shimmer effect near the active burn zone (subtle vertical distortion)
- Tune particle physics: adjust drift frequencies, deceleration, color curves
- Tune scorch growth rate and visual progression
- Add a subtle shadow under the magnifying glass
- Choose final paragraph text (thematic: about light, paper, entropy, or a classic specimen)
```

Verify: the overall demo feels cohesive and physical. Show it to someone who hasn't seen it before — do they immediately understand the metaphor without explanation?

---

## Troubleshooting

**Text doesn't reflow around scorch zones:** Check that `getAvailableWidth()` correctly intersects scorch zones with the current line's Y band. Log the width values per line to verify they're actually narrowing.

**Characters "pop" when they become particles:** The particle spawn position doesn't match the Pretext layout position. Log both positions and compare. The character's x position is the line's x offset plus the cumulative width of preceding characters on that line.

**FPS drops when glass moves:** The Canvas `filter` property forces a GPU readback. Cache the blurred region on an offscreen canvas and only update it when the glass position changes by more than a few pixels.

**Pretext layout is slow:** You're probably calling `prepareWithSegments()` every frame. It should only be called when the text string changes. `layoutNextLine()` is the fast path.
