// Render loop, state management, canvas setup

import {
  prepareText,
  layoutLines,
  FONT,
  LINE_HEIGHT,
  TEXT_COLOR,
  PAPER_COLOR,
  PADDING,
  DEFAULT_TEXT,
  type PreparedTextWithSegments,
} from './layout';
import { createInputState, setupInputListeners, updateFocus, type InputState } from './input';
import { drawGlass, getLensCenter, BURN_THRESHOLD } from './glass';
import { drawScorchZones, drawHeatHalo, createScorchZone, growScorchZone, type ScorchZone } from './scorch';
import { spawnEmber, updateEmbers, drawEmbers, type Ember } from './particles';

// --- State ---

interface State {
  text: string;
  prepared: PreparedTextWithSegments;
  canvasWidth: number;
  canvasHeight: number;
  input: InputState;
  scorchZones: ScorchZone[];
  embers: Ember[];
  pendingBurns: Array<{ charIndex: number; x: number; y: number; char: string }>;
  batchTimer: number;
  // Cached layout
  layoutDirty: boolean;
  cachedLines: Array<{ text: string; width: number; x: number; y: number }>;
  linePositions: Array<{ text: string; x: number; y: number; width: number }>;
  lineCharOffsets: number[];
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function createState(): State {
  const text = DEFAULT_TEXT;
  const prepared = prepareText(text);
  return {
    text,
    prepared,
    canvasWidth: window.innerWidth,
    canvasHeight: window.innerHeight,
    input: createInputState(),
    scorchZones: [],
    embers: [],
    pendingBurns: [],
    batchTimer: 0,
    layoutDirty: true,
    cachedLines: [],
    linePositions: [],
    lineCharOffsets: [],
  };
}

const state = createState();
setupInputListeners(canvas, state.input);

// --- Paper texture ---

let paperCanvas: OffscreenCanvas | null = null;

function generatePaperTexture(w: number, h: number) {
  const dpr = devicePixelRatio;
  const pw = Math.ceil(w * dpr);
  const ph = Math.ceil(h * dpr);
  paperCanvas = new OffscreenCanvas(pw, ph);
  const pCtx = paperCanvas.getContext('2d')!;

  // Base fill
  pCtx.fillStyle = PAPER_COLOR;
  pCtx.fillRect(0, 0, pw, ph);

  // Per-pixel grain noise
  const imageData = pCtx.getImageData(0, 0, pw, ph);
  const data = imageData.data;
  // Parse base color for blending
  const baseR = 250, baseG = 246, baseB = 240; // #FAF6F0

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8; // ±4 variation
    data[i] = Math.max(0, Math.min(255, baseR + noise));
    data[i + 1] = Math.max(0, Math.min(255, baseG + noise));
    data[i + 2] = Math.max(0, Math.min(255, baseB + noise * 0.8)); // slightly less blue variation
    // alpha stays 255
  }

  pCtx.putImageData(imageData, 0, 0);

