# Solar Scorch — PRD

A Pretext.js demo where a magnifying glass focuses sunlight onto a paragraph of text, scorching the paper and causing characters to detach as rising ember particles while the remaining text reflows in real time.

---

## Concept

The user looks down at a page of text on a desk. A magnifying glass follows the cursor. When held over the text, a focused light cone tightens to a bright focal point, which begins to scorch the paper beneath it. Characters in the burn zone darken, detach from the paragraph, and float upward as glowing embers that cool into ash and fade. The remaining text continuously reflows around the growing scorch marks using Pretext's `layoutNextLine()` API.

The interaction is destructive and permanent — scorch marks accumulate, the paragraph progressively fragments, and the text fights to fill the shrinking available space.

---

## Why Pretext

This demo exercises Pretext's core differentiator: DOM-free text layout with per-line variable widths, recomputed every frame.

**APIs used:**

- `prepareWithSegments()` — one-time text preparation with segment-level data for manual layout
- `layoutNextLine()` — the main loop; lays out each line with a different available width based on which scorch zones intersect that line's vertical position
- `layoutWithLines()` — used for initial render and to compute character positions before detachment

**Pretext usage score: 8/10.** The reflow is structural (not cosmetic) — every frame, the paragraph layout is genuinely recomputed around the burn zones. The remaining 2 points would come from advanced features like mixed font sizes for heat-warped text near the burn zone.

---

## Interaction Model

### The Magnifying Glass

- Follows the cursor at all times
- Top-down perspective — user is looking down at a page on a desk
- Rendered as a circle with a handle angled to one side (~30° tilt)
- Inside the lens: iOS-style frosted glass effect (slight blur, brightness/saturation boost, faint white radial gradient for surface reflection, thin specular highlight arc on one edge)
- Text inside the lens appears slightly magnified (scale transform within circular clip)

### The Focal Point

- A small, bright, warm-white dot within the magnifying glass circle (not the full lens area)
- Animated caustic pattern — the dancing light effect of sunlight through curved glass
- This is where the actual burning happens
- The separation between the large lens area and the small focal point gives the user fine, deliberate control

### The Burn Sequence

1. **Hover** — Magnifying glass follows cursor. Light cone visible but diffuse. No damage.
2. **Focus** — When held still (or moving slowly), the light cone tightens visually toward the focal point. A brief "charging" moment (~0.5s).
3. **Scorch begins** — Paper under the focal point starts yellowing, then browning.
4. **Character detachment** — Characters at the hottest point darken to brown/amber, then detach from the paragraph and become ember particles.
5. **Reflow** — As characters are removed from the text string, Pretext recomputes the layout. Remaining text closes gaps and flows around the scorch zone.
6. **Continuous burn** — Hold the glass still and the damage radius slowly expands outward from the focal point.
7. **Trail** — Move the glass and it leaves a scorched trail behind.

### Permanence

- **No recovery.** Scorch marks and destroyed text are permanent.
- The permanence gives the interaction weight and creates the core visual tension: the paragraph desperately trying to reflow through increasingly fragmented space.
- Edges of burn zones may glow faintly for a short time (cooling embers), but the scorch itself never fades.

---

## Visual Design

### Rendering Stack (bottom to top, per frame)

1. **Paper background** — Warm off-white, subtle paper texture
2. **Scorch marks** — Permanent, accumulating dark burn marks on the paper surface. Darkened/browned areas with slightly irregular edges. Radial gradient at edges to suggest depth (darker at center, fading to brown at edges)
3. **Pretext-laid-out text** — The paragraph, recomputed every frame via `layoutNextLine()` with variable widths per line based on scorch zone intersections
4. **Magnifying glass lens** — Frosted glass circle with magnified text view inside
5. **Focal point** — Bright caustic shimmer within the lens
6. **Ember particles** — Character glyphs rising upward, tumbling, cooling, fading

### The Scorch Marks

