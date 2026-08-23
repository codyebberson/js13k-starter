import { TILE_H, TILE_W } from './constants';
import { spawnDamageNumber, spawnExplosion } from './fx';
import { getTile, TILE_WALL } from './map';
import { playHit } from './music';
import { RAINBOW_COLORS } from './palette';
import { dropEliteLoot, dropLoot } from './pickups';
import { damagePlayer, getPlayerHitbox } from './player';
import { createSprite, measureContentBox } from './sprites';

/**
 * Difficulty ladder (easiest → hardest) mapped to sheet cell index within the
 * 7×9 enemy strip at (11,0). Ladder order: paperclip, pencil, binder clip,
 * pen, USB stick, stapler, calculator, scissors.
 */
const TIER_SHEET_INDEX = [4, 1, 0, 2, 6, 3, 5, 7];

const ENEMY_CAP = 150;
const MAX_SWARM_ELITES = 4;
const ELITE_CHANCE = 0.04;
const ELITE_HP_MUL = 10;
// Baseline ~2 enemies/sec (surge spawns are a later phase)
const SPAWN_INTERVAL_MS = 500;
// Extra distance past the half view diagonal so spawns land just off-screen
const SPAWN_MARGIN = 16;
// Past this multiple of the spawn radius an enemy is recycled back to the ring
const TELEPORT_FACTOR = 1.75;
const CONTACT_TICK_MS = 500;
// px/ms — per-type speeds TBD; every type shares this for now (player is 0.05)
const ENEMY_SPEED = 0.03;
const BOB_PERIOD_MS = 900;

// Player-centered spatial hash (enemies stay near the camera)
const GRID_CELL = 22;
const GRID_W = 64;
const GRID_H = 64;
const GRID_SPAN = GRID_W * GRID_CELL;

interface EnemyType {
  canvas: HTMLCanvasElement;
  /** Content-sized hitbox, relative to the 7×9 cell origin. */
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
  /** Separation radius: half the larger hitbox dimension. */
  radius: number;
  contactDamage: number;
  /** Per-type HP is TBD; paperclip=8, +4 per tier. */
  hp: number;
}

const enemyTypes: EnemyType[] = [];

export interface Enemy {
  /** Top-left of the 7×9 sprite cell, world px. */
  x: number;
  y: number;
  /** Index into the difficulty ladder (0 = paperclip). */
  type: number;
  hp: number;
  /** Knockback velocity, px/ms. */
  kbX: number;
  kbY: number;
  bobTime: number;
  contactTimer: number;
  /** Remaining freeze (ms). Frozen entities take +25% damage. */
  frozen: number;
  /** Remaining slow (ms). */
  slowed: number;
  /** Elite / portal mini-boss. */
  boss: boolean;
  /** Nova color 0–6, or -1 if this enemy has no nova. */
  color: number;
  maxHp: number;
  homeX: number;
  homeY: number;
  cd: number;
  boost: number;
  chasing: boolean;
  moving: boolean;
}

export const enemies: Enemy[] = [];

// Tiers allowed to spawn. Starts at paperclips; each portal unlocks the next.
let unlockedTiers = 1;

/** Director's Cut cutscene still reads this; not drawn in production. */
export let finalBossSprites: HTMLCanvasElement[] | undefined;

function hitOf(enemy: Enemy): EnemyType {
  return enemyTypes[enemy.type];
}

/** Bake one canvas + content hitbox per enemy type. Call once after the sheet loads. */
export function bakeEnemyTypes(): void {
  for (let tier = 0; tier < TIER_SHEET_INDEX.length; tier++) {
    const sheetIndex = TIER_SHEET_INDEX[tier];
    const sheetX = 11 + (sheetIndex % 4) * 7;
    const sheetY = sheetIndex < 4 ? 0 : 9;
    const box = measureContentBox(sheetX, sheetY, 7, 9);
    enemyTypes.push({
      canvas: createSprite(sheetX, sheetY, 7, 9),
      hitX: box.x,
      hitY: box.y,
      hitW: box.w,
      hitH: box.h,
      radius: Math.max(box.w, box.h) / 2,
      contactDamage: tier + 1,
      hp: 8 + tier * 4,
    });
  }
}

