// SFX pack exported by Voxby. Each entry is [rowLen, patternLen, instrument, notes].

export const PICKUP = 0;
export const POWERUP = 1;
export const NOVA_FIRE = 2;
export const ENEMY_HIT = 3;
export const HORN_ATTACK = 4;

export type SfxEntry = [number, number, number[], number[]];

const pack: SfxEntry[] = [
  /* PICKUP */ [
    2646,
    11,
    [
      3, 154, 150, 0, 3, 14, 151, 9, 0, 0, 0, 14, 69, 36, 87, 4, 0, 0, 0, 0, 2, 182, 52, 0, 29, 0,
      0, 55, 1,
    ],
    [147],
  ],
  /* POWERUP */ [
    2646,
    26,
    [
      1, 149, 124, 0, 1, 152, 136, 2, 0, 0, 12, 41, 104, 32, 87, 3, 0, 0, 0, 0, 2, 224, 32, 0, 16,
      0, 0, 119, 1,
    ],
    [147],
  ],
  /* NOVA_FIRE */ [
    2646,
    18,
    [
      0, 244, 95, 124, 0, 59, 97, 0, 154, 2, 0, 20, 105, 71, 0, 0, 0, 0, 0, 0, 2, 58, 62, 0, 43, 0,
      0, 0, 0,
    ],
    [147],
  ],
  /* ENEMY_HIT */ [
    2646,
    6,
    [
      2, 194, 115, 160, 2, 120, 115, 103, 110, 113, 0, 12, 60, 35, 0, 0, 0, 0, 0, 0, 3, 102, 88, 1,
      45, 0, 0, 0, 0,
    ],
    [147],
  ],
  /* HORN_ATTACK */ [
    2646,
    7,
    [
      1, 174, 112, 74, 2, 156, 113, 105, 52, 97, 0, 16, 61, 21, 0, 0, 0, 0, 0, 0, 2, 111, 94, 11,
      44, 0, 0, 0, 0,
    ],
    [147],
  ],
];

export default pack;

export function expandSfx(entry: SfxEntry) {
  return {
    songData: [{ i: entry[2], p: [1], c: [{ n: entry[3], f: [] }] }],
    rowLen: entry[0],
    patternLen: entry[1],
    endPattern: 0,
    numChannels: 1,
  };
}
