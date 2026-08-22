import { MAP_HEIGHT, MAP_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH, TILE_SIZE } from '../constants';
import { getTile, hubRadiusTiles, PORTAL_CELLS, TILE_WALL, TILE_WHITE } from '../map';
import { BLUE, GREEN, ORANGE, RAINBOW_COLORS, VIOLET } from '../palette';
import { createSprite } from '../sprites';

export interface HitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PipePiece {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  /** Collision boxes. Straights/caps use the sprite AABB. */
  hits?: HitBox[];
}

export const pipePieces: PipePiece[] = [];
export const portals: PipePiece[] = [];
/** Bit i set = edge portal i is gone (removed when that pipe is destroyed). */
export let portalsGone = 0;

function hidePipePortal(color: number): void {
  portalsGone |= 1 << color;
}
/** Pieces per color (portal stub + plaza run). Same objects as `pipePieces`. */
export const pipeRuns: PipePiece[][] = [];
/** Remaining HP for the 7 edge portals. Plaza portal is not in this list. */
export const portalHp: number[] = [];
export const PORTAL_MAX_HP = 100;
/** Plaza-side cap center per color — cutscene drain origin. */
export const drainCaps: { x: number; y: number }[] = [];

let slainPortal: { color: number; x: number; y: number } | null = null;

export function takeSlainPortal(): { color: number; x: number; y: number } | null {
  const slain = slainPortal;
  slainPortal = null;
  return slain;
}

/** 12×23 AABB, or null if that edge portal is gone. */
export function portalHitbox(i: number): HitBox | null {
  if (i >= 7 || portalsGone & (1 << i)) {
    return null;
  }
  const p = portals[i];
  return { x: p.x, y: p.y, w: PORTAL_W, h: PORTAL_H };
}

/** True if this hit killed the portal. Damage numbers are the caller's job. */
export function damagePortal(i: number, amount: number): boolean {
  const box = portalHitbox(i);
  if (!box || amount <= 0 || portalHp[i] <= 0) {
    return false;
  }
  portalHp[i] -= amount;
  if (portalHp[i] > 0) {
    return false;
  }
  portalHp[i] = 0;
  slainPortal = { color: i, x: box.x + box.w / 2, y: box.y + box.h / 2 };
  return true;
}

/** Remove every segment of a color (stub + debris) and hide its edge portal. */
export function destroyPipe(color: number): void {
  hidePipePortal(color);
  const run = pipeRuns[color];
  if (!run) {
    return;
  }
  for (let i = pipePieces.length - 1; i >= 0; i--) {
    if (run.indexOf(pipePieces[i]) >= 0) {
      pipePieces.splice(i, 1);
    }
  }
  run.length = 0;
}

let currentRun: PipePiece[] = [];

const DIR_E = 0;
const DIR_N = 1;
const DIR_W = 2;
const DIR_S = 3;

const WORLD_W = MAP_WIDTH * TILE_SIZE;
const WORLD_H = MAP_HEIGHT * TILE_SIZE;
const CENTER_X = WORLD_W / 2;
const CENTER_Y = WORLD_H / 2;

const CAP = { x: 12, y: 29, w: 5, h: 8 };
const STRAIGHT = { x: 17, y: 29, w: 9, h: 6 };
const PORTAL = { x: 0, y: 19, w: 12, h: 23 };
const PORTAL_W = 12;
const PORTAL_H = 23;
const PIPE_H = 6;

/** Horizontal straight end-to-end with 1px outline overlap. */
const ADVANCE = 8;
const PORT = 2.5;
const STUB_STRAIGHTS = 3;
const RUN_MIN = 3;
const RUN_MAX = 6;
/** Extra run just outside the hub so spawn camera sees capped pipes. */
const PLAZA_RING = 24;

/** Authored stripe / cap-dot on the sheet; remapped per pipe to a rainbow color. */
const PIPE_STRIPE = 0xb1b1b1;

interface PipeKit {
  straightH: HTMLCanvasElement;
  straightV: HTMLCanvasElement;
  caps: HTMLCanvasElement[];
}

const kits: PipeKit[] = [];

/** Colorless twin (stripe left `b1b1b1`) of every colored kit canvas. */
const greyTwin = new Map<HTMLCanvasElement, HTMLCanvasElement>();

let portalSprite: HTMLCanvasElement;

let straightH: HTMLCanvasElement;
let straightV: HTMLCanvasElement;
/** caps[dir] — long border against the pipe. */
let caps: HTMLCanvasElement[];

function opposite(dir: number): number {
  return (dir + 2) % 4;
}

