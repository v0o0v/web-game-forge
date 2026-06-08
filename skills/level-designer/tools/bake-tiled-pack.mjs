#!/usr/bin/env node
/* ============================================================================
 * bake-tiled-pack — 절차 CC0 Tiled 팩 생성기 (무의존성: Node 내장 zlib만 사용)
 * ----------------------------------------------------------------------------
 * "외부 CC0 Tiled 팩 임포트"의 실증용 팩을 **우리가 직접 절차 저작**해 만든다.
 * 제3자 다운로드 0 → 100% CC0/IP-safe(저작자=WebGameForge). 그래도 산출물은
 * 진짜 외부 파일(tileset.png + level.tmj + pack.json)이라, 게임은 절차 베이크가
 * 아니라 **실제 이미지 파일을 Phaser 로더로 임포트**하는 경로를 그대로 탄다.
 *
 * 산출:
 *   <outDir>/tileset.png   — 가로 스트립 아틀라스(문자 그리드 래스터, 애니 프레임 포함)
 *   <outDir>/level.tmj     — Tiled 맵(ascii-to-tmj 공유 계약; 애니/충돌 tiles[] 포함)
 *   <outDir>/pack.json     — 라이선스 매니페스트(verify-tiled-pack 게이트 입력)
 *
 * PNG 인코더: Node 내장 zlib(deflateSync)로 IDAT 압축, CRC32/IHDR/IEND 직접 프레이밍.
 * 외부 npm 의존 0.
 *
 * 사용:
 *   node bake-tiled-pack.mjs <outDir>
 * ==========================================================================*/
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import path from 'node:path';
import { asciiToTmj } from './ascii-to-tmj.mjs';

const TILE = 16;
const TILESET_NAME = 'forge';

// --- 팔레트 (단일 문자 → [r,g,b] / null=투명) -------------------------------
const PAL = {
  '.': null, ' ': null,
  // 바닥(따뜻한 석재)
  f: [201, 180, 143], F: [182, 160, 121], d: [156, 133, 95],
  // 벽(청회 벽돌)
  w: [93, 107, 140], W: [63, 76, 107], x: [124, 140, 173],
  // 용암(애니: 주황→노랑 흐름)
  a: [232, 93, 53], A: [168, 51, 26], y: [255, 210, 63], o: [120, 30, 10]
};

