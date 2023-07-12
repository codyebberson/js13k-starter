import { initKeys, KEY_A, KEY_D, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_S, KEY_UP, KEY_W, keys, updateKeys } from './keys';
import { initMouse, mouse, updateMouse } from './mouse';
import { music } from './music';
import { zzfx, zzfxP } from './zzfx';

const WIDTH = 480;
const HEIGHT = 270;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const MILLIS_PER_SECOND = 1000;
const FRAMES_PER_SECOND = 30;
const MILLIS_PER_FRAME = MILLIS_PER_SECOND / FRAMES_PER_SECOND;
const ENTITY_TYPE_PLAYER = 0;
const ENTITY_TYPE_BULLET = 1;
const ENTITY_TYPE_SNAKE = 2;
const ENTITY_TYPE_SPIDER = 3;
const ENTITY_TYPE_GEM = 6;
const PLAYER_SPEED = 2;
const BULLET_SPEED = 4;
const SPIDER_SPEED = 1;

interface Entity {
  entityType: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  health: number;
  cooldown: number;
}

const canvas = document.querySelector('#c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

const image = new Image();
image.src = 'i.png';

const entities: Entity[] = [];

const player = createEntity(ENTITY_TYPE_PLAYER, CENTER_X, CENTER_Y);

const startTime = Date.now();

let time = 0;
let score = 0;
let musicStarted = false;
let threshold = 0;

initKeys(canvas);
initMouse(canvas);

function createEntity(entityType: number, x: number, y: number, dx = 0, dy = 0): Entity {
  const e = {
    entityType,
    x,
    y,
    dx,
    dy,
    health: 100,
    cooldown: 0,
  };
  entities.push(e);
  return e;
}

function randomEnemy(): void {
  const entityType = Math.random() < 0.5 ? ENTITY_TYPE_SNAKE : ENTITY_TYPE_SPIDER;
  const theta = Math.random() * Math.PI * 2;
  const x = CENTER_X + Math.cos(theta) * CENTER_X * 1.5;
  const y = CENTER_Y + Math.sin(theta) * CENTER_X * 1.5;
  createEntity(entityType, x, y);
}

function gameLoop(): void {
  if (player.health > 0) {
    time = (Date.now() - startTime) / 1000;

    // At t=0, randomness = 0.01
    // At t=60, randomness = 0.1
    threshold = 0.01 + time * 0.001;
    if (Math.random() < threshold) {
      randomEnemy();
    }

    updateKeys();
    updateMouse();
    handleInput();
    ai();
    collisionDetection();
  }

  render();
}

function handleInput(): void {
  if (!musicStarted && mouse.buttons[0].down) {
    musicStarted = true;
    zzfxP(...music).loop = true;
  }
  if (keys[KEY_UP].down || keys[KEY_W].down) {
    player.y -= PLAYER_SPEED;
  }
  if (keys[KEY_LEFT].down || keys[KEY_A].down) {
    player.x -= PLAYER_SPEED;
  }
  if (keys[KEY_DOWN].down || keys[KEY_S].down) {
    player.y += PLAYER_SPEED;
  }
  if (keys[KEY_RIGHT].down || keys[KEY_D].down) {
    player.x += PLAYER_SPEED;
  }
  if (mouse.buttons[0].down) {
    const targetX = (mouse.x / canvas.offsetWidth) * WIDTH;
    const targetY = (mouse.y / canvas.offsetHeight) * HEIGHT;
    shoot(player, targetX, targetY, true);
  }
}

function shoot(shooter: Entity, targetX: number, targetY: number, sound = false): void {
  if (shooter.cooldown <= 0) {
    const dist = Math.hypot(targetX - shooter.x, targetY - shooter.y);
    createEntity(
      ENTITY_TYPE_BULLET,
      shooter.x,
      shooter.y,
      ((targetX - shooter.x) / dist) * BULLET_SPEED,
      ((targetY - shooter.y) / dist) * BULLET_SPEED,
    );
    shooter.cooldown = 10;
    if (sound) {
      zzfx(...[, , 90, , 0.01, 0.03, 4, , , , , , , 9, 50, 0.2, , 0.2, 0.01]);
    }
  }
}

function ai(): void {
  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i];
    entity.x += entity.dx;
    entity.y += entity.dy;
    entity.cooldown--;

    if (entity.entityType === ENTITY_TYPE_SNAKE || entity.entityType === ENTITY_TYPE_SPIDER) {
      attackAi(entity);
    }

    // Clear out dead entities
    if (entity.health <= 0) {
      entities.splice(i, 1);
    }
  }
}

function attackAi(e: Entity): void {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  e.x += (dx / dist) * SPIDER_SPEED;
  e.y += (dy / dist) * SPIDER_SPEED;
}

function collisionDetection(): void {
  for (const entity of entities) {
    for (const other of entities) {
      if (entity !== other && distance(entity, other) < 8) {
        if (
          entity.entityType === ENTITY_TYPE_BULLET &&
          (other.entityType === ENTITY_TYPE_SNAKE || other.entityType === ENTITY_TYPE_SPIDER)
        ) {
          entity.health = 0; // Kill the bullet
          other.entityType = ENTITY_TYPE_GEM; // Turn the bullet into a gem
          zzfx(...[0.4, , 368, 0.01, 0.1, 0.3, 4, 0.31, , , , , , 1.7, , 0.4, , 0.46, 0.1]);
        }
        if (entity === player && (other.entityType === ENTITY_TYPE_SNAKE || other.entityType === ENTITY_TYPE_SPIDER)) {
          entity.health -= 10; // Hurt the player
          other.health = 0; // Remove the enemy
          if (player.health <= 0) {
            // Game over
            zzfx(...[2.89, , 752, 0.04, 0.4, 0.44, 1, 1.39, 1, , , , 0.15, 1.3, 19, 0.9, 0.32, 0.39, 0.15, 0.31]);
          } else {
            // Just a flesh wound
            zzfx(...[2, , 433, 0.01, 0.06, 0.11, 1, 2.79, 7.7, -8.6, , , , 1.7, , 0.4, , 0.54, 0.05]);
          }
        }
        if (entity === player && other.entityType === ENTITY_TYPE_GEM) {
          score += 100;
          other.health = 0;
          zzfx(...[, , 1267, 0.01, 0.09, 0.15, , 1.95, , , 412, 0.06, , , , , , 0.45, 0.02]);
        }
      }
    }
  }
}

function render(): void {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const entity of entities) {
    ctx.drawImage(image, entity.entityType * 8, 8, 8, 8, entity.x | 0, entity.y | 0, 8, 8);
  }

  drawString('HEALTH  ' + player.health, 4, 5);
  drawString('SCORE   ' + score, 4, 15);
  drawString('TIME    ' + (time | 0), 4, 25);

  drawString('ARROW KEYS OR WASD TO MOVE', 4, 250);
  drawString('LEFT CLICK TO SHOOT', 4, 260);
}

function drawString(str: string, x: number, y: number): void {
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const charIndex = charCode < 65 ? charCode - 48 : charCode - 55;
    ctx.drawImage(image, charIndex * 6, 0, 6, 6, x, y, 6, 6);
    x += 6;
  }
}

const distance = (a: Entity, b: Entity): number => Math.hypot(a.x - b.x, a.y - b.y);

window.setInterval(gameLoop, MILLIS_PER_FRAME);
