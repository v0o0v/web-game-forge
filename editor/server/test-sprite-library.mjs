#!/usr/bin/env node
/* ============================================================================
 * WGF Studio 통합 스프라이트 브라우저 — 백엔드 게이트 하니스 (zero-dep)
 * ----------------------------------------------------------------------------
 * 계약서(.omc/plans/sprite-browser-plan.md) §2·§7 의 Lane A 백엔드를 실제 실행 검증.
 * test-bridge.mjs 의 spawn+READY 파싱·request/api 헬퍼 방식을 그대로 차용한다.
 * 브리지를 WGF_BRIDGE_PORT=0 + WGF_BRIDGE_SCENE=games/wgf-sprite-demo/scene.json 으로
 * spawn 해(현재 게임 디렉터리가 있어야 /api/sprite/use 가 동작) 라운드트립을 검증한다.
 *
 * 게이트:
 *   S1 GET /api/sprite/catalog — packs/sources 병합 + preview 웹경로 + downloaded 판정.
 *   S2 GET /api/sprite/library — assets-library/** collection/sheet + 게임 시트 포함.
 *   S3 POST /api/sprite/slice — 사이드카 머지 저장 + 위생화 + library 재조회 반영.
 *   S4 POST /api/sprite/use   — vendoring + local 에셋 등록 + 동일 sha 재사용(reused).
 *   S5 경로 traversal 거부(slice·use 의 범위 밖 relPath → 4xx).
 *   S6 GET /api/scene ETag — If-None-Match 일치 시 304(본문 생략).
 *
 * 부수효과 정리: 테스트가 만든 assets-library/wgf-slices.json(신규) + use 가 vendoring 한
 *   games/wgf-sprite-demo/assets/imported/<신규> 파일을 종료 시 제거(리포 오염 0).
 *
 * 사용: node editor/server/test-sprite-library.mjs
 * 출력: 사람용 줄 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
 * 종료코드: 전부 통과 0, 하나라도 실패 1.
 * ==========================================================================*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deriveAnims } from './sprite-library.mjs';
// 공통모듈(P1-0 재배치) 직접 import — sprite-library re-export 와 동일 함수임을 검증(import 패리티).
import { deriveAnims as deriveAnimsCommon } from '../../engine/derive-anims.mjs';
// getSheetMeta 직접 호출(왕복 단언: catalog analysis.json anims → editor 리더 동일 반환).
import { getSheetMeta } from './sprite-library.mjs';
// scanLibrary 직접 호출(1B 단언: 사이드카 없는 다운로드 시트 anims 자동표면화 — analysis.json·deriveAnims fallback).
import { scanLibrary } from './sprite-library.mjs';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');
const BRIDGE = path.join(SERVER_DIR, 'bridge.mjs');

// 테스트 대상 씬(현재 게임 디렉터리가 있어야 use 동작) — 존재 확인.
const SCENE_REL = 'games/wgf-sprite-demo/scene.json';
// 검증에 쓰는 이미 존재하는 라이브러리 자산(임시 이미지 생성 금지 — 계약 §3 지시).
const LIB_TILE_REL = 'assets-library/kenney-tiny-dungeon/raw/Tiles/tile_0000.png';
const SLICES_REL = 'assets-library/wgf-slices.json';

// 정리 추적: 시작 시 wgf-slices.json 존재 여부 + imported 디렉터리 스냅샷.
const SLICES_ABS = path.resolve(REPO_ROOT, SLICES_REL);
const IMPORTED_DIR = path.resolve(REPO_ROOT, 'games', 'wgf-sprite-demo', 'assets', 'imported');
const slicesExistedBefore = fs.existsSync(SLICES_ABS);
let importedBefore = new Set();
try { importedBefore = new Set(fs.readdirSync(IMPORTED_DIR)); } catch (e) { /* 없을 수도 */ }

const checks = [];
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  const passed = !!cond;
  checks.push({ name, ok: passed, detail: detail || '' });
  if (passed) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 브리지 spawn + READY 파싱(test-bridge.mjs 동일 방식) ──────────────────────
function startBridge(extraEnv) {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, { WGF_BRIDGE_PORT: '0' }, extraEnv || {});
    const child = spawn(process.execPath, [BRIDGE], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    let buf = '';
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; child.kill(); reject(new Error('브리지 기동 타임아웃')); } }, 8000);
    child.stderr.on('data', (c) => {
      buf += c.toString('utf8');
      const m = buf.match(/\[wgf-bridge\] READY (\{.*\})/);
      if (m && !done) {
        done = true; clearTimeout(timer);
        let info;
        try { info = JSON.parse(m[1]); } catch (e) { reject(e); return; }
        resolve({ child, info });
      }
    });
    child.on('exit', (code) => { if (!done) { done = true; clearTimeout(timer); reject(new Error('브리지 조기 종료 code=' + code)); } });
  });
}

// ── HTTP 요청 헬퍼(test-bridge.mjs 동일) ──────────────────────────────────────
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

// 토큰·Origin 자동 부착 API 요청.
function api(info, method, p, bodyObj, extraHeaders) {
  const body = bodyObj != null ? JSON.stringify(bodyObj) : null;
  const headers = Object.assign({
    'X-WGF-Token': info.token,
    'Origin': `http://127.0.0.1:${info.port}`
  }, body != null ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}, extraHeaders || {});
  return request({ host: '127.0.0.1', port: info.port, path: p, method, headers }, body);
}

