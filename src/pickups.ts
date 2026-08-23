import { PLAYER_SPEED, PLAYER_WIDTH } from './constants';
import { playCrystal } from './music';
import { getPlayerHitbox } from './player';
import { createSprite } from './sprites';
import { SHOP_MAGNET, shopRanks } from './stats';

export const PICKUP_CRYSTAL = 0;
export const PICKUP_SCRAP = 1;

// Inherent drop chances are TBD; these are placeholders until the tuning phase.
const CRYSTAL_CHANCE = 0.5;
const SCRAP_CHANCE = 0.2;

const MAGNET_RADIUS = PLAYER_WIDTH * 2;
const PULL_SPEED = PLAYER_SPEED * 1.5;
const MAGNET_DELAY_MS = 500;
export const CRYSTAL_W = 4;
export const CRYSTAL_H = 6;
export const SCRAP_W = 6;
export const SCRAP_H = 6;

interface Pickup {
  x: number;
  y: number;
  kind: number;
  delay: number;
}

export const pickups: Pickup[] = [];

/** In-run XP remainder toward the next level. */
export let xp = 0;
/** Starts at 1; increments when the bar fills (one queued overlay per wrap). */
export let level = 1;
/** Magneted scrap this session; persisted with shop ranks in localStorage. */
export let scrap = 0;
/** Level-ups waiting for the overlay queue. */
export let pendingLevelUps = 0;

let crystalSprite: HTMLCanvasElement;
export let scrapSprite: HTMLCanvasElement;

/** Placeholder curve until the tuning phase. */
export function xpNeeded(): number {
  return 5 * level;
}

export function addXp(amount: number): void {
  xp += amount;
  while (xp >= xpNeeded()) {
    xp -= xpNeeded();
    level++;
    pendingLevelUps++;
  }
}

/** True if a level-up overlay should open. */
export function consumeLevelUp(): boolean {
  if (pendingLevelUps <= 0) {
    return false;
  }
  pendingLevelUps--;
  return true;
}

export function setScrap(n: number): void {
  scrap = Math.max(0, n | 0);
}

export function spendScrap(amount: number): boolean {
  if (scrap < amount) {
    return false;
  }
  scrap -= amount;
  return true;
}

/** Clears ground pickups and XP. Magneted scrap is kept. */
export function resetPickups(): void {
  pickups.length = 0;
  xp = 0;
  level = 1;
  pendingLevelUps = 0;
}

export function bakePickups(): void {
  crystalSprite = createSprite(12, 29, CRYSTAL_W, CRYSTAL_H);
  scrapSprite = createSprite(16, 29, SCRAP_W, SCRAP_H);
}

/** Final-boss chunk: several independent rolls plus guaranteed scrap. */
export function dropBossLoot(x: number, y: number): void {
  for (let i = 0; i < 6; i++) {
    dropLoot(x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14);
  }
  for (let i = 0; i < 4; i++) {
    pickups.push({
      x: x - SCRAP_W / 2 + (Math.random() - 0.5) * 14,
      y: y - SCRAP_H / 2 + (Math.random() - 0.5) * 14,
      kind: PICKUP_SCRAP,
      delay: MAGNET_DELAY_MS,
    });
  }
}

/** Independent crystal/scrap rolls at a world point (usually an enemy center). */
export function dropLoot(x: number, y: number): void {
  if (Math.random() < CRYSTAL_CHANCE) {
    pickups.push({
      x: x - CRYSTAL_W / 2 + (Math.random() - 0.5) * 4,
      y: y - CRYSTAL_H / 2 + (Math.random() - 0.5) * 4,
      kind: PICKUP_CRYSTAL,
      delay: MAGNET_DELAY_MS,
    });
  }
  if (Math.random() < SCRAP_CHANCE) {
    pickups.push({
      x: x - SCRAP_W / 2 + (Math.random() - 0.5) * 4,
      y: y - SCRAP_H / 2 + (Math.random() - 0.5) * 4,
      kind: PICKUP_SCRAP,
      delay: MAGNET_DELAY_MS,
    });
  }
}

export function updatePickups(dt: number): void {
  const hit = getPlayerHitbox();
  const cx = hit.x + hit.w / 2;
  const cy = hit.y + hit.h / 2;
  const pull = PULL_SPEED * dt;
  const magnet = MAGNET_RADIUS * (1 + 0.25 * shopRanks[SHOP_MAGNET]);

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (p.delay > 0) {
      p.delay -= dt;
      continue;
    }
    const pw = p.kind === PICKUP_CRYSTAL ? CRYSTAL_W : SCRAP_W;
    const ph = p.kind === PICKUP_CRYSTAL ? CRYSTAL_H : SCRAP_H;
    const pcx = p.x + pw / 2;
    const pcy = p.y + ph / 2;
    const dx = cx - pcx;
    const dy = cy - pcy;
    const dist = Math.hypot(dx, dy);

    if (dist < magnet && dist > 0.01) {
      const step = Math.min(pull, dist);
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }

    if (p.x < hit.x + hit.w && p.x + pw > hit.x && p.y < hit.y + hit.h && p.y + ph > hit.y) {
      if (p.kind === PICKUP_CRYSTAL) {
        addXp(1);
        playCrystal();
      } else {
        scrap += 1;
      }
      pickups.splice(i, 1);
    }
  }
}

export function drawPickups(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number
): void {
  for (const p of pickups) {
    const canvas = p.kind === PICKUP_CRYSTAL ? crystalSprite : scrapSprite;
    const screenX = Math.floor(p.x - cameraX);
    const screenY = Math.floor(p.y - cameraY);
    if (
      screenX + canvas.width < 0 ||
      screenY + canvas.height < 0 ||
      screenX > viewWidth ||
      screenY > viewHeight
    ) {
      continue;
    }
    ctx.drawImage(canvas, screenX, screenY);
  }
}
