import { MAP_HEIGHT, MAP_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH, TILE_SIZE } from '../constants';
import { finalBossSprites } from '../enemies';
import { bakeText, FONT_H, measureText } from '../font';
import { anyKeyPressed, mouse } from '../input';
import { bakeTiles, getTile, tileCanvases } from '../map';
import { colorWave, WAVE_SPEED } from '../overlays';
import { unlockedColors } from '../palette';
import { drainCaps, type PipePiece, pipeRuns, plazaPortal, portals } from './pipes';
import { createSprite, rebakeAllSprites } from '../sprites';

// Opening cutscene: boss + portal already in the plaza, one line, then pipes
// drop staggered. Each drop starts that color's drain from the plaza cap.
// Unicorn gets the last line once every slice is grey.

const PH_TALK = 0;
const PH_PIPES = 1;
const PH_UNICORN = 2;

const LINE_BOSS = 'THE PORTALS WORK! TIME TO STEAL THESE VALUABLE COLORS!';
const LINE_UNICORN = 'I MUST FIND AND DESTROY THOSE PORTALS!';
const REVEAL_GAP_MS = 220;

let onDone: (() => void) | null = null;
let phase = PH_TALK;
/** Time within the current phase (ms). */
let t = 0;
/** Total cutscene time (ms), for the dialogue blink. */
let time = 0;
/** Swallow the input that confirmed START on the same frame. */
let skipGuard = false;

let plazaGate: PipePiece;
let showBoss = true;

const boss = { x: 0, y: 0 };

/** Pipes revealed so far (drain starts on each drop). */
let revealed = 0;

const drainWaves: {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: number;
  active: boolean;
}[] = [];
const greySlice: HTMLCanvasElement[] = [];

let dlgLines: HTMLCanvasElement[] = [];
let dlgBakedW = -1;

let unicornSprite: HTMLCanvasElement | undefined;

export function startCutscene(done: () => void): void {
  onDone = done;
  phase = PH_TALK;
  t = 0;
  time = 0;
  skipGuard = true;
  revealed = 0;
  drainWaves.length = 0;
  showBoss = true;
  dlgBakedW = -1;

  for (let i = 0; i < 7; i++) {
    unlockedColors[i] = true;
  }
  bakeTiles();
  rebakeAllSprites();

  if (!unicornSprite) {
    unicornSprite = createSprite(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
  }

  plazaGate = plazaPortal();
  boss.x = plazaGate.x - PLAYER_WIDTH - 4;
  boss.y = plazaGate.y + plazaGate.canvas.height - PLAYER_HEIGHT;
}

/** Jump to the run-start state: all colors locked, all pipes standing. */
function finish(): void {
  colorWave.active = false;
  for (let i = 0; i < 7; i++) {
    unlockedColors[i] = false;
  }
  bakeTiles();
  rebakeAllSprites();
  const done = onDone;
  onDone = null;
  if (done) {
    done();
  }
}

export function updateCutscene(dt: number): void {
  if (!onDone) {
    return;
  }
  const pressed = !skipGuard && (anyKeyPressed() || mouse.clicked);
  skipGuard = false;
  t += dt;
  time += dt;

  if (phase === PH_TALK) {
    if (pressed) {
      phase = PH_PIPES;
      t = 0;
    }
    return;
  }

  if (pressed) {
    finish();
    return;
  }

  if (phase === PH_PIPES) {
    while (revealed < 7 && t >= revealed * REVEAL_GAP_MS) {
      startDrainWave(revealed);
      revealed++;
      showBoss = false;
    }
    let live = 0;
    let locked = false;
    for (const wave of drainWaves) {
      if (!wave.active) {
        continue;
      }
      wave.r += WAVE_SPEED * dt;
      if (wave.r >= wave.maxR) {
        wave.active = false;
        unlockedColors[wave.color] = false;
        locked = true;
      } else {
        live++;
      }
    }
    if (locked) {
      bakeTiles();
      rebakeAllSprites();
    }
    if (revealed >= 7 && live === 0) {
      phase = PH_UNICORN;
      dlgBakedW = -1;
    }
  }
}

function startDrainWave(color: number): void {
  const worldW = MAP_WIDTH * TILE_SIZE;
  const worldH = MAP_HEIGHT * TILE_SIZE;
  const cap = drainCaps[color];
  const gate = portals[color];
  const ox = cap ? cap.x : gate.x + gate.canvas.width / 2;
  const oy = cap ? cap.y : gate.y + gate.canvas.height / 2;
  drainWaves.push({
    x: ox,
    y: oy,
    r: 0,
    maxR: Math.max(
      Math.hypot(ox, oy),
      Math.hypot(worldW - ox, oy),
      Math.hypot(ox, worldH - oy),
      Math.hypot(worldW - ox, worldH - oy)
    ),
    color,
    active: true,
  });
  unlockedColors[color] = false;
  bakeTiles();
  let canvas = greySlice[color];
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    greySlice[color] = canvas;
  }
  (canvas.getContext('2d') as CanvasRenderingContext2D).drawImage(tileCanvases[color], 0, 0);
  unlockedColors[color] = true;
  bakeTiles();
}

