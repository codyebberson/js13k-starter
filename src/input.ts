const downKeys = new Set<string>();
const pressedKeys = new Set<string>();

export const mouse = {
  x: 0,
  y: 0,
  clicked: false,
};

/** Analog move from the on-screen stick, -1..1. */
export let stickX = 0;
export let stickY = 0;

const STICK_R = 28;
const KNOB_R = 10;
const STICK_PAD = 14;
const DEAD = 0.15;

let viewW = 1;
let viewH = 1;
let touchSeen = false;
let stickId = -1;
let stickEnabled = false;

export function setViewSize(width: number, height: number): void {
  viewW = width;
  viewH = height;
}

/** Capture analog move only during a live run (not title / menus). */
export function setStickEnabled(on: boolean): void {
  stickEnabled = on;
  if (!on) {
    resetStick();
  }
}

function stickCenter(): { x: number; y: number } {
  return { x: viewW / 2, y: viewH - STICK_PAD - STICK_R };
}

function clientToView(canvas: HTMLCanvasElement, clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((clientY - rect.top) / rect.height) * canvas.height;
}

function setStickFrom(x: number, y: number): void {
  const c = stickCenter();
  let dx = x - c.x;
  let dy = y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist > STICK_R && dist > 0.01) {
    dx = (dx / dist) * STICK_R;
    dy = (dy / dist) * STICK_R;
  }
  const nx = dx / STICK_R;
  const ny = dy / STICK_R;
  const mag = Math.hypot(nx, ny);
  if (mag < DEAD) {
    stickX = 0;
    stickY = 0;
    return;
  }
  stickX = nx;
  stickY = ny;
}

function resetStick(): void {
  stickId = -1;
  stickX = 0;
  stickY = 0;
}

export function initInput(canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', (event) => {
    if (!event.repeat) {
      pressedKeys.add(event.code);
    }
    downKeys.add(event.code);
    if (event.code.startsWith('Arrow') || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    downKeys.delete(event.code);
  });

  const syncMouse = (event: MouseEvent): void => {
    clientToView(canvas, event.clientX, event.clientY);
  };
  canvas.addEventListener('mousemove', syncMouse);
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      syncMouse(event);
      mouse.clicked = true;
    }
  });

  canvas.addEventListener(
    'touchstart',
    (event) => {
      event.preventDefault();
      touchSeen = true;
      const t = event.changedTouches[0];
      clientToView(canvas, t.clientX, t.clientY);
      mouse.clicked = true;
      if (stickEnabled && stickId < 0) {
        stickId = t.identifier;
        setStickFrom(mouse.x, mouse.y);
      }
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault();
      for (let i = 0; i < event.changedTouches.length; i++) {
        const t = event.changedTouches[i];
        if (t.identifier === stickId) {
          clientToView(canvas, t.clientX, t.clientY);
          setStickFrom(mouse.x, mouse.y);
        }
      }
    },
    { passive: false }
  );
  const endTouch = (event: TouchEvent): void => {
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === stickId) {
        resetStick();
      }
    }
  };
  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });
}

export function isDown(code: string): boolean {
  return downKeys.has(code);
}

/** True only on the first frame after the key went down. */
export function wasPressed(code: string): boolean {
  return pressedKeys.has(code);
}

/** True if any key went down this frame (cutscene advance/skip). */
export function anyKeyPressed(): boolean {
  return pressedKeys.size > 0;
}

/** Draw the virtual stick; hidden until the first touch, in-run only. */
export function drawStick(ctx: CanvasRenderingContext2D, inRun: boolean): void {
  if (!inRun || !touchSeen) {
    return;
  }
  const c = stickCenter();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(c.x, c.y, STICK_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(c.x + 0.5, c.y + 0.5, STICK_R - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(c.x + stickX * STICK_R, c.y + stickY * STICK_R, KNOB_R, 0, Math.PI * 2);
  ctx.fill();
}

/** Call once at the end of every frame. */
export function clearPressedKeys(): void {
  pressedKeys.clear();
  mouse.clicked = false;
}
