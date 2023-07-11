import { Input, newInput, updateInput } from './input';

export const KEY_LEFT = 37;
export const KEY_UP = 38;
export const KEY_RIGHT = 39;
export const KEY_DOWN = 40;
export const KEY_A = 65;
export const KEY_D = 68;
export const KEY_S = 83;
export const KEY_W = 87;

const KEY_COUNT = 256;

/**
 * Array of keyboard keys.
 */
export const keys: Input[] = new Array(KEY_COUNT);

/**
 * Initializes the keyboard.
 * @param el The HTML element to listen on.
 */
export function initKeys(el: HTMLElement): void {
  for (let i = 0; i < KEY_COUNT; i++) {
    keys[i] = newInput();
  }

  el.addEventListener('click', handleClick);
  el.addEventListener('keydown', (e) => setKey(e, true));
  el.addEventListener('keyup', (e) => setKey(e, false));
}

function handleClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  (e.currentTarget as HTMLElement).focus();
}

function setKey(e: KeyboardEvent, state: boolean): void {
  e.preventDefault();
  e.stopPropagation();
  keys[e.keyCode].down = state;
}

export function updateKeys(): void {
  keys.forEach(updateInput);
}
