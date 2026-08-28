import { PLAYER_HEIGHT, PLAYER_WIDTH } from './constants';
import {
  applyKnockback,
  crowdControl,
  crowdControlAt,
  type Enemy,
  enemies,
  enemyHitbox,
  hurtEnemyAt,
} from './enemies';
import { playHorn, playNova } from './music';
import { RAINBOW_COLORS, unlockedColors } from './palette';
import { damagePlayer, freezePlayer, getPlayerHitbox, player } from './player';
import { damagePortal, hurtPortalsRing, portalLive, portals, PORTAL_H, PORTAL_W } from './portals';
import { createSprite } from './sprites';
import { pwr, STAT_STR, STAT_WIS } from './stats';

const HORN_MS = 250;
const HORN_BEATS = 6;
const HORN_DAMAGE = 10;
/** Tip reach from the sprite's left/right edge (hitbox, not the 17×9 art). */
const HORN_LEN = 35;
/** Visual half-height of the old chevron; still drives hitbox height. */
const HORN_SPREAD = 8;
const HORN_SW = 17;
const HORN_SH = 9;

const STOMP_DAMAGE = 5;
const NOVA_RADIUS = 66;
const STOMP_KNOCKBACK = 0.36;

const FIREBALL_DAMAGE = 8;
const BOLT_SPEED = 0.18;
const BOLT_SIZE = 4;

const FLAME_NOVA_DAMAGE = 6;
const NOVA_PERIOD = 2000;
const NOVA_LIFE = 500;
const SPEED_BURST_MS = 1000;
const FREEZE_MS = 500;
/** 2× the 7px enemy sprite cell — "small impact radius". */
const FROSTBALL_RADIUS = 14;

const HEAL_AMOUNT = 8;

const BOLT_FIRE = 0;
const BOLT_FROST = 1;

const N_WHITE = 1;
const N_RED = 2;
const N_ORANGE = 4;
const N_YELLOW = 8;
const N_GREEN = 16;
const N_BLUE = 32;
const N_INDIGO = 64;
const N_VIOLET = 128;

let novaCd = 0;
/** Time remaining in the current 250ms beat. */
let hornT = 0;
/** 0–1 = right/left lash, 2–5 = rest. Starts at 5 so the first tick wraps to 0. */
let hornBeat = 5;
/** 1 = right, -1 = left. Starts at -1 so the first fire flips to right. */
let hornDir = -1;
/** Enemies already tagged by the current lash. */
const hornSeen: Enemy[] = [];
/** Portal bits already tagged by the current lash. */
let hornGates = 0;

interface Bolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: number;
  damage: number;
  freezeMs: number;
  friendly: boolean;
}

interface Nova {
  owner: Enemy | null;
  bits: number;
  pwr: number;
  life: number;
  seen: Enemy[];
  seenP: number;
  hitP: boolean;
}

const bolts: Bolt[] = [];
const novas: Nova[] = [];

let hornRight: HTMLCanvasElement | undefined;
let hornLeft: HTMLCanvasElement | undefined;

let viewX = 0;
let viewY = 0;
let viewW = 1;
let viewH = 1;

/** Vertical center of the sprite. Follows player.x/y. */
function hornY(): number {
  return player.y + PLAYER_HEIGHT / 2;
}

function hornHitbox(): { x: number; y: number; w: number; h: number } {
  const h = HORN_SPREAD * 4.5;
  const w = HORN_LEN * 1.5;
  return {
    x: player.x + (hornDir > 0 ? PLAYER_WIDTH : -w),
    y: hornY() - h / 2,
    w,
    h,
  };
}

function playerCenter(): { x: number; y: number } {
  const hit = getPlayerHitbox();
  return { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 };
}

