import {
  PLAYER_HEIGHT,
  PLAYER_HIT,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
  PLAYER_SPEED,
  TILE_H,
  TILE_W,
} from './constants';
import { spawnExplosion } from './fx';
import { isDown, stickX, stickY } from './input';
import { getTileSolid } from './map';
import {
  CON_HP_PER_RANK,
  SHOP_REVIVE,
  SHOP_START_HP,
  START_HP_PER_RANK,
  STAT_CON,
  STAT_DEX,
  shopRanks,
  speedMul,
  totalStat,
} from './stats';

export const player = {
  // Top-left corner of the player sprite, world-space pixels
  x: PLAYER_SPAWN_X,
  y: PLAYER_SPAWN_Y,
  moving: false,
  /** Walk-cycle clock (ms); advances only while moving, resets when idle. */
  walkTime: 0,
  // Baseline 100 HP; CON and shop Start HP raise the max
  hp: 100,
  maxHp: 100,
  /** Remaining freeze (ms). Frozen entities take +25% damage. */
  frozen: 0,
  /** Remaining yellow-nova speed burst (ms). */
  boost: 0,
  /** Extra lives remaining this run (from the shop Revive row). */
  lives: 0,
  /** Remaining i-frames (ms). Incoming damage is ignored while > 0. */
  iframes: 0,
};

const IFRAME_MS = 2000;

export function damagePlayer(amount: number): void {
  if (amount <= 0 || player.hp <= 0 || player.iframes > 0) {
    return;
  }
  if (player.frozen > 0) {
    amount *= 1.25;
  }
  amount *= 1 - 0.1 * totalStat(STAT_DEX);
  const hit = getPlayerHitbox();
  const cx = hit.x + hit.w / 2;
  const cy = hit.y + hit.h / 2;
  spawnExplosion(cx, cy, 0x000000, 5);
  spawnExplosion(cx, cy, 0xffffff, 5);
  player.hp = Math.max(0, player.hp - amount);
}

export function freezePlayer(ms: number): void {
  if (player.iframes > 0) {
    return;
  }
  player.frozen = Math.max(player.frozen, ms);
}

/** Spend a life to stand back up at full HP with a short i-frame window. */
export function tryRevive(): boolean {
  if (player.hp > 0 || player.lives <= 0) {
    return false;
  }
  player.lives--;
  player.hp = player.maxHp;
  player.frozen = 0;
  player.iframes = IFRAME_MS;
  const hit = getPlayerHitbox();
  spawnExplosion(hit.x + hit.w / 2, hit.y + hit.h / 2, 0xffffff, 16);
  spawnExplosion(hit.x + hit.w / 2, hit.y + hit.h / 2, 0xcecece, 10);
  return true;
}

export function resetPlayer(): void {
  player.x = PLAYER_SPAWN_X;
  player.y = PLAYER_SPAWN_Y;
  player.moving = false;
  player.walkTime = 0;
  player.maxHp =
    100 + CON_HP_PER_RANK * totalStat(STAT_CON) + START_HP_PER_RANK * shopRanks[SHOP_START_HP];
  player.hp = player.maxHp;
  player.frozen = 0;
  player.boost = 0;
  player.lives = shopRanks[SHOP_REVIVE];
  player.iframes = 0;
}

export function updatePlayer(dt: number): void {
  if (player.iframes > 0) {
    player.iframes = Math.max(0, player.iframes - dt);
  }
  if (player.boost > 0) {
    player.boost = Math.max(0, player.boost - dt);
  }
  if (player.frozen > 0) {
    player.frozen = Math.max(0, player.frozen - dt);
    player.moving = false;
    return;
  }

  let dx = stickX;
  let dy = stickY;
  if (isDown('ArrowLeft') || isDown('KeyA')) {
    dx -= 1;
  }
  if (isDown('ArrowRight') || isDown('KeyD')) {
    dx += 1;
  }
  if (isDown('ArrowUp') || isDown('KeyW')) {
    dy -= 1;
  }
  if (isDown('ArrowDown') || isDown('KeyS')) {
    dy += 1;
  }

  const len = Math.hypot(dx, dy);
  player.moving = len > 0.01;
  player.walkTime = player.moving ? player.walkTime + dt : 0;
  if (!player.moving) {
    return;
  }
  if (len > 1) {
    dx /= len;
    dy /= len;
  }

  const speed = PLAYER_SPEED * speedMul(player.boost);
  moveWithCollision(dx * speed * dt, dy * speed * dt);
}

