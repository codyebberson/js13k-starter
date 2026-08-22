// Bit-packed 3×5 font. Bit 0 = top-left, then row-major (3 bits per row).
// Glyphs: A–Z, 0–9, and the punctuation the UI needs (including :).
const CHARS = '0123456789ABCDEFGHIKLMNOPQRSTUVWXYZ,!+/:.';
const GLYPHS = [
  // 0-9
  0x7b6f, 0x749a, 0x73e7, 0x79e7, 0x49ed, 0x79cf, 0x7bcf, 0x4927, 0x7bef, 0x79ef,
  // A–Z except unused J
  0x5bea, 0x3aeb, 0x624e, 0x3b6b, 0x72cf, 0x12cf, 0x6b4e, 0x5bed, 0x7497, 0x5aed, 0x7249,
  0x5bfd, 0x5b7b, 0x2b6a, 0x12eb, 0x476a, 0x5aeb, 0x348e, 0x2497, 0x7b6d, 0x2b6d, 0x5fed, 0x5aad,
  0x24ad, 0x72a7,
  // , ! + / : .
  0x1400, 0x2092, 0x05d0, 0x1494, 0x0410, 0x2000,
];

export const FONT_W = 3;
export const FONT_H = 5;
export const FONT_GAP = 1;

export function measureText(text: string, scale = 1): { w: number; h: number } {
  const n = text.length;
  return {
    w: n === 0 ? 0 : (n * FONT_W + (n - 1) * FONT_GAP) * scale,
    h: FONT_H * scale,
  };
}

function glyphBits(ch: string): number {
  const i = CHARS.indexOf(ch);
  return i < 0 ? 0 : GLYPHS[i];
}

/** Draw a string with per-pixel fillRect. Used when baking labels, not per-frame. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = '#fff',
  scale = 1
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const bits = glyphBits(text[i]);
    const ox = x + i * (FONT_W + FONT_GAP) * scale;
    for (let b = 0; b < 15; b++) {
      if (bits & (1 << b)) {
        ctx.fillRect(ox + (b % 3) * scale, y + ((b / 3) | 0) * scale, scale, scale);
      }
    }
  }
}

/**
 * Render text to an offscreen canvas. Pass `into` to redraw a cached label in place
 * (resizes the canvas when the string's pixel width changes).
 */
export function bakeText(
  text: string,
  color = '#fff',
  scale = 1,
  into?: HTMLCanvasElement
): HTMLCanvasElement {
  const { w, h } = measureText(text, scale);
  const canvas = into ?? document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  drawText(ctx, text, 0, 0, color, scale);
  return canvas;
}
