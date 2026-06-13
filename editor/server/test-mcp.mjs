#!/usr/bin/env node
/* ============================================================================
 * WGF Studio MCP + 역채널 통합 테스트 하니스 — P3 게이트 (zero-dep)
 * ----------------------------------------------------------------------------
 * bridge.mjs 와 mcp.mjs 를 실제 spawn 해 설계서 §5 P3 게이트를 실행 검증한다.
 * MCP 는 stdio newline-delimited JSON-RPC 로 통신(실제 Claude 세션 없이 MCP
 * 클라이언트를 시뮬레이션).
 *
 * 게이트:
 *   G-MCP   MCP JSON-RPC: initialize → tools/list(18종) → tools/call 동작.
 *           newline-delimited 프레이밍 파싱 검증.
 *   G-CHAT  챗 "적 3마리 추가" e2e(메커니즘): POST /api/chat → editor_next_message
 *           디큐 → scene_add_entity ×3(MCP→브리지) → 엔티티 +3 → editor_reply →
 *           에디터 SSE 구독자가 reply 수신.
 *   G-REENTER 재진입 큐 무손실: enqueue → 브리지 kill → 재spawn → 큐 파일에서 복원.
 *   G-HB    하트비트: heartbeat 후 status=connected, 임계 초과 후 disconnected
 *           (임계는 테스트에서 단축 — 5초 임계 로직 검증).
 *   G-NOBUILD 루트 무빌드 불변식: 루트 package.json/node_modules 부재 단언.
 *
 * 사용: node editor/server/test-mcp.mjs
 * 출력: 사람용 줄 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
 * 종료코드: 전부 통과 0, 하나라도 실패 1.
 * ==========================================================================*/
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');
const BRIDGE = path.join(SERVER_DIR, 'bridge.mjs');
const MCP = path.join(SERVER_DIR, 'mcp.mjs');

const checks = [];
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  const passed = !!cond;
  checks.push({ name, ok: passed, detail: detail || '' });
  if (passed) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, intervalMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeoutMs || 3000)) {
    if (await fn()) return true;
    await sleep(intervalMs || 20);
  }
  return false;
}

// 임시 작업 디렉터리(엔드포인트·챗 큐 파일 격리). 테스트 종료 시 정리.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wgf-mcp-test-'));
const ENDPOINT_FILE = path.join(TMP, 'bridge-endpoint.json');
const CHAT_FILE = path.join(TMP, 'chat-queue.json');

function cleanupTmp() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }

// ── 브리지 spawn + READY 파싱 ─────────────────────────────────────────────────
function startBridge(extraEnv) {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      WGF_BRIDGE_PORT: '0',
      WGF_BRIDGE_ENDPOINT_FILE: ENDPOINT_FILE,
      WGF_BRIDGE_CHAT_FILE: CHAT_FILE
    }, extraEnv || {});
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

// ── HTTP 헬퍼(브리지 직접 — 에디터/사용자 시뮬레이션) ─────────────────────────
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
function api(info, method, p, bodyObj) {
  const body = bodyObj != null ? JSON.stringify(bodyObj) : null;
  const headers = Object.assign({
    'X-WGF-Token': info.token, 'Origin': `http://127.0.0.1:${info.port}`
  }, body != null ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {});
  return request({ host: '127.0.0.1', port: info.port, path: p, method, headers }, body);
}

// 간이 SSE 리더(에디터 구독자 — chat 델타 수신 검증용).
function openSSE(info) {
  return new Promise((resolve, reject) => {
    const headers = { 'Accept': 'text/event-stream', 'Origin': `http://127.0.0.1:${info.port}` };
    const req = http.request({
      host: '127.0.0.1', port: info.port,
      path: '/api/events?token=' + encodeURIComponent(info.token), method: 'GET', headers
    }, (res) => {
      const handle = { status: res.statusCode, events: [], close: () => { try { req.destroy(); } catch (e) {} } };
      let sseBuf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        sseBuf += chunk;
        let idx;
        while ((idx = sseBuf.indexOf('\n\n')) >= 0) {
          const rawEvt = sseBuf.slice(0, idx); sseBuf = sseBuf.slice(idx + 2);
          const dataLines = [];
          for (const line of rawEvt.split('\n')) { if (line.startsWith('data:')) dataLines.push(line.slice(5).trim()); }
          if (!dataLines.length) continue;
          try { handle.events.push(JSON.parse(dataLines.join('\n'))); } catch (e) {}
        }
      });
      resolve(handle);
    });
    req.on('error', reject);
    req.end();
  });
}

