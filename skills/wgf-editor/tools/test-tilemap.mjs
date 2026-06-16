#!/usr/bin/env node
// test-tilemap.mjs — TilemapLayer(2C) UI 헬퍼 헤드리스 단위 테스트 + 게이트 검증
// ─────────────────────────────────────────────────────────────────────────────
// editor/ui/src/tilemap.js 의 순수 헬퍼(컨테이너 식별·격자 스냅·셀 타일 탐색)를 실제 node
// 실행으로 결정적 검증한다. 우클릭 지우개(Viewport)·레이어 이동(Inspector)·activeLayerId
// 검증(main)이 공유하는 규약 함수라, 회귀가 조용히 새지 않도록 잠근다. tilemap.js 는 의존 0
// 순수 ESM 이라 preact/DOM 없이 node 로 직접 import 한다(렌더 검증은 브라우저 e2e 소관).
//
// 게이트:
//   G-TM-A  isTilemapContainer — 콜론 포함 접두사로 컨테이너만 식별(드리프트 방어 포함)
//   G-TM-B  snapToGrid — 격자 스냅·기본값
//   G-TM-C  findTopTileAtCell — 셀 내 임의지점 타일 탐색·빈셀 null·non-tile 제외
//   G-TM-D  컨테이너 보호 — 컨테이너 자체는 절대 반환 안 함(레이어 통째삭제 방지)
//   G-TM-E  겹친 레이어 — 같은 셀 최상단(배열 마지막) 반환
//   G-TM-F  이동 컨테이너 — off-grid 원점 + 로컬좌표 타일의 월드 매치
//
// 사용: node skills/wgf-editor/tools/test-tilemap.mjs
// 출력: 사람용 줄 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');          // 리포 루트
const TILEMAP = pathToFileURL(resolve(root, 'editor/ui/src/tilemap.js')).href;

const { isTilemapContainer, snapToGrid, listTilemapContainers, findTopTileAtCell } = await import(TILEMAP);

