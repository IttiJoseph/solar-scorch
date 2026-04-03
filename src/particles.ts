// Ember particle system (spawn, physics, lifecycle, rendering)

import { FONT } from './layout';

export interface Ember {
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  age: number;
  maxAge: number;
  seed: number; // unique value for varied sine-wave drift
}

const MAX_PARTICLES = 60;

// Spawn a new ember particle at the exact position a character was removed from
export function spawnEmber(embers: Ember[], char: string, x: number, y: number) {
  const ember: Ember = {
    char,
    x,
    y,
    vx: (Math.random() - 0.5) * 0.3, // slight initial horizontal scatter
    vy: -(1.8 + Math.random() * 1.8), // upward initial velocity
    rotation: (Math.random() - 0.5) * 0.4,
    rotationSpeed: (Math.random() - 0.5) * 0.08,
    age: 0,
    maxAge: 130 + Math.random() * 70, // ~2-3.3 seconds at 60fps
    seed: Math.random() * 1000,
  };

  // Cap particle count — recycle oldest
  if (embers.length >= MAX_PARTICLES) {
    embers.shift();
  }
  embers.push(ember);
}

// Update all particles for one frame
export function updateEmbers(embers: Ember[]) {
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.age++;

    // Remove dead particles
    if (e.age >= e.maxAge) {
      embers.splice(i, 1);
      continue;
    }

    // Vertical deceleration — rises fast, then floats, then ash drifts down
    const progress = e.age / e.maxAge;
    e.vy *= 0.98;
    if (progress > 0.7) {
      e.vy += 0.008; // gentle gravity pull on cooling ash
    }

    // Lateral sine-wave drift — three frequencies for organic motion
    const time = e.age * 0.05;
    e.vx = Math.sin(time * 1.3 + e.seed) * 0.45
         + Math.sin(time * 3.7 + e.seed * 2) * 0.18
         + Math.sin(time * 0.5 + e.seed * 0.7) * 0.25;

    // Apply velocity
    e.x += e.vx;
    e.y += e.vy;

    // Tumble — slows as ember cools
    e.rotation += e.rotationSpeed * (1 - progress * 0.5);
  }
}

// Color lifecycle: orange-yellow → red-orange → grey → fade
function getEmberColor(progress: number): { r: number; g: number; b: number; a: number } {
  // progress: 0 = just spawned, 1 = about to die
  if (progress < 0.3) {
    // Bright orange-yellow (combusting)
    const t = progress / 0.3;
    return {
      r: 255,
      g: Math.round(220 - t * 80),  // 220 → 140
      b: Math.round(50 - t * 30),   // 50 → 20
      a: 1,
    };
  } else if (progress < 0.6) {
    // Red-orange (cooling)
    const t = (progress - 0.3) / 0.3;
    return {
      r: Math.round(255 - t * 120), // 255 → 135
      g: Math.round(140 - t * 80),  // 140 → 60
      b: Math.round(20 + t * 30),   // 20 → 50
      a: 1,
    };
  } else if (progress < 0.85) {
    // Cooling to grey (ash)
    const t = (progress - 0.6) / 0.25;
    return {
      r: Math.round(135 - t * 35),  // 135 → 100
      g: Math.round(60 + t * 35),   // 60 → 95
      b: Math.round(50 + t * 45),   // 50 → 95
      a: 1,
    };
  } else {
    // Fade out
    const t = (progress - 0.85) / 0.15;
    return {
      r: 100,
      g: 95,
      b: 95,
      a: 1 - t,
    };
  }
}

// Draw all ember particles
export function drawEmbers(ctx: CanvasRenderingContext2D, embers: Ember[]) {
  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (const e of embers) {
    const progress = e.age / e.maxAge;
    const color = getEmberColor(progress);

    // Tumble effect: oscillating width scale simulates a flat flake turning
    const widthScale = 0.5 + 0.5 * Math.cos(e.age * 0.08 + e.seed);
    // Shrink slightly as it ages
    const sizeScale = 1 - progress * 0.3;

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rotation);
    ctx.scale(widthScale * sizeScale, sizeScale);
    ctx.globalAlpha = color.a;
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.fillText(e.char, 0, 0);
    ctx.restore();
  }

  // Reset text alignment for other drawing
  ctx.textAlign = 'start';
}