function enemyCenter(enemy: Enemy): { x: number; y: number } {
  const box = enemyHitbox(enemy);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function novaCenter(n: Nova): { x: number; y: number } {
  return n.owner ? enemyCenter(n.owner) : playerCenter();
}

function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function nearestEnemyCenter(fromX: number, fromY: number): { x: number; y: number } | null {
  let bestX = 0;
  let bestY = 0;
  let bestD = Infinity;
  for (const enemy of enemies) {
    const box = enemyHitbox(enemy);
    const ex = box.x + box.w / 2;
    const ey = box.y + box.h / 2;
    const d = Math.hypot(ex - fromX, ey - fromY);
    if (d < bestD) {
      bestD = d;
      bestX = ex;
      bestY = ey;
    }
  }
  return bestD === Infinity ? null : { x: bestX, y: bestY };
}

function playerBits(): number {
  let bits = N_WHITE;
  for (let i = 0; i < 7; i++) {
    if (unlockedColors[i]) {
      bits |= 2 << i;
    }
  }
  return bits;
}

export function updateCombat(
  dt: number,
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number
): void {
  viewX = cameraX;
  viewY = cameraY;
  viewW = viewWidth;
  viewH = viewHeight;

  hornT -= dt;
  if (hornT <= 0) {
    hornT += HORN_MS;
    hornBeat = (hornBeat + 1) % HORN_BEATS;
    if (hornBeat < 2) {
      startHorn();
    }
  }
  if (hornBeat < 2) {
    tickHorn();
  }

  novaCd -= dt;
  if (novaCd <= 0) {
    fireNova(null, playerBits());
    novaCd += NOVA_PERIOD;
  }
  for (const enemy of enemies) {
    if (!enemy.boss || enemy.color < 0) {
      continue;
    }
    enemy.cd -= dt;
    if (enemy.cd <= 0 && enemy.frozen <= 0) {
      fireNova(enemy, 2 << enemy.color);
      enemy.cd += NOVA_PERIOD;
    }
  }

  updateNovas(dt);
  updateBolts(dt);
}

export function resetCombat(): void {
  novaCd = 0;
  hornT = 0;
  hornBeat = 5;
  hornDir = -1;
  hornSeen.length = 0;
  hornGates = 0;
  bolts.length = 0;
  novas.length = 0;
}

function startHorn(): void {
  playHorn();
  hornDir = -hornDir;
  hornSeen.length = 0;
  hornGates = 0;
}

function tickHorn(): void {
  const box = hornHitbox();
  const amount = HORN_DAMAGE * pwr(STAT_STR);
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (hornSeen.indexOf(enemies[i]) >= 0) {
      continue;
    }
    const enemy = enemyHitbox(enemies[i]);
    if (overlaps(box.x, box.y, box.w, box.h, enemy.x, enemy.y, enemy.w, enemy.h)) {
      hornSeen.push(enemies[i]);
      hurtEnemyAt(i, amount);
    }
  }
  for (let g = 0; g < 7; g++) {
    if (hornGates & (1 << g) || !portalLive(g)) {
      continue;
    }
    const p = portals[g];
    if (overlaps(box.x, box.y, box.w, box.h, p.x, p.y, PORTAL_W, PORTAL_H)) {
      hornGates |= 1 << g;
      damagePortal(g, amount);
    }
  }
}

function fireNova(owner: Enemy | null, bits: number): void {
  if (!owner) {
    playNova();
  }
  const amount = owner ? 1 : pwr(STAT_WIS);
  const c = owner ? enemyCenter(owner) : playerCenter();
  const caster = owner || player;
  if (bits & N_GREEN) {
    caster.hp = Math.min(caster.maxHp, caster.hp + HEAL_AMOUNT * amount);
  }
  if (bits & N_YELLOW) {
    caster.boost = SPEED_BURST_MS;
  }
  if (bits & (N_RED | N_INDIGO)) {
    const t = owner ? playerCenter() : nearestEnemyCenter(c.x, c.y);
    if (t) {
      if (bits & N_RED) {
        spawnBolt(c.x, c.y, t.x, t.y, BOLT_FIRE, FIREBALL_DAMAGE * amount, !owner);
      }
      if (bits & N_INDIGO) {
        spawnBolt(c.x, c.y, t.x, t.y, BOLT_FROST, 0, !owner, FREEZE_MS * amount);
      }
    }
  }
  novas.push({
    owner,
    bits,
    pwr: amount,
    life: NOVA_LIFE,
    seen: [],
    seenP: 0,
    hitP: false,
  });
}

