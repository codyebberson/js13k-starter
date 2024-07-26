import {
  FLOATY_GRAVITY,
  GRAVITY,
  HALF_TILE_SIZE,
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
  ENTITY_TYPE_COIN,
  ENTITY_TYPE_JUMPPAD,
  ENTITY_TYPE_PLAYER,
  ENTITY_TYPE_WALKING_ENEMY,
  entities,
} from './entity';
import { KEY_A, KEY_D, KEY_LEFT, KEY_RIGHT, KEY_Z, initKeys, keys, updateKeys } from './keys';
import { initMouse, updateMouse } from './mouse';
import { coinSound, hurtSound, jumpPadSound, jumpSound } from './sounds';
import { collisionDetectionEntityToTile, getTile, initTileMap } from './tilemap';
import { zzfx } from './zzfx';

const canvas = document.querySelector('#c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

const skyGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
skyGradient.addColorStop(0, '#dff6f5');
skyGradient.addColorStop(1, '#a4c6f1');

const image = new Image();
image.src = 'i.png';

const player = initTileMap();

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
    dt = Math.min(newTime - windowTime, 1000 / 30);
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
    zzfx(...jumpSound);
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

    if (entity === player && keys[KEY_Z].down) {
      player.dy += dt * FLOATY_GRAVITY;
    } else if (entity.entityType !== ENTITY_TYPE_COIN) {
      entity.dy += dt * GRAVITY;
    }

    if (entity.entityType === ENTITY_TYPE_WALKING_ENEMY) {
      entity.dx = entity.direction * 0.03;
    }

    entity.x += dt * entity.dx;
    entity.y += dt * entity.dy;
    entity.cooldown--;

    // Clear out dead entities
    if (entity.health <= 0) {
      entities.splice(i, 1);
    }
  }
}

function collisionDetection(): void {
  collisionDetectionEntityToTile();
  collisionDetectionEntityToEntity();
}

function collisionDetectionEntityToEntity(): void {
  for (const entity of entities) {
    for (const other of entities) {
      if (entity !== other && entity.distance(other) < TILE_SIZE) {
        if (entity === player && other.entityType === ENTITY_TYPE_COIN) {
          score += 100;
          other.health = 0;
          zzfx(...coinSound);
        }
        if (entity === player && other.entityType === ENTITY_TYPE_JUMPPAD) {
          player.y = Math.min(player.y, other.y - 8);
          player.dx = 0;
          player.dy = -PLAYER_JUMP_POWER * 2;
          zzfx(...jumpPadSound);
        }
        if (entity === player && other.entityType === ENTITY_TYPE_WALKING_ENEMY) {
          if (player.y + HALF_TILE_SIZE < other.y) {
            // If the player is at least half a tile above the enemy, kill the enemy
            other.health -= 100;
            player.dy = -PLAYER_JUMP_POWER;
            zzfx(...jumpSound);
          } else {
            // Otherwise hurt the player
            player.health -= 10;
            player.dy = -0.25 * PLAYER_JUMP_POWER;

            // Push the player away from the enemy
            if (player.x < other.x) {
              player.x = other.x - TILE_SIZE - HALF_TILE_SIZE;
            } else {
              player.x = other.x + TILE_SIZE + HALF_TILE_SIZE;
            }
            zzfx(...hurtSound);
          }
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

  if (viewportX + WIDTH > TILEMAP_WIDTH * TILE_SIZE) {
    viewportX = TILEMAP_WIDTH * TILE_SIZE - WIDTH;
  }
}

function render(): void {
  clearScreen();
  drawTileMap();
  drawEntities();
  drawOverlay();
}

function clearScreen(): void {
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawTileMap(): void {
  for (let y = 0; y < TILEMAP_HEIGHT; y++) {
    for (let x = 0; x < TILEMAP_WIDTH; x++) {
      const tile = getTile(x, y);
      if (tile > 0) {
        const tx = (tile - 1) * TILE_SIZE;
        const ty = 24;
        ctx.drawImage(
          image,
          tx,
          ty,
          TILE_SIZE,
          TILE_SIZE,
          Math.floor(x * TILE_SIZE - viewportX),
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
    ctx.save();
    ctx.translate(Math.floor(entity.x - viewportX + HALF_TILE_SIZE), Math.floor(entity.y + HALF_TILE_SIZE));
    ctx.scale(entity.direction, 1);
    let sx = 0;
    if (entity.entityType === ENTITY_TYPE_PLAYER) {
      const walking = Math.abs(entity.dx) > 0.01;
      sx = !entity.grounded ? 48 : walking ? 16 + (entity.frame | 0) * TILE_SIZE : 0;
    } else if (entity.entityType === ENTITY_TYPE_COIN) {
      sx = 64 + (entity.frame | 0) * TILE_SIZE;
    } else if (entity.entityType === ENTITY_TYPE_JUMPPAD) {
      sx = 96;
    } else if (entity.entityType === ENTITY_TYPE_WALKING_ENEMY) {
      sx = 112 + (entity.frame | 0) * TILE_SIZE;
    }
    ctx.drawImage(image, sx, 8, TILE_SIZE, TILE_SIZE, -HALF_TILE_SIZE, -HALF_TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.restore();
    entity.frame += dt * 0.005;
    if (entity.frame >= 2) {
      entity.frame = 0;
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