// ── 정리(부수효과 제거) ────────────────────────────────────────────────────────
function cleanup() {
  // 테스트가 새로 만든 wgf-slices.json 만 삭제(기존에 있었으면 보존).
  try {
    if (!slicesExistedBefore && fs.existsSync(SLICES_ABS)) fs.rmSync(SLICES_ABS, { force: true });
  } catch (e) {}
  // use 가 새로 vendoring 한 imported 파일만 삭제(기존 파일은 보존).
  try {
    const after = fs.readdirSync(IMPORTED_DIR);
    for (const f of after) {
      if (!importedBefore.has(f)) {
        try { fs.rmSync(path.join(IMPORTED_DIR, f), { force: true }); } catch (e) {}
      }
    }
  } catch (e) {}
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  // 전제: 데모 씬은 커밋돼 있어 항상 존재(없으면 환경 문제 — 명확히 실패).
  ok('전제: 데모 씬 존재', fs.existsSync(path.resolve(REPO_ROOT, SCENE_REL)), SCENE_REL);
  // 전제(ENV-2 견고화): 라이브러리 raw 타일(LIB_TILE_REL)은 .gitignore 제외(assets-library/*/raw/)라
  //  클린 클론/CI 에 부재할 수 있다. 부재 시 use/analyze 등 raw 의존 단언을 abort 없이 graceful skip
  //  하기 위해 존재 여부를 플래그로 잡는다(전제 단언 자체는 graceful-skip 패턴 — 부재해도 통과로 기록).
  const rawTilePresent = fs.existsSync(path.resolve(REPO_ROOT, LIB_TILE_REL));
  ok('전제: 라이브러리 raw 타일(부재 시 raw 의존 단언 graceful skip)', true, rawTilePresent ? LIB_TILE_REL : `부재 — raw 의존 블록 스킵: ${LIB_TILE_REL}`);
  // tiny-dungeon 팩 다운로드 디렉터리 존재(S1-5/S2-3 의 collection·downloaded 단언 전제).
  const tinyDungeonDownloaded = (() => {
    try { return fs.statSync(path.resolve(REPO_ROOT, 'assets-library', 'kenney-tiny-dungeon')).isDirectory(); }
    catch (e) { return false; }
  })();

  let bridge;
  try { bridge = await startBridge({ WGF_BRIDGE_SCENE: SCENE_REL }); }
  catch (e) { ok('브리지 기동', false, String(e)); finish(); return; }
  const { child, info } = bridge;
  ok('브리지 기동(READY 파싱)', info && info.port > 0 && typeof info.token === 'string' && info.token.length >= 16, `port=${info.port}`);

  try {
    // ── S1 catalog ─────────────────────────────────────────────────────────────
    {
      const r = await api(info, 'GET', '/api/sprite/catalog');
      const b = JSON.parse(r.body);
      ok('S1-1 catalog 200 + ok', r.status === 200 && b.ok === true, `status=${r.status}`);
      ok('S1-2 packs 배열(>0)', Array.isArray(b.packs) && b.packs.length > 0, `packs=${b.packs && b.packs.length}`);
      ok('S1-3 sources 배열(>0)', Array.isArray(b.sources) && b.sources.length > 0, `sources=${b.sources && b.sources.length}`);
      const tinyD = b.packs.find((p) => p.id === 'kenney-tiny-dungeon');
      ok('S1-4 preview 웹경로(/skills/.../thumbnails/)',
        tinyD && typeof tinyD.preview === 'string' && tinyD.preview.startsWith('/skills/wgf-sprite-picker/catalog/thumbnails/'),
        `preview=${tinyD && tinyD.preview}`);
      // downloaded 판정은 assets-library/kenney-tiny-dungeon/ 디렉터리 존재에 의존(.gitignore 로
      //  클린 클론에 부재 가능). 부재 시 graceful skip(부재해도 통과로 기록 — downloaded=false 가 정답).
      if (!tinyDungeonDownloaded) {
        ok('S1-5 downloaded 판정(tiny-dungeon 미다운로드 — graceful skip)', tinyD && tinyD.downloaded === false, `downloaded=${tinyD && tinyD.downloaded}`);
      } else {
        ok('S1-5 downloaded 판정(tiny-dungeon=true)', tinyD && tinyD.downloaded === true, `downloaded=${tinyD && tinyD.downloaded}`);
      }
      // 미다운로드 팩: assets-library/<id>/ 디렉터리가 없는 catalog 팩.
      // (kenney-pixel-platformer 는 이제 임포트돼 downloaded=true 이므로 디스크에 없는 다른 팩을 픽스처로 쓴다.)
      const notDl = b.packs.find((p) => p.id === 'kenney-roguelike-rpg-pack');
      ok('S1-6 downloaded 판정(미다운로드 팩=false)', notDl && notDl.downloaded === false, `id=${notDl && notDl.id} downloaded=${notDl && notDl.downloaded}`);
    }

    // ── S2 library ─────────────────────────────────────────────────────────────
    {
      const r = await api(info, 'GET', '/api/sprite/library');
      const b = JSON.parse(r.body);
      ok('S2-1 library 200 + ok', r.status === 200 && b.ok === true, `status=${r.status}`);
      ok('S2-2 items 배열(>0)', Array.isArray(b.items) && b.items.length > 0, `items=${b.items && b.items.length}`);
      // tile_* 132개 → 1 collection. raw/ 타일이 .gitignore 로 부재하면 collection 자체가 없으므로
      //  raw 타일 존재 시에만 강하게 단언하고, 부재 시 graceful skip(회귀가드 가치 보존).
      const coll = b.items.find((it) => it.kind === 'collection' && it.packId === 'kenney-tiny-dungeon');
      if (!rawTilePresent) {
        ok('S2-3 Tiles collection(raw 타일 부재 — graceful skip)', true, 'no raw tiles present');
        ok('S2-6 collection filesRel[](raw 타일 부재 — graceful skip)', true, 'no collection to check');
      } else {
        ok('S2-3 Tiles collection(count>=100)', coll && coll.count >= 100 && Array.isArray(coll.files), `count=${coll && coll.count}`);
        // collection 은 filesRel[](repo-상대, 선행 / 없음) 보유 + files 와 1:1 정렬(H-1).
        ok('S2-6 collection filesRel[](files 와 1:1, 선행 / 없음)',
          coll && Array.isArray(coll.filesRel) && coll.filesRel.length === coll.files.length &&
          coll.filesRel.length > 0 && coll.filesRel.every((r) => typeof r === 'string' && r.length > 0 && r[0] !== '/') &&
          coll.filesRel[0] === coll.files[0].replace(/^\//, ''),
          `filesRel0=${coll && coll.filesRel && coll.filesRel[0]}`);
      }
      // 현재 게임 시트(tiny-dungeon.png) 포함.
      const gameSheet = b.items.find((it) => it.kind === 'sheet' && typeof it.relPath === 'string' && it.relPath.includes('wgf-sprite-demo'));
      ok('S2-4 현재 게임 시트 포함', !!gameSheet, gameSheet ? gameSheet.relPath : 'none');
      // sheet 항목은 url(/) + relPath + anims 배열 보유.
      const anySheet = b.items.find((it) => it.kind === 'sheet');
      ok('S2-5 sheet 스키마(url·relPath·anims)',
        anySheet && typeof anySheet.url === 'string' && anySheet.url.startsWith('/') && typeof anySheet.relPath === 'string' && Array.isArray(anySheet.anims),
        `sample=${anySheet && anySheet.relPath}`);
    }

    // ── S3 slice 라운드트립 ──────────────────────────────────────────────────────
    {
      // 게임 시트(tiny-dungeon.png)에 슬라이스 메타 저장.
      const targetRel = 'games/wgf-sprite-demo/assets/imported/tiny-dungeon.png';
      const patch = {
        name: '테스트 슬라이스',
        frameConfig: { frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0 },
        anims: [{ key: 'walk', frames: [0, 1, 2, 3], fps: 8, loop: true }],
        excludedFrames: [7, 8]
      };
      const r = await api(info, 'POST', '/api/sprite/slice', { relPath: targetRel, patch });
      const b = JSON.parse(r.body);
      ok('S3-1 slice 저장 200 + ok', r.status === 200 && b.ok === true, `status=${r.status}`);
      ok('S3-2 저장 항목 반영(name·frameConfig)',
        b.item && b.item.name === '테스트 슬라이스' && b.item.frameConfig && b.item.frameConfig.frameWidth === 16,
        `item=${JSON.stringify(b.item && b.item.frameConfig)}`);
      ok('S3-3 anims 보존', b.item && Array.isArray(b.item.anims) && b.item.anims[0] && b.item.anims[0].key === 'walk',
        `anims=${JSON.stringify(b.item && b.item.anims)}`);

      // library 재조회 → 그 시트에 frameConfig/anims 가 병합돼 나와야 함.
      const lib = JSON.parse((await api(info, 'GET', '/api/sprite/library')).body);
      const sheet = lib.items.find((it) => it.relPath === targetRel);
      ok('S3-4 library 에 슬라이스 병합 반영',
        sheet && sheet.frameConfig && sheet.frameConfig.frameWidth === 16 && sheet.name === '테스트 슬라이스' && sheet.anims.length === 1,
        `sheet=${JSON.stringify(sheet && { name: sheet.name, fc: sheet.frameConfig, anims: sheet.anims.length })}`);

      // 위생화 검증: 잘못된 frameConfig(음수) patch → 무시(기존 보존).
      const bad = await api(info, 'POST', '/api/sprite/slice', { relPath: targetRel, patch: { frameConfig: { frameWidth: -5, frameHeight: 16 } } });
      const bb = JSON.parse(bad.body);
      ok('S3-5 음수 frameConfig 위생화(기존 16 보존)',
        bad.status === 200 && bb.ok === true && bb.item.frameConfig && bb.item.frameConfig.frameWidth === 16,
        `fc=${JSON.stringify(bb.item && bb.item.frameConfig)}`);
    }

    // ── S4 use 라운드트립(vendoring + reused) ────────────────────────────────────
    //  raw 타일(LIB_TILE_REL) 의존. .gitignore 로 부재하면 use 가 4xx(원본 파일 없음) 반환 →
    //  b1.asset 이 undefined 가 되어 S4-5 의 b1.asset.url deref 가 TypeError→catch→exit1 로
    //  후속 S4b~S8 단언을 통째로 소실시킨다(ENV-1). raw 부재면 블록 전체 graceful skip.
    if (!rawTilePresent) {
      ok('S4 use 라운드트립(raw 타일 부재 — graceful skip)', true, 'LIB_TILE_REL 부재로 use 의존 단언 스킵');
    } else {
      // 라이브러리 타일을 현재 게임에 적용(첫 use → reused:false).
      const r1 = await api(info, 'POST', '/api/sprite/use', {
        relPath: LIB_TILE_REL,
        frameConfig: { frameWidth: 16, frameHeight: 16 },
        frame: 0,
        license: 'CC0-1.0',
        credit: 'Kenney — Tiny Dungeon (CC0-1.0)'
      });
      const b1 = JSON.parse(r1.body);
      ok('S4-1 use 200 + ok', r1.status === 200 && b1.ok === true, `status=${r1.status} body=${r1.body.slice(0, 200)}`);
      ok('S4-2 첫 use reused=false', b1.reused === false, `reused=${b1.reused}`);
      ok('S4-3 local 에셋 등록(source·url games/·frameConfig)',
        b1.asset && b1.asset.source === 'local' && typeof b1.asset.url === 'string' && b1.asset.url.startsWith('games/') &&
        b1.asset.frameConfig && b1.asset.frameConfig.frameWidth === 16,
        `asset=${JSON.stringify(b1.asset && { src: b1.asset.source, url: b1.asset.url, fc: b1.asset.frameConfig })}`);
      ok('S4-4 frame 보존', b1.asset && b1.asset.frame === 0, `frame=${b1.asset && b1.asset.frame}`);

      // ENV-1 가드: use 가 4xx(asset 부재) 면 후속 디스크/재사용 단언이 deref TypeError 로 abort 되므로
      //  명시적으로 graceful 처리하고 S4 잔여 단언을 스킵(전제대로면 b1.asset 존재 — 이 분기는 안전망).
      if (!b1.asset) {
        ok('S4-5 use 실패(asset 부재 — graceful skip)', true, `status=${r1.status} body=${r1.body.slice(0, 160)}`);
      } else {
        // 실제 파일이 vendoring 됐는지 디스크 확인.
        const vendoredAbs = path.resolve(REPO_ROOT, b1.asset.url);
        ok('S4-5 vendoring 파일 디스크 존재', fs.existsSync(vendoredAbs), `path=${b1.asset.url}`);

        // 동일 relPath 재적용 → 같은 sha → reused:true, 기존 asset 반환(추가 등록 없음).
        const r2 = await api(info, 'POST', '/api/sprite/use', { relPath: LIB_TILE_REL, frameConfig: { frameWidth: 16, frameHeight: 16 } });
        const b2 = JSON.parse(r2.body);
        ok('S4-6 동일 sha 재적용 reused=true', r2.status === 200 && b2.ok === true && b2.reused === true, `reused=${b2.reused}`);
        ok('S4-7 재사용 asset 동일 id', b2.asset && b1.asset && b2.asset.id === b1.asset.id, `id1=${b1.asset && b1.asset.id} id2=${b2.asset && b2.asset.id}`);

        // asset/list 로 실제 등록 확인(중복 등록 없음 — 새 id 1개만 늘어남).
        const listB = JSON.parse((await api(info, 'GET', '/api/asset/list')).body);
        const sameSha = (listB.assets.sprites || []).filter((s) => s && s.sha256 === b1.asset.sha256);
        ok('S4-8 동일 sha 에셋 1개만(중복 vendoring 없음)', sameSha.length === 1, `count=${sameSha.length}`);
      }
    }

    // ── S4b collection 적용(filesRel[i] 로 use → local 에셋) ───────────────────────
    //  핵심 시나리오 회귀 가드(H-1/H-2): collection 항목은 relPath 가 없고 filesRel[] 로 적용한다.
    //  frameConfig/frame 을 보내지 않아도(각 파일이 단일 이미지 1프레임) 200 + local 에셋이어야 한다.
    {
      const lib = JSON.parse((await api(info, 'GET', '/api/sprite/library')).body);
      const coll = lib.items.find((it) => it.kind === 'collection' && Array.isArray(it.filesRel) && it.filesRel.length > 0);
      // collection 은 raw 타일(132 PNG) 에서만 생긴다. raw 부재면 collection 부재 → graceful skip.
      if (!rawTilePresent) {
        ok('S4b collection 적용(raw 타일 부재 — graceful skip)', true, 'no collection without raw tiles');
      } else {
      ok('S4b-1 collection 항목 존재(filesRel 보유)', !!coll, coll ? `count=${coll.count}` : 'none');
      if (coll) {
        const targetRel = coll.filesRel[0];
        const r = await api(info, 'POST', '/api/sprite/use', {
          relPath: targetRel,
          license: 'CC0-1.0',
          credit: 'Kenney — Tiny Dungeon (CC0-1.0)'
        });
        const b = JSON.parse(r.body);
        ok('S4b-2 collection use 200 + ok', r.status === 200 && b.ok === true, `status=${r.status} body=${r.body.slice(0, 200)}`);
        ok('S4b-3 local 에셋 등록(source·url games/)',
          b.asset && b.asset.source === 'local' && typeof b.asset.url === 'string' && b.asset.url.startsWith('games/'),
          `asset=${JSON.stringify(b.asset && { src: b.asset.source, url: b.asset.url })}`);
        // collection 은 frameConfig 를 보내지 않았으므로 에셋에도 frameConfig 없음(단일 이미지).
        ok('S4b-4 frameConfig 미설정(단일 이미지)', b.asset && b.asset.frameConfig === undefined, `fc=${b.asset && JSON.stringify(b.asset.frameConfig)}`);
        ok('S4b-5 vendoring 파일 디스크 존재', b.asset && fs.existsSync(path.resolve(REPO_ROOT, b.asset.url)), `path=${b.asset && b.asset.url}`);
      }
      }
    }

    // ── S4c frames[] 비균일 영역(free-mode) use + 재사용 키(M-1/M-5) ───────────────
    //  자유영역 frames 가 use~addAsset 까지 보존되고, 동일 sha 라도 frames 가 다르면 별 id 로 등록.
    //  raw 타일(LIB_TILE_REL) 의존 — 부재 시 use 가 4xx 라 단언이 통째 fail. graceful skip(ENV-3).
    if (!rawTilePresent) {
      ok('S4c frames[] free-mode(raw 타일 부재 — graceful skip)', true, 'LIB_TILE_REL 부재로 use 의존 단언 스킵');
    } else {
      // (1) frames[] 와 함께 use → asset.frames 보존.
      const r1 = await api(info, 'POST', '/api/sprite/use', {
        relPath: LIB_TILE_REL,
        frames: [{ name: 'a', x: 0, y: 0, w: 8, h: 8 }, { x: 8, y: 0, w: 8, h: 8 }],
        license: 'CC0-1.0'
      });
      const b1 = JSON.parse(r1.body);
      ok('S4c-1 frames[] use 200 + ok', r1.status === 200 && b1.ok === true, `status=${r1.status}`);
      ok('S4c-2 asset.frames 보존(영역 2개)',
        b1.asset && Array.isArray(b1.asset.frames) && b1.asset.frames.length === 2 &&
        b1.asset.frames[0].w === 8 && b1.asset.frames[0].h === 8,
        `frames=${JSON.stringify(b1.asset && b1.asset.frames)}`);
      // (2) 같은 sha 인데 frames 가 다른 영역 → 재사용 안 함(M-5, 새 id).
      const r2 = await api(info, 'POST', '/api/sprite/use', {
        relPath: LIB_TILE_REL,
        frames: [{ x: 0, y: 0, w: 16, h: 16 }],
        license: 'CC0-1.0'
      });
      const b2 = JSON.parse(r2.body);
      ok('S4c-3 frames 다르면 재사용 안 함(reused=false·새 id)',
        r2.status === 200 && b2.ok === true && b2.reused === false && b2.asset && b1.asset && b2.asset.id !== b1.asset.id,
        `reused=${b2.reused} id1=${b1.asset && b1.asset.id} id2=${b2.asset && b2.asset.id}`);
      // (3) 같은 frames 재적용 → 재사용(reused=true).
      const r3 = await api(info, 'POST', '/api/sprite/use', {
        relPath: LIB_TILE_REL,
        frames: [{ x: 0, y: 0, w: 16, h: 16 }],
        license: 'CC0-1.0'
      });
      const b3 = JSON.parse(r3.body);
      ok('S4c-4 동일 frames 재적용 reused=true(같은 id)',
        r3.status === 200 && b3.ok === true && b3.reused === true && b3.asset && b3.asset.id === b2.asset.id,
        `reused=${b3.reused} id=${b3.asset && b3.asset.id}`);
    }

    // ── S7 analyze(동작별 의미 분석 — D1) ────────────────────────────────────────
    //  /api/sprite/analyze 는 저장 안 함. 그리드(클라 w/h/frameConfig) + 사이드카 frames 경로 모두 검증.
    {
      // (1)(2)(5) 는 LIB_TILE_REL 시트를 analyze 한다 — raw 부재면 getSheetMeta 가 4xx 라
      //  analyze 가 4xx 가 되어 200 기대 단언이 fail. raw 존재 시에만 강하게 단언(graceful skip).
      //  (3) 경로 가드·(4) 거대입력/순수 deriveAnims 단위는 tile 무관이므로 항상 실행한다.
      if (!rawTilePresent) {
        ok('S7-(1)(2) grid·사이드카 frames analyze(raw 타일 부재 — graceful skip)', true, 'LIB_TILE_REL 부재로 analyze 의존 단언 스킵');
      } else {
      // (1) 그리드 분석: 클라가 w/h/frameConfig 전달(프론트가 이미지 로드 후 픽셀 크기 안다).
      //     4 cols x 3 rows → anims 3개, 의미 라벨(idle/walk/run), frames 인덱스가 올바른 행 셀.
      const r1 = await api(info, 'POST', '/api/sprite/analyze', {
        relPath: LIB_TILE_REL,
        w: 64, h: 48,
        frameConfig: { frameWidth: 16, frameHeight: 16 }
      });
      const b1 = JSON.parse(r1.body);
      ok('S7-1 grid analyze 200 + ok', r1.status === 200 && b1.ok === true, `status=${r1.status}`);
      ok('S7-2 anims 길이>0(행 단위 클립 3개)', Array.isArray(b1.anims) && b1.anims.length === 3, `len=${b1.anims && b1.anims.length}`);
      ok('S7-3 의미 라벨(idle/walk/run)',
        b1.anims && b1.anims[0].key === 'idle' && b1.anims[1].key === 'walk' && b1.anims[2].key === 'run',
        `keys=${b1.anims && b1.anims.map((a) => a.key).join(',')}`);
      ok('S7-4 frames 인덱스가 올바른 행 셀(row-major)',
        b1.anims && JSON.stringify(b1.anims[0].frames) === '[0,1,2,3]' &&
        JSON.stringify(b1.anims[1].frames) === '[4,5,6,7]' && JSON.stringify(b1.anims[2].frames) === '[8,9,10,11]',
        `row0=${b1.anims && JSON.stringify(b1.anims[0].frames)}`);
      ok('S7-5 클립 기본값(fps=8, loop=true)',
        b1.anims && b1.anims[0].fps === 8 && b1.anims[0].loop === true, `fps=${b1.anims && b1.anims[0].fps}`);
      ok('S7-6 frameConfig 에코(저장 안 함)', b1.frameConfig && b1.frameConfig.frameWidth === 16, `fc=${JSON.stringify(b1.frameConfig)}`);

      // (2) 사이드카 frames[] 경로: slice 로 명명 영역 저장 후 analyze 가 그걸 조회해 prefix 그룹핑.
      //     walk_0/walk_1/idle_0 → 'walk'(2프레임), 'idle_pose'(1프레임).
      await api(info, 'POST', '/api/sprite/slice', {
        relPath: LIB_TILE_REL,
        patch: { frames: [
          { name: 'walk_0', x: 0, y: 0, w: 8, h: 8 },
          { name: 'walk_1', x: 8, y: 0, w: 8, h: 8 },
          { name: 'idle_0', x: 0, y: 8, w: 8, h: 8 }
        ] }
      });
      const r2 = await api(info, 'POST', '/api/sprite/analyze', { relPath: LIB_TILE_REL });
      const b2 = JSON.parse(r2.body);
      ok('S7-7 사이드카 frames analyze 200 + ok', r2.status === 200 && b2.ok === true, `status=${r2.status}`);
      ok('S7-8 frames 조회(영역 3개)', Array.isArray(b2.frames) && b2.frames.length === 3, `frames=${b2.frames && b2.frames.length}`);
      const walk = (b2.anims || []).find((a) => a.key === 'walk');
      const idle = (b2.anims || []).find((a) => a.key === 'idle_pose');
      ok('S7-9 prefix 그룹핑 클립(walk=2프레임, idle_pose=1프레임)',
        walk && JSON.stringify(walk.frames) === '[0,1]' && walk.loop === true &&
        idle && JSON.stringify(idle.frames) === '[2]' && idle.loop === false,
        `anims=${JSON.stringify(b2.anims && b2.anims.map((a) => a.key + ':' + JSON.stringify(a.frames)))}`);
      }

      // (3) 경로 가드: traversal·범위밖·dotfile → 4xx.
      const g1 = await api(info, 'POST', '/api/sprite/analyze', { relPath: 'assets-library/../../etc/passwd' });
      ok('S7-10 analyze traversal 거부(4xx)', g1.status >= 400 && g1.status < 500, `status=${g1.status}`);
      const g2 = await api(info, 'POST', '/api/sprite/analyze', { relPath: 'skills/wgf-sprite-picker/catalog/packs.json' });
      ok('S7-11 analyze 범위 밖 거부(4xx)', g2.status >= 400 && g2.status < 500, `status=${g2.status}`);
      const g3 = await api(info, 'POST', '/api/sprite/analyze', { relPath: 'assets-library/.git/config' });
      ok('S7-12 analyze dotfile 거부(4xx)', g3.status >= 400 && g3.status < 500, `status=${g3.status}`);

      // (4) 거대입력 OOM 방어(보안 HIGH): w 가 거대 + frameWidth 1 이면 cols*rows 가 수십억이 되어
      //     nested loop 가 힙을 소진할 수 있다. analyze 엔드포인트는 크래시 없이 200 이어야 한다
      //     (사이드카 frames 가 있으면 그쪽으로 fallthrough 할 수 있으나, 그리드 자재화는 안 함).
      const huge = await api(info, 'POST', '/api/sprite/analyze', {
        relPath: LIB_TILE_REL,
        w: 1e9, h: 1e9,
        frameConfig: { frameWidth: 1, frameHeight: 1 }
      });
      let hugeBody = null;
      try { hugeBody = JSON.parse(huge.body); } catch (e) {}
      ok('S7-13 거대입력 크래시 없이 응답(200/4xx)',
        (huge.status === 200 || (huge.status >= 400 && huge.status < 500)) && hugeBody !== null,
        `status=${huge.status}`);
      // 순수 함수 deriveAnims 단위 검증: 그리드 경로에서 거대 입력은 루프 없이 자재화 거부해야 한다.
      //  (사이드카 frames 가 없는 순수 grid 입력 — 거대 시트 한 변 > MAX_SHEET_DIM 또는 셀 총수 초과.)
      const d1 = deriveAnims({ frameConfig: { frameWidth: 1, frameHeight: 1 }, w: 1e9, h: 1e9 });
      ok('S7-14 거대입력 deriveAnims bounded(anims=[] — 그리드 자재화 거부)',
        Array.isArray(d1.anims) && d1.anims.length === 0,
        `anims=${d1.anims && d1.anims.length} truncated=${d1.truncated}`);
      // 셀 총수만 초과(한 변은 정상)해도 루프 없이 truncated=true 로 거부.
      const d2 = deriveAnims({ frameConfig: { frameWidth: 1, frameHeight: 1 }, w: 16000, h: 16000 });
      ok('S7-14b 셀 총수 초과 → truncated=true(루프 없이 거부)',
        Array.isArray(d2.anims) && d2.anims.length === 0 && d2.truncated === true,
        `anims=${d2.anims && d2.anims.length} truncated=${d2.truncated}`);

      // (5) margin>0 그리드가 어댑터(scenekit-phaser.js, margin 1배) 공식과 일치하는 cols/frame 인덱스 산출.
      //     w=64,h=48,frameWidth=16,margin=10,spacing=0 → 어댑터 1배: cols=floor((64-10)/16)=3, rows=floor((48-10)/16)=2.
      //     (구 2배 공식이면 cols=floor((64-20)/16)=2 로 어긋남 — 1배여야 row0=[0,1,2].)
      //     LIB_TILE_REL analyze 의존 — raw 부재 시 graceful skip.
      if (!rawTilePresent) {
        ok('S7-(5) margin>0 어댑터 공식(raw 타일 부재 — graceful skip)', true, 'LIB_TILE_REL 부재로 스킵');
      } else {
        const mg = await api(info, 'POST', '/api/sprite/analyze', {
          relPath: LIB_TILE_REL,
          w: 64, h: 48,
          frameConfig: { frameWidth: 16, frameHeight: 16, margin: 10, spacing: 0 }
        });
        const mgb = JSON.parse(mg.body);
        ok('S7-15 margin>0 analyze 200 + ok', mg.status === 200 && mgb.ok === true, `status=${mg.status}`);
        // rows=2 → 클립 2개(idle/walk). cols=3 → 각 행 셀 3개(row-major: row0=[0,1,2], row1=[3,4,5]).
        ok('S7-16 margin 어댑터 공식 일치(cols=3, rows=2)',
          Array.isArray(mgb.anims) && mgb.anims.length === 2 &&
          JSON.stringify(mgb.anims[0].frames) === '[0,1,2]' &&
          JSON.stringify(mgb.anims[1].frames) === '[3,4,5]',
          `anims=${mgb.anims && JSON.stringify(mgb.anims.map((a) => a.frames))}`);
      }
    }

    // ── S8 공통모듈 재배치(P1-0): import 패리티 + 형태 패리티 + anims 도출값 ──────────
    //  deriveAnims 가 engine/derive-anims.mjs 로 재배치되고 sprite-library 가 re-export 함을 검증.
    {
      // (1) import 패리티: sprite-library re-export 와 공통모듈 직접 import 가 동일 함수 참조.
      ok('S8-1 deriveAnims re-export == 공통모듈 직접 import(동일 함수)',
        typeof deriveAnims === 'function' && deriveAnims === deriveAnimsCommon,
        `reexport=${typeof deriveAnims} common=${typeof deriveAnimsCommon} same=${deriveAnims === deriveAnimsCommon}`);

      // (2) 형태 패리티: 공통모듈 직접 호출이 그리드 경로에서 같은 결과(라벨·frames·기본값) 산출.
      const dc = deriveAnimsCommon({ frameConfig: { frameWidth: 16, frameHeight: 16 }, w: 64, h: 48 });
      ok('S8-2 공통모듈 grid 도출(클립 3개·idle/walk/run·row-major)',
        Array.isArray(dc.anims) && dc.anims.length === 3 &&
        dc.anims[0].key === 'idle' && dc.anims[1].key === 'walk' && dc.anims[2].key === 'run' &&
        JSON.stringify(dc.anims[0].frames) === '[0,1,2,3]' && dc.cols === 4 && dc.rows === 3,
        `anims=${dc.anims && JSON.stringify(dc.anims.map((a) => a.key))}`);
      // frames[] 경로 패리티(prefix 그룹핑).
      const df = deriveAnimsCommon({ frames: [
        { name: 'walk_0', x: 0, y: 0, w: 8, h: 8 }, { name: 'walk_1', x: 8, y: 0, w: 8, h: 8 },
        { name: 'idle_0', x: 0, y: 8, w: 8, h: 8 }
      ] });
      const dfWalk = (df.anims || []).find((a) => a.key === 'walk');
      const dfIdle = (df.anims || []).find((a) => a.key === 'idle_pose');
      ok('S8-3 공통모듈 frames prefix 그룹핑(walk=2, idle_pose=1)',
        dfWalk && JSON.stringify(dfWalk.frames) === '[0,1]' && dfIdle && JSON.stringify(dfIdle.frames) === '[2]',
        `anims=${df.anims && JSON.stringify(df.anims.map((a) => a.key + ':' + JSON.stringify(a.frames)))}`);

      // (3) catalog 왕복: 샘플 팩(raw/ 보유)에 analyze-pack 재실행 → analysis.json anims 가 빈 배열 아닌
      //     도출값 + editor 리더(getSheetMeta)가 동일 anims 반환. raw/ 보유 팩이 없으면 환경 스킵.
      const ANALYZE = path.resolve(REPO_ROOT, 'skills', 'wgf-sprite-picker', 'catalog', 'analyze-pack.mjs');
      const LIB_ROOT = path.resolve(REPO_ROOT, 'assets-library');
      let samplePack = null;
      try {
        for (const d of fs.readdirSync(LIB_ROOT, { withFileTypes: true })) {
          if (!d.isDirectory()) continue;
          if (fs.existsSync(path.join(LIB_ROOT, d.name, 'raw'))) { samplePack = d.name; break; }
        }
      } catch (e) {}
      if (!samplePack) {
        ok('S8-4 catalog 왕복(raw/ 팩 없음 — 환경 스킵)', true, 'no pack with raw/ present');
      } else {
        // analysis.json 백업(왕복 후 복원 — 리포 오염 0).
        const analysisAbs = path.resolve(LIB_ROOT, samplePack, 'analysis.json');
        const hadAnalysis = fs.existsSync(analysisAbs);
        const analysisBackup = hadAnalysis ? fs.readFileSync(analysisAbs) : null;
        // library.json 백업(upsert 복원).
        const libJsonAbs = path.resolve(LIB_ROOT, 'library.json');
        const hadLib = fs.existsSync(libJsonAbs);
        const libBackup = hadLib ? fs.readFileSync(libJsonAbs) : null;
        try {
          const run = spawnSync(process.execPath, [ANALYZE, '--pack', samplePack], { cwd: REPO_ROOT, encoding: 'utf8' });
          ok('S8-4 analyze-pack 재실행 exit 0', run.status === 0, `pack=${samplePack} status=${run.status} stderr=${(run.stderr || '').slice(-160)}`);
          const doc = JSON.parse(fs.readFileSync(analysisAbs, 'utf8'));
          const arr = Array.isArray(doc.sheets) ? doc.sheets : Object.keys(doc.sheets || {}).map((k) => doc.sheets[k]);
          ok('S8-5 analysis.json sheets 배열 형태(표준)', Array.isArray(doc.sheets), `type=${Array.isArray(doc.sheets) ? 'array' : typeof doc.sheets}`);
          // anims 가 빈 배열 아닌 도출값을 가진 시트가 1개 이상(grid/atlas/alpha 메타 보유 시트).
          const withAnims = arr.find((s) => s && Array.isArray(s.anims) && s.anims.length > 0);
          ok('S8-6 analysis.json anims 도출값 존재(빈 배열 아님)',
            !!withAnims, `pack=${samplePack} sheets=${arr.length} withAnims=${withAnims ? withAnims.id : 'none'}`);
          // 왕복: editor getSheetMeta 가 동일 anims 반환(키·frames 동치). raw/ 기준 파일명으로 조회.
          if (withAnims) {
            // analysis.sheets[].file 은 packDir 산출 파일(raw/ 아님)이라, getSheetMeta 가 매칭하는
            // 경로는 assets-library/<pack>/raw/<원본 basename>. readAnalysisSheet 가 sh.file basename
            // 으로 매칭하므로, file 과 같은 basename 의 raw 파일을 찾아 조회한다.
            const baseName = path.basename(withAnims.file);
            // raw/ 내에서 같은 basename(또는 slug 역추적이 어려우면 file 자체가 packDir 에 있으므로
            // packDir 경로로 조회 — readAnalysisSheet 는 basename 매칭이라 packDir 파일도 매칭됨).
            const rdRel = `assets-library/${samplePack}/${withAnims.file}`;
            const meta = getSheetMeta(REPO_ROOT, rdRel);
            ok('S8-7 editor getSheetMeta 왕복(동일 anims 반환)',
              meta && meta.ok && Array.isArray(meta.anims) && meta.anims.length === withAnims.anims.length &&
              meta.anims.length > 0 &&
              JSON.stringify(meta.anims.map((a) => a.key)) === JSON.stringify(withAnims.anims.map((a) => a.key)),
              `rel=${rdRel} reader=${meta && JSON.stringify(meta.anims && meta.anims.map((a) => a.key))} analysis=${JSON.stringify(withAnims.anims.map((a) => a.key))}`);
          } else {
            ok('S8-7 editor getSheetMeta 왕복(anims 없는 팩 — 스킵)', true, 'no derived anims to round-trip');
          }
        } finally {
          // 복원(리포 오염 0).
          try { if (hadAnalysis) fs.writeFileSync(analysisAbs, analysisBackup); } catch (e) {}
          try { if (hadLib) fs.writeFileSync(libJsonAbs, libBackup); } catch (e) {}
        }
      }
    }

    // ── S9 scanLibrary anims 자동표면화(1B) ──────────────────────────────────────────
    //  사이드카(wgf-slices.json)에 anims 가 없는 "다운로드만 한" 시트가 라이브러리 탭에서 즉시
    //  "애니 N개"로 뜨는지 검증한다. 우선순위: 사이드카 > analysis.json > deriveAnims 즉석.
    //  결정적·환경무관 단언을 위해 임시 픽스처 팩을 만든다(커밋된 tiny-dungeon.png 를 복사 — 이미지
    //  *생성* 안 함). 팩 PNG 는 .gitignore(assets-library/*/*.png) 대상이라 git 추적 오염 0이고,
    //  블록 종료 시 팩 디렉터리 통째 제거(리포 오염 0). 사이드카 우선순위는 S3-4 가 이미 커버.
    {
      const FIX_PACK = '__wgf-anim-fixture__';
      const fixDirAbs = path.resolve(REPO_ROOT, 'assets-library', FIX_PACK);
      const SRC_IMG = path.resolve(REPO_ROOT, 'games', 'wgf-sprite-demo', 'assets', 'imported', 'tiny-dungeon.png');
      const srcImgExists = fs.existsSync(SRC_IMG);
      // 픽스처 안전 제거 헬퍼(블록 진입 전 잔재·종료 시 정리 공용).
      const rmFix = () => { try { fs.rmSync(fixDirAbs, { recursive: true, force: true }); } catch (e) {} };
      rmFix();
      try {
        if (!srcImgExists) {
          ok('S9 자동표면화(소스 이미지 부재 — graceful skip)', true, 'tiny-dungeon.png 부재');
        } else {
          fs.mkdirSync(fixDirAbs, { recursive: true });
          // 픽스처 A: analysis.json anims fallback. 사이드카 없음 → analysis.json 의 anims 가 표면화돼야.
          const imgA = 'walk-cycle.png';
          fs.copyFileSync(SRC_IMG, path.join(fixDirAbs, imgA));
          // 픽스처 B: analysis.json anims=[] 이지만 frames 보유 → deriveAnims 즉석(prefix 그룹핑)로 표면화.
          const imgB = 'regions.png';
          fs.copyFileSync(SRC_IMG, path.join(fixDirAbs, imgB));
          // 픽스처 C: analysis.json 에 항목 없음 + 사이드카 없음 + frames 없음 → anims 빈 배열(즉석 도출 입력 부재).
          const imgC = 'plain.png';
          fs.copyFileSync(SRC_IMG, path.join(fixDirAbs, imgC));
          // analysis.json(P1-0 표준: sheets 배열). file 은 basename 매칭(readAnalysisSheet).
          const analysisDoc = {
            packId: FIX_PACK,
            sheets: [
              { id: FIX_PACK + '__walk', file: imgA, method: 'grid', frameConfig: { frameWidth: 16, frameHeight: 16 }, frames: null,
                anims: [{ key: 'walk', frames: [0, 1, 2, 3], fps: 8, loop: true }] },
              { id: FIX_PACK + '__regions', file: imgB, method: 'frames', frameConfig: null,
                frames: [{ name: 'run_0', x: 0, y: 0, w: 8, h: 8 }, { name: 'run_1', x: 8, y: 0, w: 8, h: 8 }],
                anims: [] }
            ]
          };
          fs.writeFileSync(path.join(fixDirAbs, 'analysis.json'), JSON.stringify(analysisDoc, null, 2));

          // scanLibrary 직접 호출(bridge 무관 순수 함수). gameDir=null — assets-library/** 만 스캔.
          const scan = scanLibrary(REPO_ROOT, null);
          ok('S9-1 scanLibrary ok + items 배열', scan && scan.ok === true && Array.isArray(scan.items), `items=${scan && scan.items && scan.items.length}`);
          const relA = `assets-library/${FIX_PACK}/${imgA}`;
          const relB = `assets-library/${FIX_PACK}/${imgB}`;
          const relC = `assets-library/${FIX_PACK}/${imgC}`;
          const itA = scan.items.find((it) => it.kind === 'sheet' && it.relPath === relA);
          const itB = scan.items.find((it) => it.kind === 'sheet' && it.relPath === relB);
          const itC = scan.items.find((it) => it.kind === 'sheet' && it.relPath === relC);
          // ② 핵심: 사이드카 없는 다운로드 시트의 anims 가 비어있지 않음(analysis.json fallback).
          ok('S9-2 analysis.json anims 자동표면화(walk, 비어있지 않음)',
            itA && Array.isArray(itA.anims) && itA.anims.length === 1 && itA.anims[0].key === 'walk' &&
            JSON.stringify(itA.anims[0].frames) === '[0,1,2,3]',
            `anims=${itA && JSON.stringify(itA.anims)}`);
          // ② 보강: analysis.json anims=[] 일 때 frames 로 deriveAnims 즉석 도출(run prefix 그룹핑).
          ok('S9-3 deriveAnims 즉석 표면화(frames→run, 비어있지 않음)',
            itB && Array.isArray(itB.anims) && itB.anims.length === 1 && itB.anims[0].key === 'run' &&
            JSON.stringify(itB.anims[0].frames) === '[0,1]',
            `anims=${itB && JSON.stringify(itB.anims)}`);
          // 음성 대조: 메타 전무(analysis 항목·사이드카·frames 없음) 시트는 anims=[](과표면화 안 함).
          ok('S9-4 메타 전무 시트는 anims=[](과표면화 없음)',
            itC && Array.isArray(itC.anims) && itC.anims.length === 0,
            `anims=${itC && JSON.stringify(itC.anims)}`);

          // ── S10 frameConfig 표면화(L1-C) ──────────────────────────────────────
          //  ① 사이드카 없는 다운로드 시트(itA)가 analysis.json frameConfig(16×16)를 항목에
          //     frameConfig 로 표면화 — SheetSlicer 가 16×16 기본값/"메타 없음" 대신 실제 grid 로 열림.
          ok('S10-1 analysis.json frameConfig 자동표면화(frameWidth>0)',
            itA && itA.frameConfig && itA.frameConfig.frameWidth === 16 && itA.frameConfig.frameHeight === 16,
            `fc=${itA && JSON.stringify(itA.frameConfig)}`);
          //  ① 보강: analysis.json frames 보유 시트(itB)는 frames 도 항목에 표면화(영역 2개).
          ok('S10-2 analysis.json frames 자동표면화(영역 2개)',
            itB && Array.isArray(itB.frames) && itB.frames.length === 2 &&
            itB.frames[0].w === 8 && itB.frames[0].h === 8,
            `frames=${itB && JSON.stringify(itB.frames)}`);
          //  음성 대조: 메타 전무 시트(itC)는 frameConfig=null(과표면화 없음).
          ok('S10-3 메타 전무 시트는 frameConfig=null(과표면화 없음)',
            itC && itC.frameConfig === null,
            `fc=${itC && JSON.stringify(itC.frameConfig)}`);

          //  ② 우선순위: 사이드카 frameConfig 가 analysis.json 보다 우선. itA(analysis=16×16)에
          //     사이드카 frameConfig 32×32 를 심어 재스캔 → 항목에 32 가 떠야(사이드카 승).
          //     wgf-slices.json 은 cleanup() 이 처리(시작 시 없었으면 종료 시 제거).
          const SLICES = path.resolve(REPO_ROOT, 'assets-library', 'wgf-slices.json');
          let prevSlices = null;
          try { prevSlices = fs.readFileSync(SLICES, 'utf8'); } catch (e) {}
          try {
            const doc = prevSlices ? JSON.parse(prevSlices) : { version: 1, sheets: {} };
            if (!doc.sheets || typeof doc.sheets !== 'object') doc.sheets = {};
            doc.sheets[relA] = { frameConfig: { frameWidth: 32, frameHeight: 32, margin: 0, spacing: 0 } };
            fs.writeFileSync(SLICES, JSON.stringify(doc, null, 2));
            const scan2 = scanLibrary(REPO_ROOT, null);
            const itA2 = scan2.items.find((it) => it.kind === 'sheet' && it.relPath === relA);
            ok('S10-4 사이드카 frameConfig 우선(analysis 16 위에 사이드카 32)',
              itA2 && itA2.frameConfig && itA2.frameConfig.frameWidth === 32 && itA2.frameConfig.frameHeight === 32,
              `fc=${itA2 && JSON.stringify(itA2.frameConfig)}`);
          } finally {
            // 사이드카 원복(테스트 격리 — S10 이 심은 relA 항목 제거).
            try {
              if (prevSlices === null) { if (!slicesExistedBefore) fs.rmSync(SLICES, { force: true }); }
              else fs.writeFileSync(SLICES, prevSlices);
            } catch (e) {}
          }
        }
      } catch (e) {
        ok('S9 자동표면화 블록 예외', false, String(e && e.stack || e));
      } finally {
        rmFix();
      }
    }

    // ── S5 경로 traversal 거부 ────────────────────────────────────────────────────
    {
      // slice: 범위 밖(skills/) → 4xx.
      const s1 = await api(info, 'POST', '/api/sprite/slice', { relPath: 'skills/x.png', patch: { name: 'x' } });
      ok('S5-1 slice 범위 밖 거부(4xx)', s1.status >= 400 && s1.status < 500, `status=${s1.status}`);
      // slice: traversal(../) → 4xx.
      const s2 = await api(info, 'POST', '/api/sprite/slice', { relPath: 'assets-library/../../etc/passwd', patch: { name: 'x' } });
      ok('S5-2 slice traversal 거부(4xx)', s2.status >= 400 && s2.status < 500, `status=${s2.status}`);
      // slice: dotfile → 4xx.
      const s3 = await api(info, 'POST', '/api/sprite/slice', { relPath: 'assets-library/.git/config', patch: { name: 'x' } });
      ok('S5-3 slice dotfile 거부(4xx)', s3.status >= 400 && s3.status < 500, `status=${s3.status}`);
      // use: 범위 밖 → 4xx(409 currentGameDir 는 있으므로 경로검증 400 도달).
      const u1 = await api(info, 'POST', '/api/sprite/use', { relPath: 'skills/wgf-sprite-picker/catalog/packs.json' });
      ok('S5-4 use 범위 밖 거부(4xx)', u1.status >= 400 && u1.status < 500, `status=${u1.status}`);
      // use: traversal → 4xx.
      const u2 = await api(info, 'POST', '/api/sprite/use', { relPath: 'assets-library/../bridge.mjs' });
      ok('S5-5 use traversal 거부(4xx)', u2.status >= 400 && u2.status < 500, `status=${u2.status}`);
    }

    // ── S6 GET /api/scene ETag ────────────────────────────────────────────────────
    {
      const r1 = await api(info, 'GET', '/api/scene');
      const etag = r1.headers.etag;
      ok('S6-1 /api/scene ETag 헤더(wgf-)', r1.status === 200 && typeof etag === 'string' && /^"wgf-\d+"$/.test(etag), `etag=${etag}`);
      // If-None-Match 일치 → 304(본문 생략).
      const r2 = await api(info, 'GET', '/api/scene', null, { 'If-None-Match': etag });
      ok('S6-2 If-None-Match 일치 → 304', r2.status === 304, `status=${r2.status}`);
      ok('S6-3 304 본문 비어있음', r2.body.length === 0, `bodyLen=${r2.body.length}`);
      // 상태 변경(seq 증가) 후 ETag 달라짐 → 같은 옛 ETag 로는 200.
      await api(info, 'POST', '/api/command', { command: { type: 'addEntity', entity: { name: 's6-new', transform: { x: 1, y: 1 }, components: [] } } });
      const r3 = await api(info, 'GET', '/api/scene', null, { 'If-None-Match': etag });
      ok('S6-4 seq 변경 후 옛 ETag 로 200(캐시 무효화)', r3.status === 200, `status=${r3.status}`);
    }

  } catch (e) {
    ok('테스트 실행 예외', false, String(e && e.stack || e));
  } finally {
    try { child.kill(); } catch (e) {}
    await sleep(50);
    cleanup();
    finish();
  }
}

function finish() {
  const result = { ok: fail === 0, pass, fail, checks };
  console.log(JSON.stringify(result));
  process.exit(fail === 0 ? 0 : 1);
}

main();