function spawnBolt(
  x: number,
  y: number,
  tx: number,
  ty: number,
  kind: number,
  damage: number,
  friendly: boolean,
  freezeMs = 0
): void {
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.01) {
    return;
  }
  bolts.push({
    x,
    y,
    vx: (dx / dist) * BOLT_SPEED,
    vy: (dy / dist) * BOLT_SPEED,
    kind,
    damage,
    freezeMs,
    friendly,
  });
}

function novaRadius(n: Nova): number {
  return (1 - n.life / NOVA_LIFE) * (n.owner ? NOVA_RADIUS * 0.5 : NOVA_RADIUS);
}

function updateNovas(dt: number): void {
  for (let i = novas.length - 1; i >= 0; i--) {
    const n = novas[i];
    n.life -= dt;
    const r = novaRadius(n);
    const c = novaCenter(n);
    const freeze = n.bits & N_BLUE ? FREEZE_MS * n.pwr : 0;
    const dmg =
      ((n.bits & N_WHITE ? STOMP_DAMAGE : 0) + (n.bits & N_ORANGE ? FLAME_NOVA_DAMAGE : 0)) * n.pwr;

    if (n.bits & N_VIOLET) {
      for (let b = bolts.length - 1; b >= 0; b--) {
        const p = bolts[b];
        if (n.owner ? !p.friendly : p.friendly) {
          continue;
        }
        const dist = Math.hypot(p.x - c.x, p.y - c.y);
        if (dist <= r) {
          bolts.splice(b, 1);
        }
      }
    }

    if (!n.owner) {
      for (let e = enemies.length - 1; e >= 0; e--) {
        const enemy = enemies[e];
        if (n.seen.indexOf(enemy) >= 0) {
          continue;
        }
        const box = enemyHitbox(enemy);
        const dist = Math.hypot(box.x + box.w / 2 - c.x, box.y + box.h / 2 - c.y);
        if (dist > r) {
          continue;
        }
        n.seen.push(enemy);
        if (freeze) {
          crowdControl(enemy, freeze);
        }
        let alive = true;
        if (dmg) {
          alive = !hurtEnemyAt(e, dmg);
        }
        if (alive && n.bits & N_WHITE) {
          applyKnockback(enemy, c.x, c.y, STOMP_KNOCKBACK);
        }
      }
      if (dmg) {
        n.seenP = hurtPortalsRing(c.x, c.y, r, dmg, n.seenP);
      }
    } else if (!n.hitP) {
      const hit = getPlayerHitbox();
      const dist = Math.hypot(hit.x + hit.w / 2 - c.x, hit.y + hit.h / 2 - c.y);
      if (dist <= r) {
        n.hitP = true;
        if (freeze) {
          freezePlayer(freeze);
        }
        if (dmg) {
          damagePlayer(dmg);
        }
      }
    }

    if (n.life <= 0) {
      novas.splice(i, 1);
    }
  }
}