function pipeSprite(
  atlas: { x: number; y: number; w: number; h: number },
  flipH: boolean,
  flipV: boolean,
  rot90: number,
  color: number
): HTMLCanvasElement {
  return createSprite(
    atlas.x,
    atlas.y,
    atlas.w,
    atlas.h,
    flipH,
    flipV,
    rot90,
    PIPE_STRIPE,
    color,
    0,
    true
  );
}

function bakeKit(color: number): PipeKit {
  const kitCaps: HTMLCanvasElement[] = [];
  kitCaps[DIR_E] = pipeSprite(CAP, true, false, 0, color);
  kitCaps[DIR_W] = pipeSprite(CAP, false, false, 0, color);
  kitCaps[DIR_N] = pipeSprite(CAP, true, false, 1, color);
  kitCaps[DIR_S] = pipeSprite(CAP, false, false, 1, color);
  return {
    straightH: pipeSprite(STRAIGHT, false, false, 0, color),
    straightV: pipeSprite(STRAIGHT, false, false, 1, color),
    caps: kitCaps,
  };
}

function kitCanvasList(kit: PipeKit): HTMLCanvasElement[] {
  return [kit.straightH, kit.straightV, ...kit.caps];
}

/** The colorless twin of a pipe canvas (cutscene pipes before they activate). */
export function greyPipeCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  return greyTwin.get(canvas) ?? canvas;
}

function bakePieces(): void {
  if (!kits.length) {
    for (let i = 0; i < 7; i++) {
      kits.push(bakeKit(RAINBOW_COLORS[i]));
    }
    const greyList = kitCanvasList(bakeKit(PIPE_STRIPE));
    for (const kit of kits) {
      const canvases = kitCanvasList(kit);
      for (let i = 0; i < canvases.length; i++) {
        greyTwin.set(canvases[i], greyList[i]);
      }
    }
  }
  if (!portalSprite) {
    portalSprite = createSprite(PORTAL.x, PORTAL.y, PORTAL.w, PORTAL.h);
  }
}

function useKit(colorIndex: number): void {
  const kit = kits[colorIndex];
  straightH = kit.straightH;
  straightV = kit.straightV;
  caps = kit.caps;
}

function addPipePiece(canvas: HTMLCanvasElement, x: number, y: number, hits?: HitBox[]): void {
  const piece: PipePiece = {
    canvas,
    x,
    y,
    hits: hits ?? [{ x, y, w: canvas.width, h: canvas.height }],
  };
  pipePieces.push(piece);
  currentRun.push(piece);
}

function straightStep(
  cx: number,
  cy: number,
  dir: number
): { x: number; y: number; canvas: HTMLCanvasElement; nx: number; ny: number } {
  if (dir === DIR_E) {
    return { x: cx, y: cy - PORT, canvas: straightH, nx: cx + ADVANCE, ny: cy };
  }
  if (dir === DIR_W) {
    return { x: cx - ADVANCE, y: cy - PORT, canvas: straightH, nx: cx - ADVANCE, ny: cy };
  }
  if (dir === DIR_S) {
    return { x: cx - PORT, y: cy, canvas: straightV, nx: cx, ny: cy + ADVANCE };
  }
  return { x: cx - PORT, y: cy - ADVANCE, canvas: straightV, nx: cx, ny: cy - ADVANCE };
}

function capPos(cx: number, cy: number, dir: number): { x: number; y: number } {
  if (dir === DIR_E) {
    return { x: cx - 1, y: cy - PORT - 1 };
  }
  if (dir === DIR_W) {
    return { x: cx - 3, y: cy - PORT - 1 };
  }
  if (dir === DIR_N) {
    return { x: cx - PORT - 1, y: cy - 3 };
  }
  return { x: cx - PORT - 1, y: cy - 1 };
}

/** Opposite-facing cap behind the first straight (1px join, not buried under it). */
function backCapPos(cx: number, cy: number, dir: number): { x: number; y: number } {
  if (dir === DIR_E) {
    return { x: cx - 4, y: cy - PORT - 1 };
  }
  if (dir === DIR_W) {
    return { x: cx - 1, y: cy - PORT - 1 };
  }
  if (dir === DIR_S) {
    return { x: cx - PORT - 1, y: cy - 4 };
  }
  return { x: cx - PORT - 1, y: cy - 1 };
}

function pushStraight(cx: number, cy: number, dir: number): { cx: number; cy: number } {
  const step = straightStep(cx, cy, dir);
  addPipePiece(step.canvas, step.x, step.y);
  return { cx: step.nx, cy: step.ny };
}

function pushCap(cx: number, cy: number, dir: number): void {
  const pos = capPos(cx, cy, dir);
  addPipePiece(caps[dir], pos.x, pos.y);
}

