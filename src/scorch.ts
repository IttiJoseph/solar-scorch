// Scorch zone state, growth, color progression

export interface ScorchZone {
  x: number;
  y: number;
  radius: number;
  intensity: number; // 0–1, controls color progression (yellow → brown → black)
}

export function createScorchZone(x: number, y: number): ScorchZone {
  return { x, y, radius: 10, intensity: 0.3 };
}

// Draw all scorch marks onto the canvas with realistic color progression
export function drawScorchZones(ctx: CanvasRenderingContext2D, zones: ScorchZone[]) {
  for (const zone of zones) {
    const { x, y, radius, intensity } = zone;

    // Outer yellow fringe (paper yellowing from heat)
    const outerGradient = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.4);
    outerGradient.addColorStop(0, `rgba(180, 140, 50, ${intensity * 0.3})`);
    outerGradient.addColorStop(0.5, `rgba(200, 170, 80, ${intensity * 0.2})`);
    outerGradient.addColorStop(1, 'rgba(210, 190, 120, 0)');

    ctx.beginPath();
    ctx.arc(x, y, radius * 1.4, 0, Math.PI * 2);
    ctx.fillStyle = outerGradient;
    ctx.fill();

    // Main scorch: dark center → brown edge
    const mainGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const coreAlpha = Math.min(intensity, 1);

    // Color shifts based on intensity:
    //   low intensity (0-0.4): yellow-brown
    //   mid intensity (0.4-0.7): deep brown
    //   high intensity (0.7-1.0): near-black
    if (intensity < 0.4) {
      const t = intensity / 0.4;
      mainGradient.addColorStop(0, `rgba(${100 - t * 40}, ${70 - t * 30}, ${20}, ${coreAlpha})`);
      mainGradient.addColorStop(0.5, `rgba(${140 - t * 40}, ${90 - t * 30}, ${30}, ${coreAlpha * 0.6})`);
      mainGradient.addColorStop(1, `rgba(160, 120, 50, 0)`);
    } else if (intensity < 0.7) {
      const t = (intensity - 0.4) / 0.3;
      mainGradient.addColorStop(0, `rgba(${60 - t * 30}, ${40 - t * 20}, ${20 - t * 10}, ${coreAlpha})`);
      mainGradient.addColorStop(0.4, `rgba(${80 - t * 20}, ${45 - t * 15}, ${15}, ${coreAlpha * 0.7})`);
      mainGradient.addColorStop(0.8, `rgba(120, 70, 30, ${coreAlpha * 0.3})`);
      mainGradient.addColorStop(1, 'rgba(150, 100, 40, 0)');
    } else {
      mainGradient.addColorStop(0, `rgba(25, 15, 8, ${coreAlpha})`);
      mainGradient.addColorStop(0.3, `rgba(45, 25, 12, ${coreAlpha * 0.85})`);
      mainGradient.addColorStop(0.6, `rgba(80, 40, 18, ${coreAlpha * 0.5})`);
      mainGradient.addColorStop(1, 'rgba(130, 80, 35, 0)');
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = mainGradient;
    ctx.fill();
  }
}

// Draw a yellowing "heat halo" under the focal point (before characters burn)
export function drawHeatHalo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  focalIntensity: number
) {
  if (focalIntensity <= 0) return;

  const haloRadius = 15 + focalIntensity * 10;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
  const alpha = focalIntensity * 0.25;
  gradient.addColorStop(0, `rgba(220, 190, 100, ${alpha})`);
  gradient.addColorStop(0.5, `rgba(210, 180, 90, ${alpha * 0.5})`);
  gradient.addColorStop(1, 'rgba(200, 170, 80, 0)');

  ctx.beginPath();
  ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

// Grow a scorch zone while the focal point is near it
export function growScorchZone(zone: ScorchZone) {
  zone.radius = Math.min(zone.radius + 0.15, 30);
  zone.intensity = Math.min(zone.intensity + 0.01, 1);
}
