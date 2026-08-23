// Director's Cut: pipes, portals, cutscene, and the color wave live in
// src/directors-cut/ (pipes.ts, cutscene.ts). Production is a survival sandbox.
import { resetCombat } from './combat';
import { resetEnemies } from './enemies';
import { resetExplosions } from './fx';
import { formatScrap, pauseIconContains } from './hud';
import { mouse, wasPressed } from './input';
import { bakeTiles } from './map';
import { playPowerup } from './music';
import { unlockedColors } from './palette';
import { consumeLevelUp, resetPickups, scrap, spendScrap } from './pickups';
import { player, resetPlayer, tryRevive } from './player';
import { loadSave, saveGame } from './save';
import { rebakeAllSprites } from './sprites';
import {
  applyPick,
  CON_HP_PER_RANK,
  type DraftCard,
  dealLevelUpCards,
  resetRunStats,
  SHOP_RANK_CAP,
  SHOP_ROWS,
  STAT_CON,
  shopLine,
  shopPrice,
  shopRanks,
} from './stats';
import {
  closeUi,
  drawUi,
  hideMenuButtons,
  isUiOpen,
  openCards,
  openMenu,
  rebakeRainbowTitle,
  setTitleStory,
  updateUi,
} from './ui';

export const SCENE_TITLE = 0;
export const SCENE_RUN = 1;

export let scene = SCENE_TITLE;

/** Elapsed run time (ms). Pauses with overlays. */
export let runTime = 0;

const TITLE_LETTERS = 7;
const TITLE_DRAIN_MS = 500;
const TITLE_STORY =
  'CORPORATE IS STEALING THE COLORS OF THE CRYSTAL DIMENSION! IT IS UP TO YOU TO STOP THEM!';

let pauseOpen = false;
let hand: DraftCard[] = [];
let titleDraining = false;
let titleGrey = 0;
let titleDrainT = 0;

/** Director's Cut cutscene still reads these. Unused this pass. */
export const WAVE_SPEED = 0.38;
export const colorWave = { active: false, x: 0, y: 0, r: 0 };

const overlayQueue: (() => void)[] = [];

export function enqueueOverlay(open: () => void): void {
  overlayQueue.push(open);
}

export function isWorldFrozen(): boolean {
  return scene !== SCENE_RUN || isUiOpen() || titleDraining;
}

export function isSequenceActive(): boolean {
  return false;
}

function openTitle(): void {
  pauseOpen = false;
  titleDraining = false;
  scene = SCENE_TITLE;
  for (let i = 0; i < 7; i++) {
    unlockedColors[i] = true;
  }
  bakeTiles();
  rebakeAllSprites();
  openMenu(
    'DYE HARD',
    ['START', 'UPGRADES'],
    (index) => {
      if (index === 0) {
        startTitleDrain();
      } else {
        openShop(true);
      }
    },
    3,
    true
  );
}

function startTitleDrain(): void {
  hideMenuButtons();
  setTitleStory(TITLE_STORY);
  titleDraining = true;
  titleGrey = 0;
  titleDrainT = 0;
}

function lockNextTitleColor(): void {
  unlockedColors[titleGrey] = false;
  titleGrey++;
  bakeTiles();
  rebakeAllSprites();
  rebakeRainbowTitle();
}

function beginRun(): void {
  closeUi();
  overlayQueue.length = 0;
  resetRun();
  scene = SCENE_RUN;
}

function quitToTitle(): void {
  closeUi();
  overlayQueue.length = 0;
  saveGame();
  resetRun();
  openTitle();
}

function openEnd(title: string): void {
  saveGame();
  openMenu(title, ['CONTINUE'], () => openShop(false));
}

function openShop(fromTitle: boolean): void {
  const items: string[] = [];
  for (let i = 0; i < SHOP_ROWS; i++) {
    items.push(shopLine(i));
  }
  items.push('DONE');
  openMenu(
    'SHOP',
    items,
    (index) => {
      if (index >= SHOP_ROWS) {
        closeUi();
        saveGame();
        if (fromTitle) {
          openTitle();
        } else {
          beginRun();
        }
        return;
      }
      if (shopRanks[index] < SHOP_RANK_CAP && spendScrap(shopPrice(index))) {
        shopRanks[index]++;
        saveGame();
        openShop(fromTitle);
      }
    },
    1,
    false,
    'SCRAP ' + formatScrap(scrap)
  );
}

function openPause(): void {
  pauseOpen = true;
  openMenu('PAUSED', ['RESUME', 'QUIT TO MENU'], (index) => {
    closeUi();
    pauseOpen = false;
    if (index === 1) {
      quitToTitle();
    }
  });
}

function closePause(): void {
  closeUi();
  pauseOpen = false;
}

function openLevelUp(): void {
  hand = dealLevelUpCards();
  if (hand.length === 0) {
    return;
  }
  playPowerup();
  openCards('LEVEL UP', hand, (index) => {
    const card = hand[index];
    applyPick(card);
    if (card.id === STAT_CON) {
      player.maxHp += CON_HP_PER_RANK;
      player.hp += CON_HP_PER_RANK;
    }
    closeUi();
  });
}

function pumpOverlays(): void {
  if (isUiOpen() || scene !== SCENE_RUN) {
    return;
  }
  const next = overlayQueue.shift();
  if (next) {
    next();
    return;
  }
  if (consumeLevelUp()) {
    openLevelUp();
  }
}

function wantsPause(viewHeight: number): boolean {
  return (
    wasPressed('Escape') ||
    wasPressed('KeyP') ||
    (mouse.clicked && pauseIconContains(mouse.x, mouse.y, viewHeight))
  );
}

export function initOverlays(): void {
  loadSave();
  openTitle();
}

export function resetRun(): void {
  runTime = 0;
  resetRunStats();
  resetPlayer();
  resetEnemies();
  resetPickups();
  resetExplosions();
  resetCombat();
  for (let i = 0; i < 7; i++) {
    unlockedColors[i] = false;
  }
  rebakeAllSprites();
  bakeTiles();
}

export function updateOverlays(viewWidth: number, viewHeight: number, dt: number): void {
  if (titleDraining) {
    titleDrainT += dt;
    while (titleDrainT >= TITLE_DRAIN_MS && titleGrey < TITLE_LETTERS) {
      titleDrainT -= TITLE_DRAIN_MS;
      lockNextTitleColor();
    }
    if (titleGrey >= TITLE_LETTERS && titleDrainT >= TITLE_DRAIN_MS) {
      titleDraining = false;
      beginRun();
    }
  }

  if (scene === SCENE_RUN && !isWorldFrozen()) {
    runTime += dt;
  }

  if (scene === SCENE_RUN && wantsPause(viewHeight)) {
    if (pauseOpen) {
      closePause();
      mouse.clicked = false;
    } else if (!isUiOpen()) {
      openPause();
      mouse.clicked = false;
    }
  }
  if (isUiOpen()) {
    updateUi(viewWidth, viewHeight);
  }
  if (scene === SCENE_RUN && !isUiOpen() && player.hp <= 0 && overlayQueue.length === 0) {
    if (!tryRevive()) {
      openEnd('YOU DIED');
    }
  }
  pumpOverlays();
}

export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  viewWidth: number,
  viewHeight: number
): void {
  drawUi(ctx, viewWidth, viewHeight);
}
