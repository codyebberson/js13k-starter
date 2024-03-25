import { TILEMAP_HEIGHT, TILEMAP_WIDTH } from './constants';

const tileMap: string[] = [
  '                                                                                                                                ',
  '                                                                                                                                ',
  '                                                                                                                                ',
  '                                                                                                                                ',
  '                                                                                                                                ',
  '                                                                                                                                ',
  '                                                                                                                                ',
  '                                                                                                                                ',
  '            1223                                                                                                                ',
  '                3                                                                                                               ',
  '       1223      3                                                                                                              ',
  '                  3                                                                                                             ',
  '     13            3                                                                                                            ',
  '    1223            3                                                                                                           ',
  '   122223  123                                                                                                                  ',
  '22222222222456222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222',
];

export function getTile(x: number, y: number): number {
  if (x < 0 || x >= TILEMAP_WIDTH || y < 0 || y >= TILEMAP_HEIGHT) {
    return 100;
  }

  // Convert ASCII to tile index
  // 48 is the ASCII code for '0'
  // See ASCII chart for more details: https://en.wikipedia.org/wiki/ASCII
  return Math.max(0, tileMap[y | 0].charCodeAt(x | 0) - 48);
}