let spawnTimer = 0;
let lastSpawnRadius = 200;
let regulars = 0;
let swarmElites = 0;

export function resetEnemies(): void {
  enemies.length = 0;
  spawnTimer = 0;
  unlockedTiers = 1;
  regulars = 0;
  swarmElites = 0;
}

function makeEnemy(x: number, y: number, hp: number, extra: Partial<Enemy>): Enemy {
  return {
    x,
    y,
    type: 0,
    hp,
    kbX: 0,
    kbY: 0,
    bobTime: 0,
    contactTimer: 0,
    frozen: 0,
    slowed: 0,
    boss: false,
    color: -1,
    maxHp: hp,
    homeX: 0,
    homeY: 0,
    cd: 0,
    boost: 0,
    chasing: false,
    moving: false,
    ...extra,
  };
}

export function updateEnemies(dt: number, viewWidth: number, viewHeight: number): void {
  const spawnRadius = Math.hypot(viewWidth, viewHeight) / 2 + SPAWN_MARGIN;
  lastSpawnRadius = spawnRadius;
  const playerHit = getPlayerHitbox();
  const playerCenterX = playerHit.x + playerHit.w / 2;
  const playerCenterY = playerHit.y + playerHit.h / 2;

  spawnTimer += dt;
  while (spawnTimer >= SPAWN_INTERVAL_MS) {
    spawnTimer -= SPAWN_INTERVAL_MS;
    trySpawn(playerCenterX, playerCenterY, spawnRadius);
  }

  const teleportRadius = spawnRadius * TELEPORT_FACTOR;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const type = hitOf(enemy);
    if (enemy.frozen > 0) {
      enemy.frozen = Math.max(0, enemy.frozen - dt);
    } else {
      enemy.bobTime += dt;
    }
    if (enemy.slowed > 0) {
      enemy.slowed = Math.max(0, enemy.slowed - dt);
    }
    if (enemy.boost > 0) {
      enemy.boost = Math.max(0, enemy.boost - dt);
    }
    enemy.contactTimer = Math.max(0, enemy.contactTimer - dt);

    const centerX = enemy.x + type.hitX + type.hitW / 2;
    const centerY = enemy.y + type.hitY + type.hitH / 2;
    const towardX = playerCenterX - centerX;
    const towardY = playerCenterY - centerY;
    const dist = Math.hypot(towardX, towardY);

    if (!enemy.boss && dist > teleportRadius) {
      if (regulars >= ENEMY_CAP - 5) {
        enemies.splice(i, 1);
        regulars--;
      } else {
        const spot = findSpawnSpot(
          enemyTypes[enemy.type],
          playerCenterX,
          playerCenterY,
          spawnRadius
        );
        if (spot) {
          enemy.x = spot.x;
          enemy.y = spot.y;
          enemy.contactTimer = 0;
          enemy.kbX = 0;
          enemy.kbY = 0;
        }
      }
      continue;
    }

    if (enemy.kbX !== 0 || enemy.kbY !== 0) {
      const kbx = enemy.kbX * dt;
      const kby = enemy.kbY * dt;
      if (!hitsWall(enemy.x + type.hitX + kbx, enemy.y + type.hitY, type.hitW, type.hitH)) {
        enemy.x += kbx;
      }
      if (!hitsWall(enemy.x + type.hitX, enemy.y + type.hitY + kby, type.hitW, type.hitH)) {
        enemy.y += kby;
      }
      const decay = Math.exp(-dt / 80);
      enemy.kbX *= decay;
      enemy.kbY *= decay;
      if (Math.hypot(enemy.kbX, enemy.kbY) < 0.01) {
        enemy.kbX = 0;
        enemy.kbY = 0;
      }
    }

    if (dist > 1 && enemy.frozen <= 0) {
      const step = ENEMY_SPEED * (enemy.slowed > 0 ? 0.5 : 1) * (enemy.boost > 0 ? 1.15 : 1) * dt;
      const dx = (towardX / dist) * step;
      const dy = (towardY / dist) * step;
      if (!hitsWall(enemy.x + type.hitX + dx, enemy.y + type.hitY, type.hitW, type.hitH)) {
        enemy.x += dx;
      }
      if (!hitsWall(enemy.x + type.hitX, enemy.y + type.hitY + dy, type.hitW, type.hitH)) {
        enemy.y += dy;
      }
    }

    // Contact damage at >10% of the enemy hitbox; max overlap is capped in separate().
    const hitLeft = enemy.x + type.hitX;
    const hitTop = enemy.y + type.hitY;
    const overlapW =
      Math.min(hitLeft + type.hitW, playerHit.x + playerHit.w) - Math.max(hitLeft, playerHit.x);
    const overlapH =
      Math.min(hitTop + type.hitH, playerHit.y + playerHit.h) - Math.max(hitTop, playerHit.y);
    if (
      overlapW > 0 &&
      overlapH > 0 &&
      overlapW * overlapH > 0.1 * type.hitW * type.hitH &&
      enemy.contactTimer <= 0
    ) {
      damagePlayer(type.contactDamage);
      enemy.contactTimer = CONTACT_TICK_MS;
    }
  }

  separate();
}

