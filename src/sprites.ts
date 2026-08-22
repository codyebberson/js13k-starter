import { currentColor } from './palette';

interface BakedSprite {
  canvas: HTMLCanvasElement;
  sourceX: number;
  sourceY: number;
  width: number;
  height: number;
  flipH: boolean;
  flipV: boolean;
  /** Quarter-turns counter-clockwise: 0–3 */
  rot90: number;
  /** If set, sheet pixels of this rgb are treated as `recolorTo` before palette bake. */
  recolorFrom: number;
  recolorTo: number;
  /** Walk-frame leg cut (§3 Animation): 0 = none, 1 = left leg, 2 = right leg. */
  legCut: number;
  /** If true, `recolorTo` skips the locked-palette remap (pipe stripes). */
  keepRecolor: boolean;
}

let sheet: ImageData;
const bakedSprites: BakedSprite[] = [];

/** Load the sprite sheet once and keep its raw pixels for baking. */
export async function loadSpriteSheet(url: string): Promise<void> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(image, 0, 0);
  sheet = ctx.getImageData(0, 0, image.width, image.height);
}

/**
 * Bake a region of the sheet into its own canvas, applying the current palette
 * state (locked rainbow colors render as grey) and optional flips / rotation.
 * The returned canvas is stable: rebakes redraw into it in place.
 *
 * Transform order: flip in source space, then rotate 90° CCW `rot90` times.
 * Odd rotations swap width/height.
 *
 * `recolorFrom`/`recolorTo` swap an authored rgb (e.g. the pipe stripe) to a
 * rainbow color and skip the locked-palette remap, so the stripe stays colored
 * even while the rest of the world is grey.
 */
export function createSprite(
  sourceX: number,
  sourceY: number,
  width: number,
  height: number,
  flipH = false,
  flipV = false,
  rot90 = 0,
  recolorFrom = 0,
  recolorTo = 0,
  legCut = 0,
  keepRecolor = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rot90 % 2 === 0 ? width : height;
  canvas.height = rot90 % 2 === 0 ? height : width;
  const sprite: BakedSprite = {
    canvas,
    sourceX,
    sourceY,
    width,
    height,
    flipH,
    flipV,
    rot90,
    recolorFrom,
    recolorTo,
    legCut,
    keepRecolor,
  };
  bake(sprite);
  bakedSprites.push(sprite);
  return canvas;
}

/**
 * Idle + two walk frames for an 11×19 character, derived from the single sheet
 * frame via the leg-cut trick (§3 Animation). Returns [idle, leftCut, rightCut].
 */
export function createWalkSprites(
  sourceX: number,
  sourceY: number,
  width: number,
  height: number
): HTMLCanvasElement[] {
  return [0, 1, 2].map((cut) =>
    createSprite(sourceX, sourceY, width, height, false, false, 0, 0, 0, cut)
  );
}

function bake(sprite: BakedSprite): void {
  const {
    canvas,
    sourceX,
    sourceY,
    width,
    height,
    flipH,
    flipV,
    rot90,
    recolorFrom,
    recolorTo,
    legCut,
    keepRecolor,
  } = sprite;
  const outWidth = canvas.width;
  const outHeight = canvas.height;
  const output = new ImageData(outWidth, outHeight);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Leg-cut walk frame: drop the bottom 2 rows of one leg (4 columns off
      // the vertical midline) and paint the row above solid black as the new
      // foot outline, so that leg reads as lifted.
      let footOutline = false;
      if (legCut) {
        const cutX = legCut === 1 ? 1 : 6;
        if (x >= cutX && x < cutX + 4) {
          if (y >= height - 2) {
            continue;
          }
          footOutline = y === height - 3;
        }
      }
      const srcX = sourceX + (flipH ? width - 1 - x : x);
      const srcY = sourceY + (flipV ? height - 1 - y : y);
      const srcIndex = (srcY * sheet.width + srcX) * 4;
      const alpha = sheet.data[srcIndex + 3];
      if (alpha === 0) {
        continue;
      }
      let rgb =
        (sheet.data[srcIndex] << 16) | (sheet.data[srcIndex + 1] << 8) | sheet.data[srcIndex + 2];
      if (footOutline) {
        rgb = 0;
      } else if (recolorTo && rgb === recolorFrom) {
        rgb = keepRecolor ? recolorTo : currentColor(recolorTo);
      } else {
        rgb = currentColor(rgb);
      }
      const r = (rgb >> 16) & 255;
      const g = (rgb >> 8) & 255;
      const b = rgb & 255;

      let dx = x;
      let dy = y;
      let dw = width;
      let dh = height;
      for (let i = 0; i < rot90; i++) {
        const ndx = dy;
        const ndy = dw - 1 - dx;
        dx = ndx;
        dy = ndy;
        const tmp = dw;
        dw = dh;
        dh = tmp;
      }

      const outIndex = (dy * outWidth + dx) * 4;
      output.data[outIndex] = r;
      output.data[outIndex + 1] = g;
      output.data[outIndex + 2] = b;
      output.data[outIndex + 3] = alpha;
    }
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.putImageData(output, 0, 0);
}

/**
 * Tight AABB of the opaque pixels inside a sheet cell, relative to the cell
 * origin. Used for content-sized hitboxes (enemy cells are padded to 7×9).
 */
export function measureContentBox(
  sourceX: number,
  sourceY: number,
  width: number,
  height: number
): { x: number; y: number; w: number; h: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = sheet.data[((sourceY + y) * sheet.width + sourceX + x) * 4 + 3];
      if (alpha === 0) {
        continue;
      }
      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Re-render every baked sprite after the palette unlock state changes. */
export function rebakeAllSprites(): void {
  for (const sprite of bakedSprites) {
    bake(sprite);
  }
}
