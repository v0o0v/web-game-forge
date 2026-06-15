#!/usr/bin/env node
/* ============================================================================
 * WGF Studio P4 스킬+에셋 통합 테스트 하니스 — P4 게이트 (zero-dep)
 * ----------------------------------------------------------------------------
 * bridge.mjs 와 mcp.mjs 를 실제 spawn 해 설계서 §5 P4·§4.6·§6 게이트를 실행 검증한다.
 * MCP 는 stdio newline-delimited JSON-RPC 로 통신(실제 Claude 세션 없이 MCP
 * 클라이언트를 시뮬레이션).
 *
 * 게이트:
 *   G-DET    결정형 실행: skill_run_tool 로 lint-scene(현재 씬, file="current") →
 *            exit 0. juice 류(lint-juice) 도구 1개 → exit 0. lint-kit-deps → exit 0.
 *   G-WL     화이트리스트 거부: 화이트리스트 외 도구명('rm'·'node'·임의 경로) → 거부
 *            (실행 안 됨, 구조화 에러).
 *   G-ARG    인자스키마 위반 거부: 허용 도구라도 잘못된 인자(경로 traversal '../'·
 *            타입 위반·허용 외 키) → 거부.
 *   G-SHELL  셸 보간 안전: 인자에 '; rm -rf /' 등을 넣어도 execFile 배열이라 셸 미실행
 *            (파일명으로만 취급) → lint-rng 가 그 "파일"을 못 찾아 실패하되, 셸 부작용 없음.
 *   G-DISP   창작 디스패치 왕복: 창작 요청 enqueue(현재 씬 문맥 포함) → editor_next_message
 *            디큐(문맥 확인) → editor_reply 왕복.
 *   G-REF    에셋 드래그→ref 유효: asset_add_procedural 로 자산 추가 → 엔티티에
 *            Sprite(sprite=그 id) addComponent → 현재 씬 직렬화 후 lint-scene exit 0
 *            (댕글링 아님).
 *   G-CC0    asset_add_cc0(url+license) → list 반영.
 *
 * 사용: node editor/server/test-skill.mjs
 * 출력: 사람용 줄 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
 * 종료코드: 전부 통과 0, 하나라도 실패 1.
 * ==========================================================================*/
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wgf-skill-test-'));
const ENDPOINT_FILE = path.join(TMP, 'bridge-endpoint.json');
const CHAT_FILE = path.join(TMP, 'chat-queue.json');
function cleanupTmp() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }

// 셸 보간 안전 검증용 마커 파일(있으면 절대 안 됨 — 셸이 도구를 실행했다는 증거).
const SHELL_CANARY = path.join(TMP, 'SHELL-PWNED.txt');

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

// ── MCP 클라이언트(stdio newline-delimited JSON-RPC) ──────────────────────────
function startMcp(extraEnv) {
  const env = Object.assign({}, process.env, {
    WGF_BRIDGE_ENDPOINT_FILE: ENDPOINT_FILE
  }, extraEnv || {});
  const child = spawn(process.execPath, [MCP], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let outBuf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    outBuf += chunk;
    let idx;
    while ((idx = outBuf.indexOf('\n')) >= 0) {
      const line = outBuf.slice(0, idx); outBuf = outBuf.slice(idx + 1);
      const t = line.trim();
      if (!t) continue;
      let msg;
      try { msg = JSON.parse(t); } catch (e) { continue; }
      if (msg.id != null && pending.has(msg.id)) { const r = pending.get(msg.id); pending.delete(msg.id); r(msg); }
    }
  });
  let nextId = 1;
  return {
    child,
    notify(method, params) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'); },
    rpc(method, params, timeoutMs) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP rpc 타임아웃 ' + method)); }, timeoutMs || 8000);
        pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    stop() { try { child.stdin.end(); child.kill(); } catch (e) {} }
  };
}

