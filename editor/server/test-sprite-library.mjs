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
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  // 전제: 씬·라이브러리 자산 존재 확인(없으면 환경 문제 — 명확히 실패).
  ok('전제: 데모 씬 존재', fs.existsSync(path.resolve(REPO_ROOT, SCENE_REL)), SCENE_REL);
  ok('전제: 라이브러리 타일 존재', fs.existsSync(path.resolve(REPO_ROOT, LIB_TILE_REL)), LIB_TILE_REL);

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
      ok('S1-5 downloaded 판정(tiny-dungeon=true)', tinyD && tinyD.downloaded === true, `downloaded=${tinyD && tinyD.downloaded}`);
      const notDl = b.packs.find((p) => p.id === 'kenney-pixel-platformer');
      ok('S1-6 downloaded 판정(미다운로드 팩=false)', notDl && notDl.downloaded === false, `downloaded=${notDl && notDl.downloaded}`);
    }

    // ── S2 library ─────────────────────────────────────────────────────────────
    {
      const r = await api(info, 'GET', '/api/sprite/library');
      const b = JSON.parse(r.body);
      ok('S2-1 library 200 + ok', r.status === 200 && b.ok === true, `status=${r.status}`);
      ok('S2-2 items 배열(>0)', Array.isArray(b.items) && b.items.length > 0, `items=${b.items && b.items.length}`);
      // tile_* 132개 → 1 collection.
      const coll = b.items.find((it) => it.kind === 'collection' && it.packId === 'kenney-tiny-dungeon');
      ok('S2-3 Tiles collection(count>=100)', coll && coll.count >= 100 && Array.isArray(coll.files), `count=${coll && coll.count}`);
      // collection 은 filesRel[](repo-상대, 선행 / 없음) 보유 + files 와 1:1 정렬(H-1).
      ok('S2-6 collection filesRel[](files 와 1:1, 선행 / 없음)',
        coll && Array.isArray(coll.filesRel) && coll.filesRel.length === coll.files.length &&
        coll.filesRel.length > 0 && coll.filesRel.every((r) => typeof r === 'string' && r.length > 0 && r[0] !== '/') &&
        coll.filesRel[0] === coll.files[0].replace(/^\//, ''),
        `filesRel0=${coll && coll.filesRel && coll.filesRel[0]}`);
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
    {
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

    // ── S4b collection 적용(filesRel[i] 로 use → local 에셋) ───────────────────────
    //  핵심 시나리오 회귀 가드(H-1/H-2): collection 항목은 relPath 가 없고 filesRel[] 로 적용한다.
    //  frameConfig/frame 을 보내지 않아도(각 파일이 단일 이미지 1프레임) 200 + local 에셋이어야 한다.
    {
      const lib = JSON.parse((await api(info, 'GET', '/api/sprite/library')).body);
      const coll = lib.items.find((it) => it.kind === 'collection' && Array.isArray(it.filesRel) && it.filesRel.length > 0);
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

    // ── S4c frames[] 비균일 영역(free-mode) use + 재사용 키(M-1/M-5) ───────────────
    //  자유영역 frames 가 use~addAsset 까지 보존되고, 동일 sha 라도 frames 가 다르면 별 id 로 등록.
    {
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
