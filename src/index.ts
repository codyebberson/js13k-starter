import {
  CENTER_X,
  CENTER_Y,
  FLOATY_GRAVITY,
  GRAVITY,
  HEIGHT,
  PLAYER_ACCELERATION,
  PLAYER_JUMP_POWER,
  PLAYER_MAX_SPEED,
  TILEMAP_HEIGHT,
  TILEMAP_WIDTH,
  TILE_SIZE,
  WIDTH,
} from './constants';
import {
  ENTITY_TYPE_BULLET,
  ENTITY_TYPE_GEM,
  ENTITY_TYPE_PLAYER,
  ENTITY_TYPE_SNAKE,
  ENTITY_TYPE_SPIDER,
  Entity,
  entities,
} from './entity';
import { KEY_A, KEY_D, KEY_LEFT, KEY_RIGHT, KEY_Z, initKeys, keys, updateKeys } from './keys';
import { initMouse, updateMouse } from './mouse';
import { getTile } from './tilemap';
import { zzfx } from './zzfx';

const canvas = document.querySelector('#c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

const image = new Image();
image.src = 'i.png';

const player = new Entity(ENTITY_TYPE_PLAYER, CENTER_X, CENTER_Y);

let windowTime = 0;
let dt = 0;
let gameTime = 0;
let score = 0;
let viewportX = 0;

initKeys(canvas);
initMouse(canvas);

function gameLoop(newTime: number): void {
  requestAnimationFrame(gameLoop);

  if (player.health > 0) {
    dt = newTime - windowTime;
    gameTime += dt;

    updateKeys();
    updateMouse();
    handleInput();
    updateEntities();
    collisionDetection();
    updateCamera();
  }

  render();
  windowTime = newTime;
  dt = 0;
}

function handleInput(): void {
  if (keys[KEY_LEFT].down || keys[KEY_A].down) {
    player.dx -= dt * PLAYER_ACCELERATION;
    player.direction = -1;
  } else if (keys[KEY_RIGHT].down || keys[KEY_D].down) {
    player.dx += dt * PLAYER_ACCELERATION;
    player.direction = 1;
  } else {
    player.dx = 0;
  }

  if (keys[KEY_Z].downCount === 1 && player.grounded) {
    player.dy = -PLAYER_JUMP_POWER;
  }

  if (keys[KEY_Z].down) {
    player.dy += dt * FLOATY_GRAVITY;
  } else {
    player.dy += dt * GRAVITY;
  }

  if (player.dx > PLAYER_MAX_SPEED) {
    player.dx = PLAYER_MAX_SPEED;
  } else if (player.dx < -PLAYER_MAX_SPEED) {
    player.dx = -PLAYER_MAX_SPEED;
  }
}

function updateEntities(): void {
  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i];
    entity.x += dt * entity.dx;
    entity.y += dt * entity.dy;
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
  e.x += dx / dist; // * SPIDER_SPEED;
  e.y += dy / dist; // * SPIDER_SPEED;
}

function collisionDetection(): void {
  collisionDetectionEntityToTile();
  collisionDetectionEntityToEntity();
}

function collisionDetectionEntityToTile(): void {
  for (const entity of entities) {
    entity.grounded = false;

    if (entity.dy < 0) {
      if (getTile((entity.x + 8) / TILE_SIZE, entity.y / TILE_SIZE)) {
        entity.y = Math.floor(entity.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE;
        entity.dy = 0;
      }
    }

    if (entity.dy > 0) {
      if (getTile((entity.x + 4) / TILE_SIZE, entity.y / TILE_SIZE + 1)) {
        entity.y = Math.floor(entity.y / TILE_SIZE) * TILE_SIZE;
        entity.dy = 0;
        entity.grounded = true;
      }
      if (getTile((entity.x + 12) / TILE_SIZE, entity.y / TILE_SIZE + 1)) {
        entity.y = Math.floor(entity.y / TILE_SIZE) * TILE_SIZE;
        entity.dy = 0;
        entity.grounded = true;
      }
    }

    if (getTile(entity.x / TILE_SIZE, (entity.y + 8) / TILE_SIZE)) {
      entity.x = Math.floor(entity.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE;
      entity.dx = 0;
    }

    if (getTile(entity.x / TILE_SIZE + 1, (entity.y + 8) / TILE_SIZE)) {
      entity.x = Math.floor(entity.x / TILE_SIZE) * TILE_SIZE;
      entity.dx = 0;
    }

    if (entity.y > HEIGHT - 32) {
      entity.y = HEIGHT - 32;
      entity.dy = 0;
      entity.grounded = true;
    }
  }
}

function collisionDetectionEntityToEntity(): void {
  for (const entity of entities) {
    for (const other of entities) {
      if (entity !== other && entity.distance(other) < 8) {
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

function updateCamera(): void {
  if (player.x - viewportX > 300) {
    viewportX = player.x - 300;
  } else if (viewportX + WIDTH - player.x > 300) {
    viewportX = player.x + 300 - WIDTH;
  }

  if (viewportX < 0) {
    viewportX = 0;
  }
}

function render(): void {
  clearScreen();
  drawTileMap();
  drawEntities();
  drawOverlay();
}

function clearScreen(): void {
  ctx.fillStyle = '#c0e7ec';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawTileMap(): void {
  for (let y = 0; y < TILEMAP_HEIGHT; y++) {
    for (let x = 0; x < TILEMAP_WIDTH; x++) {
      const tile = getTile(x, y);
      if (tile > 0) {
        const tx = 48 + tile * TILE_SIZE;
        const ty = 8;
        ctx.drawImage(
          image,
          tx,
          ty,
          TILE_SIZE,
          TILE_SIZE,
          (x * TILE_SIZE - viewportX) | 0,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
    }
  }
}

function drawEntities(): void {
  for (const entity of entities) {
    const walking = Math.abs(entity.dx) > 0.01;
    if (entity.entityType === ENTITY_TYPE_PLAYER) {
      ctx.save();
      ctx.translate(((entity.x - viewportX) | 0) + 8, (entity.y | 0) + 8);
      ctx.scale(entity.direction, 1);
      const sx = !entity.grounded ? 48 : walking ? 16 + (entity.frame | 0) * 16 : 0;
      ctx.drawImage(image, sx, 8, 16, 16, -8, -8, 16, 16);
      ctx.restore();
      entity.frame += dt * 0.007;
      if (entity.frame >= 2) {
        entity.frame = 0;
      }
    } else {
      ctx.drawImage(image, entity.entityType * 8, 8, 8, 8, entity.x | 0, entity.y | 0, 8, 8);
    }
  }
}

function drawOverlay(): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, 16);

  drawString('HEALTH  ' + player.health, 4, 6);
  drawString('SCORE   ' + score, 150, 6);
  drawString('TIME    ' + ((gameTime / 1000) | 0), 300, 6);
}

function drawString(str: string, x: number, y: number): void {
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const charIndex = charCode < 65 ? charCode - 48 : charCode - 55;
    ctx.drawImage(image, charIndex * 6, 0, 6, 6, x, y, 6, 6);
    x += 6;
  }
}

requestAnimationFrame(gameLoop);
