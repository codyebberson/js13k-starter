import { combatDebug } from './combat';
import { TILE_H, TILE_W } from './constants';
import { enemies, enemyHitbox, spawnBurst } from './enemies';
import { wasPressed } from './input';
import { bakeTiles } from './map';
import { unlockedColors } from './palette';
import {
  addXp,
  CRYSTAL_H,
  CRYSTAL_W,
  level,
  pickups,
  SCRAP_H,
  SCRAP_W,
  scrap,
  setScrap,
  xp,
} from './pickups';
import { getPlayerHitbox, player } from './player';
import { rebakeAllSprites } from './sprites';

let showHitboxes = false;

/**
 * Bake sheet sprites (except the player) and scatter copies — unused this pass;
 * flowers are live world props. Dev-only.
 */
export function initDebugProps(): void {}

/**
 * Keys 1-7 toggle rainbow unlocks;
 * 8 toggles hitbox outlines; 9 burst-spawns 50 enemies; 0 restores full HP;
 * X grants 5 XP; C grants 50 scrap; K sets HP to 0.
 * Dev-only.
 */
export function handleDebugKeys(): void {
  for (let i = 0; i < 7; i++) {
    if (wasPressed('Digit' + (i + 1))) {
      unlockedColors[i] = !unlockedColors[i];
      rebakeAllSprites();
      bakeTiles();
    }
  }
  if (wasPressed('Digit8')) {
    showHitboxes = !showHitboxes;
  }
  if (wasPressed('Digit9')) {
    spawnBurst(50);
  }
  if (wasPressed('Digit0')) {
    player.hp = player.maxHp;
  }
  if (wasPressed('KeyX')) {
    addXp(5);
  }
  if (wasPressed('KeyC')) {
    setScrap(scrap + 50);
  }
  if (wasPressed('KeyK')) {
    player.hp = 0;
  }
}

/** Hitbox outlines and footer help. Dev-only. */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  _firstTileX: number,
  _firstTileY: number,
  lastTileX: number,
  lastTileY: number,
  viewHeight: number
): void {
  const viewLeft = cameraX;
  const viewTop = cameraY;
  const viewRight = (lastTileX + 1) * TILE_W;
  const viewBottom = (lastTileY + 1) * TILE_H;

  if (showHitboxes) {
    for (const enemy of enemies) {
      const box = enemyHitbox(enemy);
      if (
        box.x + box.w < viewLeft ||
        box.x > viewRight ||
        box.y + box.h < viewTop ||
        box.y > viewBottom
      ) {
        continue;
      }
      debugRect(
        ctx,
        Math.floor(box.x - cameraX),
        Math.floor(box.y - cameraY),
        box.w,
        box.h,
        '#f0f'
      );
    }
    for (const p of pickups) {
      debugRect(
        ctx,
        Math.floor(p.x - cameraX),
        Math.floor(p.y - cameraY),
        p.kind === 0 ? CRYSTAL_W : SCRAP_W,
        p.kind === 0 ? CRYSTAL_H : SCRAP_H,
        '#8f8'
      );
    }
    const hit = getPlayerHitbox();
    debugRect(ctx, Math.floor(hit.x - cameraX), Math.floor(hit.y - cameraY), hit.w, hit.h, '#f00');

    const combat = combatDebug();
    debugRect(
      ctx,
      Math.floor(combat.horn.x - cameraX),
      Math.floor(combat.horn.y - cameraY),
      combat.horn.w,
      combat.horn.h,
      '#ff8'
    );
    const pcx = Math.floor(hit.x + hit.w / 2 - cameraX) + 0.5;
    const pcy = Math.floor(hit.y + hit.h / 2 - cameraY) + 0.5;
    ctx.strokeStyle = '#8ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pcx, pcy, combat.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#fff';
  ctx.font = '5px monospace';
  ctx.fillText(
    'wasd/arrows: move / 1-7: colors / 8: hitboxes / 9: +50 / 0: heal / x: +xp / c: +scrap / k: kill   enemies: ' +
      enemies.length +
      ' hp: ' +
      player.hp +
      ' lives: ' +
      player.lives +
      ' xp: ' +
      xp +
      ' lv: ' +
      level +
      ' scrap: ' +
      scrap,
    3,
    viewHeight - 3
  );
}

function debugRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}
