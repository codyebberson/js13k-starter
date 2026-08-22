import { TILE_H, TILE_W } from './constants';
import { RAINBOW_COLORS } from './palette';
import { createSprite } from './sprites';

const FLOWER_W = 7;
const FLOWER_H = 10;
const DENSITY = 0.33;

/** 4 sheet variants × 7 petal colors. Palette-locked whites grey with their family. */
const flowers: HTMLCanvasElement[] = [];

export function bakeFlowers(): void {
  if (flowers.length) {
    return;
  }
  for (let variant = 0; variant < 4; variant++) {
    for (let color = 0; color < 7; color++) {
      flowers.push(
        createSprite(
          12 + variant * 7,
          19,
          FLOWER_W,
          FLOWER_H,
          false,
          false,
          0,
          0xffffff,
          RAINBOW_COLORS[color]
        )
      );
    }
  }
}

function hash2(tx: number, ty: number): number {
  let n = Math.imul(tx | 0, 374761393) + Math.imul(ty | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Seeded ~33% of tiles; variant and petal color come from the same hash. */
export function drawFlowers(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  firstTileX: number,
  firstTileY: number,
  lastTileX: number,
  lastTileY: number
): void {
  for (let ty = firstTileY; ty <= lastTileY; ty++) {
    for (let tx = firstTileX; tx <= lastTileX; tx++) {
      const h = hash2(tx, ty);
      if (h >= DENSITY) {
        continue;
      }
      const pick = Math.min(27, ((h / DENSITY) * 28) | 0);
      const canvas = flowers[pick];
      const sx = Math.floor(tx * TILE_W + ((TILE_W - FLOWER_W) >> 1) - cameraX);
      const sy = Math.floor(ty * TILE_H + TILE_H - FLOWER_H - cameraY);
      ctx.drawImage(canvas, sx, sy);
    }
  }
}
