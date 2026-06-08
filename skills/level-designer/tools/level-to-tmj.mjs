#!/usr/bin/env node
/* ============================================================================
 * level-to-tmj — 절차 LEVEL 피처리스트 → Tiled(.tmj) 변환기 (무의존성 Node)
 * ----------------------------------------------------------------------------
 * web-game-builder의 자체 LEVEL 데이터를 표준 Tiled JSON으로 변환한다.
 *   - 라운드트립: 변환 결과를 실제 Tiled 앱에서 열어 편집 가능.
 *   - 데모: engine/tiled.js의 loadTiledMap이 그대로 로드(절차 베이크 타일셋과 연결).
 *
 * 분할 규칙(docs/tiled-연동-설계.md §1): 타일 레이어 = 정적 지형(ground/dirt/stone),
 * 오브젝트 레이어 = 행동하는 모든 것(player/coin/enemy/block/pipe/goal).
 *
 * 타일셋 계약(§2): 순서 있는 배열, GID = index+1. 베이커(engine/tiled.js)와 공유.
 *   1=ground(collides) 2=dirt(collides) 3=stone(collides)
 *
 * 사용:
 *   node level-to-tmj.mjs <in-level.js> <out.tmj> [globalVarName]
 *   예) node level-to-tmj.mjs ../../../games/super-runner/level.js \
 *         ../../../games/super-runner/level.tmj SUPER_RUNNER_TMJ
 *   → out.tmj(순수 JSON) + out.tmj.js(window.<globalVarName> 래퍼, fetch-free 로딩) 동시 출력.
 * ==========================================================================*/
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// --- 표준 플랫포머 타일셋 (docs §2 계약 — 베이커와 동일 순서) -----------------
const PLATFORMER_TILES = [
  { name: 'ground', collides: true },  // GID 1
  { name: 'dirt',   collides: true },  // GID 2
  { name: 'stone',  collides: true }   // GID 3
];
const GID = { ground: 1, dirt: 2, stone: 3 };

// 'S' 피처는 stone 타일로(지형), 나머지 피처는 오브젝트로.
const BLOCK_KIND = { 'B': 'brick', '?': 'coin', 'M': 'mushroom' };

function tilesetBlock(tileDefs, tileSize, name) {
  const n = tileDefs.length;
  const columns = n;                 // 단일 행
  const tiles = [];
  tileDefs.forEach((d, i) => {
    if (d.collides) tiles.push({ id: i, properties: [{ name: 'collides', type: 'bool', value: true }] });
  });
  return {
    firstgid: 1, name,
    tilewidth: tileSize, tileheight: tileSize,
    tilecount: n, columns,
    margin: 0, spacing: 0,
    image: name + '-tileset.png',
    imagewidth: columns * tileSize, imageheight: tileSize,
    tiles
  };
}

/**
 * 순수 변환: LEVEL 객체 → Tiled JSON 객체.
 * @param {object} level super-runner LEVEL 포맷
 * @param {object} [opts] { tile=16, tilesetName='forge' }
 */