// --- 타일 정의: art(프레임 그리드) + 계약 메타 -------------------------------
// 정적 = grids 1장, 애니 = grids N장(GID 는 첫 칸). docs/tiled-연동-설계.md GID 계약.
const TILE_DEFS = [
  { name: 'floor', collides: false, grids: [[
    'ffffffffffffffff', 'fFffffdfffffFfff', 'ffffffffffffffff', 'fffdffffffFfffff',
    'ffffffffdfffffff', 'fFfffffffffffdff', 'ffffffFfffffffff', 'ffdfffffffffffff',
    'ffffffffFfffffff', 'fffffdffffffffFf', 'fFffffffffdfffff', 'ffffffffffffffff',
    'ffFfffdfffffffff', 'ffffffffffFfffff', 'fdffffffffffffdf', 'ffffffFfffffffff'
  ]] },
  { name: 'wall', collides: true, grids: [[
    'xxxxxxxxxxxxxxxx', 'xWwwwwwWwwwwwwWx', 'xwwwwwwwwwwwwwwx', 'xwwwwwwwwwwwwwwx',
    'WWWWWWWWWWWWWWWW', 'wwwwwwxwwwwwwwww', 'wwwwwwxwwwwwwwww', 'wwwwwwxwwwwwwwww',
    'WWWWWWWWWWWWWWWW', 'wwwxwwwwwwwxwwww', 'wwwxwwwwwwwxwwww', 'wwwxwwwwwwwxwwww',
    'WWWWWWWWWWWWWWWW', 'wwwwwwwwxwwwwwww', 'wwwwwwwwxwwwwwww', 'xWwwwwwwxwwwwWxx'
  ]] },
  // 용암: 3프레임 흐름 애니(콜라이드 없음 — 데미지는 게임이 오브젝트/콜백으로).
  { name: 'lava', collides: false, anim: { frames: 3, duration: 220 }, grids: [
    [
      'oaaaaaaaaaaaaaao', 'aayaaaaaaaayaaaa', 'aaaaayaaaaaaaaaa', 'aAaaaaaaaayaaaaa',
      'aaaaaaayaaaaaaaa', 'ayaaaaaaaaaaaAaa', 'aaaaaAaaaaaaaaaa', 'aaaayaaaaaaaaaya',
      'aaaaaaaaayaaaaaa', 'aAaaaaaaaaaaaaAa', 'aaaaayaaaaaaaaaa', 'aaaaaaaaaaaayaaa',
      'ayaaaaAaaaaaaaaa', 'aaaaaaaaaaayaaaa', 'aAaaaaaaaaaaaaaa', 'oaaaaaaaaaaaaaao'
    ],
    [
      'oaaaaaaaaaaaaaao', 'aaaaayaaaaaaaaaa', 'aayaaaaaaaayaaaa', 'aaaaaaayaaaaaAaa',
      'aAaaaaaaaaaaaaaa', 'aaaaaaaaayaaaaaa', 'ayaaaaaaaaaaaaya', 'aaaaaAaaaaaaaaaa',
      'aaaaaaaaaaaayaaa', 'aaaayaaaaAaaaaaa', 'aAaaaaaaaaaaaaaa', 'aaaaaaayaaaaaaaa',
      'aaaaaaaaaaayaaaa', 'ayaaaAaaaaaaaaaa', 'aaaaaaaaaaaaaAaa', 'oaaaaaaaaaaaaaao'
    ],
    [
      'oaaaaaaaaaaaaaao', 'aaaaaaaaayaaaaaa', 'aAaaaayaaaaaaaaa', 'aaaaaaaaaaaaaAaa',
      'aaayaaaaaaaaayaa', 'aaaaaaaAaaaaaaaa', 'aaaaaaaaaaayaaaa', 'ayaaaaaaaaaaaaAa',
      'aaaaaAaaaayaaaaa', 'aaaaaaaaaaaaaaya', 'aAaaayaaaaaaaaaa', 'aaaaaaaaaAaaaaaa',
      'aaaayaaaaaaaaaaa', 'aaaaaaaaaayaaaAa', 'ayaaaaaaaaaaaaaa', 'oaaaaaaaaaaaaaao'
    ]
  ] }
];

// --- 문자 그리드 → RGBA 칸 버퍼 ----------------------------------------------
function rasterCell(grid, size) {
  const buf = Buffer.alloc(size * size * 4); // 기본 0 = 투명
  for (let y = 0; y < grid.length && y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length && x < size; x++) {
      const col = PAL[row[x]];
      if (!col) continue;
      const i = (y * size + x) * 4;
      buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255;
    }
  }
  return buf;
}

// --- 칸 버퍼들을 가로 스트립 아틀라스로 합성 ---------------------------------
function compositeAtlas(cellBufs, size) {
  const cols = cellBufs.length;
  const W = cols * size, H = size;
  const atlas = Buffer.alloc(W * H * 4);
  cellBufs.forEach((cell, ci) => {
    const ox = ci * size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const si = (y * size + x) * 4;
        const di = (y * W + (ox + x)) * 4;
        cell.copy(atlas, di, si, si + 4);
      }
    }
  });
  return { atlas, width: W, height: H };
}