- No burn-through / no visible background behind the holes
- Instead: a scorched trail on the paper surface
- Color progression of paper: off-white → yellow → brown → dark brown/black at center
- Slightly irregular edges (not perfect circles) for organic feel
- Rendered via Canvas compositing or radial gradients

### The Ember Particles

Each particle is a **text character glyph**, not a generic dot. The character that was destroyed is the particle that rises.

**Motion physics:**

- **Initial launch:** Fast upward velocity (`vy`), near-zero horizontal. Thermal updraft kicks the ember off the surface.
- **Turbulence / lateral drift:** Layered sine waves for organic horizontal wandering:
  ```
  x += sin(time * 1.3 + seed) * 0.5 + sin(time * 3.7 + seed * 2) * 0.2
  ```
  Two or three frequencies at different amplitudes. Unhurried, non-mechanical.
- **Vertical deceleration:** `vy *= 0.98` per frame. Rises fast initially, then floats lazily.
- **Tumble:** Slowly changing rotation angle + oscillating width scale (full width ↔ near-zero), simulating a flat ash flake turning edge-on and face-on to the viewer. Bright when face-on, nearly invisible edge-on.
- **Color progression (time-based):**
  - Bright orange-yellow (combusting)
  - Deep red-orange (cooling)
  - Dark grey (ash)
  - Opacity fade to nothing
  - Color shift and opacity fade happen on **different timelines** — the ember goes grey before it disappears, like real ash.
- **Lifecycle:** ~2–3 seconds per particle.
- **Particle count:** ~30–60 active at a time. Very cheap.

**Particle data structure:**
```
{ char, x, y, vx, vy, rotation, rotationSpeed, age, maxAge, seed }
```

Each particle renders with `ctx.fillText()` of a single character with per-frame transforms (color, opacity, rotation, scale). No sprites needed.

### The Magnifying Glass

- Circle + angled handle (simple geometric rendering)
- Lens interior: blur the underlying content within the circular clip, boost brightness/saturation, overlay faint white radial gradient, add thin bright arc on one edge (specular highlight)
- Canvas implementation: copy pixels under lens → apply `ctx.filter = 'blur(4px) saturate(1.2) brightness(1.1)'` → draw back at slight scale-up → overlay gradient
- Focal point: small radial gradient (warm white center → transparent), with animated caustic noise pattern

---

## Technical Architecture

### Technology

- **Pretext** (`@chenglou/pretext`) — text measurement and layout
- **Canvas 2D** — all rendering (no DOM elements for text, no WebGL)
- **Vanilla JS/TS** — no framework needed
- **Vite** — dev server and build

### Rendering Pipeline (per frame)

```
1. Clear canvas
2. Draw paper background
3. Draw accumulated scorch marks (permanent layer)
4. Compute scorch exclusion zones
5. Recompute text layout via Pretext layoutNextLine() with variable widths
6. Draw text lines with ctx.fillText()
7. Apply scorch zone compositing over text (yellowing/browning near zones)
8. Draw magnifying glass lens (clip + blur + magnify + overlay)
9. Draw focal point with caustic animation
10. Update and draw ember particles
```

### Text Layout Loop (Pretext core)

```javascript
const prepared = prepareWithSegments(text, font)

// Each frame:
let cursor = { segmentIndex: 0, graphemeIndex: 0 }
let y = 0

while (true) {
  // Calculate available width for this line based on scorch zone intersections
  const width = getAvailableWidth(y, lineHeight, scorchZones, columnWidth)
  const line = layoutNextLine(prepared, cursor, width)
  if (line === null) break

  ctx.fillText(line.text, getLineX(y, scorchZones), y)
  cursor = line.end
  y += lineHeight
}
```

The `getAvailableWidth()` function checks which scorch zones intersect the current line's vertical band and returns the remaining horizontal space. This is the same mechanic as Pretext's README example of flowing text around a floated image — but with multiple, irregularly placed exclusion zones that grow over time.