  // A few faint fiber blotches
  for (let i = 0; i < 12; i++) {
    const bx = Math.random() * pw;
    const by = Math.random() * ph;
    const br = 30 + Math.random() * 60;
    const grad = pCtx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, 'rgba(235, 228, 215, 0.15)');
    grad.addColorStop(1, 'rgba(235, 228, 215, 0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
}

// --- Canvas setup ---

function resize() {
  const dpr = devicePixelRatio;
  state.canvasWidth = window.innerWidth;
  state.canvasHeight = window.innerHeight;
  canvas.width = state.canvasWidth * dpr;
  canvas.height = state.canvasHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  generatePaperTexture(state.canvasWidth, state.canvasHeight);
  state.layoutDirty = true;
}

resize();
window.addEventListener('resize', resize);

// --- Character hit testing ---

// Find the character index in the full text string at a given (px, py) position
function findCharAtPosition(px: number, py: number): { charIndex: number; x: number; y: number } | null {
  const { linePositions, lineCharOffsets } = state;

  for (let li = 0; li < linePositions.length; li++) {
    const line = linePositions[li];
    // Check if py is within this line's vertical band
    if (py < line.y || py > line.y + LINE_HEIGHT) continue;
    if (px < line.x) continue;

    // Measure character positions within the line to find which character was hit
    ctx.font = FONT;
    let charX = line.x;
    const charOffset = lineCharOffsets[li];

    for (let i = 0; i < line.text.length; i++) {
      const charWidth = ctx.measureText(line.text[i]).width;
      if (px >= charX && px < charX + charWidth) {
        return {
          charIndex: charOffset + i,
          x: charX + charWidth / 2,
          y: line.y + LINE_HEIGHT / 2,
        };
      }
      charX += charWidth;
    }
  }

  return null;
}

// --- Burn logic ---

const BURN_RADIUS = 12;
// How many frames between reflows. 30 = ~0.5s at 60fps. Tweak this!
const BATCH_INTERVAL = 10;

function tryBurn() {
  const { input } = state;
  if (input.focusDuration < BURN_THRESHOLD) return;

  // Only burn every few frames to control speed
  if (input.focusDuration % 4 !== 0) return;

  // Burn at the lens center, not the cursor (hand) position
  const lens = getLensCenter(input.mouseX, input.mouseY);
  const fx = lens.x;
  const fy = lens.y;

  // Find characters near the focal point
  const hit = findCharAtPosition(fx, fy);
  if (!hit) return;

  // Check distance from focal point
  const dx = hit.x - fx;
  const dy = hit.y - fy;
  if (Math.sqrt(dx * dx + dy * dy) > BURN_RADIUS) return;

  // Don't burn whitespace
  if (state.text[hit.charIndex] === ' ') return;

  // Skip if this character is already pending removal
  if (state.pendingBurns.some(b => b.charIndex === hit.charIndex)) return;

  // Queue the burn — scorch mark appears now, but text reflows later
  state.scorchZones.push(createScorchZone(hit.x, hit.y));
  state.pendingBurns.push({ charIndex: hit.charIndex, x: hit.x, y: hit.y, char: state.text[hit.charIndex] });
}

// Remove all pending characters at once and re-prepare the text
function flushBurns() {
  if (state.pendingBurns.length === 0) return;

  // Sort by charIndex descending so removing from the end first doesn't shift earlier indices
  const sorted = [...state.pendingBurns].sort((a, b) => b.charIndex - a.charIndex);

  let text = state.text;
  for (const burn of sorted) {
    text = text.slice(0, burn.charIndex) + text.slice(burn.charIndex + 1);
  }

  // Spawn ember particles for each burned character
  for (const burn of state.pendingBurns) {
    spawnEmber(state.embers, burn.char, burn.x, burn.y);
  }

  state.text = text;
  state.prepared = prepareText(state.text);
  state.pendingBurns = [];
  state.layoutDirty = true;
}

// --- Render ---

function render() {
  const { canvasWidth, canvasHeight, prepared, input, scorchZones } = state;

  // Update input state
  updateFocus(input);

  // Try to burn characters
  tryBurn();

  // Flush pending burns in batches for smoother reflow
  state.batchTimer++;
  if (state.batchTimer >= BATCH_INTERVAL) {
    flushBurns();
    state.batchTimer = 0;
  }

  // Grow scorch zones near the focal point (lens center)
  const lens = getLensCenter(input.mouseX, input.mouseY);
  for (const zone of scorchZones) {
    const dx = zone.x - lens.x;
    const dy = zone.y - lens.y;
    if (Math.sqrt(dx * dx + dy * dy) < 40 && input.focusDuration > BURN_THRESHOLD) {
      growScorchZone(zone);
      state.layoutDirty = true;
    }
  }

  // 1. Draw paper background (textured)
  if (paperCanvas) {
    ctx.drawImage(paperCanvas, 0, 0, canvasWidth, canvasHeight);
  } else {
    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 2. Draw accumulated scorch marks
  drawScorchZones(ctx, scorchZones);

  // 2b. Draw heat halo under focal point (paper yellowing before burn)
  const focalIntensity = Math.min(input.focusDuration / 30, 1);
  if (input.isOverCanvas && focalIntensity > 0) {
    drawHeatHalo(ctx, lens.x, lens.y, focalIntensity);
  }

  // 3. Lay out text with variable widths around scorch zones (cached when clean)
  const columnWidth = canvasWidth - PADDING * 2;
  if (columnWidth <= 0) {
    requestAnimationFrame(render);
    return;
  }

  if (state.layoutDirty) {
    const lines = layoutLines(prepared, columnWidth, scorchZones, PADDING, PADDING);
    state.cachedLines = lines.map(l => ({ text: l.text, width: l.width, x: l.x, y: l.y }));

    state.linePositions = [];
    state.lineCharOffsets = [];
    let charOffset = 0;
    for (const line of state.cachedLines) {
      state.linePositions.push({ text: line.text, x: line.x, y: line.y, width: line.width });
      state.lineCharOffsets.push(charOffset);
      charOffset += line.text.length;
    }
    state.layoutDirty = false;
  }

  // 4. Draw each line
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = FONT;
  ctx.textBaseline = 'top';

  for (const line of state.cachedLines) {
    ctx.fillText(line.text, line.x, line.y);
  }

  // 5. Draw magnifying glass
  drawGlass(ctx, input);

  // 6. Update and draw ember particles
  updateEmbers(state.embers);
  drawEmbers(ctx, state.embers);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
