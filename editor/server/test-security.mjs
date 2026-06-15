#!/usr/bin/env node
/* ============================================================================
 * WGF Studio P5 보안 게이트 하니스 — 신뢰경계 검증 (zero-dep)
 * ----------------------------------------------------------------------------
 * bridge.mjs 를 임의 빈 포트(WGF_BRIDGE_PORT=0)로 임시 디렉터리 격리(ENDPOINT/CHAT
 * 파일을 tmp 로 지정)해 spawn 하고, stderr 의 `[wgf-bridge] READY {json}` 라인에서
 * port·token·host 를 회수해 설계서 §6 보안 신뢰경계를 실제 실행 검증한다.
 * test-bridge.mjs 의 spawn+READY 파싱·request/api 헬퍼 방식을 그대로 차용한다.
 *
 * 검사(각각 pass/fail):
 *   1. 바인딩    : READY host=127.0.0.1 + 127.0.0.1:port GET /api/status 200(LAN 비노출).
 *   2. traversal : 인코딩/raw ../ + dotfile(.git) 정적 GET → 전부 403/404(200 아님).
 *   3. 명령주입  : POST /api/skill/run 로 (a) rm·(b) node 화이트리스트 거부,
 *                  (c) lint-scene 인자에 셸 메타문자/세미콜론 경로 → 경로거부 4xx +
 *                  리포 루트에 CANARY 미생성(execFile 셸 미경유 증명).
 *   4. 토큰      : (a) 토큰 없음 → 401, (b) 길이 다른 잘못된 토큰 → 401 + 브리지 생존
 *                  (timing-safe 길이불일치 throw 안 함 증명), (c) 같은 길이 다른 토큰 → 401.
 *   5. Origin    : 정상 토큰 + Origin http://evil.com → 403.
 *   6. 파일권한  : (POSIX 한정) endpoint 파일 stat.mode & 0o077 === 0. win32 면 platform-skip.
 *
 * 사용: node editor/server/test-security.mjs
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

const checks = [];
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  const passed = !!cond;
  checks.push({ name, ok: passed, detail: detail || '' });
  if (passed) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 임시 작업 디렉터리(엔드포인트·챗 큐 격리) ──────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wgf-sec-test-'));
const ENDPOINT_FILE = path.join(TMP, 'bridge-endpoint.json');
const CHAT_FILE = path.join(TMP, 'chat-queue.json');
function cleanupTmp() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }

// 명령주입 검사용 카나리(셸이 도구를 실행했다면 생성되는 마커). 절대 생성되면 안 됨.
// 리포 루트에 생성 시도(인자가 'games/x; touch CANARY_SEC.txt' 형태) → 셸 미경유면 부재.
const CANARY_NAME = 'CANARY_SEC.txt';
const CANARY_PATH = path.join(REPO_ROOT, CANARY_NAME);
function cleanupCanary() { try { fs.rmSync(CANARY_PATH, { force: true }); } catch (e) {} }

// ── 브리지 spawn + READY 파싱(test-bridge.mjs 동일 방식) ──────────────────────
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

// 토큰·Origin 자동 부착 API 요청(정상 클라 시뮬레이션).
function api(info, method, p, bodyObj, extraHeaders) {
  const body = bodyObj != null ? JSON.stringify(bodyObj) : null;
  const headers = Object.assign({
    'X-WGF-Token': info.token,
    'Origin': `http://127.0.0.1:${info.port}`
  }, body != null ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}, extraHeaders || {});
  return request({ host: '127.0.0.1', port: info.port, path: p, method, headers }, body);
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  let bridge;
  try { bridge = await startBridge(); }
  catch (e) { ok('브리지 기동', false, String(e)); finish(); return; }
  const { child, info } = bridge;
  ok('브리지 기동(READY 파싱)', info && info.port > 0 && typeof info.token === 'string' && info.token.length >= 16,
    `port=${info.port}`);

  // 검사 시작 전 혹시 남은 카나리 정리.
  cleanupCanary();

  try {
    // ── 1. 바인딩(127.0.0.1 전용 — LAN 비노출) ─────────────────────────────────
    {
      // READY 가 보고한 host 가 127.0.0.1 이어야 한다(0.0.0.0 금지 — LAN 노출 방지).
      ok('1-a READY host=127.0.0.1(LAN 비노출)', info.host === '127.0.0.1', `host=${info.host}`);

      // 127.0.0.1:port 로 토큰 포함 GET /api/status → 200(로컬 정상 접근).
      const st = await api(info, 'GET', '/api/status');
      ok('1-b 127.0.0.1 로컬 GET /api/status 200', st.status === 200, `status=${st.status}`);
    }

    // ── 2. path-traversal / dotfile 차단(정적 서빙은 토큰 불요 — 토큰 없이 호출) ──
    {
      // 인코딩된 ../ — 닷세그먼트/루트 밖 정규화 → 403/404(200 아님).
      const enc = await request({ host: '127.0.0.1', port: info.port, path: '/..%2f..%2f..%2fetc%2fpasswd', method: 'GET' });
      ok('2-a 인코딩 traversal 차단(403/404, 200 아님)', enc.status === 403 || enc.status === 404, `status=${enc.status}`);

      // raw ../ — 정규화 후 루트 밖 → 403/404.
      const raw = await request({ host: '127.0.0.1', port: info.port, path: '/../../../etc/passwd', method: 'GET' });
      ok('2-b raw traversal 차단(403/404)', raw.status === 403 || raw.status === 404, `status=${raw.status}`);

      // dotfile(.git/config) — 닷세그먼트 차단 → 403(200 아님).
      const dot = await request({ host: '127.0.0.1', port: info.port, path: '/.git/config', method: 'GET' });
      ok('2-c dotfile(.git) 차단(403/404)', dot.status === 403 || dot.status === 404, `status=${dot.status}`);
    }

    // ── 3. 명령주입 방어(화이트리스트 + execFile 셸 미경유) ──────────────────────
    {
      // (a) 'rm' — 화이트리스트 외 → 403 거부(실행 안 됨).
      const rmRes = await api(info, 'POST', '/api/skill/run', { tool: 'rm', args: {} });
      const rmBody = JSON.parse(rmRes.body);
      ok('3-a rm 화이트리스트 거부(403)', rmRes.status === 403 && rmBody.ok === false, `status=${rmRes.status}`);

      // (b) 'node' — 화이트리스트 외 → 403 거부.
      const nodeRes = await api(info, 'POST', '/api/skill/run', { tool: 'node', args: {} });
      const nodeBody = JSON.parse(nodeRes.body);
      ok('3-b node 화이트리스트 거부(403)', nodeRes.status === 403 && nodeBody.ok === false, `status=${nodeRes.status}`);

      // (c) lint-scene 인자에 셸 메타문자(;) + traversal(../) 결합 경로 → 경로거부 4xx.
      //     '../' 로 리포 범위를 벗어나므로 resolveScopedPath 가 확실히 거부한다(범위 밖).
      //     세미콜론은 경로 문자로 합법이라 execFile 인자라면 무해하나(셸 미경유), 여기서는
      //     traversal 결합으로 경로검증이 4xx 로 막는 경로를 단언한다.
      const evilTraversal = '../x; touch ' + CANARY_NAME;
      const injRes = await api(info, 'POST', '/api/skill/run', { tool: 'lint-scene', args: { file: evilTraversal } });
      const injBody = JSON.parse(injRes.body);
      ok('3-c 셸 메타문자+traversal 경로 거부(4xx)',
        injRes.status >= 400 && injRes.status < 500 && injBody.ok === false,
        `status=${injRes.status} error=${injBody.error}`);

      // (d) 셸 미경유 증명: 세미콜론 경로가 경로검증을 통과(리포 내 합법 파일명)하더라도
      //     execFile(배열 인자)은 셸을 거치지 않으므로 ';' 이후 'touch' 가 실행되지 않는다.
      //     'games/x; touch CANARY' 는 그런 이름의 파일이 없어 도구가 fail 하되 셸 부작용 0.
      const inRepoSemicolon = 'games/x; touch ' + CANARY_NAME;
      await api(info, 'POST', '/api/skill/run', { tool: 'lint-scene', args: { file: inRepoSemicolon } });

      // 셸 부작용 0 검증: 두 경로 어느 쪽으로도 카나리가 생성되지 않아야 함(execFile 셸 미경유).
      await sleep(120);
      const canaryExists = fs.existsSync(CANARY_PATH);
      ok('3-d CANARY 미생성(execFile 셸 미경유 증명)', canaryExists === false, `canaryExists=${canaryExists}`);
      if (canaryExists) cleanupCanary();   // 혹시 생겼으면 즉시 정리(테스트 잔류 방지)
    }

    // ── 4. 토큰 검사(timing-safe — 길이 불일치 throw 안 함) ──────────────────────
    {
      // (a) 토큰 없이 /api/scene → 401.
      const noTok = await request({
        host: '127.0.0.1', port: info.port, path: '/api/scene', method: 'GET',
        headers: { 'Origin': `http://127.0.0.1:${info.port}` }
      });
      ok('4-a 토큰 없음 → 401', noTok.status === 401, `status=${noTok.status}`);

      // (b) 길이 다른 잘못된 토큰("deadbeef") → 401 이고 브리지 미crash.
      //     safeEqual 이 길이 불일치 시 throw 없이 false 를 반환함을 증명(timingSafeEqual 회피).
      const shortTok = await request({
        host: '127.0.0.1', port: info.port, path: '/api/scene', method: 'GET',
        headers: { 'X-WGF-Token': 'deadbeef', 'Origin': `http://127.0.0.1:${info.port}` }
      });
      ok('4-b 길이 다른 잘못된 토큰 → 401', shortTok.status === 401, `status=${shortTok.status}`);

      // 이어서 정상 토큰 호출 200 — 브리지가 (b) 로 죽지 않고 생존함을 확인(길이불일치 throw 0).
      const alive = await api(info, 'GET', '/api/scene');
      ok('4-b2 길이 불일치 후 브리지 생존(정상 토큰 200)',
        alive.status === 200 && child.exitCode == null, `status=${alive.status} exitCode=${child.exitCode}`);

      // (c) 같은 길이 다른 토큰(TOKEN 과 동일 길이 hex) → 401.
      //     모든 바이트가 다르되 길이는 같은 hex 를 만들어 상수시간 비교가 false 를 반환하는지.
      const sameLenBad = info.token.replace(/[0-9a-f]/g, (ch) => (ch === '0' ? '1' : '0'));
      const sameLen = await request({
        host: '127.0.0.1', port: info.port, path: '/api/scene', method: 'GET',
        headers: { 'X-WGF-Token': sameLenBad, 'Origin': `http://127.0.0.1:${info.port}` }
      });
      ok('4-c 같은 길이 다른 토큰 → 401',
        sameLen.status === 401 && sameLenBad.length === info.token.length,
        `status=${sameLen.status} len=${sameLenBad.length}/${info.token.length}`);
    }

    // ── 5. Origin 검사(정상 토큰이어도 외부 Origin 거부) ────────────────────────
    {
      const evilOrigin = await request({
        host: '127.0.0.1', port: info.port, path: '/api/scene', method: 'GET',
        headers: { 'X-WGF-Token': info.token, 'Origin': 'http://evil.com' }
      });
      ok('5 정상 토큰 + Origin evil.com → 403', evilOrigin.status === 403, `status=${evilOrigin.status}`);
    }

    // ── 5.5 신규 /api/screenshot* 엔드포인트 신뢰경계(2B) ───────────────────────
    // 새 캡처 엔드포인트도 /api/* 전 구간 가드(토큰·Origin)를 동일 적용받아야 한다.
    //  또한 셸 미경유 불변식 보존 — 이 엔드포인트는 execFile 을 호출하지 않으므로 셸 표면 0.
    {
      // (a) GET /api/screenshot/capture — 토큰 없음 → 401.
      const capNoTok = await request({
        host: '127.0.0.1', port: info.port, path: '/api/screenshot/capture', method: 'GET',
        headers: { 'Origin': `http://127.0.0.1:${info.port}` }
      });
      ok('5.5-a /api/screenshot/capture 토큰 없음 → 401', capNoTok.status === 401, `status=${capNoTok.status}`);

      // (b) GET /api/screenshot/capture — 정상 토큰 + 외부 Origin(evil.com) → 403.
      const capEvil = await request({
        host: '127.0.0.1', port: info.port, path: '/api/screenshot/capture', method: 'GET',
        headers: { 'X-WGF-Token': info.token, 'Origin': 'http://evil.com' }
      });
      ok('5.5-b /api/screenshot/capture 외부 Origin → 403', capEvil.status === 403, `status=${capEvil.status}`);

      // (c) POST /api/screenshot — 토큰 없음 → 401(회신 위조 차단).
      const postNoTok = await request({
        host: '127.0.0.1', port: info.port, path: '/api/screenshot', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': `http://127.0.0.1:${info.port}` }
      }, JSON.stringify({ requestId: 'x', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }));
      ok('5.5-c POST /api/screenshot 토큰 없음 → 401', postNoTok.status === 401, `status=${postNoTok.status}`);

      // (d) POST /api/screenshot — 정상 토큰 + 외부 Origin → 403.
      const postEvil = await request({
        host: '127.0.0.1', port: info.port, path: '/api/screenshot', method: 'POST',
        headers: { 'X-WGF-Token': info.token, 'Content-Type': 'application/json', 'Origin': 'http://evil.com' }
      }, JSON.stringify({ requestId: 'x', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }));
      ok('5.5-d POST /api/screenshot 외부 Origin → 403', postEvil.status === 403, `status=${postEvil.status}`);

      // (e) 정상 토큰+Origin POST 인데 미매칭 requestId → 404(pending 없음). 임의 회신이
      //     캡처를 가로채지 못함(서버 발급 requestId 만 매칭).
      const postBadId = await api(info, 'POST', '/api/screenshot', { requestId: 'no-such-request', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
      ok('5.5-e 미매칭 requestId 회신 → 404', postBadId.status === 404, `status=${postBadId.status}`);

      // (f) 비-PNG dataUrl(스크립트 data: 스킴) → 400 거부(저장형 XSS·위장 페이로드 차단).
      //     매칭 requestId 가 없어도 형식 검증이 선행되어야 하므로 404 이전에 400 이 나야 한다.
      const postBadFmt = await api(info, 'POST', '/api/screenshot', { requestId: 'x', dataUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' });
      ok('5.5-f 비-PNG dataUrl → 400 거부', postBadFmt.status === 400, `status=${postBadFmt.status}`);

      // (g) PNG 시그니처 위장(헤더만 PNG MIME, 본문은 PNG 매직넘버 아님) → 400 거부.
      const fakePngB64 = Buffer.from('not a real png payload').toString('base64');
      const postFakeSig = await api(info, 'POST', '/api/screenshot', { requestId: 'x', dataUrl: 'data:image/png;base64,' + fakePngB64 });
      ok('5.5-g PNG 시그니처 위장 → 400 거부', postFakeSig.status === 400, `status=${postFakeSig.status}`);

      // (h) 셸 미경유 불변식 보존: 캡처 엔드포인트 호출 후에도 CANARY 미생성(execFile 표면 0).
      //     (구독자 없으므로 capture 는 즉시 headless 200 ok:false — 셸 동작 없음.)
      await api(info, 'GET', '/api/screenshot/capture');
      await sleep(60);
      const canaryAfterShot = fs.existsSync(CANARY_PATH);
      ok('5.5-h 캡처 엔드포인트 셸 미경유(CANARY 미생성)', canaryAfterShot === false, `canaryExists=${canaryAfterShot}`);
    }

    // ── 6. 토큰 파일 권한(POSIX 한정: 0o600 — 다른 로컬 사용자 비노출) ────────────
    {
      if (process.platform === 'win32') {
        // Windows 에서 POSIX mode 비트는 신뢰할 수 없음 → 중립 pass(platform-skip).
        ok('6 endpoint 파일 권한 0o600(POSIX)', true, 'platform-skip(win32 — POSIX mode 비적용)');
      } else {
        let mode = null;
        try { mode = fs.statSync(ENDPOINT_FILE).mode; } catch (e) { /* 부재 */ }
        // stat.mode & 0o077 === 0 : group/other 권한 비트가 모두 0(소유자 전용).
        const restricted = mode != null && (mode & 0o077) === 0;
        ok('6 endpoint 파일 권한 0o600(POSIX)', restricted,
          `mode=${mode != null ? '0o' + (mode & 0o777).toString(8) : 'null'}`);
      }
    }

  } catch (e) {
    ok('테스트 실행 예외', false, String(e && e.stack || e));
  } finally {
    try { child.kill(); } catch (e) {}
    await sleep(50);
    cleanupCanary();   // 혹시 남았으면 최종 정리(리포 루트 오염 방지)
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