// ── 체크 하니스 (test-scenekit.mjs 와 동형) ──────────────────────────────────
const checks = [];
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  const passed = !!cond;
  checks.push({ name, ok: passed, detail: detail || '' });
  if (passed) { pass++; console.log(`✓ ${name}`); }
  else        { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── G-TM-A  isTilemapContainer (콜론 접두사·드리프트 방어) ────────────────────
ok('G-TM-A 컨테이너 식별(TilemapLayer:ground)', isTilemapContainer({ name: 'TilemapLayer:ground' }) === true);
ok('G-TM-A 컨테이너 식별(TilemapLayer:layer1)', isTilemapContainer({ name: 'TilemapLayer:layer1' }) === true);
ok('G-TM-A 타일은 컨테이너 아님(tile)', isTilemapContainer({ name: 'tile' }) === false);
ok('G-TM-A 한글 타일명 아님(타일0)', isTilemapContainer({ name: '타일0' }) === false);
ok('G-TM-A 드리프트 방어 — 콜론 없는 유사명은 컨테이너 아님(TilemapLayerMeta)',
   isTilemapContainer({ name: 'TilemapLayerMeta' }) === false);
ok('G-TM-A 이름 없음 방어', isTilemapContainer({}) === false);
ok('G-TM-A null 방어', isTilemapContainer(null) === false);

// ── G-TM-B  snapToGrid ────────────────────────────────────────────────────────
ok('G-TM-B snap 16 정렬(17→16)', snapToGrid(17, 16) === 16);
ok('G-TM-B snap 16 반올림(24→32)', snapToGrid(24, 16) === 32);
ok('G-TM-B snap size 0 → 16 기본', snapToGrid(17, 0) === 16);
ok('G-TM-B 음수 좌표 스냅(-7,16→0)', snapToGrid(-7, 16) === -0 || snapToGrid(-7, 16) === 0);

// ── 표준 타일맵 픽스처: 컨테이너(0,0) + 타일 3개 + player ───────────────────────
const world = { entities: [
  { id: 'layer1', name: 'TilemapLayer:layer1', transform: { x: 0, y: 0 } },
  { id: 't0', name: 'tile', parentId: 'layer1', transform: { x: 0,  y: 0 }, components: [{ type: 'Sprite', sprite: 's', frame: 0 }] },
  { id: 't1', name: 'tile', parentId: 'layer1', transform: { x: 16, y: 0 }, components: [{ type: 'Sprite', sprite: 's', frame: 1 }] },
  { id: 't2', name: 'tile', parentId: 'layer1', transform: { x: 32, y: 0 }, components: [{ type: 'Sprite', sprite: 's', frame: 2 }] },
  { id: 'player', name: 'player', transform: { x: 0, y: 0 }, components: [{ type: 'Body' }] }
]};

ok('G-TM-C 컨테이너 목록 1개', listTilemapContainers(world).length === 1);

// ── G-TM-C  findTopTileAtCell (셀 내 임의지점·빈셀·non-tile 제외) ──────────────
ok('G-TM-C 셀 내 지점(2,1) → t0', (findTopTileAtCell(world, 2, 1, 16) || {}).id === 't0');
ok('G-TM-C 셀 내 지점(17,3) → t1', (findTopTileAtCell(world, 17, 3, 16) || {}).id === 't1');
ok('G-TM-C 셀 내 지점(33,2) → t2', (findTopTileAtCell(world, 33, 2, 16) || {}).id === 't2');
ok('G-TM-C 빈 셀 → null', findTopTileAtCell(world, 200, 200, 16) === null);
ok('G-TM-C non-tile(player) 제외 — (0,0)에서 t0 반환', (findTopTileAtCell(world, 0, 0, 16) || {}).id === 't0');
ok('G-TM-C world 없음 방어 → null', findTopTileAtCell(null, 0, 0, 16) === null);

// ── G-TM-D  컨테이너 보호(컨테이너만 있으면 null — 레이어 통째삭제 방지) ───────
const onlyContainer = { entities: [{ id: 'L', name: 'TilemapLayer:x', transform: { x: 0, y: 0 } }] };
ok('G-TM-D 컨테이너만 → null(레이어 통째삭제 불가)', findTopTileAtCell(onlyContainer, 0, 0, 16) === null);

// ── G-TM-E  겹친 두 레이어 같은 셀 → 마지막(배열순서 최상단) ───────────────────
const overlap = { entities: [
  { id: 'L1', name: 'TilemapLayer:a', transform: { x: 0, y: 0 } },
  { id: 'L2', name: 'TilemapLayer:b', transform: { x: 0, y: 0 } },
  { id: 'tA', name: 'tile', parentId: 'L1', transform: { x: 0, y: 0 } },
  { id: 'tB', name: 'tile', parentId: 'L2', transform: { x: 0, y: 0 } }
]};
ok('G-TM-E 겹침 → 최상단(tB, 배열 마지막)', (findTopTileAtCell(overlap, 0, 0, 16) || {}).id === 'tB');

// ── G-TM-F  이동된 off-grid 컨테이너(100,80) + 로컬(0,0) 타일 → 월드(100,80) 매치 ─
const moved = { entities: [
  { id: 'Lm', name: 'TilemapLayer:m', transform: { x: 100, y: 80 } },
  { id: 'tm', name: 'tile', parentId: 'Lm', transform: { x: 0, y: 0 } }
]};
ok('G-TM-F 이동 컨테이너 타일 월드클릭 매치', (findTopTileAtCell(moved, 100, 80, 16) || {}).id === 'tm');

// ── 결과 출력(test-scenekit.mjs 와 동일 포맷) ────────────────────────────────
console.log(`\n— pass ${pass} · fail ${fail} · total ${pass + fail}`);
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }));
process.exit(fail ? 1 : 0);
