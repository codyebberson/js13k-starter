import { newInput, updateInput } from './input';

export const mouse = {
  /**
   * Mouse x coordinate.
   * @type {number}
   */
  x: 0,

  /**
   * Mouse y coordinate.
   * @type {number}
   */
  y: 0,

  /**
   * Mouse buttons
   */
  buttons: [newInput(), newInput(), newInput()],
};

/**
 * Initializes the keyboard.
 * @param el The HTML element to listen on.
 */
export function initMouse(el: HTMLElement): void {
  el.addEventListener('mousedown', (e) => {
    mouse.buttons[e.button].down = true;
  });
  el.addEventListener('mouseup', (e) => {
    mouse.buttons[e.button].down = false;
  });
  el.addEventListener('mousemove', (e) => {
    mouse.x = e.pageX - el.offsetLeft;
    mouse.y = e.pageY - el.offsetTop;
  });
}

/**
 * Updates all mouse button states.
 */
export function updateMouse(): void {
  mouse.buttons.forEach(updateInput);
}
