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
