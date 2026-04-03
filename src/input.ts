// Mouse/touch tracking, focus duration, burn triggering

export interface InputState {
  mouseX: number;
  mouseY: number;
  prevMouseX: number;
  prevMouseY: number;
  focusDuration: number; // frames the mouse has been roughly still
  isOverCanvas: boolean;
}

export function createInputState(): InputState {
  return {
    mouseX: -1000,
    mouseY: -1000,
    prevMouseX: -1000,
    prevMouseY: -1000,
    focusDuration: 0,
    isOverCanvas: false,
  };
}

const STILL_THRESHOLD = 3; // pixels — movement under this counts as "still"

export function setupInputListeners(canvas: HTMLCanvasElement, input: InputState) {
  canvas.style.cursor = 'none';

  canvas.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    input.isOverCanvas = true;
  });

  canvas.addEventListener('mouseleave', () => {
    input.isOverCanvas = false;
  });

  canvas.addEventListener('mouseenter', () => {
    input.isOverCanvas = true;
  });
}

// Call once per frame to update focus duration
export function updateFocus(input: InputState) {
  const dx = input.mouseX - input.prevMouseX;
  const dy = input.mouseY - input.prevMouseY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < STILL_THRESHOLD) {
    input.focusDuration++;
  } else {
    input.focusDuration = 0;
  }

  input.prevMouseX = input.mouseX;
  input.prevMouseY = input.mouseY;
}
