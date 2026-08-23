import { drawText, measureText } from './font';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  /** Screen-space (HUD) particle — no camera, ticks while paused. */
  screen: boolean;
}

interface DamagePop {
  x: number;
  y: number;
  life: number;
  text: string;
}

const particles: Particle[] = [];
const pops: DamagePop[] = [];

const LIFE_MS = 480;
const SPEED_MIN = 0.08;
const SPEED_MAX = 0.32;
const POP_MS = 600;
const POP_RISE = 12;

/**
 * Tintable burst-of-pixels. Used for enemy deaths and the player taking a hit.
 */
export function spawnExplosion(x: number, y: number, color: number, count = 22): void {
  const css = '#' + color.toString(16).padStart(6, '0');
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
    particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: LIFE_MS * (0.65 + Math.random() * 0.45),
      color: css,
      size: Math.random() < 0.35 ? 3 : 2,
      screen: false,
    });
  }
}

/** White-on-black floating damage, same look as the scrap HUD counter. */
export function spawnDamageNumber(x: number, y: number, amount: number): void {
  const n = Math.round(amount);
  if (n <= 0) {
    return;
  }
  pops.push({
    x: x + (Math.random() - 0.5) * 6,
    y,
    life: POP_MS,
    text: String(n),
  });
}

/** Screen-space pixels falling from a HUD color square. */
export function spawnHudShower(x: number, y: number, color: number, count = 36): void {
  const css = '#' + color.toString(16).padStart(6, '0');
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 0.12,
      vy: 0.04 + Math.random() * 0.14,
      life: 520 + Math.random() * 380,
      color: css,
      size: Math.random() < 0.4 ? 3 : 2,
      screen: true,
    });
  }
}

export function resetExplosions(): void {
  particles.length = 0;
  pops.length = 0;
}

/** World particles + damage pops. Skip while the run is frozen. */
export function updateExplosions(dt: number): void {
  tickParticles(dt, false);
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].life -= dt;
    if (pops[i].life <= 0) {
      pops.splice(i, 1);
    }
  }
}

/** HUD shower keeps falling during overlays. */
export function updateHudShower(dt: number): void {
  tickParticles(dt, true);
}

function tickParticles(dt: number, screen: boolean): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.screen !== screen) {
      continue;
    }
    if (p.screen) {
      p.vy += 0.00035 * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function drawExplosions(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number
): void {
  for (const p of particles) {
    if (p.screen) {
      continue;
    }
    const sx = Math.floor(p.x - cameraX);
    const sy = Math.floor(p.y - cameraY);
    if (sx + p.size < 0 || sy + p.size < 0 || sx >= viewWidth || sy >= viewHeight) {
      continue;
    }
    ctx.globalAlpha = Math.max(0, p.life / LIFE_MS);
    ctx.fillStyle = p.color;
    ctx.fillRect(sx, sy, p.size, p.size);
  }
  for (const pop of pops) {
    const t = 1 - pop.life / POP_MS;
    const { w, h } = measureText(pop.text);
    const sx = Math.floor(pop.x - cameraX - w / 2);
    const sy = Math.floor(pop.y - cameraY - t * POP_RISE);
    if (sx + w < 0 || sy + h < 0 || sx > viewWidth || sy > viewHeight) {
      continue;
    }
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = '#000';
    ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
    drawText(ctx, pop.text, sx, sy);
  }
  ctx.globalAlpha = 1;
}

export function drawHudShower(ctx: CanvasRenderingContext2D): void {
  for (const p of particles) {
    if (!p.screen) {
      continue;
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 500));
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