function trySpawn(playerCenterX: number, playerCenterY: number, radius: number): void {
  if (regulars < ENEMY_CAP) {
    spawnAt(playerCenterX, playerCenterY, radius, false);
  }
  if (Math.random() < ELITE_CHANCE && swarmElites < MAX_SWARM_ELITES) {
    spawnAt(playerCenterX, playerCenterY, radius, true);
  }
}

function spawnAt(
  playerCenterX: number,
  playerCenterY: number,
  radius: number,
  elite: boolean
): void {
  const tier = Math.floor(Math.random() * unlockedTiers);
  const type = enemyTypes[tier];
  const spot = findSpawnSpot(type, playerCenterX, playerCenterY, radius);
  if (!spot) {
    return;
  }
  if (elite) {
    pushElite(spot.x, spot.y, tier, (Math.random() * 7) | 0, false);
  } else {
    enemies.push(
      makeEnemy(spot.x, spot.y, type.hp, {
        type: tier,
        bobTime: Math.random() * BOB_PERIOD_MS,
      })
    );
    regulars++;
  }
}

function pushElite(x: number, y: number, tier: number, color: number, fromPortal: boolean): void {
  const type = enemyTypes[tier];
  const hp = type.hp * ELITE_HP_MUL;
  enemies.push(
    makeEnemy(x, y, hp, {
      type: tier,
      boss: true,
      color,
      maxHp: hp,
      chasing: fromPortal,
      cd: 400 + Math.random() * 800,
      bobTime: Math.random() * BOB_PERIOD_MS,
    })
  );
  if (!fromPortal) {
    swarmElites++;
  }
}

/** Portal death: elite of the newly unlocked tier, at the portal. */
export function spawnPortalElite(x: number, y: number): void {
  const tier = Math.min(7, unlockedTiers - 1);
  const type = enemyTypes[tier];
  pushElite(x - type.hitX - type.hitW / 2, y - type.hitY - type.hitH / 2, tier, (Math.random() * 7) | 0, true);
}

/** Dev helper: burst-spawn toward the cap (tree-shaken out of production). */
export function spawnBurst(count: number): void {
  const playerHit = getPlayerHitbox();
  for (let i = 0; i < count; i++) {
    trySpawn(playerHit.x + playerHit.w / 2, playerHit.y + playerHit.h / 2, lastSpawnRadius);
  }
}

/** A ring position whose hitbox avoids walls, or null after 10 tries. */
function findSpawnSpot(
  type: EnemyType,
  playerCenterX: number,
  playerCenterY: number,
  radius: number
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const hitLeft = playerCenterX + Math.cos(angle) * radius - type.hitW / 2;
    const hitTop = playerCenterY + Math.sin(angle) * radius - type.hitH / 2;
    if (!hitsWall(hitLeft, hitTop, type.hitW, type.hitH)) {
      return { x: hitLeft - type.hitX, y: hitTop - type.hitY };
    }
  }
  return null;
}

