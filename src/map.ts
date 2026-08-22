import { TILE_H, TILE_W } from './constants';
import { cssColor, RAINBOW_COLORS, rainbowShade } from './palette';

/** 10×10 map of portal cells — Director's Cut / unused this pass. */
export const PORTAL_CELLS: [number, number][] = [
  [0, 0],
  [5, 0],
  [9, 0],
  [0, 5],
  [9, 5],
  [0, 9],
  [5, 9],
];

/** Ground tiles 0–6 match RAINBOW_COLORS (unused bake helpers this pass). */
export const TILE_WHITE = 7;
export const TILE_WALL = 8;

/**
 * Vein overlay — independent of TILE_W / TILE_H.
 *   VEIN_W / VEIN_H — stamp pixels (2:1 is 6×12)
 *   VEIN_WIDTH / VEIN_GAP — band thickness and spacing, in vein-cells
 *   VEIN_STEP_X / VEIN_STEP_Y — diagonal in vein-cell space
 */
export const VEIN_W = 6;
export const VEIN_H = 12;
const VEIN_ALPHA = 0.25;
const VEIN_WIDTH = 1;
const VEIN_GAP = 8;
const VEIN_STEP_X = 1;
const VEIN_STEP_Y = 1;
const VEIN_STRIDE = VEIN_WIDTH + VEIN_GAP;
const VEIN_PERIOD = VEIN_STRIDE * 7;

const veinCanvases: HTMLCanvasElement[] = [];

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Always white plaza ground. Veins are a separate overlay. */
export function getTile(_tx: number, _ty: number): number {
  return TILE_WHITE;
}

/** Centered solid box for this tile, or null if walkable. */
export function getTileSolid(
  _tx: number,
  _ty: number
): { x: number; y: number; w: number; h: number } | null {
  return null;
}

/** Lumpy plaza radius in tiles — Director's Cut / unused this pass. */
export function hubRadiusTiles(ang: number): number {
  return 9 * (1 + 0.14 * Math.sin(ang * 3) + 0.09 * Math.sin(ang * 5 + 0.8));
}

/** No-op: the live map is infinite white. Slice generation stays in git. */
export function generateMap(): void {}

export const tileCanvases: HTMLCanvasElement[] = [];
/** Palette state from before the current color wave. */
export const tileCanvasesPrev: HTMLCanvasElement[] = [];

/** Copy the live tile bakes so a wave can draw old + new palettes. */
export function snapshotTiles(): void {
  for (let tile = 0; tile < tileCanvases.length; tile++) {
    let canvas = tileCanvasesPrev[tile];
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = TILE_W;
      canvas.height = TILE_H;
      tileCanvasesPrev[tile] = canvas;
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(tileCanvases[tile], 0, 0);
  }
}

export function bakeTiles(): void {
  for (let tile = 0; tile <= TILE_WALL; tile++) {
    let canvas = tileCanvases[tile];
    if (!canvas) {
      canvas = document.createElement('canvas');
      tileCanvases[tile] = canvas;
    }
    canvas.width = TILE_W;
    canvas.height = TILE_H;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (tile === TILE_WALL) {
      paintWall(ctx);
    } else if (tile === TILE_WHITE) {
      paintGround(ctx, TILE_W, TILE_H, '#ffffff', '#cecece');
    } else {
      paintGround(
        ctx,
        TILE_W,
        TILE_H,
        cssColor(rainbowShade(tile, 0.8)),
        cssColor(RAINBOW_COLORS[tile])
      );
    }
  }
  for (let color = 0; color < 7; color++) {
    let canvas = veinCanvases[color];
    if (!canvas) {
      canvas = document.createElement('canvas');
      veinCanvases[color] = canvas;
    }
    canvas.width = VEIN_W;
    canvas.height = VEIN_H;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    paintGround(
      ctx,
      VEIN_W,
      VEIN_H,
      cssColor(rainbowShade(color, 0.8)),
      cssColor(RAINBOW_COLORS[color])
    );
  }
}

function getVein(vx: number, vy: number): number {
  const d =
    (((vx * VEIN_STEP_X + vy * VEIN_STEP_Y) % VEIN_PERIOD) + VEIN_PERIOD) % VEIN_PERIOD;
  if (d % VEIN_STRIDE < VEIN_WIDTH) {
    return (d / VEIN_STRIDE) | 0;
  }
  return -1;
}

/** Vein stamps on their own grid, drawn after white ground. */
export function drawVeins(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number
): void {
  const x0 = Math.floor(cameraX / VEIN_W);
  const y0 = Math.floor(cameraY / VEIN_H);
  const x1 = Math.floor((cameraX + viewWidth) / VEIN_W);
  const y1 = Math.floor((cameraY + viewHeight) / VEIN_H);
  ctx.globalAlpha = VEIN_ALPHA;
  for (let vy = y0; vy <= y1; vy++) {
    for (let vx = x0; vx <= x1; vx++) {
      const color = getVein(vx, vy);
      if (color < 0) {
        continue;
      }
      ctx.drawImage(
        veinCanvases[color],
        Math.floor(vx * VEIN_W - cameraX),
        Math.floor(vy * VEIN_H - cameraY)
      );
    }
  }
  ctx.globalAlpha = 1;
}

function paintGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fill: string,
  highlight: string
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = highlight;
  const random = mulberry32(7);
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(Math.floor(random() * w), Math.floor(random() * h), 2, 1);
  }
}

function paintWall(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#747474';
  ctx.fillRect(0, 0, TILE_W, TILE_H);
  ctx.fillStyle = '#cecece';
  const inset = 2;
  ctx.fillRect(inset, inset, TILE_W - inset * 2, TILE_H - inset * 2);
}