### Critical Transition: Layout-Managed → Physics-Managed

When a character is "hit" by the focal point:

1. **Snapshot** its current position from the Pretext layout (line position + character offset within line)
2. **Remove** it from the text string fed to Pretext (so reflow closes around it next frame)
3. **Add** a scorch mark at its position
4. **Spawn** an ember particle at the exact same position with initial upward velocity

The position match between step 1 and step 4 must be exact — any jump or pop breaks the illusion. This is the make-or-break detail to prototype early.

### State Management

```javascript
state = {
  // Text state
  text: string,              // Current text (characters removed as they burn)
  prepared: PreparedText,    // Re-prepared when text changes

  // Scorch state
  scorchZones: Array<{
    x: number,
    y: number,
    radius: number,          // Grows while focal point is nearby
    intensity: number        // Controls color (yellow → brown → black)
  }>,

  // Particle state
  embers: Array<{
    char: string,
    x: number, y: number,
    vx: number, vy: number,
    rotation: number,
    rotationSpeed: number,
    age: number,
    maxAge: number,
    seed: number
  }>,

  // Interaction state
  mouseX: number,
  mouseY: number,
  focusDuration: number,     // How long the glass has been ~still
  focalIntensity: number     // Ramps up with focusDuration
}
```

### Performance Considerations

- `prepareWithSegments()` should be called only when the text string actually changes (character removal), not every frame
- `layoutNextLine()` is called every frame (this is the cheap hot path — pure arithmetic, ~0.001ms per call)
- Scorch zone intersection tests are simple circle-vs-horizontal-band checks
- Ember particle count capped at ~60; old particles recycled
- Canvas filter for glass blur effect may need optimization — consider pre-rendering the blurred region to an offscreen canvas if frame rate drops

---

## Content

### Default Text

A medium-length paragraph (150–250 words) with varied word lengths and natural rhythm. The content itself can be thematic — something about light, paper, permanence, or entropy. Or it can be a classic typographic specimen passage. The text should be long enough that the reflow behavior is clearly visible as scorch zones fragment the layout.

### Typography

- A clean serif or sans-serif font (e.g., Inter, Georgia, or a variable-weight font for future heat-warp effects)
- ~18px font size, ~26px line height
- Dark text on warm off-white paper

---

## Scope and Phases

### Phase 1 — Core Loop
- Canvas setup with paper background
- Pretext text layout rendering (static, no interaction)
- Magnifying glass following cursor (circle + handle, no glass effect yet)
- Focal point rendering (simple bright dot)
- Character removal on burn → text reflow via `layoutNextLine()`
- Basic scorch marks (dark circles)

### Phase 2 — Physics and Polish
- Ember particle system (character glyphs, full motion physics, color lifecycle)
- Scorch mark visual refinement (color progression, irregular edges, radial gradients)
- Frosted glass lens effect (blur, brightness, magnification)
- Caustic focal point animation
- Focus charging mechanic (brief delay before burn starts)
- Scorch radius expansion when glass is held still

### Phase 3 — Refinement
- Paper texture background
- Specular highlight on lens edge
- Smoke/heat shimmer near active burn zone (subtle)
- Performance optimization (offscreen canvas for glass blur, particle recycling)
- Mobile/touch support (finger = magnifying glass)
- Sound design (optional — faint crackling, paper burning)

---

## Success Criteria

1. **Reflow is structural, not cosmetic.** The text genuinely recomputes its layout around scorch zones every frame via Pretext. This is not a CSS mask or visual trick.
2. **The transition from layout to particle is seamless.** No visible jump when a character detaches from the paragraph and becomes an ember.
3. **It feels physical.** The paper, the glass, the light, the fire — each element behaves in a way that maps to real-world intuition.
4. **60fps on modern hardware.** The Pretext layout loop and Canvas rendering stay within frame budget.
5. **It showcases Pretext's unique capability.** This demo could not be built (at this performance level) with DOM-based text layout.
