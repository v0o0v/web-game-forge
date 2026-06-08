#!/usr/bin/env node
/* ============================================================================
 * ascii-to-tmj — ASCII 격자 맵 → Tiled(.tmj) 변환기 (무의존성 Node)
 * ----------------------------------------------------------------------------
 * LLM이 가장 자연스럽게 맵을 "그리는" 방식 — 문자 격자 — 를 표준 Tiled JSON으로
 * 변환한다. 탑다운·퍼즐·던전처럼 그리드형 레벨 저작에 적합. engine/tiled.js의
 * loadTiledMap이 그대로 로드한다(절차 베이크 타일셋과 연결).
 *
 * 분할 규칙(docs/tiled-연동-설계.md §1): 타일 레이어 = 정적 지형(floor/wall),
 * 오브젝트 레이어 = 행동하는 것(player/enemy/pickup/goal…).
 *
 * 사용(설정 + 격자를 담은 JS 모듈을 입력):
 *   node ascii-to-tmj.mjs <map-module.js> <out.tmj>
 * map 모듈은 { GRID:[...rows], TILES:[...], LEGEND:{...}, FLOOR:'floor', TILE:16 }
 * 형태를 module.exports 한다(아래 LEGEND 규약 참고).
 *
 * 라이브러리로도 사용:  import { asciiToTmj } from './ascii-to-tmj.mjs'
 * ==========================================================================*/
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * @param {string[]} grid  각 행이 같은 길이(짧으면 floor/empty로 우패딩)인 문자 배열
 * @param {object} opts {
 *   tile=16,
 *   tilesetName='forge',
 *   tiles: [{name, collides}],     // 순서 배열, GID = index+1 (engine 베이커와 공유)
 *   floor: 'floor'|null,           // 오브젝트/빈 셀 아래 깔 기본 타일(없으면 빈칸)
 *   legend: { ch: { tile?:name, object?:type, props?:{...} } }
 * }
 */
export function asciiToTmj(grid, opts = {}) {
  const TILE = opts.tile || 16;
  const tilesetName = opts.tilesetName || 'forge';
  const tiles = opts.tiles || [];
  const legend = opts.legend || {};
  const floorName = opts.floor || null;

  const nameToGid = {};
  tiles.forEach((t, i) => { nameToGid[t.name] = i + 1; });
  const floorGid = floorName ? (nameToGid[floorName] || 0) : 0;

  const H = grid.length;
  const W = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const data = new Array(W * H).fill(0);
  const objects = [];
  let oid = 0;

  for (let r = 0; r < H; r++) {
    const row = grid[r];
    for (let c = 0; c < W; c++) {
      const ch = c < row.length ? row[c] : ' ';
      const spec = legend[ch];
      let gid = floorGid; // 기본: 바닥
      if (spec && spec.tile) {
        gid = nameToGid[spec.tile] || 0;
      } else if (ch === ' ') {
        gid = 0; // 명시적 공백 = 빈칸(바닥 없음)
      }
      if (gid) data[r * W + c] = gid;
      if (spec && spec.object) {
        oid += 1;
        const o = {
          id: oid, name: '', type: spec.object,
          x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
          width: 0, height: 0, point: true, rotation: 0, visible: true
        };
        if (spec.props) {
          o.properties = Object.keys(spec.props).map(k => {
            const v = spec.props[k];
            const ty = typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float')
              : typeof v === 'boolean' ? 'bool' : 'string';
            return { name: k, type: ty, value: v };
          });
        }
        objects.push(o);
      }
    }
  }

  const tilesBlock = [];
  tiles.forEach((t, i) => {
    if (t.collides) tilesBlock.push({ id: i, properties: [{ name: 'collides', type: 'bool', value: true }] });
  });

  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width: W, height: H, tilewidth: TILE, tileheight: TILE,
    nextlayerid: 3, nextobjectid: oid + 1,
    tilesets: [{
      firstgid: 1, name: tilesetName,
      tilewidth: TILE, tileheight: TILE,
      tilecount: tiles.length, columns: tiles.length,
      margin: 0, spacing: 0,
      image: tilesetName + '-tileset.png',
      imagewidth: tiles.length * TILE, imageheight: TILE,
      tiles: tilesBlock
    }],
    layers: [
      { id: 1, type: 'tilelayer', name: 'Ground', x: 0, y: 0,
        width: W, height: H, opacity: 1, visible: true, data },
      { id: 2, type: 'objectgroup', name: 'Objects', opacity: 1, visible: true,
        x: 0, y: 0, draworder: 'topdown', objects }
    ]
  };
}

// --- CLI ---------------------------------------------------------------------
async function main() {
  const [, , inPath, outPath] = process.argv;
  if (!inPath || !outPath) {
    console.error('사용: node ascii-to-tmj.mjs <map-module.js> <out.tmj>');
    process.exit(1);
  }
  const url = pathToFileURL(path.resolve(inPath)).href;
  const mod = (await import(url)).default || {};
  if (!mod.GRID) throw new Error('맵 모듈은 module.exports = { GRID, TILES, LEGEND, FLOOR, TILE } 형태여야 함');
  const tmj = asciiToTmj(mod.GRID, {
    tile: mod.TILE, tiles: mod.TILES, legend: mod.LEGEND, floor: mod.FLOOR, tilesetName: mod.TILESET_NAME
  });
  await writeFile(outPath, JSON.stringify(tmj, null, 2), 'utf8');
  const tileN = tmj.layers[0].data.filter(g => g !== 0).length;
  console.log(`✓ ${outPath} — ${tmj.width}x${tmj.height}, 타일 ${tileN}개, 오브젝트 ${tmj.layers[1].objects.length}개`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