function overlaps(a: HitBox, b: HitBox, pad = 0): boolean {
  return (
    a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y
  );
}

function boxHitsPipes(box: HitBox, pad = 1): boolean {
  for (const piece of pipePieces) {
    for (const hit of piece.hits ?? []) {
      if (overlaps(box, hit, pad)) {
        return true;
      }
    }
  }
  return false;
}

function boxOnBadTile(box: HitBox, color: number, strictSlice = true): boolean {
  const x0 = Math.floor(box.x / TILE_SIZE);
  const y0 = Math.floor(box.y / TILE_SIZE);
  const x1 = Math.floor((box.x + box.w - 0.001) / TILE_SIZE);
  const y1 = Math.floor((box.y + box.h - 0.001) / TILE_SIZE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const tile = getTile(tx, ty);
      if (tile === TILE_WALL || tile === TILE_WHITE || (strictSlice && tile !== color)) {
        return true;
      }
    }
  }
  return false;
}

function runBoxes(
  cx: number,
  cy: number,
  dir: number,
  count: number,
  cappedStart: boolean
): HitBox[] {
  const boxes: HitBox[] = [];
  if (cappedStart) {
    const back = caps[opposite(dir)];
    const pos = backCapPos(cx, cy, dir);
    boxes.push({ x: pos.x, y: pos.y, w: back.width, h: back.height });
  }
  let x = cx;
  let y = cy;
  for (let i = 0; i < count; i++) {
    const step = straightStep(x, y, dir);
    boxes.push({ x: step.x, y: step.y, w: step.canvas.width, h: step.canvas.height });
    x = step.nx;
    y = step.ny;
  }
  const head = caps[dir];
  const pos = capPos(x, y, dir);
  boxes.push({ x: pos.x, y: pos.y, w: head.width, h: head.height });
  return boxes;
}

function pushRun(cx: number, cy: number, dir: number, count: number, cappedStart: boolean): void {
  let x = cx;
  let y = cy;
  for (let i = 0; i < count; i++) {
    const next = pushStraight(x, y, dir);
    x = next.cx;
    y = next.cy;
  }
  if (cappedStart) {
    const pos = backCapPos(cx, cy, dir);
    addPipePiece(caps[opposite(dir)], pos.x, pos.y);
  }
  pushCap(x, y, dir);
}

function tryPlaceDebris(
  color: number,
  cx: number,
  cy: number,
  dir: number,
  count: number,
  pad: number,
  strictSlice = true
): boolean {
  const boxes = runBoxes(cx, cy, dir, count, true);
  for (const box of boxes) {
    if (boxOnBadTile(box, color, strictSlice) || boxHitsPipes(box, pad)) {
      return false;
    }
  }
  useKit(color);
  currentRun = pipeRuns[color];
  pushRun(cx, cy, dir, count, true);
  return true;
}

function placePlazaRun(): void {
  for (let i = 0; i < 7; i++) {
    const [gx, gy] = PORTAL_CELLS[i];
    const ang = Math.atan2((gy + 0.5) * SLOT - CENTER_Y, (gx + 0.5) * SLOT - CENTER_X);
    const dir = opposite(inwardDir(gx, gy));
    let placed = false;
    for (const extra of [PLAZA_RING, PLAZA_RING + 12, PLAZA_RING + 24, PLAZA_RING + 36]) {
      if (placed) {
        break;
      }
      const r = hubRadiusTiles(ang) * TILE_SIZE + extra;
      const x = CENTER_X + Math.cos(ang) * r;
      const y = CENTER_Y + Math.sin(ang) * r;
      if (getTile(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)) !== i) {
        continue;
      }
      for (let n = RUN_MAX; n >= RUN_MIN; n--) {
        if (tryPlaceDebris(i, x, y, dir, n, 4, false)) {
          const pos = backCapPos(x, y, dir);
          const cap = caps[opposite(dir)];
          drainCaps[i] = { x: pos.x + cap.width / 2, y: pos.y + cap.height / 2 };
          placed = true;
          break;
        }
      }
    }
  }
}

const SLOT = WORLD_W / 10;
const INSET = 75;
const PORTAL_PIPE_OFF_Y = PORTAL_H - 1 - PIPE_H + PORT;

