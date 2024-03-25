import { CENTER_X, CENTER_Y } from './constants';

export const ENTITY_TYPE_PLAYER = 0;
export const ENTITY_TYPE_BULLET = 1;
export const ENTITY_TYPE_SNAKE = 2;
export const ENTITY_TYPE_SPIDER = 3;
export const ENTITY_TYPE_GEM = 6;

export class Entity {
  entityType: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  direction: number;
  grounded: boolean;
  frame: number;
  health: number;
  cooldown: number;

  constructor(entityType: number, x: number, y: number, dx = 0, dy = 0) {
    this.entityType = entityType;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.direction = 1;
    this.grounded = false;
    this.frame = 0;
    this.health = 100;
    this.cooldown = 0;
    entities.push(this);
  }

  distance(other: Entity): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }
}

export const entities: Entity[] = [];

export function randomEnemy(): Entity {
  const entityType = Math.random() < 0.5 ? ENTITY_TYPE_SNAKE : ENTITY_TYPE_SPIDER;
  const theta = Math.random() * Math.PI * 2;
  const x = CENTER_X + Math.cos(theta) * CENTER_X * 1.5;
  const y = CENTER_Y + Math.sin(theta) * CENTER_X * 1.5;
  return new Entity(entityType, x, y);
}
