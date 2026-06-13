#!/usr/bin/env node
/* ============================================================================
 * WGF Studio 브리지 서버 — 라이브 씬 상태 = 단일 진실 (P2)
 * ----------------------------------------------------------------------------
 * 설계서 §3.1·§3.3·§4.5·§4.9·§5 P2·§6·§7·§8 위험8 구현.
 *
 * 책임:
 *  - SceneKit world(authoritative)를 보유 — 모든 변경은 커맨드 → 직렬 apply 큐
 *    (전순서) → 델타 SSE 브로드캐스트(§7 동시편집 직렬화).
 *  - 서버측 커맨드 로그 + Undo/Redo(applyCommand 의 undoDelta 스택, 상한 §7).
 *  - editor/·games/·engine/ 정적 서빙(127.0.0.1 전용, traversal 가드 — serve.mjs 동등).
 *  - SSE 델타 스트림(id:=seq, Last-Event-ID 무손실 복구, 백프레셔 resync §8 위험8).
 *  - Play 권위(§4.9): mode='play' 동안 씬 문서 read-only — edit 커맨드 409 거부.
 *
 * 불변식:
 *  - zero-dep — Node 빌트인만(http/crypto/fs/path/url/module). npm 의존 금지.
 *  - 결정론 — 상태 변경은 SceneKit.applyCommand/applyUndo 로만. 토큰용
 *    crypto.randomBytes 는 보안 예외(씬 상태 무관).
 *
 * 실행(프로젝트 루트에서):
 *   node editor/server/bridge.mjs [port]          # 기본 5180
 *   WGF_BRIDGE_PORT=5200 node editor/server/bridge.mjs
 *   WGF_BRIDGE_SCENE=games/<slug>/scene.json node editor/server/bridge.mjs
 *   WGF_BRIDGE_PORT=0 ...                           # 임의 빈 포트(테스트 하니스)
 * 그 다음 브라우저: http://127.0.0.1:<port>/editor/ui/
 *
 * 보안(설계서 §6):
 *   - 127.0.0.1 전용 바인딩(0.0.0.0 금지 — LAN 비노출).
 *   - 기동 시 무작위 토큰(crypto.randomBytes) 발급. /api/* 는 토큰 + Origin 검사.
 *   - 모든 파일 경로를 리포 루트로 정규화 후 prefix 검사, ../ traversal 거부, dotfile 차단.
 * ==========================================================================*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));    // editor/server/
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');            // 리포 루트(서빙 루트)

// ── 설정 ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.argv[2] || process.env.WGF_BRIDGE_PORT || '5180', 10);
const HOST = '127.0.0.1';
const UNDO_LIMIT = 200;            // Undo/Redo·커맨드 로그 상한(설계서 §7)
// 구독자별 송신 버퍼 상한(백프레셔, §8 위험8). 초과 → resync.
//  - SSE_BUFFER_LIMIT: 백프레셔 진입 후 누적 프레임 수 상한.
//  - SSE_BYTES_LIMIT: Node 스트림 내부 버퍼(res.writableLength) 바이트 상한.
//    writableLength 는 클라가 안 읽으면 OS 소켓이 아니라 Node 스트림에 쌓이므로 결정적으로
//    증가 → 테스트가 WGF_BRIDGE_SSE_LIMIT 만 낮춰도 resync 경로를 OS 의존 없이 트리거.
const SSE_BUFFER_LIMIT = parseInt(process.env.WGF_BRIDGE_SSE_LIMIT || '1000', 10);
const SSE_BYTES_LIMIT = parseInt(process.env.WGF_BRIDGE_SSE_BYTES || String(256 * 1024), 10);
// 테스트 전용: localhost loopback 송신 버퍼가 수 MB라 실제 소켓으로는 백프레셔를 결정적
// 으로 트리거하기 어렵다. 이 플래그가 켜지면 매 write 후 강제로 backpressured 로 간주해
// resync 경로를 실제로 실행 검증한다(프로덕션 기본 off — OS 신호/writableLength 만 사용).
const SSE_FORCE_BP = process.env.WGF_BRIDGE_SSE_FORCE_BP === '1';
const DEFAULT_SCENE = 'games/_editor-samples/topdown-min/scene.json';

// ── 토큰(보안 §6) ─────────────────────────────────────────────────────────────
const TOKEN = crypto.randomBytes(24).toString('hex');

// ── SceneKit 코어 로드(authoritative world) ──────────────────────────────────
// 브라우저 외부(Node)에서도 동일 코어로 t=0 를 만든다 — §4.1 단일 코어 원칙.
const SceneKit = require(path.resolve(REPO_ROOT, 'engine/scenekit.js'));
require(path.resolve(REPO_ROOT, 'engine/scenekit-components.js'));  // 컴포넌트 등록(필수)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

// ── 씬 문서 로드(단일 진실 부트스트랩) ────────────────────────────────────────
const SCENE_REL = process.env.WGF_BRIDGE_SCENE || DEFAULT_SCENE;
let sceneDoc;
try {
  sceneDoc = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, SCENE_REL), 'utf8'));
} catch (e) {
  process.stderr.write(`[wgf-bridge] 씬 로드 실패(${SCENE_REL}) — 빈 씬으로 시작: ${String(e)}\n`);
  sceneDoc = {
    format: 'wgf-scene@1', slug: 'empty',
    meta: { title: '빈 씬', genre: 'topdown', viewport: { w: 320, h: 240 }, pixelArt: true },
    assets: {}, walls: [], scenes: [{ id: 'main', systems: {}, entities: [] }], dataLayers: {}
  };
}

// ── 라이브 상태(단일 진실) ────────────────────────────────────────────────────
const state = {
  baseDoc: sceneDoc,             // wgf-scene@1 래퍼(serialize 결과를 다시 감쌀 때 기준)
  world: SceneKit.load(sceneDoc, { mode: 'edit' }),
  mode: 'edit',                  // 'edit' | 'play' (권위 모드, §4.9)
  seq: 0,                        // 현재 시퀀스(마지막으로 적용된 델타의 id)
  log: [],                       // 커맨드 로그 [{seq, kind, command, undoDelta}] — SSE 복구용
  undoStack: [],                 // [{cmd, undoDelta}]
  redoStack: []
};

// ── SSE 구독자 ────────────────────────────────────────────────────────────────
// 각 구독자: {res, buffer:[], alive}. buffer 는 백프레셔 상한 초과 시 비우고 resync 발행.
const subscribers = new Set();

// ── 커맨드 적용(직렬 apply 큐 — 전순서, §7) ──────────────────────────────────
// Node 단일 스레드 + 동기 applyCommand 이므로 호출 자체가 전순서. 시퀀스 부여 후 브로드캐스트.
function applyAndBroadcast(kind, command, undoDelta) {
  state.seq += 1;
  const entry = { seq: state.seq, kind, command, undoDelta };
  state.log.push(entry);
  if (state.log.length > UNDO_LIMIT) state.log.shift();   // 로그 상한(§7)
  broadcast({ type: kind, seq: state.seq, command });
  return state.seq;
}

// edit 커맨드(GUI/Claude). Play 모드면 거부 호출자가 처리. undoDelta 를 Undo 스택에 적재.
// 반환 {seq, newId} — addEntity 면 newId = 브리지가 발급한 확정 id(remote 클라가 즉시 회수).
function pushCommand(command) {
  const undoDelta = SceneKit.applyCommand(state.world, command);
  // addEntity 의 새 id 를 커맨드에 박아 redo/미러 재적용 시 같은 id 가 나오게(§ editorController 패턴).
  let stored = command;
  let newId = null;
  if (command.type === 'addEntity' && undoDelta && undoDelta.type === 'removeEntity' && undoDelta.id != null) {
    newId = undoDelta.id;
    const ent = Object.assign({}, command.entity, { id: newId });
    stored = Object.assign({}, command, { entity: ent });
  }
  state.undoStack.push({ cmd: stored, undoDelta });
  if (state.undoStack.length > UNDO_LIMIT) state.undoStack.shift();
  state.redoStack.length = 0;
  // 미러 동기는 stored(확정 id 포함) 를 브로드캐스트해야 클라가 같은 id 로 applyCommand.
  const seq = applyAndBroadcast('command', stored, undoDelta);
  return { seq, newId };
}

function doUndo() {
  if (state.undoStack.length === 0) return null;
  const entry = state.undoStack.pop();
  SceneKit.applyUndo(state.world, entry.undoDelta);
  state.redoStack.push(entry);
  if (state.redoStack.length > UNDO_LIMIT) state.redoStack.shift();
  // 미러도 같은 undoDelta 를 applyUndo 해야 동일 결과 → 델타에 undoDelta 동봉.
  state.seq += 1;
  const logEntry = { seq: state.seq, kind: 'undo', command: null, undoDelta: entry.undoDelta };
  state.log.push(logEntry);
  if (state.log.length > UNDO_LIMIT) state.log.shift();
  broadcast({ type: 'undo', seq: state.seq, undoDelta: entry.undoDelta });
  return state.seq;
}

function doRedo() {
  if (state.redoStack.length === 0) return null;
  const entry = state.redoStack.pop();
  const newUndo = SceneKit.applyCommand(state.world, entry.cmd);
  state.undoStack.push({ cmd: entry.cmd, undoDelta: newUndo });
  if (state.undoStack.length > UNDO_LIMIT) state.undoStack.shift();
  // 미러는 원래 커맨드 재적용 → command 델타로 동봉(미러가 applyCommand).
  return applyAndBroadcast('command', entry.cmd, newUndo);
}

// ── SSE 브로드캐스트 + 백프레셔 ───────────────────────────────────────────────
function formatEvent(evt) {
  // 일반 델타: id:=seq + data. resync 는 event: resync 로 따로.
  return `id: ${evt.seq}\ndata: ${JSON.stringify(evt)}\n\n`;
}

function broadcast(evt) {
  const frame = formatEvent(evt);
  for (const sub of subscribers) {
    if (!sub.alive) continue;
    sendToSub(sub, frame);
  }
}

// 구독자에게 1프레임 전송. 백프레셔 모델:
//  - res.write() 가 false 를 반환하면 소켓 송신 버퍼가 highWaterMark 초과(느린 소비자 신호).
//    그 시점부터 "backpressured" 상태로, drain 이벤트가 오기 전까지 보내려는 프레임을 모두
//    pending 으로 누적한다(Node 가 내부 버퍼에 쌓으므로 — 무한 적체 위험).
//  - pending 이 SSE_BUFFER_LIMIT 를 넘으면 적체를 멈추고(이후 프레임 드롭) resync 1회 발행.
//    클라는 resync 를 받으면 /api/scene 으로 재동기(무손실 — 스냅샷이 최신 진실).
function sendToSub(sub, frame) {
  if (sub.resyncing) return;             // 이미 resync 발행 후 — /api/scene 재요청 대기(추가 프레임 드롭)
  // 백프레셔 신호 = write() false 반환(OS 소켓) 또는 Node 스트림 내부 버퍼 바이트 누적.
  // 둘 중 하나라도 상한 초과면 적체로 간주(writableLength 는 클라 미수신 시 결정적 증가).
  const buffered = (typeof sub.res.writableLength === 'number') ? sub.res.writableLength : 0;
  if (sub.backpressured) {
    sub.pending += 1;
    if (sub.pending > SSE_BUFFER_LIMIT || buffered > SSE_BYTES_LIMIT) { triggerResync(sub); return; }
    try { sub.res.write(frame); } catch (e) { sub.alive = false; }
    return;
  }
  let flushed;
  try { flushed = sub.res.write(frame); }
  catch (e) { sub.alive = false; return; }
  const bufferedAfter = (typeof sub.res.writableLength === 'number') ? sub.res.writableLength : 0;
  if (!flushed || bufferedAfter > SSE_BYTES_LIMIT || SSE_FORCE_BP) {
    // 백프레셔 진입(이 프레임은 이미 내부 버퍼에 들어갔다 — pending=1 로 카운트).
    sub.backpressured = true;
    sub.pending = 1;
  }
}

function triggerResync(sub) {
  if (sub.resyncing) return;
  sub.resyncing = true;
  sub.backpressured = false;
  sub.pending = 0;
  try {
    // resync 이벤트(id 없음 — 시퀀스에서 빼지 않음). 클라가 받으면 /api/scene 재요청.
    sub.res.write(`event: resync\ndata: ${JSON.stringify({ type: 'resync', seq: state.seq })}\n\n`);
  } catch (e) { sub.alive = false; }
}

// drain 시 백프레셔 해제(소비자 따라잡음). resync 후에도 drain 되면 정상 복귀.
function attachDrain(sub) {
  sub.res.on('drain', () => {
    sub.backpressured = false;
    sub.pending = 0;
    sub.resyncing = false;
  });
}

// Last-Event-ID 이후 누락 델타 재전송(무손실 복구, §8 위험8).
// [수정] 로그 상한(UNDO_LIMIT) 에 의해 이미 잘린 구간을 요청받으면 resync 발행.
//  - since+1 < oldest: 로그에 없는 seq 를 요청 → 갭 있음 → resync.
//  - since === state.seq: 갭 없음(완전 최신) → 재전송 0건이 정상, resync 불필요.
//  - off-by-one 주의: since+1 < oldest 만 resync(since+1 === oldest 는 갭 없이 연속).
function replayMissed(sub, lastId) {
  const since = parseInt(lastId, 10);
  if (!isFinite(since)) return;
  // 갭 검사: 로그에 보관된 가장 오래된 seq 보다 since+1 이 앞서면 복구 불가 → resync.
  const oldest = state.log.length ? state.log[0].seq : (state.seq + 1);
  if (since + 1 < oldest) {
    triggerResync(sub);
    return;
  }
  for (const entry of state.log) {
    if (entry.seq <= since) continue;
    let evt;
    if (entry.kind === 'undo') {
      evt = { type: 'undo', seq: entry.seq, undoDelta: entry.undoDelta };
    } else if (entry.kind === 'mode') {
      // [수정] mode 델타는 'mode' 타입으로 재전송 — 라이브 브로드캐스트(§4.9)와 동일.
      //  재연결 클라가 applyCommand({mode:'play'}) 대신 올바른 mode 이벤트로 처리하게.
      evt = { type: 'mode', seq: entry.seq, mode: entry.command.mode };
    } else {
      evt = { type: 'command', seq: entry.seq, command: entry.command };
    }
    sendToSub(sub, formatEvent(evt));
  }
}

// ── 보안 헬퍼 ─────────────────────────────────────────────────────────────────
// /api/* 토큰 검사. EventSource 는 헤더 못 넣으므로 ?token= 쿼리도 허용.
function checkToken(req, u) {
  const hdr = req.headers['x-wgf-token'];
  const q = u.searchParams.get('token');
  return hdr === TOKEN || q === TOKEN;
}

// Origin 검사 — 동일 호스트(127.0.0.1/localhost) origin 만 허용. Origin 없으면(same-origin
// fetch·서버측 클라) 허용(브라우저는 cross-origin 시 항상 Origin 부착).
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return (o.hostname === '127.0.0.1' || o.hostname === 'localhost');
  } catch (e) { return false; }
}

// 정적 서빙(traversal 가드 — serve.mjs 동등). rel = URL 경로(REPO_ROOT 기준).
function serveStatic(res, rel) {
  if (rel === '' || rel === '/') rel = '/editor/ui/index.html';
  let decoded;
  try { decoded = decodeURIComponent(rel); }
  catch { res.writeHead(400); res.end('bad request'); return; }

  const segs = decoded.split(/[\\/]+/).filter(Boolean);
  if (segs.some((s) => s.startsWith('.'))) {   // .git·.env·.. 차단
    res.writeHead(403); res.end('forbidden'); return;
  }

  let filePath = path.normalize(path.join(REPO_ROOT, decoded));
  if (filePath !== REPO_ROOT && !filePath.startsWith(REPO_ROOT + path.sep)) {
    res.writeHead(403); res.end('forbidden'); return;
  }

  fs.stat(filePath, (statErr, st) => {
    if (statErr) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + rel); return; }
    if (st.isDirectory()) filePath = path.join(filePath, 'index.html');
    // editor/ui/index.html 은 토큰 주입(브리지 부트스트랩) 위해 가공해 서빙.
    if (filePath === path.join(REPO_ROOT, 'editor', 'ui', 'index.html')) {
      serveIndexWithToken(res, filePath);
      return;
    }
    fs.readFile(filePath, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + rel); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
  });
}

// index.html 에 window.__WGF_BRIDGE__ 스크립트를 <head> 직후 삽입해 토큰·base 주입.
// 이게 있으면 UI 가 remote transport 로 동작(없으면 local 폴백).
function serveIndexWithToken(res, filePath) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const inject = `<script>window.__WGF_BRIDGE__=${JSON.stringify({ token: TOKEN, base: '' })};</script>`;
    let out;
    if (html.includes('</head>')) out = html.replace('</head>', inject + '\n</head>');
    else out = inject + '\n' + html;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(out);
  });
}

// JSON 응답 헬퍼.
function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

// POST 본문 수집(상한 가드).
function readBody(req, cb) {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 5_000_000) req.destroy(); });
  req.on('end', () => cb(body));
}

// 현재 스냅샷(serialize + 단일 진실 시퀀스). wgf-scene@1 래퍼로 감싸 라운드트립 정합.
function sceneSnapshot() {
  const serialized = SceneKit.serialize(state.world);
  return { scene: wrapForSnapshot(serialized), seq: state.seq, mode: state.mode };
}

function wrapForSnapshot(serialized) {
  const base = (state.baseDoc && typeof state.baseDoc === 'object') ? state.baseDoc : {};
  return {
    format: base.format || 'wgf-scene@1',
    slug: base.slug || 'scene',
    meta: serialized.meta && Object.keys(serialized.meta).length ? serialized.meta : (base.meta || {}),
    assets: serialized.assets || base.assets || {},
    walls: serialized.walls || base.walls || [],
    scenes: [{
      id: (base.scenes && base.scenes[0] && base.scenes[0].id) || 'main',
      systems: (base.scenes && base.scenes[0] && base.scenes[0].systems) || {},
      entities: serialized.entities || []
    }],
    dataLayers: base.dataLayers || {}
  };
}

// ── HTTP 서버 ─────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = u.pathname;

  // ── API 라우트(토큰 + Origin 검사) ────────────────────────────────────────
  if (p.startsWith('/api/')) {
    if (!checkToken(req, u)) { sendJSON(res, 401, { ok: false, error: '토큰 누락/오류' }); return; }
    if (!checkOrigin(req)) { sendJSON(res, 403, { ok: false, error: 'Origin 거부' }); return; }
    return handleApi(req, res, u, p);
  }

  // ── 정적 서빙 ──────────────────────────────────────────────────────────────
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('method not allowed');
    return;
  }
  serveStatic(res, p);
});

function handleApi(req, res, u, p) {
  // GET /api/bootstrap — 토큰·base(클라가 fetch 로 받을 수도 있는 보조 경로).
  if (req.method === 'GET' && p === '/api/bootstrap') {
    sendJSON(res, 200, { ok: true, token: TOKEN, base: '', seq: state.seq, mode: state.mode });
    return;
  }

  // GET /api/scene — 현재 스냅샷 + seq(초기 동기·resync 재요청).
  if (req.method === 'GET' && p === '/api/scene') {
    sendJSON(res, 200, Object.assign({ ok: true }, sceneSnapshot()));
    return;
  }

  // POST /api/command {command} — applyCommand → seq++ → SSE 델타. Play 모드면 409.
  if (req.method === 'POST' && p === '/api/command') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const command = parsed && parsed.command;
      if (!command || typeof command !== 'object') { sendJSON(res, 400, { ok: false, error: 'command 누락' }); return; }
      if (state.mode === 'play') { sendJSON(res, 409, { ok: false, error: 'Play 모드 — 씬 read-only(§4.9)' }); return; }
      const r = pushCommand(command);
      sendJSON(res, 200, { ok: true, seq: r.seq, newId: r.newId });
    });
    return;
  }

  // POST /api/undo · /api/redo — 서버측 undo/redo + 델타. Play 모드 거부.
  if (req.method === 'POST' && (p === '/api/undo' || p === '/api/redo')) {
    if (state.mode === 'play') { sendJSON(res, 409, { ok: false, error: 'Play 모드 — 씬 read-only(§4.9)' }); return; }
    const seq = (p === '/api/undo') ? doUndo() : doRedo();
    sendJSON(res, 200, { ok: true, seq, applied: seq != null });
    return;
  }

  // POST /api/mode {mode} — 권위 모드 전환(edit↔play).
  if (req.method === 'POST' && p === '/api/mode') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const mode = (parsed && parsed.mode === 'play') ? 'play' : 'edit';
      state.mode = mode;
      // 모드 전환도 델타로 알려 미러·UI 가 동기(권위 read-only 상태 표시).
      state.seq += 1;
      const entry = { seq: state.seq, kind: 'mode', command: { mode }, undoDelta: null };
      state.log.push(entry);
      if (state.log.length > UNDO_LIMIT) state.log.shift();
      broadcast({ type: 'mode', seq: state.seq, mode });
      sendJSON(res, 200, { ok: true, mode, seq: state.seq });
    });
    return;
  }

  // GET /api/events — SSE 델타 스트림.
  if (req.method === 'GET' && p === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    const sub = { res, pending: 0, alive: true, resyncing: false, backpressured: false };
    subscribers.add(sub);
    attachDrain(sub);
    // 초기 코멘트(연결 확인 — 일부 클라가 첫 바이트 대기).
    res.write(`: connected seq=${state.seq}\n\n`);
    // Last-Event-ID(헤더 또는 ?lastEventId=) → 누락 델타 재전송(무손실 복구).
    const lastId = req.headers['last-event-id'] || u.searchParams.get('lastEventId');
    if (lastId != null) replayMissed(sub, lastId);
    req.on('close', () => { sub.alive = false; subscribers.delete(sub); });
    return;
  }

  sendJSON(res, 404, { ok: false, error: 'unknown api' });
}

server.listen(PORT, HOST, () => {
  const actual = server.address().port;
  const url = `http://${HOST}:${actual}/editor/ui/`;
  // 첫 줄: 테스트 하니스가 파싱하는 구조화 라인(포트·토큰).
  process.stderr.write(`[wgf-bridge] READY ${JSON.stringify({ port: actual, token: TOKEN, host: HOST })}\n`);
  process.stderr.write(`[wgf-bridge] 브리지 기동 → ${url}\n`);
  process.stderr.write(`[wgf-bridge] 서빙 루트: ${REPO_ROOT}\n`);
  process.stderr.write(`[wgf-bridge] 씬: ${SCENE_REL}  entities=${state.world.entities.length}\n`);
});

server.on('error', (e) => {
  process.stderr.write(`[wgf-bridge] 서버 오류: ${String(e)}\n`);
  process.exit(1);
});