function portalFromCell(gx: number, gy: number): { portalX: number; portalY: number } {
  const cellX = (gx + 0.5) * SLOT;
  const cellY = (gy + 0.5) * SLOT;
  const yMin = TILE_SIZE + 4;
  const yMax = WORLD_H - PORTAL_H - TILE_SIZE - 4;
  const xMin = TILE_SIZE + 4;
  const xMax = WORLD_W - PORTAL_W - TILE_SIZE - 4;

  if (gx === 0) {
    return {
      portalX: INSET,
      portalY: Math.max(yMin, Math.min(yMax, cellY - PORTAL_H / 2)),
    };
  }
  if (gx === 9) {
    return {
      portalX: WORLD_W - PORTAL_W - INSET,
      portalY: Math.max(yMin, Math.min(yMax, cellY - PORTAL_H / 2)),
    };
  }
  if (gy === 0) {
    return {
      portalX: Math.max(xMin, Math.min(xMax, cellX - PORTAL_W / 2)),
      portalY: INSET,
    };
  }
  return {
    portalX: Math.max(xMin, Math.min(xMax, cellX - PORTAL_W / 2)),
    portalY: WORLD_H - PORTAL_H - INSET,
  };
}

function placePortal(color: number, gx: number, gy: number): { portalX: number; portalY: number } {
  if (color === GREEN) {
    return { portalX: INSET, portalY: CENTER_Y - PORTAL_PIPE_OFF_Y };
  }
  if (color === BLUE) {
    return {
      portalX: WORLD_W - PORTAL_W - INSET,
      portalY: CENTER_Y - PORTAL_PIPE_OFF_Y,
    };
  }
  if (color === ORANGE) {
    return { portalX: CENTER_X - PORTAL_W / 2, portalY: INSET };
  }
  if (color === VIOLET) {
    return {
      portalX: CENTER_X - PORTAL_W / 2,
      portalY: WORLD_H - PORTAL_H - INSET,
    };
  }
  return portalFromCell(gx, gy);
}

/** Inward heading from that edge. Corners on a west/east wall go horizontal. */
function inwardDir(gx: number, gy: number): number {
  if (gx === 0) {
    return DIR_E;
  }
  if (gx === 9) {
    return DIR_W;
  }
  if (gy === 0) {
    return DIR_S;
  }
  return DIR_N;
}

function stubStart(portalX: number, portalY: number, dir: number): { x: number; y: number } {
  const seamX = portalX + PORTAL_W / 2;
  const seamY = portalY + PORTAL_H - 1 - PIPE_H + PORT;
  if (dir === DIR_E) {
    return { x: seamX - 2, y: seamY };
  }
  if (dir === DIR_W) {
    return { x: seamX + 2, y: seamY };
  }
  if (dir === DIR_S) {
    return { x: seamX, y: portalY + PORTAL_H - 1 };
  }
  return { x: seamX, y: portalY + 1 };
}

function pushPortal(portalX: number, portalY: number): void {
  portals.push({ canvas: portalSprite, x: portalX, y: portalY });
}

/**
 * Place 7 portals, a 3-straight inward stub from each, and one capped run
 * (3–6 straights) just off the plaza per color.
 *
 * Director's cut: the occupancy-grid snake lived in
 * `src/directors-cut/pipe-snake.ts` (needs the old curve kit to restore).
 */
export function generatePipes(): void {
  pipePieces.length = 0;
  portals.length = 0;
  portalsGone = 0;
  pipeRuns.length = 0;
  portalHp.length = 0;
  drainCaps.length = 0;
  slainPortal = null;
  bakePieces();

  for (let i = 0; i < 7; i++) {
    const [gx, gy] = PORTAL_CELLS[i];
    const { portalX, portalY } = placePortal(i, gx, gy);
    const dir = inwardDir(gx, gy);
    const start = stubStart(portalX, portalY, dir);

    pushPortal(portalX, portalY);
    useKit(i);
    currentRun = [];
    pipeRuns.push(currentRun);
    portalHp.push(PORTAL_MAX_HP);
    pushRun(start.x, start.y, dir, STUB_STRAIGHTS, false);
  }
  placePlazaRun();
}

/**
 * Plaza portal on the right rim of the hub.
 */
export function plazaPortal(): PipePiece {
  const hub = hubRadiusTiles(0) * TILE_SIZE;
  const portalX = CENTER_X + hub - PORTAL_W * 0.4;
  const portalY = CENTER_Y - PORTAL_H / 2;
  return { canvas: portalSprite, x: portalX, y: portalY };
}

/**
 * Open the plaza portal permanently (finale). Returns the boss stand
 * position just inside the plaza.
 */
export function spawnPlazaPortal(): { x: number; y: number } {
  const piece = plazaPortal();
  portals.push(piece);
  return {
    x: piece.x - PLAYER_WIDTH - 4,
    y: piece.y + PORTAL_H - PLAYER_HEIGHT,
  };
}
