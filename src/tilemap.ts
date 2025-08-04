import { HEIGHT, TILE_SIZE, TILEMAP_HEIGHT, TILEMAP_WIDTH } from './constants';
import {
  ENTITY_TYPE_COIN,
  ENTITY_TYPE_JUMPPAD,
  ENTITY_TYPE_PLAYER,
  ENTITY_TYPE_WALKING_ENEMY,
  Entity,
  entities,
} from './entity';

// Simple tile map
//
// In this example, the tile map is a 2D array of numbers
//   P = player
//   C = coin
//   J = jump pad
//   W = walking enemy
//   1-9 = different tiles
//
// You can use whatever convention you like for creating the map
//
// Some other ideas:
// - Use a tool like Tiled to create maps
// - Load the map from image data, to take advantage of PNG compression
// - Procedurally generate the map
const tileMapSource: string[] = [
  '                               454556555556                                                                                     ',
  '                               454556555556                                                                                     ',
  '                               454556555556                                                                                     ',
  '                               457889555559                                                                                     ',
  '                               45555555889                                                                                      ',
  '                               78885556                1223                                                                     ',
  '                                   7889                                                                                         ',
  '            P  C                    CC     CC                                                                                   ',
  '                                   C         C      J       123                                                                 ',
  '            1223                      122223  C    1223     456     W       W       W       W       W       W       W       W   ',
  '            45553            W  122222555556                455223    1223    1223    1223    1223    1223    1223    1223    12',
  '       12222455553             15555555555553              155555522225555222255552222555522225555222255552222555522225555222255',
  '       455554555553    CC     1555555123555553             455555555555555555555555555555555555555555555555555555555555555555555',
  '     12455554555556   C  C   1555555545122355523   1223 J 1512355555555555555555555555555555555555555555555555555555555555555555',
  '    122355554555556J        1555555554545565555522255552225545655555555555555555555555555555555555555555555555555555555555555555',
  '22222222555545555562222222225555555554545565555555551223555545655555555555555555555555555555555555555555555555555555555555555555',
];

const tileMap: number[][] = [];

export function initTileMap(): Entity {
  let player: Entity | undefined;

  for (let y = 0; y < TILEMAP_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < TILEMAP_WIDTH; x++) {
      let tile = 0;
      let c = '';

      switch ((c = tileMapSource[y].charAt(x))) {
        case 'P':
          player = new Entity(ENTITY_TYPE_PLAYER, x * TILE_SIZE, y * TILE_SIZE);
          break;
        case 'C':
          new Entity(ENTITY_TYPE_COIN, x * TILE_SIZE, y * TILE_SIZE);
          break;
        case 'J':
          new Entity(ENTITY_TYPE_JUMPPAD, x * TILE_SIZE, y * TILE_SIZE);
          break;
        case 'W':
          new Entity(ENTITY_TYPE_WALKING_ENEMY, x * TILE_SIZE, y * TILE_SIZE);
          break;
        default:
          // Convert ASCII to tile index
          // 48 is the ASCII code for '0'
          // See ASCII chart for more details: https://en.wikipedia.org/wiki/ASCII
          tile = Math.max(0, c.charCodeAt(0) - 48);
          break;
      }
      row.push(tile);
    }
    tileMap.push(row);
  }

  return player as Entity;
}

export function getTile(x: number, y: number): number {
  if (x < 0 || x >= TILEMAP_WIDTH || y < 0 || y >= TILEMAP_HEIGHT) {
    return 1;
  }
  return tileMap[y | 0][x | 0];
}

export function collisionDetectionEntityToTile(): void {
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
      if (entity.entityType !== ENTITY_TYPE_PLAYER) {
        entity.direction = 1;
      }
    }

    if (getTile(entity.x / TILE_SIZE + 1, (entity.y + 8) / TILE_SIZE)) {
      entity.x = Math.floor(entity.x / TILE_SIZE) * TILE_SIZE;
      entity.dx = 0;
      if (entity.entityType !== ENTITY_TYPE_PLAYER) {
        entity.direction = -1;
      }
    }

    // Prevent entities from falling through the floor
    // This can be removed if you have confidence that your maps always have a floor
    if (entity.y > HEIGHT - 32) {
      entity.y = HEIGHT - 32;
      entity.dy = 0;
      entity.grounded = true;
    }
  }
}
