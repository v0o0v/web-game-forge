#!/usr/bin/env node
/*
 * sprite-picker 컴패니언 서버 — 피커를 서빙하고 "선택 완료"를 파일로 받아낸다.
 *
 * 왜: 정적 `python -m http.server` 는 GET 만 되어 사용자가 자기 브라우저에서 고른 선택을
 * Claude 가 자동으로 가져올 수 없다(localStorage 는 브라우저별). 이 서버는 POST 를 받아
 * 선택 JSON 을 디스크에 저장하므로, 사용자가 "선택 완료"만 누르면 Claude 가 그 파일을 읽는다.
 *
 * 또한 피커 디렉터리 외에 **catalog/(커밋된 썸네일)** 과 **작업공간 루트(다운로드 풀뷰)** 를
 * 각각 /catalog/, /ws/ 로 서빙한다 — 피커가 미리보기·풀 렌더에 쓴다. 다운로드분은 assets-library/
 * 또는 games/<slug>/assets/ 어디에 있든 작업공간 루트 기준 경로로 풀 렌더된다.
 *
 * 실행(프로젝트 루트에서):
 *   node skills/sprite-picker/picker/serve.mjs
 * 환경변수:
 *   PORT                 기본 8770
 *   SPRITE_PICKER_OUT    선택 저장 경로 기본 <cwd>/.sprite-picker-selection.json
 *   SPRITE_PICKER_WS     /ws/ 가 서빙할 작업공간 루트 기본 <cwd>
 *
 * 엔드포인트:
 *   GET  /                            → index.html (피커)
 *   GET  /<file>                      → 피커 디렉터리 정적 파일(data.js 포함)
 *   GET  /catalog/<path>              → skills/sprite-picker/catalog/ 정적(커밋 썸네일 등)
 *   GET  /ws/<path>                   → 작업공간 루트 정적(다운로드분 풀뷰 — assets-library/·games/… SVG/PNG/시트)
 *   POST /__sprite_picker_submit      → 본문(JSON)을 OUT 에 저장, {ok:true} 반환
 *   GET  /__sprite_picker_status      → 마지막 저장 여부/시각
 *   POST /__sprite_picker_download_request → 다운로드 큐에 팩 요청 적재(CC0 게이트)
 *   GET  /__sprite_picker_downloads        → 다운로드 큐 JSON 반환
 *   POST /__sprite_picker_library_edit     → library.json 항목 패치 + analysis.json 동기
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const PICKER_ROOT = path.dirname(fileURLToPath(import.meta.url));      // 피커 디렉터리
const CATALOG_ROOT = path.resolve(PICKER_ROOT, '..', 'catalog');      // 커밋된 카탈로그(썸네일 포함)
const WS_ROOT = process.env.SPRITE_PICKER_WS
  ? path.resolve(process.env.SPRITE_PICKER_WS)
  : path.resolve(process.cwd());                                      // 작업공간 루트(다운로드분 풀뷰)
const PORT = parseInt(process.env.PORT || '8770', 10);
const OUT = process.env.SPRITE_PICKER_OUT
  ? path.resolve(process.env.SPRITE_PICKER_OUT)
  : path.resolve(process.cwd(), '.sprite-picker-selection.json');
// 다운로드 큐 경로 — process.cwd() 기준(gitignore 대상)
const DL_QUEUE = path.resolve(process.cwd(), '.sprite-picker-downloads.json');
// 라이브러리 JSON 경로
const LIBRARY = path.resolve(process.cwd(), 'assets-library', 'library.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp'
};

let lastSavedAt = null;

// 한 정적 루트 안에서만 파일을 서빙(경로 traversal 가드). rel 은 루트 기준 상대경로.
// blockDot=true 면 닷파일/닷디렉터리(.git·.env 등)를 막는다(작업공간 루트 서빙용).
function serveStatic(res, root, rel, blockDot) {
  if (rel === '' || rel === '/') rel = '/index.html';
  const decoded = decodeURIComponent(rel);
  if (blockDot && decoded.split(/[\\/]+/).some((seg) => seg.startsWith('.') && seg !== '' && seg !== '..')) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  const filePath = path.normalize(path.join(root, decoded));
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + rel); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  // CORS (사용자 브라우저가 다른 origin 이어도 안전하게)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && u.pathname === '/__sprite_picker_submit') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const obj = JSON.parse(body);
        fs.writeFileSync(OUT, JSON.stringify(obj, null, 2));
        lastSavedAt = new Date().toISOString();
        process.stderr.write(`[sprite-picker] 선택 저장됨 → ${OUT} (${lastSavedAt})\n`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, out: OUT, savedAt: lastSavedAt }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/__sprite_picker_status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, lastSavedAt, out: OUT }));
    return;
  }

  // ── 다운로드 큐 ──────────────────────────────────────────────────────────────
  // POST /__sprite_picker_download_request
  // body: { packId, name, sourceId, safetyTier, downloadUrl, url }
  // CC0 게이트 → 큐에 append(중복 제외) → {ok, queued, duplicate}
  if (req.method === 'POST' && u.pathname === '/__sprite_picker_download_request') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const item = JSON.parse(body);
        // CC0 게이트
        if (item.safetyTier !== 'cc0') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'cc0 아님' }));
          return;
        }
        // packId 필수
        if (!item.packId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'packId 필수' }));
          return;
        }
        // 큐 로드(없으면 초기화)
        let queue;
        try {
          queue = JSON.parse(fs.readFileSync(DL_QUEUE, 'utf8'));
        } catch {
          queue = { version: 1, requests: [] };
        }
        // 중복 검사: queued/downloading/analyzing/done 상태면 중복
        const ACTIVE = new Set(['queued', 'downloading', 'analyzing', 'done']);
        const dup = queue.requests.some(
          (r) => r.packId === item.packId && ACTIVE.has(r.status)
        );
        if (!dup) {
          queue.requests.push({
            packId: item.packId,
            name: item.name || '',
            sourceId: item.sourceId || '',
            safetyTier: item.safetyTier,
            downloadUrl: item.downloadUrl || item.url || '',
            url: item.url || item.downloadUrl || '',
            status: 'queued',
            requestedAt: new Date().toISOString(),
            note: '',
          });
          fs.writeFileSync(DL_QUEUE, JSON.stringify(queue, null, 2));
          process.stderr.write(`[sprite-picker] 다운로드 큐 적재: ${item.packId}\n`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, queued: queue.requests.length, duplicate: dup }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // GET /__sprite_picker_downloads — 큐 JSON 그대로 반환
  if (req.method === 'GET' && u.pathname === '/__sprite_picker_downloads') {
    try {
      let queue;
      try {
        queue = JSON.parse(fs.readFileSync(DL_QUEUE, 'utf8'));
      } catch {
        queue = { version: 1, requests: [] };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(queue));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(e) }));
    }
    return;
  }

  // ── 라이브러리 편집 ──────────────────────────────────────────────────────────
  // POST /__sprite_picker_library_edit
  // body: { id, patch: { name?, frameConfig?, frames?, anims?, excludedFrames? } }
  // library.json items[] 에서 id 항목에 patch 머지(보존 머지) + analysis.json 동기
  if (req.method === 'POST' && u.pathname === '/__sprite_picker_library_edit') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const { id, patch } = JSON.parse(body);
        if (!id || typeof patch !== 'object' || patch === null) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'id 와 patch 객체 필수' }));
          return;
        }
        // library.json 로드
        let lib;
        try {
          lib = JSON.parse(fs.readFileSync(LIBRARY, 'utf8'));
        } catch (e) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'library.json 없음: ' + String(e) }));
          return;
        }
        if (!Array.isArray(lib.items)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'library.json items[] 없음' }));
          return;
        }
        const idx = lib.items.findIndex((it) => it.id === id);
        if (idx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: `id "${id}" 항목 없음` }));
          return;
        }
        // 보존 머지: patch 의 키만 덮어쓰고 나머지 유지, analysisVersion:2 유지
        lib.items[idx] = Object.assign({}, lib.items[idx], patch, { analysisVersion: 2 });
        fs.writeFileSync(LIBRARY, JSON.stringify(lib, null, 2));
        process.stderr.write(`[sprite-picker] library 편집: ${id}\n`);

        // analysis.json 동기: packId = id 의 '__' 앞부분
        const packId = id.split('__')[0];
        const libRoot = path.resolve(process.cwd(), 'assets-library');
        const analysisPath = packId
          ? path.resolve(libRoot, packId, 'analysis.json')
          : null;
        // 방어적 경계 가드: analysisPath 가 assets-library/ 밖으로 나가면 동기 생략
        // (id 는 이미 library 항목과 일치해야 하므로 실질 위험은 낮지만, packId 에 ../ 등이 끼는 경우 차단)
        if (analysisPath && analysisPath.startsWith(libRoot + path.sep)) {
          try {
            let analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
            if (Array.isArray(analysis.sheets)) {
              const sheetIdx = analysis.sheets.findIndex((s) => s.id === id);
              if (sheetIdx !== -1) {
                // patch 중 analysis.json sheet 에 관련된 필드만 반영
                const sheetPatch = {};
                if (patch.frameConfig !== undefined) sheetPatch.frameConfig = patch.frameConfig;
                if (patch.frames !== undefined) sheetPatch.frames = patch.frames;
                if (patch.anims !== undefined) sheetPatch.anims = patch.anims;
                if (patch.excludedFrames !== undefined) sheetPatch.excludedFrames = patch.excludedFrames;
                analysis.sheets[sheetIdx] = Object.assign({}, analysis.sheets[sheetIdx], sheetPatch);
                fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
                process.stderr.write(`[sprite-picker] analysis.json 동기: ${packId}\n`);
              }
            }
          } catch {
            // analysis.json 없거나 파싱 실패 — 무시(library.json 은 이미 저장됨)
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // 보조 정적 루트: /catalog/ (커밋 썸네일) · /ws/ (작업공간 루트 — 다운로드분 풀뷰)
  if (req.method === 'GET' && (u.pathname === '/catalog' || u.pathname.startsWith('/catalog/'))) {
    return serveStatic(res, CATALOG_ROOT, u.pathname.slice('/catalog'.length));
  }
  if (req.method === 'GET' && (u.pathname === '/ws' || u.pathname.startsWith('/ws/'))) {
    return serveStatic(res, WS_ROOT, u.pathname.slice('/ws'.length), true);
  }

  // 기본 정적 서빙 (피커 디렉터리)
  serveStatic(res, PICKER_ROOT, u.pathname);
});

function openBrowser(url) {
  if (process.env.SPRITE_PICKER_NO_OPEN) return;
  try {
    const p = process.platform;
    if (p === 'win32') spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref();
    else if (p === 'darwin') spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    else spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
  } catch (e) { /* 자동 오픈 실패는 무시 — URL 은 stderr 로 안내됨 */ }
}

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  process.stderr.write(`[sprite-picker] ${url}  (선택 저장 경로: ${OUT})\n`);
  process.stderr.write(`[sprite-picker] /catalog → ${CATALOG_ROOT}\n`);
  process.stderr.write(`[sprite-picker] /ws → ${WS_ROOT}\n`);
  openBrowser(url);   // 준비되면 사용자 브라우저 자동 오픈 (SPRITE_PICKER_NO_OPEN 로 비활성화)
});