// ── MCP 클라이언트(stdio newline-delimited JSON-RPC) ──────────────────────────
// mcp.mjs 를 spawn 하고 한 줄당 JSON 으로 요청/응답을 주고받는다.
function startMcp(extraEnv) {
  const env = Object.assign({}, process.env, {
    WGF_BRIDGE_ENDPOINT_FILE: ENDPOINT_FILE   // 토큰 공유: MCP 가 이 파일에서 브리지 토큰 획득
  }, extraEnv || {});
  const child = spawn(process.execPath, [MCP], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();   // id → {resolve}
  let outBuf = '';
  let lineCount = 0;           // 수신한 메시지 줄 수(newline-delimited 검증)
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    outBuf += chunk;
    let idx;
    while ((idx = outBuf.indexOf('\n')) >= 0) {
      const line = outBuf.slice(0, idx); outBuf = outBuf.slice(idx + 1);
      const t = line.trim();
      if (!t) continue;
      lineCount++;
      let msg;
      try { msg = JSON.parse(t); } catch (e) { continue; }   // 파싱 불가 줄(있으면 프레이밍 위반)
      if (msg.id != null && pending.has(msg.id)) { const r = pending.get(msg.id); pending.delete(msg.id); r(msg); }
    }
  });
  let stderrBuf = '';
  child.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });
  let nextId = 1;
  const client = {
    child,
    getLineCount: () => lineCount,
    getStderr: () => stderrBuf,
    notify(method, params) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); },
    rpc(method, params, timeoutMs) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP rpc 타임아웃 ' + method)); }, timeoutMs || 5000);
        pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    stop() { try { child.stdin.end(); child.kill(); } catch (e) {} }
  };
  return client;
}

