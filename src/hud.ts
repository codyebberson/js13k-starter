import { bakeText } from './font';
import { RAINBOW_COLORS, unlockedColors } from './palette';
import { level, scrap, scrapSprite, xp, xpNeeded } from './pickups';

const SCALE = 2;
const PAD = 4 * SCALE;
const PAUSE_W = 7 * SCALE;
const PAUSE_H = 6 * SCALE;
const PAUSE_PAD = 3 * SCALE;
const XP_W = 60 * SCALE;
const XP_INNER_H = 2 * SCALE;
const SQ = 6 * SCALE;
const SQ_GAP = 1 * SCALE;
const SQ_INNER = 4 * SCALE;

let levelPrefix: HTMLCanvasElement;
let levelNumber: HTMLCanvasElement;
let scrapLabel: HTMLCanvasElement;
let timerLabel: HTMLCanvasElement;
let lastLevel = -1;
let lastScrap = -1;
let lastTimer = '';

export function bakeHud(): void {
  levelPrefix = bakeText('LEVEL', '#fff', SCALE);
}

export function formatScrap(n: number): string {
  let s = String(n | 0);
  let out = '';
  while (s.length > 3) {
    out = ',' + s.slice(-3) + out;
    s = s.slice(0, -3);
  }
  return s + out;
}

function formatTime(ms: number): string {
  const total = Math.max(0, (ms / 1000) | 0);
  const m = (total / 60) | 0;
  const s = total % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function outlinedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  innerW: number,
  innerH: number,
  fill: number
): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, innerW + 2 * SCALE, innerH + 2 * SCALE);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + SCALE, y + SCALE, Math.round(innerW * fill), innerH);
}

/** Pause icon plus a little extra pad so the tiny glyph is clickable. */
export function pauseIconContains(x: number, y: number, viewHeight: number): boolean {
  const py = viewHeight - PAD - PAUSE_H;
  return (
    x >= PAD - PAUSE_PAD &&
    x < PAD + PAUSE_W + PAUSE_PAD &&
    y >= py - PAUSE_PAD &&
    y < py + PAUSE_H + PAUSE_PAD
  );
}

/** Screen-space HUD. `runTime` is elapsed run ms. */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  viewWidth: number,
  viewHeight: number,
  runTime: number
): void {
  if (level !== lastLevel) {
    lastLevel = level;
    levelNumber = bakeText(String(level), '#fff', SCALE, levelNumber);
  }
  if (scrap !== lastScrap) {
    lastScrap = scrap;
    scrapLabel = bakeText(formatScrap(scrap), '#fff', SCALE, scrapLabel);
  }
  const clock = formatTime(runTime);
  if (clock !== lastTimer) {
    lastTimer = clock;
    timerLabel = bakeText(clock, '#fff', SCALE, timerLabel);
  }

  const pauseY = viewHeight - PAD - PAUSE_H;
  for (const ox of [0, 4 * SCALE]) {
    ctx.fillStyle = '#000';
    ctx.fillRect(PAD + ox, pauseY, 3 * SCALE, 6 * SCALE);
    ctx.fillStyle = '#fff';
    ctx.fillRect(PAD + ox + SCALE, pauseY + SCALE, SCALE, 4 * SCALE);
  }

  const barX = Math.floor((viewWidth - XP_W) / 2);
  const textY = PAD;
  const plateH = timerLabel.height + 2 * SCALE;
  const gap = SCALE;
  const levelW = levelPrefix.width + gap + levelNumber.width;

  ctx.fillStyle = '#000';
  ctx.fillRect(barX, textY - SCALE, timerLabel.width + 2 * SCALE, plateH);
  ctx.drawImage(timerLabel, barX + SCALE, textY);

  const levelPlateX = barX + XP_W - (levelW + 2 * SCALE);
  ctx.fillStyle = '#000';
  ctx.fillRect(levelPlateX, textY - SCALE, levelW + 2 * SCALE, plateH);
  ctx.drawImage(levelPrefix, levelPlateX + SCALE, textY);
  ctx.drawImage(levelNumber, levelPlateX + SCALE + levelPrefix.width + gap, textY);

  const barY = PAD + timerLabel.height + 2 * SCALE;
  const need = xpNeeded();
  outlinedBar(ctx, barX, barY, XP_W - 2 * SCALE, XP_INNER_H, need > 0 ? Math.min(1, xp / need) : 1);

  const sqRowW = 7 * SQ + 6 * SQ_GAP;
  let sqX = barX + Math.floor((XP_W - sqRowW) / 2);
  const sqY = barY + XP_INNER_H + 4 * SCALE;
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = '#000';
    ctx.fillRect(sqX, sqY, SQ, SQ);
    ctx.fillStyle = unlockedColors[i]
      ? '#' + RAINBOW_COLORS[i].toString(16).padStart(6, '0')
      : '#747474';
    ctx.fillRect(sqX + SCALE, sqY + SCALE, SQ_INNER, SQ_INNER);
    sqX += SQ + SQ_GAP;
  }

  const iconW = scrapSprite.width * SCALE;
  const iconH = scrapSprite.height * SCALE;
  const iconX = viewWidth - PAD - iconW;
  const iconY = viewHeight - PAD - iconH;
  const scrapX = iconX - 2 * SCALE - scrapLabel.width;
  const scrapY = iconY + ((iconH - scrapLabel.height) >> 1);
  ctx.fillStyle = '#000';
  ctx.fillRect(scrapX - SCALE, scrapY - SCALE, scrapLabel.width + 2 * SCALE, scrapLabel.height + 2 * SCALE);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scrapSprite, iconX, iconY, iconW, iconH);
  ctx.drawImage(scrapLabel, scrapX, scrapY);
}
