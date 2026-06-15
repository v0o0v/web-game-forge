#!/usr/bin/env node
/*
 * sprite-picker 팩 분석기 — fetch-pack.mjs 가 받은 raw/ 이미지를 분석해 library.json 을 채운다(무의존성).
 *
 * 왜: 다운로드한 원본은 스프라이트시트·아틀라스·타일맵이 섞여 있다. 피커가 프레임 단위로 쓰려면
 *     각 시트의 frameConfig(균일 그리드) 또는 frames[](비균일/아틀라스/알파 검출)를 알아야 한다.
 *     이 스크립트가 시트마다 library.json 항목 1개를 만들고(analysisVersion 2) 썸네일을 생성한다.
 *
 * 분석 우선순위(계약 §4-2):
 *   1) atlas — 같은 이름 .xml(TexturePacker <SubTexture .../>) 또는 .json(Phaser frames) → frames[].
 *   2) grid  — packs.json 의 tileSize 또는 파일명 힌트(_18x18, tiles)로 균일 frameConfig.
 *              완전 투명한 그리드 칸은 excludedFrames 후보로 표시.
 *   3) alpha — 메타 없으면 내장 PNG 디코더로 알파 채널을 읽어 연결요소(BFS) bounding-box 자동검출 → frames[].
 *   (PNG 외 포맷은 단일 이미지로 처리, method:"single".)
 *
 * 산출: <lib>/<packId>/<slug>.png 복사 + <slug>.thumb.png(128px nearest 축소) + library.json upsert
 *       + <lib>/<packId>/analysis.json + .sprite-picker-downloads.json 의 packId status:"done".
 *
 * 실행:
 *   node skills/wgf-sprite-picker/catalog/analyze-pack.mjs --pack <packId> [--lib <dir=assets-library>]
 *
 * stdout 마지막 줄 JSON: { "ok":true, "packId":..., "items":[<id>...], "methods":{...} } / { "ok":false, "error":... }
 *
 * 무의존성: Node 빌트인(fs/path/url/zlib)만. PNG 디코더는 아래 decodePng() 단독 함수.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
// 애니 도출은 editor 와 공유하는 공통모듈(engine/derive-anims.mjs, zero-dep ESM)을 상향 import.
// catalog 가 emit 시 시트별 anims 를 채워 analysis.json/library.json 에 영속시킨다(P1-0 배선).
// (engine/ 는 코어 영역이라 두 소비자가 상향 import 가능 — 공통모듈은 node: 빌트인조차 없는 순수
//  함수라 스킬 디렉터리 zero-dep/독립성 제약을 위반하지 않는다.)
import { deriveAnims } from '../../../engine/derive-anims.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));        // catalog/
const PACKS = path.join(DIR, 'packs.json');
const DOWNLOAD_QUEUE = path.resolve(process.cwd(), '.sprite-picker-downloads.json');

const argv = process.argv.slice(2);
function flagVal(name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; }
const opt = {
  pack: flagVal('--pack'),
  lib: flagVal('--lib') || 'assets-library',
  // off-catalog(packs.json 에 없는 수동 팩) 메타데이터 — itch 등 수동 핸드오프용.
  name: flagVal('--name'),
  license: flagVal('--license'),
  source: flagVal('--source'),
  tier: flagVal('--tier'),
  style: flagVal('--style'),
  tags: flagVal('--tags'),
  help: argv.includes('--help') || argv.includes('-h')
};

// 라이선스 문자열에서 보수적으로 safetyTier 추론(off-catalog 기본값 — 불명이면 mixed-per-item).
function tierFromLicense(lic) {
  const l = String(lic || '').toLowerCase();
  if (/cc0|public[\s-]?domain|unlicense|\bpd\b/.test(l)) return 'cc0';
  if (/cc[\s-]?by|ofl|\bmit\b|apache|bsd|zlib/.test(l)) return 'permissive-attribution';
  return 'mixed-per-item';
}

function done(obj, code) {
  console.log(JSON.stringify(obj));
  process.exit(code == null ? (obj.ok ? 0 : 1) : code);
}

if (opt.help) {
  console.log('사용법: node analyze-pack.mjs --pack <packId> [--lib <dir=assets-library>]');
  console.log('  <lib>/<packId>/raw/ 의 이미지를 atlas→grid→alpha 우선순위로 분석해 library.json 을 갱신한다.');
  console.log('  [off-catalog 수동 팩] packs.json 에 없는 packId 면 라이선스 가정 금지 — --license 필수:');
  console.log('    node analyze-pack.mjs --pack <slug> --license <CC0-1.0|CC-BY-4.0|...> [--name "표시명"] [--source itch] [--tier <safetyTier>] [--style pixel] [--tags "a,b"]');
  process.exit(0);
}
if (!opt.pack) { done({ ok: false, error: '--pack <packId> 가 필요합니다.' }, 1); }

const TODAY = new Date().toISOString().slice(0, 10);

// ════════════════════════════════════════════════════════════════════════════
//  무의존성 PNG 디코더
//
//  지원: 색상타입 0(grayscale) / 2(RGB) / 3(palette) / 4(grayscale+alpha) / 6(RGBA),
//        비트뎁스 8(주). 1/2/4비트 팔레트는 8비트로 확장 처리. 16비트는 상위바이트만 사용.
//  필터: 0~4(None/Sub/Up/Average/Paeth) 스캔라인 언필터 구현.
//  한계: **인터레이스(Adam7) 미지원**(IHDR interlace!=0 이면 null 반환), 16비트 정밀도 손실(상위 8비트),
//        tRNS 청크 일부만(팔레트 알파) 반영, APNG 미지원(첫 프레임만).
//  반환: { width, height, data: Uint8ClampedArray RGBA(w*h*4) } 또는 null(디코드 불가).
// ════════════════════════════════════════════════════════════════════════════
function decodePng(buf) {
  // PNG 시그니처 확인.
  const SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) return null;

  let p = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette = null;          // [r,g,b,...]
  let transPalette = null;     // palette 알파(tRNS)
  const idatChunks = [];

  function u32(o) { return (buf[o] * 0x1000000) + ((buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]); }

  while (p + 8 <= buf.length) {
    const len = u32(p);
    const type = buf.slice(p + 4, p + 8).toString('ascii');
    const dataStart = p + 8;
    const dataEnd = dataStart + len;
    if (dataEnd > buf.length) break;
    if (type === 'IHDR') {
      width = u32(dataStart);
      height = u32(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
      interlace = buf[dataStart + 12];
    } else if (type === 'PLTE') {
      palette = buf.slice(dataStart, dataEnd);
    } else if (type === 'tRNS') {
      if (colorType === 3) transPalette = buf.slice(dataStart, dataEnd);
      // 색상타입 0/2 의 단일 투명색 tRNS 는 단순화를 위해 미반영(에셋 시트엔 드묾).
    } else if (type === 'IDAT') {
      idatChunks.push(buf.slice(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    p = dataEnd + 4;   // +4 CRC
  }

  if (!width || !height) return null;
  if (interlace !== 0) return null;   // Adam7 미지원

  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idatChunks)); }
  catch (e) { return null; }

  // 채널 수.
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
  if (!channels) return null;
  const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8));   // 바이트 단위 픽셀 폭(언필터 기준)
  const rowBytes = Math.ceil((channels * bitDepth * width) / 8);

  // 스캔라인 언필터(필터바이트 1개 + rowBytes).
  const unfiltered = Buffer.alloc(height * rowBytes);
  let sp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[sp++];
    const cur = unfiltered.subarray(y * rowBytes, (y + 1) * rowBytes);
    const prev = y > 0 ? unfiltered.subarray((y - 1) * rowBytes, y * rowBytes) : null;
    for (let x = 0; x < rowBytes; x++) {
      const rawByte = raw[sp++];
      const a = x >= bpp ? cur[x - bpp] : 0;            // left
      const b = prev ? prev[x] : 0;                     // up
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0; // up-left
      let val;
      switch (filter) {
        case 0: val = rawByte; break;                                   // None
        case 1: val = rawByte + a; break;                               // Sub
        case 2: val = rawByte + b; break;                               // Up
        case 3: val = rawByte + ((a + b) >> 1); break;                  // Average
        case 4: {                                                        // Paeth
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          val = rawByte + pr; break;
        }
        default: val = rawByte;
      }
      cur[x] = val & 0xff;
    }
  }

  // RGBA 로 펼치기. bitDepth(8/16/<8)·colorType(0/2/3/4/6) 조합별로 직접 샘플링.
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const rowOff = y * rowBytes;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (bitDepth === 8) {
        if (colorType === 6) {          // RGBA
          const bb = rowOff + x * 4;
          out[o] = unfiltered[bb]; out[o + 1] = unfiltered[bb + 1]; out[o + 2] = unfiltered[bb + 2]; out[o + 3] = unfiltered[bb + 3];
        } else if (colorType === 2) {   // RGB
          const bb = rowOff + x * 3;
          out[o] = unfiltered[bb]; out[o + 1] = unfiltered[bb + 1]; out[o + 2] = unfiltered[bb + 2]; out[o + 3] = 255;
        } else if (colorType === 0) {   // grayscale
          const g = unfiltered[rowOff + x]; out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255;
        } else if (colorType === 4) {   // grayscale + alpha
          const bb = rowOff + x * 2; const g = unfiltered[bb]; out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = unfiltered[bb + 1];
        } else if (colorType === 3) {   // palette
          const pi = unfiltered[rowOff + x];
          if (palette) { out[o] = palette[pi * 3]; out[o + 1] = palette[pi * 3 + 1]; out[o + 2] = palette[pi * 3 + 2]; }
          out[o + 3] = (transPalette && pi < transPalette.length) ? transPalette[pi] : 255;
        }
      } else if (bitDepth === 16) {
        if (colorType === 6) { const bb = rowOff + x * 8; out[o] = unfiltered[bb]; out[o + 1] = unfiltered[bb + 2]; out[o + 2] = unfiltered[bb + 4]; out[o + 3] = unfiltered[bb + 6]; }
        else if (colorType === 2) { const bb = rowOff + x * 6; out[o] = unfiltered[bb]; out[o + 1] = unfiltered[bb + 2]; out[o + 2] = unfiltered[bb + 4]; out[o + 3] = 255; }
        else if (colorType === 0) { const g = unfiltered[rowOff + x * 2]; out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255; }
        else if (colorType === 4) { const bb = rowOff + x * 4; const g = unfiltered[bb]; out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = unfiltered[bb + 2]; }
      } else if (bitDepth < 8 && colorType === 3) {
        // 1/2/4비트 팔레트: 비트 추출.
        const perByte = 8 / bitDepth;
        const byteIdx = rowOff + Math.floor(x / perByte);
        const shift = (perByte - 1 - (x % perByte)) * bitDepth;
        const mask = (1 << bitDepth) - 1;
        const pi = (unfiltered[byteIdx] >> shift) & mask;
        if (palette) { out[o] = palette[pi * 3]; out[o + 1] = palette[pi * 3 + 1]; out[o + 2] = palette[pi * 3 + 2]; }
        out[o + 3] = (transPalette && pi < transPalette.length) ? transPalette[pi] : 255;
      } else if (bitDepth < 8 && colorType === 0) {
        const perByte = 8 / bitDepth;
        const byteIdx = rowOff + Math.floor(x / perByte);
        const shift = (perByte - 1 - (x % perByte)) * bitDepth;
        const mask = (1 << bitDepth) - 1;
        const raw5 = (unfiltered[byteIdx] >> shift) & mask;
        const g = Math.round(raw5 * 255 / mask); out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255;
      }
    }
  }
  return { width, height, data: out };
}

// ════════════════════════════════════════════════════════════════════════════
//  무의존성 PNG 인코더(썸네일 저장용) — RGBA8, 단일 IDAT, 필터 0(None).
//  canvas 가 없으므로 직접 디플레이트한다(zlib.deflateSync). 픽셀아트 보존을 위해 압축만, 손실 없음.
// ════════════════════════════════════════════════════════════════════════════
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8bit RGBA, no interlace
  // 필터바이트 0 + 행데이터.
  const stride = width * 4;
  const rawImg = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rawImg[y * (stride + 1)] = 0;
    rgba.copy ? rgba.copy(rawImg, y * (stride + 1) + 1, y * stride, y * stride + stride)
      : Buffer.from(rgba.buffer || rgba).copy(rawImg, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(rawImg);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// nearest-neighbor 축소(픽셀아트 보존). 긴 변을 maxPx 로 내접.
function thumbnail(img, maxPx) {
  const { width, height, data } = img;
  if (width <= maxPx && height <= maxPx) return { width, height, data };  // 작으면 그대로
  const scale = maxPx / Math.max(width, height);
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      const so = (sy * width + sx) * 4, do2 = (y * tw + x) * 4;
      out[do2] = data[so]; out[do2 + 1] = data[so + 1]; out[do2 + 2] = data[so + 2]; out[do2 + 3] = data[so + 3];
    }
  }
  return { width: tw, height: th, data: out };
}

// ── 알파 기반 연결요소 bounding-box 검출(BFS flood) ───────────────────────────
// 불투명 픽셀(alpha > THRESH)들의 4-연결 컴포넌트마다 bbox 를 만든다. 너무 작은 노이즈는 제외.
function detectFramesByAlpha(img) {
  const { width, height, data } = img;
  const THRESH = 16;          // 알파 임계
  const MIN_AREA = 9;         // 3x3 미만 노이즈 제외
  const visited = new Uint8Array(width * height);
  const boxes = [];
  const stack = new Int32Array(width * height);   // BFS/DFS 인덱스 스택(재사용)
  function opaque(i) { return data[i * 4 + 3] > THRESH; }

  for (let start = 0; start < width * height; start++) {
    if (visited[start] || !opaque(start)) continue;
    let sp = 0; stack[sp++] = start; visited[start] = 1;
    let minX = width, minY = height, maxX = 0, maxY = 0, count = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width, y = (idx / width) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      count++;
      // 4-이웃.
      if (x > 0) { const n = idx - 1; if (!visited[n] && opaque(n)) { visited[n] = 1; stack[sp++] = n; } }
      if (x < width - 1) { const n = idx + 1; if (!visited[n] && opaque(n)) { visited[n] = 1; stack[sp++] = n; } }
      if (y > 0) { const n = idx - width; if (!visited[n] && opaque(n)) { visited[n] = 1; stack[sp++] = n; } }
      if (y < height - 1) { const n = idx + width; if (!visited[n] && opaque(n)) { visited[n] = 1; stack[sp++] = n; } }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    if (w * h >= MIN_AREA && count >= MIN_AREA) boxes.push({ x: minX, y: minY, w, h });
  }
  // 정렬: 위→아래, 왼→오(읽는 순서). 인접 박스 병합은 단순화를 위해 하지 않음.
  boxes.sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
  return boxes.map(function (b, i) { return { name: 'frame_' + i, x: b.x, y: b.y, w: b.w, h: b.h }; });
}

// ── Kenney Tilesheet 스펙 파서 ────────────────────────────────────────────────
// Kenney 팩은 "Tilesheet (Backgrounds).txt" 같은 스펙 파일을 동봉한다:
//   "Tile size • 24px × 24px" / "Space between tiles • 1px × 1px".
// 한 팩에 시트별로 타일 크기가 다를 수 있어(예: tiles 18px·characters 24px) packs.json 의
// 단일 tileSize 로는 정확히 못 자른다. 이 스펙을 읽어 시트별 정답 (tw,th,spacing) 을 얻는다.
// 반환: [{ category:'backgrounds', tw:24, th:24, spacing:1 }, ...] (없으면 []).
function parseKenneyTilesheets(rawDir) {
  const specs = [];
  let files;
  try { files = listFilesRec(rawDir); } catch (e) { return specs; }
  for (const f of files) {
    if (!/tilesheet[^/\\]*\.txt$/i.test(f)) continue;
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const sz = /tile\s*size[^\d]*(\d+)\s*px\s*[×xX]\s*(\d+)\s*px/i.exec(txt);
    if (!sz) continue;
    const tw = parseInt(sz[1], 10), th = parseInt(sz[2], 10);
    if (!(tw > 0) || !(th > 0)) continue;
    const sp = /space\s*between\s*tiles[^\d]*(\d+)\s*px/i.exec(txt);
    const spacing = sp ? parseInt(sp[1], 10) : 0;
    // 카테고리: 파일명 괄호 안(예: "Tilesheet (Backgrounds).txt" → backgrounds), 없으면 베이스명.
    const base = path.basename(f);
    const paren = /\(([^)]+)\)/.exec(base);
    const category = (paren ? paren[1] : base.replace(/\.txt$/i, '').replace(/tilesheet/i, '')).trim().toLowerCase();
    specs.push({ category, tw, th, spacing });
  }
  return specs;
}

// 시트 파일명에 가장 구체적으로 일치하는 Kenney 스펙을 고른다.
// 'tile(s)' 는 메인 타일맵용 일반 키워드라 가장 약하게(점수 1) 취급 — 그래야
// "tilemap-backgrounds" 가 'tile'(약) 대신 'background'(강) 로 정확히 매칭된다.
function matchKenneySpec(specs, fileBase) {
  const f = String(fileBase).toLowerCase();
  let best = null, bestScore = 0;
  for (const s of specs) {
    const cat = s.category;
    const kws = new Set([cat, cat.replace(/s$/, '')]);   // 단/복수 모두 시도
    let score = 0;
    for (const kw of kws) {
      if (kw.length < 4 || !f.includes(kw)) continue;
      const isGeneric = (kw === 'tile' || kw === 'tiles');
      score = Math.max(score, isGeneric ? 1 : kw.length);
    }
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

// tw×th 가 정해졌을 때, 여백 후보 중 양변이 정확히 나눠떨어지는 것을 골라 frameConfig 산출.
// (패킹된 시트는 spacing 0, 원본은 보통 1 — 동일 타일 크기로 두 변종을 한 번에 처리.)
function fitGrid(img, tw, th, spacingCandidates) {
  if (!(tw > 0) || !(th > 0)) return null;
  const seen = new Set();
  for (let sp of spacingCandidates) {
    if (sp == null || sp < 0) continue;
    sp = sp | 0;
    if (seen.has(sp)) continue; seen.add(sp);
    const stepX = tw + sp, stepY = th + sp;
    if (stepX <= 0 || stepY <= 0) continue;
    if ((img.width + sp) % stepX !== 0 || (img.height + sp) % stepY !== 0) continue;
    const cols = (img.width + sp) / stepX, rows = (img.height + sp) / stepY;
    if (cols >= 1 && rows >= 1) return { frameWidth: tw, frameHeight: th, margin: 0, spacing: sp, cols, rows };
  }
  return null;
}

// ── 그리드 분석: 파일명 힌트 → Kenney 스펙 → packs.json tileSize 순으로 균일 frameConfig ─
// 각 후보마다 여백 0/1(스펙은 명시 여백 우선)을 시도해 정확히 나눠떨어질 때만 채택.
// 빈(완전 투명) 칸은 excludedFrames 후보로(여백·간격 반영한 셀 원점 기준).
function detectGrid(img, pack, fileName, kenneySpecs) {
  let chosen = null;   // { frameWidth, frameHeight, margin, spacing, cols, rows }
  // 1) 파일명 힌트 _WxH (예: tiles_18x18.png) — 여백 0/1 시도.
  const m = /(\d+)\s*[xX]\s*(\d+)/.exec(fileName);
  if (m) chosen = fitGrid(img, parseInt(m[1], 10), parseInt(m[2], 10), [0, 1]);
  // 2) Kenney Tilesheet 스펙(시트별 정답 타일 크기) — 혼합 크기 팩 대응. 명시 여백 우선.
  if (!chosen && kenneySpecs && kenneySpecs.length) {
    const spec = matchKenneySpec(kenneySpecs, fileName);
    if (spec) chosen = fitGrid(img, spec.tw, spec.th, [spec.spacing, 0, 1]);
  }
  // 3) packs.json tileSize — 여백 0/1 시도.
  if (!chosen && pack.tileSize) chosen = fitGrid(img, pack.tileSize | 0, pack.tileSize | 0, [0, 1]);
  if (!chosen) return null;   // 어떤 후보도 정확히 안 나눠지면 호출부가 alpha 로 폴백.

  const { frameWidth: tw, frameHeight: th, margin, spacing, cols, rows } = chosen;
  const stepX = tw + spacing, stepY = th + spacing;
  const excluded = [];
  const { data, width } = img;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let anyOpaque = false;
      for (let y = 0; y < th && !anyOpaque; y++) {
        for (let x = 0; x < tw; x++) {
          const px = margin + c * stepX + x, py = margin + r * stepY + y;
          if (data[(py * width + px) * 4 + 3] > 8) { anyOpaque = true; break; }
        }
      }
      if (!anyOpaque) excluded.push(r * cols + c);
    }
  }
  return {
    frameConfig: { frameWidth: tw, frameHeight: th, margin, spacing },
    excludedFrames: excluded,
    cols, rows
  };
}

// ── atlas 분석: 같은 베이스명 .xml(TexturePacker) 또는 .json(Phaser) ──────────
function parseAtlasXml(text) {
  // <SubTexture name="x" x="0" y="0" width="10" height="10"/>
  const frames = [];
  const re = /<SubTexture\b([^>]*)\/?>/gi;
  let m;
  function attr(s, k) { const a = new RegExp(k + '\\s*=\\s*"([^"]*)"', 'i').exec(s); return a ? a[1] : null; }
  while ((m = re.exec(text)) !== null) {
    const a = m[1];
    const name = attr(a, 'name'), x = attr(a, 'x'), y = attr(a, 'y'), w = attr(a, 'width'), h = attr(a, 'height');
    if (x != null && y != null && w != null && h != null) {
      frames.push({ name: name || ('frame_' + frames.length), x: +x, y: +y, w: +w, h: +h });
    }
  }
  return frames.length ? frames : null;
}
function parseAtlasJson(text) {
  let doc; try { doc = JSON.parse(text); } catch (e) { return null; }
  const frames = [];
  const f = doc.frames || doc.textures && doc.textures[0] && doc.textures[0].frames;
  if (!f) return null;
  if (Array.isArray(f)) {
    // Phaser array: [{ filename, frame:{x,y,w,h} }]
    f.forEach(function (it, i) {
      const fr = it.frame || it; if (fr && fr.w != null) frames.push({ name: it.filename || ('frame_' + i), x: fr.x, y: fr.y, w: fr.w, h: fr.h });
    });
  } else {
    // Phaser hash: { "name": { frame:{x,y,w,h} } }
    Object.keys(f).forEach(function (name) {
      const fr = f[name].frame || f[name]; if (fr && fr.w != null) frames.push({ name: name, x: fr.x, y: fr.y, w: fr.w, h: fr.h });
    });
  }
  return frames.length ? frames : null;
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function slugify(s) { return String(s).toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sheet'; }
function listFilesRec(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full); else out.push(full);
    }
  })(dir);
  return out;
}
function isImageFile(f) { return /\.(png|jpe?g|gif)$/i.test(f); }

// ── 항목화 게이트(team-fix): 개별 타일/프로모 폭발 차단 ────────────────────────
// 프로모·배너·미리보기·스토어아이콘 등 "팩 자산이 아닌" 파일명을 배제(대소문자 무시).
// (비이미지 .url/.txt/.tmx/.tsx/.c3p 는 isImageFile 에서 이미 걸러지지만 방어적으로 명시.)
function isPromoOrJunk(filePath) {
  const lower = filePath.replace(/\\/g, '/').toLowerCase();
  if (/(^|\/)(preview|sample\w*|banner|cover|logo|screenshot|thumb|icon[-_]?store)\b/.test(lower)) return true;
  if (/\.(url|txt|tmx|tsx|c3p)$/i.test(lower)) return true;
  return false;
}
// 합성 시트 판정: tile unit 기준으로 한 칸 크기(개별 원자)·초소형은 항목화 금지.
// 4칸 이상 담고 양변이 unit 의 2배 이상일 때만 "여러 스프라이트가 섞인 시트"로 본다.
function isCompositeSheet(width, height, unit) {
  if (!unit || unit <= 0) unit = 16;                       // 추론 실패 시 기본 16
  if (Math.min(width, height) < 2 * unit) return false;    // 한 변이라도 1~1.x 칸이면 단일 원자
  const cols = Math.floor(width / unit), rows = Math.floor(height / unit);
  return (cols * rows) >= 4;                                // 4칸 이상 담는 합성 시트
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
(async function main() {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(PACKS, 'utf8')); }
  catch (e) { done({ ok: false, error: 'packs.json 읽기 실패: ' + e.message }, 1); }
  const foundPack = (doc.packs || []).find(function (p) { return p.id === opt.pack; });
  let pack;
  if (foundPack) {
    pack = foundPack;                 // 카탈로그 팩 — 메타데이터는 packs.json 에서.
  } else {
    // off-catalog(수동 팩): IP 안전상 CC0 가정 금지 — 라이선스는 사용자가 명시해야 한다.
    if (!opt.license) {
      done({ ok: false, error: 'off-catalog 팩(packs.json 에 없음: ' + opt.pack + ')은 --license <id> 가 필수입니다. CC0 로 가정하지 않습니다. 예: --license CC0-1.0 (또는 CC-BY-4.0 등)', packId: opt.pack }, 1);
    }
    pack = {
      id: opt.pack,
      name: opt.name || opt.pack,
      sourceId: opt.source || 'local',
      license: opt.license,
      safetyTier: opt.tier || tierFromLicense(opt.license),
      style: opt.style || 'pixel',
      contentTypes: [],
      tags: opt.tags ? opt.tags.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : []
    };
  }

  const libDir = path.resolve(process.cwd(), opt.lib);
  const packDir = path.join(libDir, opt.pack);
  const rawDir = path.join(packDir, 'raw');
  if (!fs.existsSync(rawDir)) {
    done({ ok: false, error: 'raw/ 없음 — 먼저 fetch-pack.mjs 실행 필요: ' + rawDir, packId: opt.pack }, 1);
  }

  const allRaw = listFilesRec(rawDir);
  // 프로모/정크 파일명 배제 후 이미지만(team-fix §2).
  const images = allRaw.filter(function (f) { return isImageFile(f) && !isPromoOrJunk(f); });
  if (!images.length) { done({ ok: false, error: 'raw/ 에 (프로모 제외) 이미지 없음', packId: opt.pack }, 1); }

  // tile unit: packs.json tileSize 우선, 없으면 파일명 _WxH 힌트(전역 추론), 최후 기본 16.
  function unitFor(fileName) {
    if (pack.tileSize) return pack.tileSize;
    const m = /(\d+)\s*[xX]\s*(\d+)/.exec(fileName);
    if (m) return Math.min(parseInt(m[1], 10), parseInt(m[2], 10)) || 16;
    return 16;
  }

  // Kenney 동봉 Tilesheet 스펙(시트별 정답 타일 크기) — 혼합 크기 팩에서 그리드 정확도 확보.
  const kenneySpecs = parseKenneyTilesheets(rawDir);

  const sheets = [];          // analysis.json 의 sheets (= EMIT 된 항목)
  const itemIds = [];
  const methods = {};
  const usedSlugs = new Set();
  const skippedAtoms = [];    // EMIT 안 된 개별 원자(폴백 후보)
  const emittedFiles = new Set(); // 이번 실행이 packDir 에 실제로 쓴 산출 파일명(stale 정리 keep-set)
  let promoSkipped = allRaw.filter(function (f) { return isImageFile(f) && isPromoOrJunk(f); }).length;

  // 한 이미지를 분석해 sheet/item 으로 EMIT 한다. emitForce=true 면 게이트 무시(폴백용 단일 항목).
  function emitImage(imgPath, emitForce) {
    const fileName = path.basename(imgPath);
    const isPng = /\.png$/i.test(imgPath);
    const raw = fs.readFileSync(imgPath);

    // 1) atlas: 같은 베이스명 .xml/.json 동봉?
    const base = imgPath.replace(/\.[^.]+$/, '');
    let atlasFrames = null, atlasFile = null;
    for (const ext of ['.xml', '.json']) {
      const cand = base + ext;
      if (fs.existsSync(cand)) {
        const txt = fs.readFileSync(cand, 'utf8');
        atlasFrames = ext === '.xml' ? parseAtlasXml(txt) : parseAtlasJson(txt);
        if (atlasFrames) { atlasFile = cand; break; }
      }
    }

    let decoded = null;
    if (isPng) decoded = decodePng(raw);   // grid/alpha 분석 + 합성시트 판정엔 디코드 필요

    // ── EMIT 게이트(team-fix §1) ──
    // (a) 짝 atlas 있으면 무조건 시트. (b) 없으면 unit 기준 합성 시트일 때만.
    // emitForce(폴백) 면 게이트 통과.
    if (!emitForce && !atlasFrames) {
      const unit = unitFor(fileName);
      const w = decoded ? decoded.width : 0, h = decoded ? decoded.height : 0;
      // 디코드 불가(jpg/gif) 이미지는 크기를 모르므로 합성 판정 불가 → 비-EMIT(개별 원자로 간주).
      if (!decoded || !isCompositeSheet(w, h, unit)) {
        skippedAtoms.push(imgPath);
        return false;
      }
    }

    // 시트 슬러그(중복 방지).
    let slug = slugify(fileName);
    let n = 1; while (usedSlugs.has(slug)) { slug = slugify(fileName) + '-' + (++n); }
    usedSlugs.add(slug);
    const sheetId = opt.pack + '__' + slug;

    let method = 'single', frameConfig = null, frames = null, excludedFrames = null;

    if (atlasFrames) {
      method = 'atlas'; frames = atlasFrames;
    } else if (decoded) {
      // 2) grid
      const grid = detectGrid(decoded, pack, fileName, kenneySpecs);
      if (grid) {
        method = 'grid'; frameConfig = grid.frameConfig;
        if (grid.excluded && grid.excluded.length) excludedFrames = grid.excluded;
        if (grid.excludedFrames && grid.excludedFrames.length) excludedFrames = grid.excludedFrames;
      } else {
        // 3) alpha
        const af = detectFramesByAlpha(decoded);
        if (af.length > 1) { method = 'alpha'; frames = af; }
        else { method = 'single'; }   // 단일 객체면 그냥 단일 이미지
      }
    } else {
      // PNG 아님(jpg/gif) → 디코드 불가 → 단일 이미지(폴백 경로에서만 도달).
      method = 'single';
    }

    // ── 동작별 애니 도출(P1-0 배선) ──
    // editor 와 공유하는 공통모듈(deriveAnims)에 emit 시점 스코프의 frameConfig/frames + 디코드된
    // 이미지 w/h 를 {frameConfig, frames, w, h} 로 묶어 전달한다(/api/sprite/analyze 와 동일 입력 계약).
    //  - grid: frameConfig + w/h → 행 단위 의미 클립.  - atlas/alpha: frames[] prefix 그룹핑.
    //  - single(메타 없음): 그리드도 frames 도 없어 빈 배열([]) — 기존 동작과 동일하나 키 일관 유지.
    const anims = deriveAnims({
      frameConfig: frameConfig,
      frames: frames,
      w: decoded ? decoded.width : undefined,
      h: decoded ? decoded.height : undefined
    }).anims;

    // 시트 복사: <packDir>/<slug>.<ext>. atlas/grid/alpha 모두 원본 그대로 둔다.
    // (이 시점은 EMIT 게이트를 이미 통과 — 비-EMIT 원자/프로모는 여기 도달하지 않아 복사되지 않는다.)
    const outExt = path.extname(fileName).toLowerCase() || '.png';
    const sheetFile = slug + outExt;
    fs.writeFileSync(path.join(packDir, sheetFile), raw); emittedFiles.add(sheetFile);
    // atlas 동봉 파일도 보존.
    if (atlasFile) {
      const atlasOut = slug + '.atlas' + path.extname(atlasFile).toLowerCase();
      fs.writeFileSync(path.join(packDir, atlasOut), fs.readFileSync(atlasFile)); emittedFiles.add(atlasOut);
    }

    // 썸네일: PNG 디코드 가능하면 128px nearest 축소 PNG, 아니면 원본 복사(작은 경우) 또는 생략.
    let thumbFile = '';
    if (decoded) {
      const t = thumbnail(decoded, 128);
      const png = encodePng(t.width, t.height, Buffer.from(t.data.buffer, t.data.byteOffset, t.data.byteLength));
      thumbFile = slug + '.thumb.png';
      fs.writeFileSync(path.join(packDir, thumbFile), png); emittedFiles.add(thumbFile);
    } else {
      // jpg/gif: 원본을 썸네일로 그대로(작으면 충분, 크면 피커가 CSS 로 축소).
      thumbFile = slug + outExt.replace(/\./, '.thumb.');
      fs.writeFileSync(path.join(packDir, thumbFile), raw); emittedFiles.add(thumbFile);
    }

    const relFull = path.posix.join(opt.lib.replace(/\\/g, '/'), opt.pack, sheetFile);
    const relThumb = path.posix.join(opt.lib.replace(/\\/g, '/'), opt.pack, thumbFile);

    sheets.push({
      id: sheetId, file: sheetFile, method: method,
      frameConfig: frameConfig, frames: frames, anims: anims,
      excludedFrames: excludedFrames || undefined
    });
    methods[sheetId] = method;
    itemIds.push(sheetId);

    // library.json 항목으로 보관할 데이터(아래 upsert).
    sheets[sheets.length - 1]._item = {
      id: sheetId,
      name: (pack.name || opt.pack) + ' — ' + slug,
      sourceId: pack.sourceId || 'local',
      sourcePackId: opt.pack,
      license: pack.license || 'CC0-1.0',
      safetyTier: pack.safetyTier || 'cc0',
      style: pack.style || '',
      contentTypes: pack.contentTypes || [],
      tags: pack.tags || [],
      files: [relFull],
      full: relFull,
      frameConfig: frameConfig,
      frames: frames,
      anims: anims,
      excludedFrames: excludedFrames || undefined,
      thumbnail: relThumb,
      usedIn: [],
      downloaded: true,
      analysisVersion: 2,
      addedAt: TODAY
    };
    return true;
  }

  // 1차: 게이트 통과한 합성 시트만 EMIT.
  for (const imgPath of images) emitImage(imgPath, false);

  // 폴백(team-fix §4): EMIT 0개면 개별 스프라이트만 있는 팩 → 개별 이미지를 단일 항목으로,
  // 단 최대 60개 cap. EMIT 가 1개 이상이면 개별 원자는 버린다.
  const FALLBACK_CAP = 60;
  let fallbackTruncated = 0;
  if (sheets.length === 0 && skippedAtoms.length) {
    const take = skippedAtoms.slice(0, FALLBACK_CAP);
    fallbackTruncated = skippedAtoms.length - take.length;
    for (const imgPath of take) emitImage(imgPath, true);
  }

  // ── stale 산출물 정리(team-fix 2) ──────────────────────────────────────────
  // 이번 EMIT 세트가 쓴 파일(emittedFiles) 외의 "이전 실행 잔여" 시트/썸네일/아틀라스를 packDir 최상위에서 제거.
  // raw/(원본)·하위 디렉터리·analysis.json 은 절대 건드리지 않는다. library.json 은 libDir 라 무관.
  // → 구버전이 비-EMIT 이미지까지 복사해 남긴 미참조 PNG 도 클린 재실행 시 여기서 청소된다.
  let prunedStale = 0;
  for (const e of fs.readdirSync(packDir, { withFileTypes: true })) {
    if (e.isDirectory()) continue;                 // raw/ 등 디렉터리 보존
    if (e.name === 'analysis.json') continue;       // 메타 보존
    if (emittedFiles.has(e.name)) continue;         // 이번 EMIT 산출물 보존
    // 생성 산출물로 인식되는 확장자만 제거(원본 외 파일 오삭제 방지).
    if (/\.(png|jpe?g|gif)$/i.test(e.name) || /\.atlas\.(xml|json)$/i.test(e.name)) {
      try { fs.unlinkSync(path.join(packDir, e.name)); prunedStale++; } catch (err) { /* 무시 */ }
    }
  }

  // ── library.json upsert ─────────────────────────────────────────────────────
  const libJsonPath = path.join(libDir, 'library.json');
  let lib = { schemaVersion: 1, items: [] };
  if (fs.existsSync(libJsonPath)) {
    try { lib = JSON.parse(fs.readFileSync(libJsonPath, 'utf8')); } catch (e) { /* 손상 시 새로 */ }
  }
  if (!Array.isArray(lib.items)) lib.items = [];
  // stale 정리(team-fix §3): 이 sourcePackId 의 기존 항목을 전부 제거한 뒤 이번 EMIT 세트만 재삽입
  // (재실행 시 누적/유령 항목 방지). 다른 팩 항목·sourcePackId 없는 레거시 항목은 보존.
  lib.items = lib.items.filter(function (it) { return it.sourcePackId !== opt.pack; });
  for (const s of sheets) {
    const item = s._item;
    // undefined 필드 정리(JSON 직렬화에서 빠지지만 일관성 위해 제거).
    Object.keys(item).forEach(function (k) { if (item[k] === undefined) delete item[k]; });
    lib.items.push(item);
  }
  fs.writeFileSync(libJsonPath, JSON.stringify(lib, null, 2) + '\n');

  // ── analysis.json 기록 ──────────────────────────────────────────────────────
  const analysis = {
    packId: opt.pack, analyzedAt: new Date().toISOString(),
    sheets: sheets.map(function (s) {
      const o = { id: s.id, file: s.file, method: s.method, frameConfig: s.frameConfig, frames: s.frames, anims: s.anims };
      if (s.excludedFrames) o.excludedFrames = s.excludedFrames;
      return o;
    })
  };
  fs.writeFileSync(path.join(packDir, 'analysis.json'), JSON.stringify(analysis, null, 2) + '\n');

  // ── 다운로드 큐 status:"done" 갱신(있으면) ──────────────────────────────────
  if (fs.existsSync(DOWNLOAD_QUEUE)) {
    try {
      const q = JSON.parse(fs.readFileSync(DOWNLOAD_QUEUE, 'utf8'));
      if (q && Array.isArray(q.requests)) {
        let changed = false;
        for (const r of q.requests) { if (r.packId === opt.pack && r.status !== 'done') { r.status = 'done'; changed = true; } }
        if (changed) fs.writeFileSync(DOWNLOAD_QUEUE, JSON.stringify(q, null, 2) + '\n');
      }
    } catch (e) { /* 큐 손상은 분석 실패로 보지 않음 */ }
  }

  console.log('분석 완료:', opt.pack, '— 항목', sheets.length, '개 EMIT' +
    (promoSkipped ? ' / 프로모·정크 스킵 ' + promoSkipped : '') +
    (skippedAtoms.length ? ' / 개별 원자 ' + skippedAtoms.length + '개 비-EMIT' : '') +
    (prunedStale ? ' / 미참조 잔여 ' + prunedStale + '개 정리' : ''));
  sheets.forEach(function (s) { console.log('  ·', s.id, '[' + s.method + ']' + (s.frames ? ' frames=' + s.frames.length : s.frameConfig ? ' grid=' + s.frameConfig.frameWidth + 'x' + s.frameConfig.frameHeight : '')); });
  const note = fallbackTruncated
    ? ('폴백: 개별 스프라이트 팩 — ' + FALLBACK_CAP + '개로 잘림(원본 ' + (FALLBACK_CAP + fallbackTruncated) + '개 중 ' + fallbackTruncated + '개 버림).')
    : (sheets.length === 0 ? '항목 없음(모두 프로모/원자로 스킵).' : undefined);
  if (note) console.log('NOTE:', note);
  const result = { ok: true, packId: opt.pack, items: itemIds, methods: methods, emitted: sheets.length, skippedAtoms: skippedAtoms.length, promoSkipped: promoSkipped, prunedStale: prunedStale };
  if (note) result.note = note;
  done(result, 0);
})().catch(function (e) { done({ ok: false, error: '치명적 오류: ' + (e && e.message || e) }, 1); });
