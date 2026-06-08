/* ============================================================================
 * tiled-topdown 맵 저작 입력 — ASCII 격자(프로그램적 구성).
 * ----------------------------------------------------------------------------
 * ascii-to-tmj.mjs의 입력. 손으로 격자를 그리면 행 길이 실수가 잦아 2D 배열로
 * 안전하게 구성한다(외곽 벽 + 내부 방/기둥 + 오브젝트 배치).
 * 결과 level.tmj는 engine/tiled.js loadTiledMap이 절차 베이크 타일셋과 함께 로드.
 *
 *   legend:  # 벽(충돌) · . 바닥 · @ 플레이어 · e 적 · * 보석 · X 출구
 * ==========================================================================*/
const W = 30, H = 20;

// 2D 문자 배열을 바닥('.')으로 채운 뒤 가공
const cell = [];
for (let y = 0; y < H; y++) { cell.push(new Array(W).fill('.')); }
const set = (x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < H) cell[y][x] = ch; };
const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ch); };

// 외곽 벽
rect(0, 0, W - 1, 0, '#'); rect(0, H - 1, W - 1, H - 1, '#');
rect(0, 0, 0, H - 1, '#'); rect(W - 1, 0, W - 1, H - 1, '#');

// 내부 방/벽 (출입구 gap을 남겨 @→X 이동 가능하게)
rect(4, 3, 9, 3, '#'); rect(4, 3, 4, 7, '#'); rect(9, 3, 9, 7, '#'); rect(4, 7, 6, 7, '#'); // 좌상단 방(우하단 통로 open)
rect(20, 4, 25, 4, '#'); rect(25, 4, 25, 9, '#'); rect(22, 9, 25, 9, '#');                  // 우상단 방
rect(13, 6, 13, 14, '#'); set(13, 10, '.');                                                  // 중앙 세로벽(가운데 문 1칸)
rect(6, 12, 11, 12, '#'); rect(6, 12, 6, 16, '#');                                            // 좌하단 방
rect(18, 13, 24, 13, '#'); rect(18, 13, 18, 17, '#'); set(18, 15, '.');                       // 우하단 방(문)
// 기둥 몇 개
set(16, 3, '#'); set(16, 16, '#'); set(9, 10, '#'); set(22, 11, '#');

// 오브젝트
set(2, 2, '@');                 // 플레이어 시작(좌상단)
set(W - 3, H - 3, 'X');         // 출구(우하단)
// 적 (걷는 순찰형)
set(11, 5, 'e'); set(23, 7, 'e'); set(9, 15, 'e'); set(21, 16, 'e'); set(15, 9, 'e');
// 보석
set(7, 5, '*'); set(2, 9, '*'); set(27, 2, '*'); set(23, 6, '*'); set(3, 16, '*');
set(11, 17, '*'); set(27, 11, '*'); set(16, 11, '*');

const GRID = cell.map(row => row.join(''));

export default {
  TILE: 16,
  TILESET_NAME: 'forge',
  FLOOR: 'floor',
  TILES: [
    { name: 'floor', collides: false }, // GID 1
    { name: 'wall', collides: true }    // GID 2
  ],
  LEGEND: {
    '#': { tile: 'wall' },
    '.': { tile: 'floor' },
    '@': { object: 'player' },
    'e': { object: 'enemy', props: { kind: 'walker' } },
    '*': { object: 'pickup', props: { kind: 'gem' } },
    'X': { object: 'goal' }
  },
  GRID
};
