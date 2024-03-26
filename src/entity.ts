export const ENTITY_TYPE_PLAYER = 0;
export const ENTITY_TYPE_COIN = 1;
export const ENTITY_TYPE_JUMPPAD = 2;
export const ENTITY_TYPE_WALKING_ENEMY = 3;

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