function updateBolts(dt: number): void {
  const hw = BOLT_SIZE / 2;
  for (let i = bolts.length - 1; i >= 0; i--) {
    const p = bolts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const sx = p.x - viewX;
    const sy = p.y - viewY;
    if (sx + hw < 0 || sy + hw < 0 || sx - hw > viewW || sy - hw > viewH) {
      bolts.splice(i, 1);
      continue;
    }
    if (p.friendly) {
      let hit = -1;
      for (let e = 0; e < enemies.length; e++) {
        const box = enemyHitbox(enemies[e]);
        if (overlaps(p.x - hw, p.y - hw, BOLT_SIZE, BOLT_SIZE, box.x, box.y, box.w, box.h)) {
          hit = e;
          break;
        }
      }
      if (hit >= 0) {
        if (p.damage > 0) {
          hurtEnemyAt(hit, p.damage);
        }
        if (p.freezeMs > 0) {
          crowdControlAt(p.x, p.y, FROSTBALL_RADIUS, p.freezeMs);
        }
        bolts.splice(i, 1);
        continue;
      }
      let gate = -1;
      for (let g = 0; g < 7; g++) {
        if (
          portalLive(g) &&
          overlaps(p.x - hw, p.y - hw, BOLT_SIZE, BOLT_SIZE, portals[g].x, portals[g].y, PORTAL_W, PORTAL_H)
        ) {
          gate = g;
          break;
        }
      }
      if (gate >= 0) {
        if (p.damage > 0) {
          damagePortal(gate, p.damage);
        }
        bolts.splice(i, 1);
        continue;
      }
    } else {
      const box = getPlayerHitbox();
      if (!overlaps(p.x - hw, p.y - hw, BOLT_SIZE, BOLT_SIZE, box.x, box.y, box.w, box.h)) {
        continue;
      }
      if (p.damage > 0) {
        damagePlayer(p.damage);
      }
      if (p.freezeMs > 0) {
        freezePlayer(p.freezeMs);
        crowdControlAt(p.x, p.y, FROSTBALL_RADIUS, p.freezeMs);
      }
      bolts.splice(i, 1);
    }
  }
}

export function drawCombat(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
  if (hornBeat < 2) {
    if (!hornRight) {
      hornRight = createSprite(22, 29, HORN_SW, HORN_SH);
      hornLeft = createSprite(22, 29, HORN_SW, HORN_SH, true);
    }
    ctx.drawImage(
      (hornDir > 0 ? hornRight : hornLeft) as HTMLCanvasElement,
      Math.floor(player.x + (hornDir > 0 ? PLAYER_WIDTH : -HORN_SW) - cameraX),
      Math.floor(hornY() - HORN_SH / 2 - cameraY)
    );
  }
  for (const n of novas) {
    const c = novaCenter(n);
    const r = novaRadius(n);
    const cols: string[] = [];
    for (let i = 0; i < 7; i++) {
      if (n.bits & (2 << i)) {
        cols.push('#' + RAINBOW_COLORS[i].toString(16).padStart(6, '0'));
      }
    }
    const cx = Math.floor(c.x - cameraX) + 0.5;
    const cy = Math.floor(c.y - cameraY) + 0.5;
    if (n.bits & N_WHITE && r >= 1) {
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (r > 2) {
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (r > 3) {
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (let i = 0; i < cols.length; i++) {
      const band = r - 3 - (cols.length - 1 - i);
      if (band < 1) {
        continue;
      }
      ctx.strokeStyle = cols[i];
      ctx.beginPath();
      ctx.arc(cx, cy, band, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const hw = (BOLT_SIZE / 2) | 0;
  for (const p of bolts) {
    const sx = Math.floor(p.x - cameraX) - hw;
    const sy = Math.floor(p.y - cameraY) - hw;
    ctx.fillStyle = '#000';
    ctx.fillRect(sx, sy, BOLT_SIZE + 1, BOLT_SIZE + 1);
    ctx.fillStyle =
      '#' + RAINBOW_COLORS[p.kind === BOLT_FROST ? 5 : 0].toString(16).padStart(6, '0');
    ctx.fillRect(sx + 1, sy + 1, BOLT_SIZE - 1, BOLT_SIZE - 1);
  }

  if (player.frozen > 0) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#8df';
    ctx.fillRect(
      Math.floor(player.x - cameraX),
      Math.floor(player.y - cameraY),
      PLAYER_WIDTH,
      PLAYER_HEIGHT
    );
    ctx.globalAlpha = 1;
  }
}

/** Debug: live horn AABB during a lash; empty while resting. */
export function combatDebug(): {
  horn: { x: number; y: number; w: number; h: number };
  radius: number;
} {
  return {
    horn: hornBeat < 2 ? hornHitbox() : { x: 0, y: 0, w: 0, h: 0 },
    radius: NOVA_RADIUS,
  };
}