// tools/call 결과 content[0].text 를 JSON 파싱 + isError 플래그 회수.
function parseToolResult(msg) {
  const res = msg && msg.result;
  const c = res && res.content && res.content[0];
  const isError = !!(res && res.isError);
  if (!c || typeof c.text !== 'string') return { isError, data: null };
  let data; try { data = JSON.parse(c.text); } catch (e) { data = c.text; }
  return { isError, data };
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  let bridge, mcp;
  try { bridge = await startBridge(); }
  catch (e) { ok('브리지 기동', false, String(e)); finish(); return; }
  const info = bridge.info;
  ok('브리지 기동(READY 파싱)', info && info.port > 0 && typeof info.token === 'string', `port=${info.port}`);

  mcp = startMcp();

  try {
    await mcp.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    mcp.notify('notifications/initialized');

    // ── G-DET: 결정형 실행(lint-scene 현재 씬·lint-juice·lint-kit-deps) ──────────
    {
      // lint-scene(file="current" → 브리지가 현재 씬 임시 직렬화) → exit 0.
      const r1 = await mcp.rpc('tools/call', { name: 'skill_run_tool', arguments: { tool: 'lint-scene', args: { file: 'current', json: true } } }, 35000);
      const o1 = parseToolResult(r1);
      ok('G-DET lint-scene(현재 씬) exit 0', !o1.isError && o1.data && o1.data.ok === true && o1.data.exit === 0 && o1.data.json && o1.data.json.ok === true,
        `exit=${o1.data && o1.data.exit} jsonOk=${o1.data && o1.data.json && o1.data.json.ok}`);

      // juice 류 도구(lint-juice) — 실제 game.js 대상 → exit 0.
      const r2 = await mcp.rpc('tools/call', { name: 'skill_run_tool', arguments: { tool: 'lint-juice', args: { file: 'games/super-runner/game.js', json: true } } }, 35000);
      const o2 = parseToolResult(r2);
      ok('G-DET lint-juice(juice 류) exit 0', !o2.isError && o2.data && o2.data.ok === true && o2.data.exit === 0,
        `exit=${o2.data && o2.data.exit}`);

      // lint-kit-deps(기본 manifest, 인자 없이) → exit 0.
      const r3 = await mcp.rpc('tools/call', { name: 'skill_run_tool', arguments: { tool: 'lint-kit-deps', args: { json: true } } }, 35000);
      const o3 = parseToolResult(r3);
      ok('G-DET lint-kit-deps exit 0', !o3.isError && o3.data && o3.data.ok === true && o3.data.exit === 0,
        `exit=${o3.data && o3.data.exit}`);

      // [3A] 화이트리스트 5종 전부 에디터 표면 — lint-rng(결정론) game.js 대상 → exit 0.
      const r3b = await mcp.rpc('tools/call', { name: 'skill_run_tool', arguments: { tool: 'lint-rng', args: { file: 'games/super-runner/game.js', json: true } } }, 35000);
      const o3b = parseToolResult(r3b);
      ok('G-DET lint-rng(game.js) exit 0', !o3b.isError && o3b.data && o3b.data.ok === true && o3b.data.exit === 0,
        `exit=${o3b.data && o3b.data.exit}`);

      // [3A] qa-score(종합 점수) target=games/<slug> 슬러그 → 도구 실행됨(exit 0/1 무관, 거부 아님).
      const r3c = await mcp.rpc('tools/call', { name: 'skill_run_tool', arguments: { tool: 'qa-score', args: { target: 'super-runner', json: true } } }, 35000);
      const o3c = parseToolResult(r3c);
      ok('G-DET qa-score(슬러그) 실행됨(거부 아님)', !o3c.isError && o3c.data && o3c.data.ok === true && typeof o3c.data.exit === 'number',
        `exit=${o3c.data && o3c.data.exit}`);

      // [3A] 화이트리스트 5종이 모두 실행 가능(거부 아님)임을 한 번에 단언 — 에디터 결정형 표면 완비.
      const WL5 = [
        { tool: 'lint-scene', args: { file: 'current', json: true } },
        { tool: 'lint-rng', args: { file: 'games/super-runner/game.js', json: true } },
        { tool: 'lint-juice', args: { file: 'games/super-runner/game.js', json: true } },
        { tool: 'lint-kit-deps', args: { json: true } },
        { tool: 'qa-score', args: { target: 'super-runner', json: true } }
      ];
      let wlAllRan = true; const wlDetail = [];
      for (const w of WL5) {
        const rr = JSON.parse((await api(info, 'POST', '/api/skill/run', w)).body);
        const ran = rr.ok === true && typeof rr.exit === 'number';
        wlDetail.push(w.tool + '=' + (ran ? 'run' : 'REJECT'));
        if (!ran) wlAllRan = false;
      }
      ok('G-DET 결정형 화이트리스트 5종 전부 에디터 표면(skill_run_tool 실행)', wlAllRan, wlDetail.join(' '));

      // 직접 HTTP(에디터 결정형 트랙) 경로도 동일 동작 — POST /api/skill/run.
      const r4 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'lint-scene', args: { file: 'current', json: true } })).body);
      ok('G-DET 에디터 직접 트랙(POST /api/skill/run) exit 0', r4.ok === true && r4.exit === 0 && r4.json && r4.json.ok === true,
        `exit=${r4.exit}`);
    }

    // ── G-WL: 화이트리스트 거부 ─────────────────────────────────────────────────
    {
      // 'rm' — 화이트리스트 외 → 거부(실행 안 됨).
      const r1 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'rm', args: {} })).body);
      ok('G-WL rm 거부(403)', r1.ok === false && /화이트리스트/.test(r1.error || ''), `error=${r1.error}`);

      // 'node' — 화이트리스트 외 → 거부.
      const statusNode = (await api(info, 'POST', '/api/skill/run', { tool: 'node', args: {} })).status;
      ok('G-WL node 거부(4xx)', statusNode >= 400 && statusNode < 500, `status=${statusNode}`);

      // 임의 경로를 도구명으로 — 거부.
      const r3 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: '../../../bin/sh', args: {} })).body);
      ok('G-WL 임의 경로 도구명 거부', r3.ok === false, `error=${r3.error}`);

      // MCP 경로도 거부를 구조화 에러(isError)로 전달.
      const r4 = parseToolResult(await mcp.rpc('tools/call', { name: 'skill_run_tool', arguments: { tool: 'rm', args: {} } }));
      ok('G-WL MCP skill_run_tool 거부 → isError', r4.isError === true && r4.data && r4.data.ok === false, `isError=${r4.isError}`);
    }

    // ── G-ARG: 인자스키마 위반 거부 ─────────────────────────────────────────────
    {
      // 허용 도구(lint-scene)라도 경로 traversal '../' → 거부.
      const r1 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'lint-scene', args: { file: '../../../etc/passwd' } })).body);
      ok('G-ARG traversal 경로 거부', r1.ok === false && /traversal|범위/.test(r1.error || ''), `error=${r1.error}`);

      // 절대경로 탈출(리포 밖) → 거부.
      const r2 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'lint-scene', args: { file: 'C:/Windows/System32/drivers/etc/hosts' } })).body);
      ok('G-ARG 리포 밖 절대경로 거부', r2.ok === false, `error=${r2.error}`);

      // 타입 위반: json 은 boolean 이어야 함(문자열 주입) → 거부.
      const r3 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'lint-scene', args: { file: 'current', json: 'yes' } })).body);
      ok('G-ARG boolflag 타입 위반 거부', r3.ok === false && /boolean/.test(r3.error || ''), `error=${r3.error}`);

      // 허용 외 인자 키 → 거부.
      const r4 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'lint-scene', args: { file: 'current', evil: 1 } })).body);
      ok('G-ARG 허용 외 인자 키 거부', r4.ok === false && /허용되지 않은/.test(r4.error || ''), `error=${r4.error}`);

      // qa-score slug 에 '..' → 거부(softlock 경로 탈출).
      const r5 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'qa-score', args: { target: '../../etc' } })).body);
      ok('G-ARG qa-score slug .. 거부', r5.ok === false, `error=${r5.error}`);

      // [보안 §6] qa-score slug 절대경로 우회 차단 — '/etc' 는 정규식을 통과하지만 선행 / 로 거부.
      const r6 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'qa-score', args: { target: '/etc' } })).body);
      ok('G-ARG qa-score slug 절대경로(/etc) 거부', r6.ok === false, `error=${r6.error}`);

      // [보안 §6] lint-scene path 인자에 dotfile 세그먼트 → 거부(serveStatic 정합).
      const r7 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'lint-scene', args: { file: 'games/super-runner/.env' } })).body);
      ok('G-ARG dotfile 세그먼트 경로 거부', r7.ok === false, `error=${r7.error}`);
    }

    // ── G-SHELL: 셸 보간 안전(execFile 배열 — 셸 미실행) ────────────────────────
    {
      // lint-rng 위치 인자에 셸 메타문자를 넣는다. execFile 배열이면 "그 이름의 파일"을 찾을
      // 뿐 셸이 ; 이후를 실행하지 않는다. 경로 검증(resolveScopedPath)이 제어문자/범위는 막되,
      // 메타문자만 있는 상대경로는 통과시켜 도구에 그대로 넘긴다 → 도구가 파일 부재로 실패하거나
      // 처리하되, SHELL_CANARY 파일은 절대 생성되지 않아야 한다(셸 부작용 0).
      const evilArg = 'games/super-runner/game.js; touch ' + SHELL_CANARY;
      const r1 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'lint-rng', args: { file: evilArg } })).body);
      // 거부(경로 정규화가 막든) 또는 실행(파일명으로 취급)든 — 핵심은 셸 부작용 0.
      await sleep(100);
      const canaryExists = fs.existsSync(SHELL_CANARY);
      ok('G-SHELL 셸 메타문자 인자 → canary 미생성(셸 미실행)', canaryExists === false,
        `canaryExists=${canaryExists} handled=${r1.ok}`);

      // 정상 파일명에 NUL 인접 제어문자 — 거부(제어문자 차단).
      const r2 = JSON.parse((await api(info, 'POST', '/api/skill/run', { tool: 'lint-rng', args: { file: 'games/x' + String.fromCharCode(9) + 'y.js' } })).body);
      ok('G-SHELL 제어문자(탭) 경로 거부', r2.ok === false, `error=${r2.error}`);
    }

    // ── G-DISP: 창작 디스패치 왕복(현재 씬 문맥 포함) ───────────────────────────
    {
      // 에디터(창작형 트랙) → POST /api/chat 으로 씬 문맥을 포함한 창작 요청 enqueue.
      // (UI 가 현재 씬 요약을 메시지에 동봉 — 여기선 그 형식을 시뮬레이션.)
      const sceneSnap = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const ents = sceneSnap.scene.scenes[0].entities.map((e) => e.name).join(', ');
      const creativeMsg = '[창작 요청] 이 게임에 스토리를 입혀줘. (현재 씬 엔티티: ' + ents + ')';
      const chatRes = JSON.parse((await api(info, 'POST', '/api/chat', { text: creativeMsg })).body);
      ok('G-DISP 창작 요청 enqueue', chatRes.ok === true && chatRes.id >= 1, `id=${chatRes.id}`);

      // Claude(MCP) → editor_next_message 디큐 → 메시지에 씬 문맥(엔티티 이름)이 포함됐는지.
      const nextOut = parseToolResult(await mcp.rpc('tools/call', { name: 'editor_next_message', arguments: {} }, 6000));
      const got = nextOut.data && nextOut.data.message;
      ok('G-DISP editor_next_message 디큐(씬 문맥 포함)',
        got && got.text === creativeMsg && got.text.includes('현재 씬 엔티티') && got.text.includes(sceneSnap.scene.scenes[0].entities[0].name),
        `text=${got && got.text}`);
      const handledId = got && got.id;

      // Claude → editor_reply 왕복(처리 완료 응답).
      const replyOut = parseToolResult(await mcp.rpc('tools/call', { name: 'editor_reply', arguments: { text: '스토리를 입혔습니다.', replyTo: handledId } }));
      ok('G-DISP editor_reply 왕복', !replyOut.isError && replyOut.data && replyOut.data.ok === true, `seq=${replyOut.data && replyOut.data.seq}`);

      // [3A] 콘텐츠 디렉터 스킬(sprite-picker·story-architect·style-architect) 디스패치:
      //  에디터 SkillMenu 의 dispatchCreative 가 만드는 메시지 형식을 시뮬레이션한다 —
      //  스킬명을 머리에 명시 + 현재 씬 요약을 동봉해 챗 큐에 enqueue → Claude 가 디큐.
      const sceneSnap2 = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const ctx2 = sceneSnap2.scene.scenes[0].entities.map((e) => e.name).join(', ');
      const DIRECTOR_SKILLS = ['wgf-sprite-picker', 'wgf-story-architect', 'wgf-style-architect'];
      let dispatchedAll = true; const dispDetail = [];
      for (const skill of DIRECTOR_SKILLS) {
        const msg = '[창작 요청] ' + skill + ' 로 처리해줘.\n(현재 씬 문맥: ' + ctx2 + ')';
        const enq = JSON.parse((await api(info, 'POST', '/api/chat', { text: msg })).body);
        if (!(enq.ok === true && enq.id >= 1)) { dispatchedAll = false; dispDetail.push(skill + '=enqFail'); continue; }
        const deq = parseToolResult(await mcp.rpc('tools/call', { name: 'editor_next_message', arguments: {} }, 6000));
        const got = deq.data && deq.data.message;
        const okMsg = !!(got && got.text === msg && got.text.includes(skill) && got.text.includes('현재 씬 문맥'));
        dispDetail.push(skill + '=' + (okMsg ? 'ok' : 'BAD'));
        if (!okMsg) dispatchedAll = false;
      }
      ok('G-DISP 콘텐츠 디렉터 3종 디스패치(씬 요약 chat-queue enqueue→디큐)', dispatchedAll, dispDetail.join(' '));
    }

    // ── G-REF: 에셋 추가 → Sprite ref → lint-scene 통과(댕글링 아님) ─────────────
    {
      // 1) asset_add_procedural 로 절차 스프라이트 추가.
      const addOut = parseToolResult(await mcp.rpc('tools/call', { name: 'asset_add_procedural', arguments: { id: 'spr_dragged', desc: '드래그 배정 테스트 스프라이트', w: 16, h: 16 } }));
      ok('G-REF asset_add_procedural 추가', !addOut.isError && addOut.data && addOut.data.ok === true && addOut.data.asset.id === 'spr_dragged',
        `asset=${addOut.data && addOut.data.asset && addOut.data.asset.id}`);

      // 2) 현재 씬의 한 엔티티 id 확보.
      const snap = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const targetEnt = snap.scene.scenes[0].entities[0];
      ok('G-REF 대상 엔티티 확보', !!(targetEnt && targetEnt.id), `id=${targetEnt && targetEnt.id}`);

      // 3) 그 엔티티에 두 번째 Sprite 컴포넌트를 추가(드래그 배정 = sprite:그 자산 id).
      //    (applyCommand addComponent 경로 — 결정론 불변식 준수.)
      const compOut = parseToolResult(await mcp.rpc('tools/call', { name: 'scene_add_component', arguments: { id: targetEnt.id, component: { type: 'Sprite', sprite: 'spr_dragged' } } }));
      ok('G-REF Sprite(sprite=자산id) addComponent', !compOut.isError && compOut.data && compOut.data.ok === true, `seq=${compOut.data && compOut.data.seq}`);

      // 4) 현재 씬을 임시 직렬화해 lint-scene → exit 0(댕글링 ref 아님 — 자산이 선언돼 있음).
      const lintOut = parseToolResult(await mcp.rpc('tools/call', { name: 'skill_run_tool', arguments: { tool: 'lint-scene', args: { file: 'current', json: true } } }, 35000));
      const lj = lintOut.data && lintOut.data.json;
      ok('G-REF 직렬화 후 lint-scene exit 0(자산 ref 유효)',
        !lintOut.isError && lintOut.data && lintOut.data.exit === 0 && lj && lj.ok === true && lj.counts && lj.counts.error === 0,
        `exit=${lintOut.data && lintOut.data.exit} errors=${lj && lj.counts && lj.counts.error}`);

      // 음성 대조: 선언되지 않은 자산을 ref 하면 lint-scene 이 DANGLING_SPRITE_REF 로 fail 해야 한다.
      const compBad = parseToolResult(await mcp.rpc('tools/call', { name: 'scene_add_component', arguments: { id: targetEnt.id, component: { type: 'Sprite', sprite: 'spr_does_not_exist' } } }));
      const lintBad = parseToolResult(await mcp.rpc('tools/call', { name: 'skill_run_tool', arguments: { tool: 'lint-scene', args: { file: 'current', json: true } } }, 35000));
      const ljb = lintBad.data && lintBad.data.json;
      const hasDangling = ljb && Array.isArray(ljb.findings) && ljb.findings.some((f) => f.code === 'DANGLING_SPRITE_REF');
      ok('G-REF 음성 대조: 미선언 자산 ref → lint-scene fail(DANGLING_SPRITE_REF)',
        !compBad.isError && lintBad.data && lintBad.data.exit === 1 && hasDangling,
        `exit=${lintBad.data && lintBad.data.exit} dangling=${hasDangling}`);
    }

    // ── G-CC0: CC0 에셋 추가(url+license) → list 반영 ───────────────────────────
    {
      const addOut = parseToolResult(await mcp.rpc('tools/call', { name: 'asset_add_cc0', arguments: { id: 'spr_cc0', url: 'https://example.com/cc0/sprite.png', license: 'CC0-1.0', credit: 'Kenney', desc: 'CC0 테스트' } }));
      ok('G-CC0 asset_add_cc0 추가', !addOut.isError && addOut.data && addOut.data.ok === true && addOut.data.asset.source === 'cc0' && addOut.data.asset.url,
        `source=${addOut.data && addOut.data.asset && addOut.data.asset.source}`);

      const listOut = parseToolResult(await mcp.rpc('tools/call', { name: 'asset_list', arguments: {} }));
      const sprites = listOut.data && listOut.data.assets && listOut.data.assets.sprites;
      const hasCc0 = Array.isArray(sprites) && sprites.some((s) => s.id === 'spr_cc0' && s.source === 'cc0' && s.license === 'CC0-1.0');
      const hasProc = Array.isArray(sprites) && sprites.some((s) => s.id === 'spr_dragged' && s.source === 'procedural');
      ok('G-CC0 asset_list 에 절차·CC0 모두 반영', hasCc0 && hasProc, `count=${sprites && sprites.length} cc0=${hasCc0} proc=${hasProc}`);

      // url 없는 cc0 → 거부.
      const bad = parseToolResult(await mcp.rpc('tools/call', { name: 'asset_add_cc0', arguments: { id: 'spr_nourl', url: '' } }));
      ok('G-CC0 url 없는 cc0 거부', bad.isError === true || (bad.data && bad.data.ok === false), `isError=${bad.isError}`);

      // [보안 §6] 위험 스킴(javascript:·data:·file:) cc0 url → 거부(저장형 XSS 방지).
      const badJs = parseToolResult(await mcp.rpc('tools/call', { name: 'asset_add_cc0', arguments: { id: 'spr_xss1', url: 'javascript:alert(1)' } }));
      ok('G-CC0 javascript: 스킴 cc0 url 거부', badJs.isError === true || (badJs.data && badJs.data.ok === false), `isError=${badJs.isError}`);

      const badData = parseToolResult(await mcp.rpc('tools/call', { name: 'asset_add_cc0', arguments: { id: 'spr_xss2', url: 'data:text/html,<script>alert(1)</script>' } }));
      ok('G-CC0 data: 스킴 cc0 url 거부', badData.isError === true || (badData.data && badData.data.ok === false), `isError=${badData.isError}`);
    }

    // ── G-UNITY: 로컬 Unity 폴더 스캔·임포트 E2E ──────────────────────────────
    // 테스트 전용 임시 fixture 폴더를 생성해 브리지 기동 상태에서 scan→import 전 과정을 검증.
    // 테스트가 만든 vendored 파일·IMPORT_ATTESTATIONS.json 은 끝나고 정리(repo 오염 금지).
    {
      // -- fixture 폴더 구조 설계 --
      // ├── cc0_dir/
      // │   ├── cc0_sprite.png    (allowed — cc0_dir 의 LICENSE 가 CC0)
      // │   └── LICENSE           (CC0 문구 — cc0_sprite.png 에만 영향)
      // ├── warn_dir/
      // │   └── nolic.png         (warn — 라이선스 단서 없음)
      // └── mario.png             (blocked — IP 금칙)
      // 이렇게 폴더를 분리해야 cc0_dir/LICENSE 가 warn_dir/nolic.png 에 영향을 주지 않는다.
      const UNITY_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wgf-gunity-fix-'));
      const TINY_PNG = Buffer.from([
        0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
        0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
        0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
        0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
        0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,
        0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,
        0x00,0x00,0x02,0x00,0x01,0xE2,0x21,0xBC,
        0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
        0x44,0xAE,0x42,0x60,0x82
      ]);
      // cc0_dir: LICENSE(CC0) + cc0_sprite.png → allowed
      const cc0Dir = path.join(UNITY_TMP, 'cc0_dir');
      fs.mkdirSync(cc0Dir, { recursive: true });
      fs.writeFileSync(path.join(cc0Dir, 'cc0_sprite.png'), TINY_PNG);
      fs.writeFileSync(path.join(cc0Dir, 'LICENSE'), 'Creative Commons Zero v1.0 Universal\nCC0 1.0 Public Domain Dedication\n');
      // warn_dir: 라이선스 단서 없음 → nolic.png warn
      const warnDir = path.join(UNITY_TMP, 'warn_dir');
      fs.mkdirSync(warnDir, { recursive: true });
      fs.writeFileSync(path.join(warnDir, 'nolic.png'), TINY_PNG);
      // 루트에 mario.png → blocked(IP)
      fs.writeFileSync(path.join(UNITY_TMP, 'mario.png'), TINY_PNG);

      // currentGameDir() = scene.json 의 직계 부모(보안 LOW-1):
      // SCENE_REL='games/_editor-samples/topdown-min/scene.json'
      // → gameDir = games/_editor-samples/topdown-min
      // → importedDir = games/_editor-samples/topdown-min/assets/imported/
      const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');
      const gameSlugDir = path.join(REPO_ROOT, 'games', '_editor-samples', 'topdown-min');
      const importedDir = path.join(gameSlugDir, 'assets', 'imported');
      fs.mkdirSync(importedDir, { recursive: true });

      // 테스트 전 vendored 파일 목록 스냅샷(정리용)
      let preImportedFiles = [];
      try { preImportedFiles = fs.readdirSync(importedDir); } catch (e) { preImportedFiles = []; }
      const attestLogPath = path.join(gameSlugDir, 'IMPORT_ATTESTATIONS.json');
      let preAttest = null;
      try { preAttest = fs.readFileSync(attestLogPath, 'utf8'); } catch (e) { preAttest = null; }
      // export 스모크 산출물 위치(games/topdown-min/ — export 의 slug 기반 별도 outDir).
      // 테스트가 새로 만들면 정리해 작업트리 오염을 막는다(pre-existence 스냅샷).
      const exportOutDir = path.join(REPO_ROOT, 'games', 'topdown-min');
      const exportOutDirExisted = fs.existsSync(exportOutDir);

      try {
        // 1) MCP asset_scan_unity_folder — allowed·warn·blocked 분류 확인
        const scanOut = parseToolResult(await mcp.rpc('tools/call', {
          name: 'asset_scan_unity_folder',
          arguments: { folder: UNITY_TMP }
        }, 10000));
        ok('G-UNITY scan ok', !scanOut.isError && scanOut.data && scanOut.data.ok === true,
          `ok=${scanOut.data && scanOut.data.ok} err=${scanOut.isError}`);

        const items = scanOut.data && scanOut.data.items;
        const byRel = new Map((Array.isArray(items) ? items : []).map((i) => [i.relPath, i]));
        ok('G-UNITY scan cc0_dir/cc0_sprite.png → allowed',
          byRel.get('cc0_dir/cc0_sprite.png') && byRel.get('cc0_dir/cc0_sprite.png').status === 'allowed',
          `status=${byRel.get('cc0_dir/cc0_sprite.png') && byRel.get('cc0_dir/cc0_sprite.png').status}`);
        ok('G-UNITY scan warn_dir/nolic.png → warn',
          byRel.get('warn_dir/nolic.png') && byRel.get('warn_dir/nolic.png').status === 'warn',
          `status=${byRel.get('warn_dir/nolic.png') && byRel.get('warn_dir/nolic.png').status}`);
        ok('G-UNITY scan mario.png → blocked',
          byRel.get('mario.png') && byRel.get('mario.png').status === 'blocked',
          `status=${byRel.get('mario.png') && byRel.get('mario.png').status}`);

        // 2) warn-무attestation 거부: warn_dir/nolic.png, attestation 없음 → rejected
        const importBadAttest = parseToolResult(await mcp.rpc('tools/call', {
          name: 'asset_import_unity',
          arguments: {
            folder: UNITY_TMP,
            selections: [{ relPath: 'warn_dir/nolic.png', id: 'g_unity_noattest' }]
          }
        }, 10000));
        const nolicRejected = importBadAttest.isError
          ? true
          : (importBadAttest.data && Array.isArray(importBadAttest.data.rejected) &&
             importBadAttest.data.rejected.some((r) => r.relPath === 'warn_dir/nolic.png'));
        ok('G-UNITY warn 무attestation → rejected', nolicRejected,
          `isError=${importBadAttest.isError} rejected=${JSON.stringify(importBadAttest.data && importBadAttest.data.rejected)}`);

        // 3) blocked(mario) → rejected
        const importBlocked = parseToolResult(await mcp.rpc('tools/call', {
          name: 'asset_import_unity',
          arguments: {
            folder: UNITY_TMP,
            selections: [{ relPath: 'mario.png', id: 'g_unity_mario' }]
          }
        }, 10000));
        const marioRejected = importBlocked.isError
          ? true
          : (importBlocked.data && Array.isArray(importBlocked.data.rejected) &&
             importBlocked.data.rejected.some((r) => r.relPath === 'mario.png'));
        ok('G-UNITY blocked(mario) → rejected', marioRejected,
          `isError=${importBlocked.isError} rejected=${JSON.stringify(importBlocked.data && importBlocked.data.rejected)}`);

        // 4) allowed(cc0_dir/cc0_sprite.png) + warn(warn_dir/nolic.png)+attested → 둘 다 임포트
        const importOut = parseToolResult(await mcp.rpc('tools/call', {
          name: 'asset_import_unity',
          arguments: {
            folder: UNITY_TMP,
            selections: [
              { relPath: 'cc0_dir/cc0_sprite.png', id: 'g_unity_cc0' },
              { relPath: 'warn_dir/nolic.png', id: 'g_unity_nolic',
                attested: { owner: 'TestOwner', declaredLicense: 'user-owned' } }
            ]
          }
        }, 10000));
        ok('G-UNITY import ok', !importOut.isError && importOut.data && importOut.data.ok === true,
          `ok=${importOut.data && importOut.data.ok} isError=${importOut.isError}`);

        const added = importOut.data && Array.isArray(importOut.data.added) ? importOut.data.added : [];
        const rejected = importOut.data && Array.isArray(importOut.data.rejected) ? importOut.data.rejected : [];
        ok('G-UNITY import added 2개(allowed+attested warn)', added.length === 2,
          `added=${added.map((a) => a.id).join(',')} rejected=${rejected.map((r) => r.relPath).join(',')}`);
        ok('G-UNITY import rejected 0개', rejected.length === 0,
          `rejected=${JSON.stringify(rejected)}`);

        // added 레코드 검증: source='local', url, sha256
        const addedCc0 = added.find((a) => a.id === 'g_unity_cc0');
        const addedNolic = added.find((a) => a.id === 'g_unity_nolic');
        ok('G-UNITY added cc0 source=local', addedCc0 && addedCc0.source === 'local',
          `source=${addedCc0 && addedCc0.source}`);
        ok('G-UNITY added cc0 url 있음',
          addedCc0 && typeof addedCc0.url === 'string' && addedCc0.url.length > 0,
          `url=${addedCc0 && addedCc0.url}`);
        ok('G-UNITY added cc0 sha256 있음',
          addedCc0 && typeof addedCc0.sha256 === 'string' && addedCc0.sha256.length === 64,
          `sha256=${addedCc0 && addedCc0.sha256 && addedCc0.sha256.slice(0,8)}`);
        ok('G-UNITY added nolic attested 있음',
          addedNolic && addedNolic.attested && addedNolic.attested.owner === 'TestOwner',
          `attested=${JSON.stringify(addedNolic && addedNolic.attested)}`);

        // 5) asset_list 에 source:'local' 2개 반영
        const listOut2 = parseToolResult(await mcp.rpc('tools/call', { name: 'asset_list', arguments: {} }));
        const sprites2 = listOut2.data && listOut2.data.assets && listOut2.data.assets.sprites;
        const localSprites = Array.isArray(sprites2) ? sprites2.filter((s) => s.source === 'local') : [];
        ok('G-UNITY asset_list source:local 2개 반영', localSprites.length >= 2,
          `localCount=${localSprites.length} ids=${localSprites.map((s) => s.id).join(',')}`);

        // 6) vendored 파일이 games/_editor-samples/topdown-min/assets/imported/ 에 실제 존재
        //    (잔여물에 견고하도록 API 가 보고한 url 위치의 파일 존재로 단언 — pre/post 차집합 대신.)
        const vfCc0 = addedCc0 && addedCc0.url && fs.existsSync(path.join(REPO_ROOT, addedCc0.url.split('/').join(path.sep)));
        const vfNolic = addedNolic && addedNolic.url && fs.existsSync(path.join(REPO_ROOT, addedNolic.url.split('/').join(path.sep)));
        ok('G-UNITY vendored 파일 2개 신규 존재', !!(vfCc0 && vfNolic),
          `cc0=${!!vfCc0} nolic=${!!vfNolic} importedDir=${importedDir}`);

        // 7) IMPORT_ATTESTATIONS.json 에 attested 항목 기록됐는지
        let attestAfter = null;
        try { attestAfter = JSON.parse(fs.readFileSync(attestLogPath, 'utf8')); } catch (e) { attestAfter = null; }
        const attestHasNolic = Array.isArray(attestAfter) &&
          attestAfter.some((a) => a.owner === 'TestOwner' && a.declaredLicense === 'user-owned');
        ok('G-UNITY IMPORT_ATTESTATIONS.json 에 attested 항목 기록', attestHasNolic,
          `entries=${attestAfter && attestAfter.length} found=${attestHasNolic}`);

        // 8) export.mjs 직접 spawn → CREDITS.txt 에 "임포트 자산" + "사용자 권리 보유 선언" 포함
        // 현재 브리지가 편집 중인 씬: games/_editor-samples/topdown-min/scene.json
        // export.mjs 는 scene.json 에서 assets 를 직접 읽는다(브리지 인메모리 아님).
        // 따라서 임포트된 에셋 레코드를 scene.json 에 직접 패치 후 export 한다.
        {
          const sceneFile = path.join(REPO_ROOT, 'games', '_editor-samples', 'topdown-min', 'scene.json');
          let sceneDoc, origSceneRaw = null;
          try { origSceneRaw = fs.readFileSync(sceneFile, 'utf8'); sceneDoc = JSON.parse(origSceneRaw); } catch (e) { sceneDoc = null; }
          let creditsText = '';
          if (sceneDoc) {
            // scene.json 에 local 에셋 임시 주입(복원은 origSceneRaw 바이트로).
            if (!sceneDoc.assets) sceneDoc.assets = {};
            if (!Array.isArray(sceneDoc.assets.sprites)) sceneDoc.assets.sprites = [];
            sceneDoc.assets.sprites.push({
              id: 'g_unity_cc0_exp', source: 'local',
              url: addedCc0 ? addedCc0.url : 'games/_editor-samples/topdown-min/assets/imported/g_unity_cc0.png',
              license: 'CC0', credit: '', desc: '원본: cc0_dir/cc0_sprite.png'
            });
            sceneDoc.assets.sprites.push({
              id: 'g_unity_nolic_exp', source: 'local',
              url: addedNolic ? addedNolic.url : 'games/_editor-samples/topdown-min/assets/imported/g_unity_nolic.png',
              license: 'user-owned', credit: '', desc: '원본: warn_dir/nolic.png',
              attested: { owner: 'TestOwner', declaredLicense: 'user-owned', at: new Date().toISOString() }
            });
            fs.writeFileSync(sceneFile, JSON.stringify(sceneDoc, null, 2), 'utf8');
            try {
              // spawn export.mjs
              const expResult = await new Promise((resolve) => {
                const child = spawn(process.execPath, [path.join(SERVER_DIR, 'export.mjs'), sceneFile], {
                  env: process.env, stdio: ['ignore', 'pipe', 'pipe']
                });
                let out = '';
                child.stdout.on('data', (c) => { out += c.toString(); });
                child.stderr.on('data', (c) => { out += c.toString(); });
                child.on('exit', () => { resolve(out); });
                setTimeout(() => { try { child.kill(); } catch(e){} resolve(out); }, 15000);
              });
              // export outDir: games/topdown-min/CREDITS.txt
              const creditsPath = path.join(REPO_ROOT, 'games', 'topdown-min', 'CREDITS.txt');
              try { creditsText = fs.readFileSync(creditsPath, 'utf8'); } catch (e) { creditsText = ''; }
            } catch (e) { creditsText = ''; }
            // scene.json 원상복구 — 원본 바이트 그대로(포맷·개행 보존, git diff 잔여 방지).
            if (origSceneRaw !== null) fs.writeFileSync(sceneFile, origSceneRaw, 'utf8');
          }
          ok('G-UNITY export CREDITS.txt 임포트 자산 섹션 포함',
            creditsText.includes('임포트 자산'),
            `has=${creditsText.includes('임포트 자산')}`);
          ok('G-UNITY export CREDITS.txt 사용자 권리 보유 선언 포함',
            creditsText.includes('사용자 권리 보유 선언'),
            `has=${creditsText.includes('사용자 권리 보유 선언')}`);
        }

      } finally {
        // -- 테스트 정리: fixture 폴더 제거 + vendored 파일 삭제 + attestation 원상복구 --
        try { fs.rmSync(UNITY_TMP, { recursive: true, force: true }); } catch (e) {}
        try {
          const afterFiles = fs.readdirSync(importedDir);
          for (const f of afterFiles.filter((f) => !preImportedFiles.includes(f))) {
            try { fs.unlinkSync(path.join(importedDir, f)); } catch (e) {}
          }
        } catch (e) {}
        try {
          if (preAttest === null) { try { fs.unlinkSync(attestLogPath); } catch (e) {} }
          else { fs.writeFileSync(attestLogPath, preAttest, 'utf8'); }
        } catch (e) {}
        // export 스모크 산출물(games/topdown-min/) — 테스트가 새로 만들었으면 제거(작업트리 위생).
        try { if (!exportOutDirExisted) fs.rmSync(exportOutDir, { recursive: true, force: true }); } catch (e) {}
        // asset_list 추가 local 에셋은 브리지 인메모리 → 프로세스 종료와 함께 사라짐
      }
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
