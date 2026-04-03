// Magnifying glass rendering (lens blur, magnification, focal point, caustics)
// Uses Glass.png image with per-pixel lens effects inside the glass circle

import type { InputState } from './input';

// --- Image geometry constants ---
// These describe key positions within the 422x591 source PNG
const IMG_WIDTH = 422;
const IMG_HEIGHT = 591;
const IMG_LENS_CX = 280;  // lens circle center X in image coords
const IMG_LENS_CY = 115;  // lens circle center Y in image coords
const IMG_LENS_R = 95;    // lens radius in image coords
const IMG_ANCHOR_X = 195; // cursor anchor X (hand grip position)
const IMG_ANCHOR_Y = 430; // cursor anchor Y (hand grip position)

const DISPLAY_SCALE = 0.5; // scale the image to half size on screen — tune to taste

// Derived values
const GLASS_RADIUS = IMG_LENS_R * DISPLAY_SCALE; // exported for other modules

// Lens effect parameters
const MAGNIFICATION = 1.25;
const REFRACTION_STRENGTH = 0.15;
const ABERRATION_AMOUNT = 3;

// Load the PNG image
const glassImage = new Image();
glassImage.src = '/Glass.png';
let imageLoaded = false;
glassImage.onload = () => { imageLoaded = true; };

// Offscreen canvases for the lens effect
let srcCanvas: OffscreenCanvas | null = null;
let srcCtx: OffscreenCanvasRenderingContext2D | null = null;
let outCanvas: OffscreenCanvas | null = null;
let outCtx: OffscreenCanvasRenderingContext2D | null = null;
let blurCanvas: OffscreenCanvas | null = null;
let blurCtx: OffscreenCanvasRenderingContext2D | null = null;
let lastLensX = -1000;
let lastLensY = -1000;

let frameCount = 0;

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function ensureCanvases(size: number) {
  if (!srcCanvas || srcCanvas.width !== size) {
    srcCanvas = new OffscreenCanvas(size, size);
    srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    outCanvas = new OffscreenCanvas(size, size);
    outCtx = outCanvas.getContext('2d');
    blurCanvas = new OffscreenCanvas(size, size);
    blurCtx = blurCanvas.getContext('2d');
  }
}

function samplePixel(data: Uint8ClampedArray, w: number, h: number, fx: number, fy: number): [number, number, number, number] {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  const r = data[i00] * (1 - tx) * (1 - ty) + data[i10] * tx * (1 - ty) + data[i01] * (1 - tx) * ty + data[i11] * tx * ty;
  const g = data[i00 + 1] * (1 - tx) * (1 - ty) + data[i10 + 1] * tx * (1 - ty) + data[i01 + 1] * (1 - tx) * ty + data[i11 + 1] * tx * ty;
  const b = data[i00 + 2] * (1 - tx) * (1 - ty) + data[i10 + 2] * tx * (1 - ty) + data[i01 + 2] * (1 - tx) * ty + data[i11 + 2] * tx * ty;
  const a = data[i00 + 3] * (1 - tx) * (1 - ty) + data[i10 + 3] * tx * (1 - ty) + data[i01 + 3] * (1 - tx) * ty + data[i11 + 3] * tx * ty;

  return [r, g, b, a];
}

// Compute the lens center position from the cursor position
export function getLensCenter(mouseX: number, mouseY: number): { x: number; y: number } {
  return {
    x: mouseX + (IMG_LENS_CX - IMG_ANCHOR_X) * DISPLAY_SCALE,
    y: mouseY + (IMG_LENS_CY - IMG_ANCHOR_Y) * DISPLAY_SCALE,
  };
}

