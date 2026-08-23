import { PLAYER_SPAWN_X, PLAYER_SPAWN_Y } from './constants';
import { spawnDamageNumber } from './fx';
import { playHit } from './music';
import { createSprite } from './sprites';

export const PORTAL_W = 12;
export const PORTAL_H = 23;
export const PORTAL_MAX_HP = 100;
/** Test ring around spawn. */
const RING = 500;
const MARKER_PAD = 14;
/** Half-length of the edge marker triangle (tip to base). */
const MARKER_LEN = 7;
const MARKER_HALF = 5;

interface Portal {
  x: number;
  y: number;
  hp: number;
}

export const portals: Portal[] = [];
/** Bit i set = portal i is gone. */
let portalsGone = 0;

let portalSprite: HTMLCanvasElement;
/** Single pending death; portals are far enough that one pulse cannot kill two. */
let slain: { color: number; x: number; y: number } | null = null;

export function bakePortals(): void {
  portalSprite = createSprite(0, 19, PORTAL_W, PORTAL_H);
}

export function resetPortals(): void {
  portals.length = 0;
  portalsGone = 0;
  slain = null;
  for (let i = 0; i < 7; i++) {
    // Red at 12 o'clock, ROYGBIV clockwise.
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / 7;
    portals.push({
      x: PLAYER_SPAWN_X + Math.cos(ang) * RING - PORTAL_W / 2,
      y: PLAYER_SPAWN_Y + Math.sin(ang) * RING - PORTAL_H / 2,
      hp: PORTAL_MAX_HP,
    });
  }
}

/** True if portal `i` is still a target. */
export function portalLive(i: number): boolean {
  return i < 7 && !(portalsGone & (1 << i)) && !!portals[i];
}

export function allPortalsGone(): boolean {
  return portalsGone === 127;
}

/** True if this hit killed the portal. */
export function damagePortal(i: number, amount: number): boolean {
  if (!portalLive(i) || amount <= 0 || portals[i].hp <= 0) {
    return false;
  }
  const p = portals[i];
  spawnDamageNumber(p.x + PORTAL_W / 2, p.y - 6, amount);
  playHit();
  p.hp -= amount;
  if (p.hp > 0) {
    return false;
  }
  p.hp = 0;
  portalsGone |= 1 << i;
  slain = { color: i, x: p.x + PORTAL_W / 2, y: p.y + PORTAL_H / 2 };
  return true;
}

export function takeSlainPortal(): { color: number; x: number; y: number } | null {
  const out = slain;
  slain = null;
  return out;
}

/**
 * Damage portals whose center is inside radius `r`.
 * `seen` is a 7-bit mask; returns the updated mask.
 */
export function hurtPortalsRing(cx: number, cy: number, r: number, amount: number, seen: number): number {
  for (let i = 0; i < 7; i++) {
    if (seen & (1 << i) || !portalLive(i)) {
      continue;
    }
    const p = portals[i];
    if (Math.hypot(p.x + PORTAL_W / 2 - cx, p.y + PORTAL_H / 2 - cy) <= r) {
      damagePortal(i, amount);
      seen |= 1 << i;
    }
  }
  return seen;
}

export function drawPortals(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number
): void {
  for (let i = 0; i < 7; i++) {
    if (!portalLive(i)) {
      continue;
    }
    const p = portals[i];
    const sx = Math.floor(p.x - cameraX);
    const sy = Math.floor(p.y - cameraY);
    if (sx + PORTAL_W < 0 || sy + PORTAL_H < 0 || sx > viewWidth || sy > viewHeight) {
      continue;
    }
    ctx.drawImage(portalSprite, sx, sy);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx, sy + PORTAL_H + 1, PORTAL_W, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx + 1, sy + PORTAL_H + 2, Math.round((PORTAL_W - 2) * (p.hp / PORTAL_MAX_HP)), 1);
  }
}

/** Black edge triangles toward off-screen live portals. */
export function drawPortalMarkers(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number
): void {
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;
  const hw = cx - MARKER_PAD;
  const hh = cy - MARKER_PAD;
  for (let i = 0; i < 7; i++) {
    if (!portalLive(i)) {
      continue;
    }
    const p = portals[i];
    const left = p.x - cameraX;
    const top = p.y - cameraY;
    if (left + PORTAL_W > 0 && top + PORTAL_H > 0 && left < viewWidth && top < viewHeight) {
      continue;
    }
    const sx = left + PORTAL_W / 2;
    const sy = top + PORTAL_H / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    let t = 1;
    if (dx !== 0) {
      t = Math.min(t, hw / Math.abs(dx));
    }
    if (dy !== 0) {
      t = Math.min(t, hh / Math.abs(dy));
    }
    const mx = Math.floor(cx + dx * t) + 0.5;
    const my = Math.floor(cy + dy * t) + 0.5;
    const snap = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const cos = Math.cos(snap);
    const sin = Math.sin(snap);
    // Tip at +MARKER_LEN along heading; base corners offset perpendicular.
    const tipX = mx + cos * MARKER_LEN;
    const tipY = my + sin * MARKER_LEN;
    const bx = mx - cos * (MARKER_LEN - 2);
    const by = my - sin * (MARKER_LEN - 2);
    const px = -sin * MARKER_HALF;
    const py = cos * MARKER_HALF;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(bx + px, by + py);
    ctx.lineTo(bx - px, by - py);
    ctx.closePath();
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
