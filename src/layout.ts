// Pretext integration, reflow logic, exclusion zone width calculation

import {
  prepareWithSegments,
  layoutNextLine,
  layoutWithLines,
  type PreparedTextWithSegments,
  type LayoutCursor,
  type LayoutLine,
} from '@chenglou/pretext';
import type { ScorchZone } from './scorch';

export type { PreparedTextWithSegments, LayoutCursor, LayoutLine };

export const FONT = '18px system-ui, -apple-system, sans-serif';
export const LINE_HEIGHT = 26;
export const TEXT_COLOR = '#2A2A2A';
export const PAPER_COLOR = '#FAF6F0';

// Padding around the text area
export const PADDING = 60;

export const DEFAULT_TEXT =
  'Light has a patience that borders on cruelty. It will wait for the glass to ' +
  'steady, for the angle to sharpen, for the focal point to tighten into a white-hot ' +
  'needle. Paper does not know it is being watched. The fibers go about their quiet ' +
  'business of holding ink and memory, unaware that a single point of concentrated ' +
  'sunlight is about to undo centuries of craftsmanship. First comes the yellowing — ' +
  'a faint blush of heat that could almost be mistaken for age. Then the browning, ' +
  'deeper and more insistent, as cellulose begins its slow surrender. And then, in an ' +
  'instant so brief it barely registers, the char. A perfect black circle eating ' +
  'through the page. The words around it scramble and reflow, desperately trying to ' +
  'maintain meaning as their world literally burns away beneath them. Letters crowd ' +
  'together, sentences compress, paragraphs reshape themselves around the growing void. ' +
  'But light is patient, and the glass is steady, and the burning has only just begun.';

// Prepare text for layout (expensive — only call when text changes)
export function prepareText(text: string): PreparedTextWithSegments {
  return prepareWithSegments(text, FONT);
}

// Lay out all text at a fixed width (used for initial/simple rendering)
export function layoutAllLines(prepared: PreparedTextWithSegments, maxWidth: number) {
  return layoutWithLines(prepared, maxWidth, LINE_HEIGHT);
}

// Calculate available width for a line at a given Y position,
// accounting for scorch zones that intersect the line's vertical band.
// For simplicity in Phase 1, we reduce the overall line width by the widest
// scorch zone that overlaps this line band. (Phase 2+ could do proper left/right gaps.)
export function getAvailableWidth(
  lineY: number,
  columnWidth: number,
  scorchZones: ScorchZone[],
  paddingX: number
): { width: number; offsetX: number } {
  let totalReduction = 0;
  let leftMost = Infinity;

  for (const zone of scorchZones) {
    // Check if this scorch zone's circle intersects the line's Y band [lineY, lineY + LINE_HEIGHT]
    // The zone circle has center (zone.x, zone.y) and radius zone.radius
    const closestY = Math.max(lineY, Math.min(zone.y, lineY + LINE_HEIGHT));
    const dy = zone.y - closestY;
    if (Math.abs(dy) >= zone.radius) continue;

    // The zone intersects this line. Calculate the horizontal span of the intersection.
    const halfChord = Math.sqrt(zone.radius * zone.radius - dy * dy);
    const zoneLeft = zone.x - halfChord;
    const zoneRight = zone.x + halfChord;

    // Clamp to text column
    const clampedLeft = Math.max(paddingX, zoneLeft);
    const clampedRight = Math.min(paddingX + columnWidth, zoneRight);
    const overlap = Math.max(0, clampedRight - clampedLeft);

    totalReduction += overlap;
    if (zoneLeft < leftMost) leftMost = zoneLeft;
  }

  // Simple approach: reduce the available width. Text will be left-aligned.
  const width = Math.max(20, columnWidth - totalReduction);
  return { width, offsetX: 0 };
}

// Lay out text line by line with variable widths (used when scorch zones exist)
export function layoutLines(
  prepared: PreparedTextWithSegments,
  columnWidth: number,
  scorchZones: ScorchZone[],
  paddingX: number,
  paddingY: number
): Array<{ text: string; width: number; x: number; y: number; start: LayoutCursor; end: LayoutCursor }> {
  const lines: Array<{ text: string; width: number; x: number; y: number; start: LayoutCursor; end: LayoutCursor }> = [];
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  let y = paddingY;

  while (true) {
    const { width: availableWidth } = getAvailableWidth(y, columnWidth, scorchZones, paddingX);
    if (availableWidth <= 0) {
      y += LINE_HEIGHT;
      if (y > 5000) break;
      continue;
    }
    const line = layoutNextLine(prepared, cursor, availableWidth);
    if (line === null) break;
    lines.push({
      text: line.text,
      width: line.width,
      x: paddingX,
      y,
      start: line.start,
      end: line.end,
    });
    cursor = line.end;
    y += LINE_HEIGHT;
  }

  return lines;
}
