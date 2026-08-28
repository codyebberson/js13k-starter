import { PLAYER_HEIGHT } from './constants';
import { bakeText, drawText, FONT_GAP, FONT_H, FONT_W, measureText } from './font';
import { mouse, wasPressed } from './input';
import { currentColor, RAINBOW_COLORS } from './palette';

const LAYOUT_LIST = 0;
const LAYOUT_CARDS = 1;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

let layout = LAYOUT_LIST;
let heading: HTMLCanvasElement | null = null;
let subheading: HTMLCanvasElement | null = null;
let headingTop = false;
let labels: HTMLCanvasElement[] = [];
let bodies: HTMLCanvasElement[] = [];
let selected = 0;
let onPick: ((index: number) => void) | null = null;
const rects: Rect[] = [];
let headingX = 0;
let headingY = 0;
let subX = 0;
let subY = 0;
let storyText = '';
let storyLines: HTMLCanvasElement[] = [];
let storyY = 0;
let storyBakeW = 0;

export function isUiOpen(): boolean {
  return onPick !== null;
}

export function closeUi(): void {
  onPick = null;
  heading = null;
  subheading = null;
  labels = [];
  bodies = [];
  storyText = '';
  storyLines = [];
  storyBakeW = 0;
  rects.length = 0;
}

/** ROYGBIV per letter; 1px black outline. Letters follow the live palette lock. */
function bakeRainbowTitle(text: string, scale: number): HTMLCanvasElement {
  const { w, h } = measureText(text, scale);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w + 2);
  canvas.height = Math.max(1, h + 2);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  let colorIndex = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') {
      continue;
    }
    const fill = currentColor(RAINBOW_COLORS[colorIndex % 7]);
    const ox = 1 + i * (FONT_W + FONT_GAP) * scale;
    drawText(ctx, ch, ox - 1, 1, '#000', scale);
    drawText(ctx, ch, ox + 1, 1, '#000', scale);
    drawText(ctx, ch, ox, 0, '#000', scale);
    drawText(ctx, ch, ox, 2, '#000', scale);
    drawText(ctx, ch, ox, 1, '#' + fill.toString(16).padStart(6, '0'), scale);
    colorIndex++;
  }
  return canvas;
}

