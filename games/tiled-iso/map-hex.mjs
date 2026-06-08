/* ============================================================================
 * tiled-iso 육각(hexagonal) 맵 — ASCII 격자 입력(ascii-to-tmj.mjs).
 * ----------------------------------------------------------------------------
 * orientation='hexagonal', staggeraxis='y'/staggerindex='odd', hexsidelength=16.
 * 타일 32x32(육각형). 지형만:  . 바닥 · # 벽(충돌) · ~ 물(애니 3프레임)
 * ?orient=hex 로 game.js 가 선택.
 * ==========================================================================*/
const W = 12, H = 11;
const cell = [];
for (let y = 0; y < H; y++) cell.push(new Array(W).fill('.'));
const set = (x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < H) cell[y][x] = ch; };
const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ch); };

// 외곽 벽
rect(0, 0, W - 1, 0, '#'); rect(0, H - 1, W - 1, H - 1, '#');
rect(0, 0, 0, H - 1, '#'); rect(W - 1, 0, W - 1, H - 1, '#');
// 물 호수 + 징검다리
rect(4, 3, 8, 6, '~'); set(6, 3, '.'); set(6, 6, '.');
// 벽 기둥 몇 개
set(3, 8, '#'); set(8, 8, '#'); set(6, 9, '#');

const GRID = cell.map(row => row.join(''));

export default {
  TILE: 32,
  TILE_WIDTH: 32,
  TILE_HEIGHT: 32,
  ORIENTATION: 'hexagonal',
  HEX: { sideLength: 16, staggerAxis: 'y', staggerIndex: 'odd' },
  TILESET_NAME: 'forge',
  FLOOR: 'floor',
  TILES: [
    { name: 'floor', collides: false },
    { name: 'water', collides: false, anim: { frames: 3, duration: 240 } },
    { name: 'wall', collides: true }
  ],
  LEGEND: {
    '#': { tile: 'wall' },
    '.': { tile: 'floor' },
    '~': { tile: 'water' }
  },
  GRID
};