const OVERLAP_EPS = 1e-6;

// Axis-separated movement: slide along walls, snap flush to the tile edge
function moveWithCollision(dx: number, dy: number): void {
  moveAxis(dx, 0);
  moveAxis(0, dy);
}

function moveAxis(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) {
    return;
  }
  const newX = player.x + dx;
  const newY = player.y + dy;
  if (!boxCollides(newX, newY)) {
    player.x = newX;
    player.y = newY;
    return;
  }

  const hit = getPlayerHitbox(newX, newY);
  if (dx > 0) {
    player.x = newX + (minOverlappingTileEdge(hit, 'left') - (hit.x + hit.w));
  } else if (dx < 0) {
    player.x = newX + (maxOverlappingTileEdge(hit, 'right') - hit.x);
  } else if (dy > 0) {
    player.y = newY + (minOverlappingTileEdge(hit, 'top') - (hit.y + hit.h));
  } else {
    player.y = newY + (maxOverlappingTileEdge(hit, 'bottom') - hit.y);
  }
}

function boxCollides(x: number, y: number): boolean {
  return forEachOverlappingSolid(getPlayerHitbox(x, y), () => true);
}

function hitsSolid(
  hit: { x: number; y: number; w: number; h: number },
  solid: { x: number; y: number; w: number; h: number }
): boolean {
  return (
    hit.x < solid.x + solid.w - OVERLAP_EPS &&
    hit.x + hit.w > solid.x + OVERLAP_EPS &&
    hit.y < solid.y + solid.h - OVERLAP_EPS &&
    hit.y + hit.h > solid.y + OVERLAP_EPS
  );
}

function forEachOverlappingSolid(
  hit: { x: number; y: number; w: number; h: number },
  visit: (solid: { x: number; y: number; w: number; h: number }) => boolean | undefined
): boolean {
  const x0 = Math.floor(hit.x / TILE_W);
  const y0 = Math.floor(hit.y / TILE_H);
  const x1 = Math.floor((hit.x + hit.w - OVERLAP_EPS) / TILE_W);
  const y1 = Math.floor((hit.y + hit.h - OVERLAP_EPS) / TILE_H);
  let found = false;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const solid = getTileSolid(tx, ty);
      if (solid && hitsSolid(hit, solid)) {
        found = true;
        if (visit(solid)) {
          return true;
        }
      }
    }
  }
  return found;
}

function minOverlappingTileEdge(
  hit: { x: number; y: number; w: number; h: number },
  edge: 'left' | 'top'
): number {
  let best = Infinity;
  forEachOverlappingSolid(hit, (solid) => {
    const value = edge === 'left' ? solid.x : solid.y;
    if (value < best) {
      best = value;
    }
  });
  return best;
}

function maxOverlappingTileEdge(
  hit: { x: number; y: number; w: number; h: number },
  edge: 'right' | 'bottom'
): number {
  let best = -Infinity;
  forEachOverlappingSolid(hit, (solid) => {
    const value = edge === 'right' ? solid.x + solid.w : solid.y + solid.h;
    if (value > best) {
      best = value;
    }
  });
  return best;
}

/** 11x11 hitbox aligned to the bottom of the 11x19 sprite (head sticks out above). */
export function getPlayerHitbox(
  x = player.x,
  y = player.y
): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return {
    x,
    y: y + (PLAYER_HEIGHT - PLAYER_HIT),
    w: PLAYER_HIT,
    h: PLAYER_HIT,
  };
}
