import {
  PLAYER_HEIGHT,
  PLAYER_HIT,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
  PLAYER_SPEED,
} from './constants';
import { spawnExplosion } from './fx';
import { isDown, stickX, stickY } from './input';
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
  // Infinite white map has no solids (`getTileSolid` is always null). Tile-edge
  // snap is in git history; restore it when walls return (Director's Cut).
  player.x += dx * speed * dt;
  player.y += dy * speed * dt;
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