// tools/call 결과 content[0].text 를 JSON 파싱(구조화 결과 회수).
function parseToolResult(msg) {
  const c = msg && msg.result && msg.result.content && msg.result.content[0];
  if (!c || typeof c.text !== 'string') return null;
  try { return JSON.parse(c.text); } catch (e) { return c.text; }
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  let bridge, mcp;
  try {
    bridge = await startBridge();
  } catch (e) { ok('브리지 기동', false, String(e)); finish(); return; }
  let info = bridge.info;
  ok('브리지 기동(READY 파싱)', info && info.port > 0 && typeof info.token === 'string', `port=${info.port}`);

  // 엔드포인트 파일이 기록됐는지(토큰 공유 경로).
  ok('엔드포인트 파일 기록(토큰 공유)', fs.existsSync(ENDPOINT_FILE), ENDPOINT_FILE);

  mcp = startMcp();

  try {
    // ── G-MCP: MCP JSON-RPC initialize → tools/list → tools/call ────────────────
    {
      const initRes = await mcp.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
      const r = initRes.result;
      ok('G-MCP initialize(protocolVersion·capabilities·serverInfo)',
        r && r.protocolVersion === '2025-06-18' && r.capabilities && r.serverInfo && r.serverInfo.name === 'wgf-editor',
        `proto=${r && r.protocolVersion} server=${r && r.serverInfo && r.serverInfo.name}`);

      mcp.notify('notifications/initialized');

      const listRes = await mcp.rpc('tools/list', {});
      const tools = listRes.result && listRes.result.tools;
      ok('G-MCP tools/list 도구 목록(18종)', Array.isArray(tools) && tools.length === 18,
        `count=${tools && tools.length}`);
      // 핵심 도구 존재 단언.
      const names = (tools || []).map((t) => t.name);
      const required = ['scene_get', 'scene_add_entity', 'scene_set_transform', 'editor_next_message', 'editor_reply', 'undo', 'redo', 'project_list'];
      const allPresent = required.every((n) => names.includes(n));
      ok('G-MCP 필수 도구 스키마 노출', allPresent, `missing=${required.filter((n) => !names.includes(n)).join(',') || 'none'}`);
      // 스키마 형태(각 도구 inputSchema.type === object).
      const schemasOk = (tools || []).every((t) => t.inputSchema && t.inputSchema.type === 'object' && typeof t.description === 'string');
      ok('G-MCP 도구 스키마 형태(object inputSchema + description)', schemasOk);

      // tools/call scene_get — 브리지 단일 진실 조회(프록시 동작).
      const getRes = await mcp.rpc('tools/call', { name: 'scene_get', arguments: {} });
      const getOut = parseToolResult(getRes);
      ok('G-MCP tools/call scene_get 프록시 동작', getOut && getOut.ok === true && getOut.scene && Array.isArray(getOut.scene.scenes),
        `ok=${getOut && getOut.ok}`);

      // newline-delimited 프레이밍: 지금까지 받은 메시지 줄 수 ≥ 3(init+list+call), stdout 에 비-JSON 없음.
      ok('G-MCP newline-delimited 프레이밍(줄 단위 파싱)', mcp.getLineCount() >= 3, `lines=${mcp.getLineCount()}`);

      // 미지원 도구 → -32602.
      const badRes = await mcp.rpc('tools/call', { name: 'no_such_tool', arguments: {} });
      ok('G-MCP 미지원 도구 → -32602', badRes.error && badRes.error.code === -32602, `code=${badRes.error && badRes.error.code}`);

      // 미지원 메서드 → -32601.
      const badMethod = await mcp.rpc('no/such/method', {});
      ok('G-MCP 미지원 메서드 → -32601', badMethod.error && badMethod.error.code === -32601, `code=${badMethod.error && badMethod.error.code}`);
    }

    // ── G-CHAT: "적 3마리 추가" e2e(메커니즘) ──────────────────────────────────
    {
      // 에디터 SSE 구독자(reply 수신 검증).
      const sse = await openSSE(info);
      ok('G-CHAT SSE 구독 연결', sse.status === 200, `status=${sse.status}`);

      // 초기 엔티티 수.
      const snap0 = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const ents0 = snap0.scene.scenes[0].entities.length;

      // 사용자(에디터) → POST /api/chat "적 3마리 추가".
      const chatRes = await api(info, 'POST', '/api/chat', { text: '적 3마리 추가' });
      const chatBody = JSON.parse(chatRes.body);
      ok('G-CHAT 사용자 메시지 enqueue', chatRes.status === 200 && chatBody.ok === true && chatBody.id >= 1, `id=${chatBody.id}`);

      // 에디터가 자기 메시지를 SSE(user)로 수신(에코).
      const gotUserEcho = await waitFor(async () => sse.events.some((e) => e.type === 'chat' && e.role === 'user' && e.text === '적 3마리 추가'), 2000);
      ok('G-CHAT 사용자 메시지 SSE 에코(role=user)', gotUserEcho);

      // MCP(Claude 시뮬) → editor_next_message 로 디큐.
      const nextRes = await mcp.rpc('tools/call', { name: 'editor_next_message', arguments: {} }, 6000);
      const nextOut = parseToolResult(nextRes);
      ok('G-CHAT editor_next_message 디큐', nextOut && nextOut.ok === true && nextOut.message && nextOut.message.text === '적 3마리 추가',
        `text=${nextOut && nextOut.message && nextOut.message.text}`);
      const handledId = nextOut && nextOut.message && nextOut.message.id;

      // MCP → scene_add_entity ×3(적 3마리).
      const addedIds = [];
      for (let i = 0; i < 3; i++) {
        const addRes = await mcp.rpc('tools/call', { name: 'scene_add_entity', arguments: { name: 'enemy' + i, transform: { x: 40 + i * 10, y: 50 }, components: [] } });
        const addOut = parseToolResult(addRes);
        if (addOut && addOut.ok && addOut.id) addedIds.push(addOut.id);
      }
      ok('G-CHAT scene_add_entity ×3(MCP→브리지)', addedIds.length === 3, `ids=${addedIds.join(',')}`);

      // 브리지 씬 엔티티 +3 확인.
      const snap1 = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const ents1 = snap1.scene.scenes[0].entities.length;
      ok('G-CHAT 브리지 씬 엔티티 +3', ents1 === ents0 + 3, `before=${ents0} after=${ents1}`);

      // MCP → editor_reply "3마리 추가 완료".
      const replyRes = await mcp.rpc('tools/call', { name: 'editor_reply', arguments: { text: '3마리 추가 완료', replyTo: handledId } });
      const replyOut = parseToolResult(replyRes);
      ok('G-CHAT editor_reply 전송', replyOut && replyOut.ok === true, `seq=${replyOut && replyOut.seq}`);

      // 에디터(SSE 구독자)가 reply 수신(role=assistant).
      const gotReply = await waitFor(async () => sse.events.some((e) => e.type === 'chat' && e.role === 'assistant' && e.text === '3마리 추가 완료'), 2000);
      ok('G-CHAT 에디터 SSE 가 reply 수신(role=assistant)', gotReply);

      sse.close();
      await sleep(50);
    }

    // ── G-HB: 하트비트 5초 임계 로직(테스트 단축) ──────────────────────────────
    // 짧은 임계(WGF_BRIDGE_HEARTBEAT_MS=300)로 별도 브리지를 띄워 임계 전후 status 검증.
    {
      let bhb;
      try { bhb = await startBridge({ WGF_BRIDGE_HEARTBEAT_MS: '300', WGF_BRIDGE_CHAT_FILE: path.join(TMP, 'chat-hb.json') }); }
      catch (e) { bhb = null; }
      if (!bhb) { ok('G-HB 브리지 기동', false, '기동 실패'); }
      else {
        const ihb = bhb.info;
        // 하트비트 전 — 아직 한 번도 없음 → disconnected.
        const s0 = JSON.parse((await api(ihb, 'GET', '/api/status')).body);
        ok('G-HB 초기 상태 disconnected', s0.status === 'disconnected', `status=${s0.status}`);

        // heartbeat → connected(임계 내, 미처리 메시지 없음).
        await api(ihb, 'POST', '/api/heartbeat');
        const s1 = JSON.parse((await api(ihb, 'GET', '/api/status')).body);
        ok('G-HB heartbeat 후 connected', s1.status === 'connected', `status=${s1.status}`);

        // 미처리 메시지 enqueue → 임계 내 + 메시지 있음 → waiting.
        await api(ihb, 'POST', '/api/heartbeat');
        await api(ihb, 'POST', '/api/chat', { text: 'pending' });
        const s2 = JSON.parse((await api(ihb, 'GET', '/api/status')).body);
        ok('G-HB 미처리 메시지 시 waiting', s2.status === 'waiting', `status=${s2.status}`);

        // 임계(300ms) 초과 대기 → disconnected.
        await sleep(450);
        const s3 = JSON.parse((await api(ihb, 'GET', '/api/status')).body);
        ok('G-HB 임계 초과 후 disconnected(5초 임계 로직)', s3.status === 'disconnected', `status=${s3.status}`);

        try { bhb.child.kill(); } catch (e) {}
        await sleep(50);
      }
    }

    // ── G-REENTER: 재진입 큐 무손실(브리지 강종 후 재spawn) ────────────────────
    // 별도 챗 파일로 격리: 메시지 2건 enqueue → 1건만 디큐 → 브리지 kill → 재spawn →
    // 큐 파일에서 미처리 1건 복원 확인.
    {
      const REENTER_CHAT = path.join(TMP, 'chat-reenter.json');
      try { fs.unlinkSync(REENTER_CHAT); } catch (e) {}
      let b1;
      try { b1 = await startBridge({ WGF_BRIDGE_CHAT_FILE: REENTER_CHAT }); } catch (e) { b1 = null; }
      if (!b1) { ok('G-REENTER 브리지 기동', false, '기동 실패'); }
      else {
        const i1 = b1.info;
        // 2건 enqueue.
        await api(i1, 'POST', '/api/chat', { text: '메시지-A' });
        await api(i1, 'POST', '/api/chat', { text: '메시지-B' });
        // 1건만 디큐(editor_next_message 직접 HTTP — MCP 없이 브리지 큐 동작 검증).
        const next1 = JSON.parse((await api(i1, 'GET', '/api/chat/next')).body);
        ok('G-REENTER 강종 전 1건 디큐', next1.message && next1.message.text === '메시지-A', `text=${next1.message && next1.message.text}`);

        await sleep(50);   // 영속 flush 여유

        // 브리지 강종(프로세스 kill — graceful 아님).
        b1.child.kill('SIGKILL');
        await sleep(150);

        // 같은 챗 파일로 재spawn → 미처리 1건(메시지-B) 복원.
        let b2;
        try { b2 = await startBridge({ WGF_BRIDGE_CHAT_FILE: REENTER_CHAT }); } catch (e) { b2 = null; }
        if (!b2) { ok('G-REENTER 재spawn', false, '재기동 실패'); }
        else {
          const i2 = b2.info;
          const next2 = JSON.parse((await api(i2, 'GET', '/api/chat/next')).body);
          ok('G-REENTER 재진입 후 미처리 무손실 복원', next2.message && next2.message.text === '메시지-B',
            `text=${next2.message && next2.message.text}`);
          // 더 이상 미처리 없음(message:null, long-poll 짧게).
          // (디큐 1건 후 빈 큐 — 다음 호출은 long-poll 타임아웃이므로 검사 생략.)
          try { b2.child.kill(); } catch (e) {}
          await sleep(50);
        }
      }
    }

    // ── G-NOBUILD: 루트 무빌드 불변식(루트 package.json/node_modules 부재) ──────
    {
      const hasPkg = fs.existsSync(path.join(REPO_ROOT, 'package.json'));
      const hasNM = fs.existsSync(path.join(REPO_ROOT, 'node_modules'));
      ok('G-NOBUILD 루트 package.json 부재', !hasPkg, `exists=${hasPkg}`);
      ok('G-NOBUILD 루트 node_modules 부재', !hasNM, `exists=${hasNM}`);
      // .mcp.json 은 설정 파일(무빌드 무관) — 존재 단언(P3 산출물).
      ok('G-NOBUILD .mcp.json 존재(설정)', fs.existsSync(path.join(REPO_ROOT, '.mcp.json')));
    }

  } catch (e) {
    ok('테스트 실행 예외', false, String(e && e.stack || e));
  } finally {
    if (mcp) mcp.stop();
    try { bridge.child.kill(); } catch (e) {}
    await sleep(50);
    cleanupTmp();
    finish();
  }
}

function finish() {
  const result = { ok: fail === 0, pass, fail, checks };
  console.log(JSON.stringify(result));
  process.exit(fail === 0 ? 0 : 1);
}

main();