export function drawGlass(ctx: CanvasRenderingContext2D, input: InputState) {
  if (!input.isOverCanvas) return;

  const { mouseX, mouseY } = input;
  const dpr = devicePixelRatio;

  // Compute where the lens center is on screen
  const lens = getLensCenter(mouseX, mouseY);
  const lensCX = lens.x;
  const lensCY = lens.y;
  const lensR = GLASS_RADIUS;

  // --- Lens effect (displacement, blur, chromatic aberration) ---
  const diameter = lensR * 2;
  const bufferSize = Math.ceil(diameter * dpr);
  const center = bufferSize / 2;
  const radiusPx = lensR * dpr;
  ensureCanvases(bufferSize);

  if (srcCtx && outCtx && blurCtx) {
    const moved = Math.abs(lensCX - lastLensX) > 1 || Math.abs(lensCY - lastLensY) > 1;
    const isBurning = input.focusDuration > 0;

    if (moved || isBurning) {
      lastLensX = lensCX;
      lastLensY = lensCY;

      const srcX = Math.round((lensCX - lensR) * dpr);
      const srcY = Math.round((lensCY - lensR) * dpr);

      srcCtx.clearRect(0, 0, bufferSize, bufferSize);
      srcCtx.drawImage(
        ctx.canvas,
        srcX, srcY, bufferSize, bufferSize,
        0, 0, bufferSize, bufferSize
      );

      blurCtx.clearRect(0, 0, bufferSize, bufferSize);
      blurCtx.drawImage(srcCanvas!, 0, 0);
      blurCtx.filter = 'blur(6px) brightness(1.08) saturate(1.15)';
      blurCtx.drawImage(blurCanvas!, 0, 0);
      blurCtx.filter = 'none';

      const srcData = srcCtx.getImageData(0, 0, bufferSize, bufferSize);
      const blurData = blurCtx.getImageData(0, 0, bufferSize, bufferSize);
      const outData = outCtx.createImageData(bufferSize, bufferSize);
      const out = outData.data;

      for (let py = 0; py < bufferSize; py++) {
        for (let px = 0; px < bufferSize; px++) {
          const dx = px - center;
          const dy = py - center;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > radiusPx) {
            const idx = (py * bufferSize + px) * 4;
            out[idx + 3] = 0;
            continue;
          }

          const normalizedDist = dist / radiusPx;
          const edgeFactor = smoothStep(0.2, 1.0, normalizedDist);
          const displaceX = dx * REFRACTION_STRENGTH * edgeFactor;
          const displaceY = dy * REFRACTION_STRENGTH * edgeFactor;

          const magX = center + dx / MAGNIFICATION;
          const magY = center + dy / MAGNIFICATION;
          const baseX = magX - displaceX;
          const baseY = magY - displaceY;

          const aberration = ABERRATION_AMOUNT * dpr * edgeFactor;
          const dirX = dist > 0.001 ? dx / dist : 0;
          const dirY = dist > 0.001 ? dy / dist : 0;

          const [r] = samplePixel(srcData.data, bufferSize, bufferSize,
            baseX + dirX * aberration, baseY + dirY * aberration);
          const [, g] = samplePixel(srcData.data, bufferSize, bufferSize,
            baseX, baseY);
          const [, , b] = samplePixel(srcData.data, bufferSize, bufferSize,
            baseX - dirX * aberration, baseY - dirY * aberration);

          const blurMix = smoothStep(0.3, 0.9, normalizedDist);
          const [br, bg, bb] = samplePixel(blurData.data, bufferSize, bufferSize,
            baseX, baseY);

          const idx = (py * bufferSize + px) * 4;
          out[idx] = r * (1 - blurMix) + br * blurMix;
          out[idx + 1] = g * (1 - blurMix) + bg * blurMix;
          out[idx + 2] = b * (1 - blurMix) + bb * blurMix;

          const edgeAlpha = smoothStep(1.0, 0.95, normalizedDist);
          out[idx + 3] = 255 * edgeAlpha;
        }
      }

      outCtx.putImageData(outData, 0, 0);
    }

    // Draw lens effect within a circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(lensCX, lensCY, lensR - 1, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
      outCanvas!,
      0, 0, bufferSize, bufferSize,
      lensCX - lensR, lensCY - lensR,
      diameter, diameter
    );

    // Glass surface reflection
    const surfaceGradient = ctx.createRadialGradient(
      lensCX - lensR * 0.2, lensCY - lensR * 0.3, 0,
      lensCX, lensCY, lensR
    );
    surfaceGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    surfaceGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
    surfaceGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = surfaceGradient;
    ctx.fill();

    ctx.restore();
  }

  // --- Shadow under glass ---
  if (imageLoaded) {
    const shadowOffX = 6;
    const shadowOffY = 8;
    const shadowBlur = 20;
    const imgW = IMG_WIDTH * DISPLAY_SCALE;
    const imgH = IMG_HEIGHT * DISPLAY_SCALE;
    const imgX = mouseX - IMG_ANCHOR_X * DISPLAY_SCALE;
    const imgY = mouseY - IMG_ANCHOR_Y * DISPLAY_SCALE;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowOffX;
    ctx.shadowOffsetY = shadowOffY;
    ctx.drawImage(glassImage, imgX, imgY, imgW, imgH);
    ctx.restore();

    // Draw again without shadow on top (so shadow doesn't tint the image)
    ctx.drawImage(glassImage, imgX, imgY, imgW, imgH);
  }

  // --- Animated caustic focal point (renders at lens center) ---
  ctx.save();
  frameCount++;
  const time = frameCount * 0.03;
  const focalIntensity = Math.min(input.focusDuration / 30, 1);
  const baseAlpha = 0.2 + focalIntensity * 0.8;

  for (let i = 0; i < 5; i++) {
    const angle = time * (0.7 + i * 0.3) + i * Math.PI * 0.4;
    const dist = (2 + Math.sin(time * 1.1 + i * 2.0) * 3) * focalIntensity;
    const bx = lensCX + Math.cos(angle) * dist;
    const by = lensCY + Math.sin(angle) * dist;
    const blobRadius = 3 + Math.sin(time * 1.5 + i * 1.7) * 1.5 + focalIntensity * 3;

    const blobGradient = ctx.createRadialGradient(bx, by, 0, bx, by, blobRadius);
    const blobAlpha = baseAlpha * (0.4 + 0.6 * Math.sin(time * 2.0 + i * 1.3) * 0.5 + 0.5);
    blobGradient.addColorStop(0, `rgba(255, 252, 235, ${blobAlpha})`);
    blobGradient.addColorStop(0.4, `rgba(255, 230, 160, ${blobAlpha * 0.5})`);
    blobGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');

    ctx.beginPath();
    ctx.arc(bx, by, blobRadius, 0, Math.PI * 2);
    ctx.fillStyle = blobGradient;
    ctx.fill();
  }

  const coreRadius = 4 + focalIntensity * 2 + Math.sin(time * 3) * 0.5;
  const coreGradient = ctx.createRadialGradient(lensCX, lensCY, 0, lensCX, lensCY, coreRadius);
  coreGradient.addColorStop(0, `rgba(255, 255, 245, ${baseAlpha})`);
  coreGradient.addColorStop(0.5, `rgba(255, 240, 190, ${baseAlpha * 0.4})`);
  coreGradient.addColorStop(1, 'rgba(255, 220, 140, 0)');

  ctx.beginPath();
  ctx.arc(lensCX, lensCY, coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = coreGradient;
  ctx.fill();

  ctx.restore();
}

// How many frames of stillness before burning starts (~0.5s at 60fps)
export const BURN_THRESHOLD = 30;

export { GLASS_RADIUS };
