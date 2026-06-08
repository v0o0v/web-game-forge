/* ============================================================================
 * tiled-iso 등각(isometric) 맵 — ASCII 격자 입력(ascii-to-tmj.mjs).
 * ----------------------------------------------------------------------------
 * orientation='isometric', 타일 32x16(다이아몬드). 지형만(타일 레이어):
 *   . 바닥(floor) · # 벽(wall, 충돌) · ~ 물(water, 애니 3프레임)
 * 시작/골 타일은 game.js 상수(START/GOAL)로 둔다(등각 좌표 변환 시연은 이동 로직에서).
 * ==========================================================================*/
const W = 14, H = 12;
const cell = [];
for (let y = 0; y < H; y++) cell.push(new Array(W).fill('.'));
const set = (x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < H) cell[y][x] = ch; };
const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ch); };

// 외곽 벽
rect(0, 0, W - 1, 0, '#'); rect(0, H - 1, W - 1, H - 1, '#');
rect(0, 0, 0, H - 1, '#'); rect(W - 1, 0, W - 1, H - 1, '#');
// 물 연못(중앙) + 건너는 돌다리(floor) 1칸
rect(5, 4, 9, 7, '~'); set(7, 4, '.'); set(7, 7, '.');
// 내부 장식 벽(통로 확보)
rect(3, 2, 3, 4, '#'); rect(10, 7, 10, 9, '#');

const GRID = cell.map(row => row.join(''));

export default {
  TILE: 16,
  TILE_WIDTH: 32,
  TILE_HEIGHT: 16,
  ORIENTATION: 'isometric',
  TILESET_NAME: 'forge',
  FLOOR: 'floor',
  TILES: [
    { name: 'floor', collides: false },                                // GID 1
    { name: 'water', collides: false, anim: { frames: 3, duration: 240 } }, // GID 2 (칸 2,3,4)
    { name: 'wall', collides: true }                                   // GID 5
  ],
  LEGEND: {
    '#': { tile: 'wall' },
    '.': { tile: 'floor' },
    '~': { tile: 'water' }
  },
  GRID
};
