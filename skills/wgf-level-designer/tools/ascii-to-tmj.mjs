#!/usr/bin/env node
/* ============================================================================
 * ascii-to-tmj — ASCII 격자 맵 → Tiled(.tmj) 변환기 (무의존성 Node)
 * ----------------------------------------------------------------------------
 * LLM이 가장 자연스럽게 맵을 "그리는" 방식 — 문자 격자 — 를 표준 Tiled JSON으로
 * 변환한다. 탑다운·퍼즐·던전·등각/육각처럼 그리드형 레벨 저작에 적합.
 * engine/tiled.js의 loadTiledMap이 그대로 로드한다(절차 베이크 타일셋과 연결).
 *
 * 분할 규칙(docs/tiled-연동-설계.md §1): 타일 레이어 = 정적 지형(floor/wall),
 * 오브젝트 레이어 = 행동하는 것(player/enemy/pickup/goal…).
 *
 * GID·애니메이션 계약은 engine/tiled.js 와 **공유**한다(createRequire 로 직접 사용):
 *   - 정적 타일 = 1칸, 애니 타일(anim:{frames:N}) = N칸(연속), GID=첫칸+1.
 *   - 애니 타일은 embedded tileset 의 tiles[] 에 animation:[{tileid,duration}] 자동 emit.
 *
 * orientation: 'orthogonal'(기본) | 'isometric' | 'hexagonal' | 'staggered'.
 *   iso/hex 는 tileWidth/tileHeight(예 32x16) + hex 파라미터를 넘긴다.
 *
 * 사용:
 *   node ascii-to-tmj.mjs <map-module.js> <out.tmj>
 * map 모듈은 export default { GRID, TILES, LEGEND, FLOOR, TILE, ORIENTATION?,
 *   TILE_WIDTH?, TILE_HEIGHT?, HEX? } 형태.
 *
 * 라이브러리로도 사용:  import { asciiToTmj } from './ascii-to-tmj.mjs'
 * ==========================================================================*/
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
// engine/tiled.js 의 순수 함수(GID/애니 계약 단일 소스)를 그대로 사용.
const TiledForge = require('../../../engine/tiled.js');

/**
 * @param {string[]} grid  각 행이 같은 길이(짧으면 floor/empty로 우패딩)인 문자 배열
 * @param {object} opts {
 *   tile=16, tileWidth?, tileHeight?,            // iso/hex 는 비정방형(예 32x16)
 *   orientation='orthogonal',                    // isometric|hexagonal|staggered
 *   hex?: { sideLength, staggerAxis:'x'|'y', staggerIndex:'odd'|'even' },
 *   tilesetName='forge',
 *   tiles: [{ name, collides, anim?:{frames,duration|durations} }], // GID=index 펼침+1
 *   floor: 'floor'|null,
 *   legend: { ch: { tile?:name, object?:type, props?:{...} } }
 * }
 */
export function asciiToTmj(grid, opts = {}) {
  const TILE = opts.tile || 16;
  const TW = opts.tileWidth || TILE;
  const TH = opts.tileHeight || TILE;
  const orientation = opts.orientation || 'orthogonal';
  const tilesetName = opts.tilesetName || 'forge';
  const tiles = opts.tiles || [];
  const legend = opts.legend || {};
  const floorName = opts.floor || null;

  // GID 매핑은 engine 의 펼침 계약으로 계산(애니 타일이 여러 칸을 차지해도 정확).
  const ex = TiledForge.expandTileDefs(tiles);
  const nameToGid = ex.nameToGid;
  const floorGid = floorName ? (nameToGid[floorName] || 0) : 0;

  const H = grid.length;
  const W = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const data = new Array(W * H).fill(0);
  const objects = [];
  let oid = 0;

  // 오브젝트 좌표: 직교는 타일 중심 픽셀. iso/hex/staggered 는 Tiled 규약상
  // "그리드 좌표 * tileheight"(논리 좌표)를 쓴다 — Phaser 가 orientation 으로 투영.
  const objX = (c, r) => orientation === 'orthogonal' ? c * TW + TW / 2 : c * TH;
  const objY = (c, r) => orientation === 'orthogonal' ? r * TH + TH / 2 : r * TH;

  for (let r = 0; r < H; r++) {
    const row = grid[r];
    for (let c = 0; c < W; c++) {
      const ch = c < row.length ? row[c] : ' ';
      const spec = legend[ch];
      let gid = floorGid;
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
          x: Math.round(objX(c, r)), y: Math.round(objY(c, r)),
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

  // embedded tileset 블록은 engine 의 buildTilesetBlock 로(collides + animation 계약).
  const tilesetBlock = TiledForge.buildTilesetBlock(tiles, {
    name: tilesetName, tileWidth: TW, tileHeight: TH, columns: ex.cells.length
  });

  const map = {
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation, renderorder: 'right-down', infinite: false,
    width: W, height: H, tilewidth: TW, tileheight: TH,
    nextlayerid: 3, nextobjectid: oid + 1,
    tilesets: [tilesetBlock],
    layers: [
      { id: 1, type: 'tilelayer', name: 'Ground', x: 0, y: 0,
        width: W, height: H, opacity: 1, visible: true, data },
      { id: 2, type: 'objectgroup', name: 'Objects', opacity: 1, visible: true,
        x: 0, y: 0, draworder: 'topdown', objects }
    ]
  };

  // 육각/스태거드 파라미터(Tiled 필수 필드).
  if (orientation === 'hexagonal' || orientation === 'staggered') {
    const hex = opts.hex || {};
    map.staggeraxis = hex.staggerAxis || 'y';
    map.staggerindex = hex.staggerIndex || 'odd';
    if (orientation === 'hexagonal') map.hexsidelength = hex.sideLength || Math.floor(TH / 2);
  }
  return map;
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
  if (!mod.GRID) throw new Error('맵 모듈은 export default { GRID, TILES, LEGEND, FLOOR, TILE } 형태여야 함');
  const tmj = asciiToTmj(mod.GRID, {
    tile: mod.TILE, tileWidth: mod.TILE_WIDTH, tileHeight: mod.TILE_HEIGHT,
    orientation: mod.ORIENTATION, hex: mod.HEX,
    tiles: mod.TILES, legend: mod.LEGEND, floor: mod.FLOOR, tilesetName: mod.TILESET_NAME
  });
  await writeFile(outPath, JSON.stringify(tmj, null, 2), 'utf8');
  const tileN = tmj.layers[0].data.filter(g => g !== 0).length;
  const anim = (tmj.tilesets[0].tiles || []).filter(t => t.animation).length;
  console.log(`✓ ${outPath} — ${tmj.orientation} ${tmj.width}x${tmj.height}, 타일 ${tileN}개, 오브젝트 ${tmj.layers[1].objects.length}개, 애니타일 ${anim}종`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