function hitsWall(x: number, y: number, w: number, h: number): boolean {
  const x0 = Math.floor(x / TILE_W);
  const y0 = Math.floor(y / TILE_H);
  const x1 = Math.floor((x + w - 0.001) / TILE_W);
  const y1 = Math.floor((y + h - 0.001) / TILE_H);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (getTile(tx, ty) === TILE_WALL) {
        return true;
      }
    }
  }
  return false;
}

// Linked-list spatial hash: gridHead per cell, gridNext per enemy index
const gridHead = new Int32Array(GRID_W * GRID_H);
const gridNext = new Int32Array(ENEMY_CAP);

function cellCoord(value: number, origin: number, max: number): number {
  return Math.min(max - 1, Math.max(0, Math.floor((value - origin) / GRID_CELL)));
}

/**
 * Pairwise push-apart via the coarse grid: enemies may overlap up to 50%,
 * never fully — centers stay at least half the combined radii apart.
 * Enemies vs player: max 40% overlap (minDist = 60% of combined radii).
 */
function separate(): void {
  const playerHit = getPlayerHitbox();
  const originX = playerHit.x + playerHit.w / 2 - GRID_SPAN / 2;
  const originY = playerHit.y + playerHit.h / 2 - GRID_SPAN / 2;

  gridHead.fill(-1);
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const type = hitOf(enemy);
    const cell =
      cellCoord(enemy.y + type.hitY + type.hitH / 2, originY, GRID_H) * GRID_W +
      cellCoord(enemy.x + type.hitX + type.hitW / 2, originX, GRID_W);
    gridNext[i] = gridHead[cell];
    gridHead[cell] = i;
  }

  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    const typeA = hitOf(a);
    const ax = a.x + typeA.hitX + typeA.hitW / 2;
    const ay = a.y + typeA.hitY + typeA.hitH / 2;
    const cellX = cellCoord(ax, originX, GRID_W);
    const cellY = cellCoord(ay, originY, GRID_H);
    for (let gy = Math.max(0, cellY - 1); gy <= Math.min(GRID_H - 1, cellY + 1); gy++) {
      for (let gx = Math.max(0, cellX - 1); gx <= Math.min(GRID_W - 1, cellX + 1); gx++) {
        for (let j = gridHead[gy * GRID_W + gx]; j !== -1; j = gridNext[j]) {
          if (j <= i) {
            continue;
          }
          const b = enemies[j];
          const typeB = hitOf(b);
          const minDist = (typeA.radius + typeB.radius) * 0.5;
          let dx = b.x + typeB.hitX + typeB.hitW / 2 - ax;
          let dy = b.y + typeB.hitY + typeB.hitH / 2 - ay;
          let dist = Math.hypot(dx, dy);
          if (dist >= minDist) {
            continue;
          }
          if (dist < 0.01) {
            dx = 1;
            dy = 0;
            dist = 1;
          }
          const push = (minDist - dist) / 2 / dist;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
  }

  const px = playerHit.x + playerHit.w / 2;
  const py = playerHit.y + playerHit.h / 2;
  const pRadius = playerHit.w / 2;
  for (const enemy of enemies) {
    const type = hitOf(enemy);
    const ex = enemy.x + type.hitX + type.hitW / 2;
    const ey = enemy.y + type.hitY + type.hitH / 2;
    const minDist = (type.radius + pRadius) * 0.6;
    let dx = ex - px;
    let dy = ey - py;
    let dist = Math.hypot(dx, dy);
    if (dist >= minDist) {
      continue;
    }
    if (dist < 0.01) {
      dx = 1;
      dy = 0;
      dist = 1;
    }
    const push = (minDist - dist) / dist;
    enemy.x += dx * push;
    enemy.y += dy * push;
  }
}

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (const enemy of enemies) {
    const type = hitOf(enemy);
    const canvas = enemyTypes[enemy.type].canvas;
    const screenX = Math.floor(enemy.x - cameraX);
    const screenY = Math.floor(enemy.y - cameraY);
    const pad = enemy.boss ? canvas.width : 0;
    if (
      screenX + canvas.width + pad < 0 ||
      screenY + canvas.height + pad < 0 ||
      screenX - pad > viewWidth ||
      screenY - pad > viewHeight
    ) {
      continue;
    }
    const down = enemy.frozen > 0 || enemy.bobTime % BOB_PERIOD_MS < BOB_PERIOD_MS / 2;
    const scale = enemy.boss ? 2 : 1;
    const dw = canvas.width * scale;
    const dh = canvas.height * scale;
    const drawX = screenX - ((dw - canvas.width) >> 1);
    const drawY = screenY - (down ? 0 : 1) - ((dh - canvas.height) >> 1);
    const shadowW = (down ? 5 : 3) * scale;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(
      drawX + type.hitX * scale + ((type.hitW * scale - shadowW) >> 1),
      drawY + type.hitY * scale + type.hitH * scale,
      shadowW,
      1
    );
    ctx.drawImage(canvas, drawX, drawY, dw, dh);
    if (enemy.frozen > 0) {
      ctx.strokeStyle = '#8df';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        screenX + type.hitX + 0.5,
        screenY + type.hitY - (down ? 0 : 1) + 0.5,
        type.hitW - 1,
        type.hitH - 1
      );
    }
  }
}

