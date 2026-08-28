import { drawCombat, updateCombat } from './combat';
import {
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TARGET_VIEW_HEIGHT,
  TILE_H,
  TILE_W,
  WALK_FRAME_MS,
} from './constants';
import { bakeEnemyTypes, drawEnemies, updateEnemies } from './enemies';
import { bakeFlowers, drawFlowers } from './flowers';
import { drawExplosions, drawHudShower, updateExplosions } from './fx';
import { bakeHud, drawHud } from './hud';
import { clearPressedKeys, drawStick, initInput, setStickEnabled, setViewSize } from './input';
import { bakeTiles, drawVeins, getTile, tileCanvases } from './map';
import {
  drawOverlays,
  initOverlays,
  isWorldFrozen,
  runTime,
  SCENE_RUN,
  scene,
  updateOverlays,
} from './overlays';
import { bakePickups, drawPickups, updatePickups } from './pickups';
import { bakePortals, drawPortalMarkers, drawPortals } from './portals';
import { player, updatePlayer } from './player';
import { initMusic } from './music';
import { createWalkSprites, loadSpriteSheet } from './sprites';

const canvas = document.querySelector('#c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

// Loaded only when import.meta.env.DEV — dropped from production entry
let debug: typeof import('./debug') | undefined;

// The visible slice of the world, in world pixels; recomputed on resize
let viewWidth = 1;
let viewHeight = 1;

// Fill the whole viewport: pick the integer pixel scale that gets the view
// height closest to TARGET_VIEW_HEIGHT, then size the canvas to cover the
// window at that scale (it may overhang by up to scale-1 px; overflow hidden).
function resize(): void {
  const scale = Math.max(1, Math.round(window.innerHeight / TARGET_VIEW_HEIGHT));
  viewWidth = Math.ceil(window.innerWidth / scale);
  viewHeight = Math.ceil(window.innerHeight / scale);
  canvas.width = viewWidth;
  canvas.height = viewHeight;
  canvas.style.width = viewWidth * scale + 'px';
  canvas.style.height = viewHeight * scale + 'px';
  ctx.imageSmoothingEnabled = false;
  setViewSize(viewWidth, viewHeight);
}

// [idle, left leg-cut, right leg-cut] — the cut frames alternate while moving
let playerSprites: HTMLCanvasElement[];

async function main(): Promise<void> {
  await loadSpriteSheet('sprites.png');

  // Single 11x19 sheet frame, drawn 1:1 with no facing flips (facing art TBD);
  // the two walk frames are derived at bake time (§3 leg-cut)
  playerSprites = createWalkSprites(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
  bakeEnemyTypes();
  bakePickups();
  bakePortals();
  bakeFlowers();
  bakeHud();

  bakeTiles();
  initInput(canvas);
  initMusic();
  initOverlays();
  if (import.meta.env.DEV) {
    debug = await import('./debug');
    debug.initDebugProps();
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(gameLoop);
}

let lastTime = 0;

function gameLoop(time: number): void {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(time - lastTime, 1000 / 30);
  lastTime = time;

  if (debug) {
    debug.handleDebugKeys();
  }
  updateOverlays(viewWidth, viewHeight, dt);
  setStickEnabled(scene === SCENE_RUN && !isWorldFrozen());
  if (!isWorldFrozen()) {
    updatePlayer(dt);
    const cam = cameraOrigin();
    updateCombat(dt, cam.x, cam.y, viewWidth, viewHeight);
    updateEnemies(dt, viewWidth, viewHeight);
    updatePickups(dt);
    updateExplosions(dt);
  }
  render();
  clearPressedKeys();
}

function render(): void {
  // The camera stays fractional; every draw position is rounded exactly once
  // via floor(worldX - cameraX). This keeps the player's screen position
  // perfectly stable while the camera follows (no 1px jitter from double
  // rounding), regardless of view size parity.
  const { x: cameraX, y: cameraY } = cameraOrigin();

  const firstTileX = Math.floor(cameraX / TILE_W);
  const firstTileY = Math.floor(cameraY / TILE_H);
  const lastTileX = Math.floor((cameraX + viewWidth) / TILE_W);
  const lastTileY = Math.floor((cameraY + viewHeight) / TILE_H);
  drawTiles(tileCanvases, cameraX, cameraY, firstTileX, firstTileY, lastTileX, lastTileY);
  drawVeins(ctx, cameraX, cameraY, viewWidth, viewHeight);
  drawFlowers(ctx, cameraX, cameraY, firstTileX, firstTileY, lastTileX, lastTileY);

  drawPickups(ctx, cameraX, cameraY, viewWidth, viewHeight);

  if (scene === SCENE_RUN) {
    drawPortals(ctx, cameraX, cameraY, viewWidth, viewHeight);
    drawEnemies(ctx, cameraX, cameraY, viewWidth, viewHeight);
  }

  const playerScreenX = Math.floor(player.x - cameraX);
  const playerScreenY = Math.floor(player.y - cameraY);
  if (player.iframes <= 0 || ((player.iframes / 80) | 0) % 2 === 0) {
    const frame = player.moving ? 1 + (((player.walkTime / WALK_FRAME_MS) | 0) % 2) : 0;
    ctx.drawImage(playerSprites[frame], playerScreenX, playerScreenY);
  }
  drawCombat(ctx, cameraX, cameraY);
  drawExplosions(ctx, cameraX, cameraY, viewWidth, viewHeight);

  if (scene === SCENE_RUN) {
    ctx.fillStyle = '#000';
    ctx.fillRect(playerScreenX, playerScreenY + PLAYER_HEIGHT + 1, PLAYER_WIDTH, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(
      playerScreenX + 1,
      playerScreenY + PLAYER_HEIGHT + 2,
      Math.round((PLAYER_WIDTH - 2) * (player.hp / player.maxHp)),
      1
    );
    drawHud(ctx, viewWidth, viewHeight, runTime);
    drawPortalMarkers(ctx, cameraX, cameraY, viewWidth, viewHeight);
    drawHudShower(ctx);
    drawStick(ctx, true);
  }
  drawOverlays(ctx, viewWidth, viewHeight);

  if (debug) {
    debug.drawDebugOverlay(
      ctx,
      cameraX,
      cameraY,
      firstTileX,
      firstTileY,
      lastTileX,
      lastTileY,
      viewHeight
    );
  }
}

function drawTiles(
  canvases: HTMLCanvasElement[],
  cameraX: number,
  cameraY: number,
  firstTileX: number,
  firstTileY: number,
  lastTileX: number,
  lastTileY: number
): void {
  for (let ty = firstTileY; ty <= lastTileY; ty++) {
    for (let tx = firstTileX; tx <= lastTileX; tx++) {
      ctx.drawImage(
        canvases[getTile(tx, ty)],
        Math.floor(tx * TILE_W - cameraX),
        Math.floor(ty * TILE_H - cameraY)
      );
    }
  }
}

function cameraOrigin(): { x: number; y: number } {
  return {
    x: player.x + PLAYER_WIDTH / 2 - viewWidth / 2,
    y: player.y + PLAYER_HEIGHT / 2 - viewHeight / 2,
  };
}

main();