/** Clip each live drain so that color's slice greys from the plaza cap outward. */
export function drawCutsceneDrain(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  firstTileX: number,
  firstTileY: number,
  lastTileX: number,
  lastTileY: number
): void {
  if (!onDone) {
    return;
  }
  for (const wave of drainWaves) {
    if (!wave.active) {
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(wave.x - cameraX, wave.y - cameraY, wave.r, 0, Math.PI * 2);
    ctx.clip();
    const canvas = greySlice[wave.color];
    for (let ty = firstTileY; ty <= lastTileY; ty++) {
      for (let tx = firstTileX; tx <= lastTileX; tx++) {
        if (getTile(tx, ty) === wave.color) {
          ctx.drawImage(
            canvas,
            Math.floor(tx * TILE_SIZE - cameraX),
            Math.floor(ty * TILE_SIZE - cameraY)
          );
        }
      }
    }
    ctx.restore();
  }
}

/** World-space cutscene layer: revealed pipes, plaza portal, boss. */
export function drawCutsceneWorld(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number
): void {
  if (!onDone) {
    return;
  }
  for (let i = 0; i < revealed; i++) {
    const gate = portals[i];
    ctx.drawImage(gate.canvas, Math.floor(gate.x - cameraX), Math.floor(gate.y - cameraY));
    for (const piece of pipeRuns[i]) {
      ctx.drawImage(piece.canvas, Math.floor(piece.x - cameraX), Math.floor(piece.y - cameraY));
    }
  }

  if (showBoss) {
    ctx.drawImage(
      plazaGate.canvas,
      Math.floor(plazaGate.x - cameraX),
      Math.floor(plazaGate.y - cameraY)
    );
    if (finalBossSprites) {
      ctx.drawImage(
        finalBossSprites[0],
        Math.floor(boss.x - cameraX),
        Math.floor(boss.y - cameraY)
      );
    }
  }
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

/** Zelda-like dialogue panel: framed speaker portrait left, text right. */
export function drawCutsceneUi(
  ctx: CanvasRenderingContext2D,
  viewWidth: number,
  viewHeight: number
): void {
  if (!onDone || (phase !== PH_TALK && phase !== PH_UNICORN)) {
    return;
  }

  const pad = 3;
  const frameW = 15;
  const frameH = 23;
  const panelW = Math.min(viewWidth - 8, 240);
  const panelH = frameH + pad * 2;
  const px = (viewWidth - panelW) >> 1;
  const py = viewHeight - panelH - 5;
  const textX = px + pad + frameW + 4;
  const textW = px + panelW - pad - textX;

  if (dlgBakedW !== textW) {
    dlgBakedW = textW;
    dlgLines = wrap(phase === PH_UNICORN ? LINE_UNICORN : LINE_BOSS, textW).map((line) =>
      bakeText(line)
    );
  }

  ctx.fillStyle = '#fff';
  ctx.fillRect(px - 1, py - 1, panelW + 2, panelH + 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(px, py, panelW, panelH);

  const fx = px + pad;
  const fy = py + pad;
  ctx.fillStyle = '#747474';
  ctx.fillRect(fx, fy, frameW, frameH);
  ctx.fillStyle = '#000';
  ctx.fillRect(fx + 1, fy + 1, frameW - 2, frameH - 2);
  const portrait = phase === PH_UNICORN ? unicornSprite : finalBossSprites?.[0];
  if (portrait) {
    ctx.drawImage(
      portrait,
      fx + ((frameW - portrait.width) >> 1),
      fy + ((frameH - portrait.height) >> 1)
    );
  }

  const lineH = FONT_H + 2;
  const textY = py + ((panelH - (dlgLines.length * lineH - 2)) >> 1);
  for (let i = 0; i < dlgLines.length; i++) {
    ctx.drawImage(dlgLines[i], textX, textY + i * lineH);
  }

  if (time % 800 < 400) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + panelW - 4, py + panelH - 4, 2, 2);
  }
}