function wrap(text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && measureText(next).w > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

/** Hide list buttons but keep the heading (title Start drain). */
export function hideMenuButtons(): void {
  labels = [];
  bodies = [];
  rects.length = 0;
}

export function rebakeRainbowTitle(): void {
  heading = bakeRainbowTitle('DYE HARD', 3);
}

export function setTitleStory(text: string): void {
  storyText = text;
  storyLines = [];
  storyBakeW = 0;
}

export function openMenu(
  title: string | null,
  items: string[],
  pick: (index: number) => void,
  titleScale = 1,
  titleAtTop = false,
  subtitle?: string
): void {
  layout = LAYOUT_LIST;
  heading = title
    ? titleAtTop
      ? bakeRainbowTitle(title, titleScale)
      : bakeText(title, '#fff', titleScale)
    : null;
  subheading = subtitle ? bakeText(subtitle) : null;
  headingTop = titleAtTop;
  labels = items.map((item) => bakeText(item));
  bodies = [];
  selected = 0;
  onPick = pick;
}

export function openCards(
  title: string | null,
  items: { title: string; body: string }[],
  pick: (index: number) => void,
  titleColor = '#fff'
): void {
  layout = LAYOUT_CARDS;
  const cardScale = 1;
  heading = title ? bakeText(title, titleColor, cardScale) : null;
  subheading = null;
  headingTop = false;
  labels = items.map((item) => bakeText(item.title, '#fff', cardScale));
  bodies = items.map((item) => bakeText(item.body, '#fff', cardScale));
  selected = 0;
  onPick = pick;
}

function pointIn(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

function layoutUi(viewWidth: number, viewHeight: number): void {
  rects.length = 0;
  headingX = 0;
  headingY = 0;
  subX = 0;
  subY = 0;
  const n = labels.length;
  if (n === 0) {
    if (heading) {
      headingX = (viewWidth - heading.width) >> 1;
      headingY = headingTop
        ? ((viewHeight - PLAYER_HEIGHT) >> 1) - 8 - heading.height
        : (viewHeight - heading.height) >> 1;
    }
    if (storyText && headingTop) {
      const maxW = Math.max(40, viewWidth - 16);
      if (storyBakeW !== maxW) {
        storyBakeW = maxW;
        storyLines = wrap(storyText, maxW).map((line) => bakeText(line));
      }
      storyY = ((viewHeight - PLAYER_HEIGHT) >> 1) + PLAYER_HEIGHT + 8;
    }
    return;
  }

  if (layout === LAYOUT_LIST) {
    const padX = 6;
    const padY = 4;
    const boxH = labels[0].height + padY * 2 + 2;
    const gap = 4;
    let inner = 40;
    for (const label of labels) {
      if (label.width > inner) {
        inner = label.width;
      }
    }
    const boxW = inner + padX * 2 + 2;
    const blockH = n * boxH + (n - 1) * gap;
    const x = (viewWidth - boxW) >> 1;
    const subH = subheading ? subheading.height + 4 : 0;
    let y: number;
    if (heading) {
      headingX = (viewWidth - heading.width) >> 1;
      if (headingTop) {
        // Unicorn is camera-centered.
        const playerY = (viewHeight - PLAYER_HEIGHT) >> 1;
        headingY = playerY - 8 - heading.height;
        y = playerY + PLAYER_HEIGHT + 8;
      } else {
        const total = heading.height + 8 + subH + blockH;
        headingY = (viewHeight - total) >> 1;
        if (subheading) {
          subX = (viewWidth - subheading.width) >> 1;
          subY = headingY + heading.height + 4;
        }
        y = headingY + heading.height + 8 + subH;
      }
    } else {
      y = (viewHeight - blockH) >> 1;
    }
    for (let i = 0; i < n; i++) {
      rects.push({ x, y: y + i * (boxH + gap), w: boxW, h: boxH });
    }
    return;
  }

  const gap = 4;
  const outer = 8;
  const padX = 6;
  const padY = 4;
  const titleH = labels[0].height;
  const bodyH = bodies[0] ? bodies[0].height : 0;
  const cardH = padY * 2 + 2 + titleH + (bodyH ? 4 + bodyH : 0);
  let inner = 48;
  for (let i = 0; i < n; i++) {
    if (labels[i].width > inner) {
      inner = labels[i].width;
    }
    if (bodies[i] && bodies[i].width > inner) {
      inner = bodies[i].width;
    }
  }
  const cardW = Math.min(viewWidth - outer * 2, inner + padX * 2 + 2);
  const blockH = n * cardH + (n - 1) * gap;
  const x = (viewWidth - cardW) >> 1;
  let y: number;
  if (heading) {
    headingX = (viewWidth - heading.width) >> 1;
    const total = heading.height + 8 + blockH;
    headingY = (viewHeight - total) >> 1;
    y = headingY + heading.height + 8;
  } else {
    y = (viewHeight - blockH) >> 1;
  }
  for (let i = 0; i < n; i++) {
    rects.push({ x, y: y + i * (cardH + gap), w: cardW, h: cardH });
  }
}

/** Navigate with move keys / mouse hover; Enter or click confirms. */
export function updateUi(viewWidth: number, viewHeight: number): void {
  if (!onPick) {
    return;
  }
  layoutUi(viewWidth, viewHeight);
  const n = labels.length;
  if (n === 0) {
    return;
  }
  if (
    wasPressed('ArrowLeft') ||
    wasPressed('KeyA') ||
    wasPressed('ArrowUp') ||
    wasPressed('KeyW')
  ) {
    selected = (selected + n - 1) % n;
  }
  if (
    wasPressed('ArrowRight') ||
    wasPressed('KeyD') ||
    wasPressed('ArrowDown') ||
    wasPressed('KeyS')
  ) {
    selected = (selected + 1) % n;
  }
  for (let i = 0; i < rects.length; i++) {
    if (pointIn(mouse.x, mouse.y, rects[i])) {
      selected = i;
    }
  }
  const confirmKey = wasPressed('Enter') || wasPressed('NumpadEnter');
  const confirmClick = mouse.clicked && pointIn(mouse.x, mouse.y, rects[selected]);
  if (confirmKey || confirmClick) {
    onPick(selected);
  }
}

export function drawUi(ctx: CanvasRenderingContext2D, viewWidth: number, viewHeight: number): void {
  if (!onPick) {
    return;
  }
  layoutUi(viewWidth, viewHeight);

  if (!headingTop) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
  }

  if (heading) {
    ctx.drawImage(heading, headingX, headingY);
  }
  if (subheading) {
    ctx.drawImage(subheading, subX, subY);
  }

  if (storyLines.length) {
    let inner = 0;
    for (const line of storyLines) {
      if (line.width > inner) {
        inner = line.width;
      }
    }
    const pad = 3;
    const gap = 2;
    const blockH = storyLines.length * (FONT_H + gap) - gap + pad * 2;
    const blockW = inner + pad * 2;
    const bx = (viewWidth - blockW) >> 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(bx, storyY, blockW, blockH);
    let ly = storyY + pad;
    for (const line of storyLines) {
      ctx.drawImage(line, (viewWidth - line.width) >> 1, ly);
      ly += FONT_H + gap;
    }
  }

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    ctx.fillStyle = '#333333';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#000';
    ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    if (i === selected) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    }

    ctx.save();
    ctx.beginPath();
    const inset = i === selected ? 4 : 2;
    ctx.rect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2);
    ctx.clip();
    const bodyH = bodies[i] ? bodies[i].height : 0;
    const titleX = r.x + ((r.w - labels[i].width) >> 1);
    const titleY = r.y + ((r.h - labels[i].height - (bodyH ? bodyH + 4 : 0)) >> 1);
    ctx.drawImage(labels[i], titleX, titleY);
    if (bodies[i]) {
      const bodyX = r.x + ((r.w - bodies[i].width) >> 1);
      ctx.drawImage(bodies[i], bodyX, titleY + labels[i].height + 4);
    }
    ctx.restore();
  }
}