// --- PNG 인코더 (RGBA8, filter=None, zlib 압축) ------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // compression/filter/interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// --- 데모 맵(ASCII) — 벽으로 둘러싸인 방 + 용암 강 + 시작/골 ------------------
function buildGrid() {
  const W = 40, H = 26;
  const cell = [];
  for (let y = 0; y < H; y++) cell.push(new Array(W).fill('.'));
  const set = (x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < H) cell[y][x] = ch; };
  const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ch); };
  // 외곽 벽
  rect(0, 0, W - 1, 0, '#'); rect(0, H - 1, W - 1, H - 1, '#');
  rect(0, 0, 0, H - 1, '#'); rect(W - 1, 0, W - 1, H - 1, '#');
  // 내부 벽 미로(통로 확보)
  rect(8, 4, 8, 16, '#'); set(8, 10, '.');
  rect(16, 8, 30, 8, '#'); set(22, 8, '.');
  rect(24, 12, 24, 22, '#'); set(24, 18, '.');
  rect(12, 20, 28, 20, '#'); set(20, 20, '.');
  // 용암 강(수평) — 건널목 1칸
  rect(3, 13, 36, 13, '~'); set(20, 13, '.');
  // 시작/골
  set(2, 2, '@');
  set(W - 3, H - 3, 'X');
  return cell.map(r => r.join(''));
}

async function main() {
  const outDir = path.resolve(process.argv[2] || '.');
  await mkdir(outDir, { recursive: true });

  // 아틀라스: TILE_DEFS 를 펼친 순서로 칸 합성(엔진 GID 계약과 동일 순서).
  const cellBufs = [];
  for (const def of TILE_DEFS) {
    const grids = def.grids;
    for (const g of grids) cellBufs.push(rasterCell(g, TILE));
  }
  const { atlas, width, height } = compositeAtlas(cellBufs, TILE);
  const png = encodePNG(width, height, atlas);
  await writeFile(path.join(outDir, 'tileset.png'), png);

  // .tmj — TILES 는 art 없이 계약 메타만(asciiToTmj 가 엔진 펼침으로 GID/애니 계산).
  const TILES = TILE_DEFS.map(d => ({ name: d.name, collides: d.collides, anim: d.anim }));
  const GRID = buildGrid();
  const tmj = asciiToTmj(GRID, {
    tile: TILE, orientation: 'orthogonal', tilesetName: TILESET_NAME,
    tiles: TILES, floor: 'floor',
    legend: {
      '#': { tile: 'wall' },
      '.': { tile: 'floor' },
      '~': { tile: 'lava' },
      '@': { object: 'player' },
      'X': { object: 'goal' }
    }
  });
  // 실제 PNG 파일명으로 image 갱신(임포트 정직성).
  tmj.tilesets[0].image = 'tileset.png';
  tmj.tilesets[0].imagewidth = width;
  tmj.tilesets[0].imageheight = height;
  await writeFile(path.join(outDir, 'level.tmj'), JSON.stringify(tmj, null, 2), 'utf8');

  // pack.json — 라이선스 매니페스트(게이트 입력)
  const manifest = {
    name: 'forge-gpu-pack',
    license: 'CC0-1.0',
    attribution: 'WebGameForge 절차 생성 (CC0)',
    source: 'WebGameForge bake-tiled-pack.mjs (절차 생성, 제3자 에셋 0)',
    tileset: 'tileset.png',
    map: 'level.tmj',
    tilesetName: TILESET_NAME,
    tileSize: TILE,
    usedIn: 'games/tiled-pack',
    note: '외부 CC0 Tiled 팩 임포트 경로 실증용. assets.json policy 게이트(verify-tiled-pack.mjs) 통과 대상.'
  };
  await writeFile(path.join(outDir, 'pack.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const animN = (tmj.tilesets[0].tiles || []).filter(t => t.animation).length;
  console.log(`✓ ${outDir}`);
  console.log(`  tileset.png — ${width}x${height} (${cellBufs.length}칸), ${png.length} bytes`);
  console.log(`  level.tmj — ${tmj.width}x${tmj.height}, 애니타일 ${animN}종`);
  console.log(`  pack.json — ${manifest.name} (${manifest.license})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