export function levelToTmj(level, opts = {}) {
  const TILE = opts.tile || 16;
  const tilesetName = opts.tilesetName || 'forge';
  const W = level.width, H = level.rows;
  const cx = (c) => c * TILE + TILE / 2;
  const cy = (r) => r * TILE + TILE / 2;

  const isPit = (col) => (level.pits || []).some(p => col >= p[0] && col <= p[1]);

  // --- 타일 레이어: ground/dirt 자동 + stone(S) ---
  const data = new Array(W * H).fill(0);
  for (let col = 0; col < W; col++) {
    if (isPit(col)) continue;
    data[level.groundTop * W + col] = GID.ground;
    data[(level.groundTop + 1) * W + col] = GID.dirt;
  }
  for (const f of level.features) {
    if (f.t === 'S') data[f.r * W + f.c] = GID.stone;
  }

  // --- 오브젝트 레이어 ---
  const objects = [];
  let oid = 0;
  const point = (type, x, y, props) => {
    oid += 1;
    const o = { id: oid, name: '', type, x: Math.round(x), y: Math.round(y),
      width: 0, height: 0, point: true, rotation: 0, visible: true };
    if (props) o.properties = props;
    return o;
  };

  // 시작점
  if (level.start) objects.push(point('player', cx(level.start.c), cy(level.start.r)));

  // 피처
  for (const f of level.features) {
    if (f.t === 'o') objects.push(point('coin', cx(f.c), cy(f.r)));
    else if (f.t === 'e') objects.push(point('enemy', cx(f.c), cy(f.r),
      [{ name: 'kind', type: 'string', value: 'slime' }]));
    else if (BLOCK_KIND[f.t]) objects.push(point('block', cx(f.c), cy(f.r),
      [{ name: 'kind', type: 'string', value: BLOCK_KIND[f.t] }]));
    // 'S'는 타일 레이어에서 처리됨
  }

  // 파이프(구조 — 좌상단 모서리 px + height 프로퍼티)
  for (const p of (level.pipes || [])) {
    objects.push(point('pipe', p.c * TILE, p.top * TILE,
      [{ name: 'height', type: 'int', value: p.h }]));
  }

  // 골
  if (level.goal) objects.push(point('goal', level.goal.c * TILE, level.groundTop * TILE));

  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down',
    infinite: false,
    width: W, height: H, tilewidth: TILE, tileheight: TILE,
    nextlayerid: 3, nextobjectid: oid + 1,
    // 맵 프로퍼티(스포너가 참조 가능 — 데모는 game.js 상수로도 알 수 있음)
    properties: [{ name: 'groundTop', type: 'int', value: level.groundTop }],
    tilesets: [tilesetBlock(PLATFORMER_TILES, TILE, tilesetName)],
    layers: [
      { id: 1, type: 'tilelayer', name: 'Ground', x: 0, y: 0,
        width: W, height: H, opacity: 1, visible: true, data },
      { id: 2, type: 'objectgroup', name: 'Objects', opacity: 1, visible: true,
        x: 0, y: 0, draworder: 'topdown', objects }
    ]
  };
}

// --- CLI ---------------------------------------------------------------------
async function loadLevel(inPath) {
  const url = pathToFileURL(path.resolve(inPath)).href;
  const mod = await import(url);
  const api = mod.default || mod;
  const level = api.LEVEL || (api.default && api.default.LEVEL) || api;
  if (!level || !level.width) throw new Error('LEVEL을 찾을 수 없음: ' + inPath + ' (module.exports = { LEVEL } 필요)');
  return { level, tile: api.TILE || 16 };
}

async function main() {
  const [, , inPath, outPath, globalVar] = process.argv;
  if (!inPath || !outPath) {
    console.error('사용: node level-to-tmj.mjs <in-level.js> <out.tmj> [globalVarName]');
    process.exit(1);
  }
  const { level, tile } = await loadLevel(inPath);
  const tmj = levelToTmj(level, { tile });
  const json = JSON.stringify(tmj, null, 2);
  await writeFile(outPath, json, 'utf8');
  let tileCount = tmj.layers[0].data.filter(g => g !== 0).length;
  console.log(`✓ ${outPath} — ${tmj.width}x${tmj.height} 타일, 타일 ${tileCount}개, 오브젝트 ${tmj.layers[1].objects.length}개`);
  if (globalVar) {
    const wrapper = `/* 자동 생성(level-to-tmj.mjs) — fetch-free 로딩용. 편집 금지. */\n` +
      `(function (g) { g.${globalVar} = ${json}; })(typeof window !== 'undefined' ? window : this);\n`;
    await writeFile(outPath + '.js', wrapper, 'utf8');
    console.log(`✓ ${outPath}.js — window.${globalVar} 래퍼`);
  }
}

// 직접 실행 시에만 CLI 동작(import 시엔 levelToTmj만 노출)
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