/** World-space content hitbox (also used by the debug overlay). */
export function enemyHitbox(enemy: Enemy): { x: number; y: number; w: number; h: number } {
  const type = hitOf(enemy);
  return { x: enemy.x + type.hitX, y: enemy.y + type.hitY, w: type.hitW, h: type.hitH };
}

export function crowdControl(enemy: Enemy, freezeMs: number): void {
  if (enemy.boss) {
    enemy.slowed = Math.max(enemy.slowed, freezeMs * 2);
  } else {
    enemy.frozen = Math.max(enemy.frozen, freezeMs);
  }
}

export function crowdControlAt(x: number, y: number, radius: number, freezeMs: number): void {
  for (const enemy of enemies) {
    const box = enemyHitbox(enemy);
    if (Math.hypot(box.x + box.w / 2 - x, box.y + box.h / 2 - y) <= radius) {
      crowdControl(enemy, freezeMs);
    }
  }
}

/** Returns true if the enemy died. Safe to call while reverse-iterating `enemies`. */
export function hurtEnemyAt(index: number, amount: number): boolean {
  const enemy = enemies[index];
  if (enemy.frozen > 0) {
    amount *= 1.25;
  }
  const box = enemyHitbox(enemy);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  spawnDamageNumber(cx, enemy.y - 6, amount);
  playHit();
  enemy.hp -= amount;
  if (enemy.hp > 0) {
    return false;
  }
  spawnExplosion(cx, cy, enemy.boss && enemy.color >= 0 ? RAINBOW_COLORS[enemy.color] : 0xb1b1b1, 24);
  if (enemy.boss) {
    dropEliteLoot(cx, cy);
    if (!enemy.chasing) {
      swarmElites--;
    }
  } else {
    dropLoot(cx, cy);
    regulars--;
  }
  enemies.splice(index, 1);
  return true;
}

export function unlockNextTier(): void {
  unlockedTiers = Math.min(8, unlockedTiers + 1);
}

export function applyKnockback(enemy: Enemy, fromX: number, fromY: number, speed: number): void {
  const box = enemyHitbox(enemy);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  let dx = cx - fromX;
  let dy = cy - fromY;
  let dist = Math.hypot(dx, dy);
  if (dist < 0.01) {
    dx = 1;
    dy = 0;
    dist = 1;
  }
  if (enemy.boss) {
    speed *= 0.5;
  }
  enemy.kbX = (dx / dist) * speed;
  enemy.kbY = (dy / dist) * speed;
}
