#!/usr/bin/env node
/* ============================================================================
 * WGF Studio 브리지 통합 테스트 하니스 — P2 게이트 (zero-dep)
 * ----------------------------------------------------------------------------
 * bridge.mjs 를 임의 빈 포트(WGF_BRIDGE_PORT=0)로 spawn 해 실제 포트·토큰을
 * stderr READY 라인에서 파싱하고, Node 빌트인 http 클라이언트 + 간이 SSE 리더로
 * 설계서 §5 P2 게이트를 실제 실행 검증한다.
 *
 * 게이트:
 *   G1 커맨드 POST→SSE 델타 라운드트립(같은 seq 델타 수신 + 스냅샷 반영)
 *   G2 Play 중 edit 커맨드 거부(mode=play 후 POST /api/command → 409)
 *   G3 SSE 끊김→Last-Event-ID 무손실 복구(끊은 뒤 추가 커맨드 → 재연결 시 누락분 전부)
 *   G4 백프레셔(느린 소비자 — 버퍼 무한적체 없음, 가능 시 resync 발행 확인)
 *   G5 path-traversal 차단(GET /../ · 인코딩 → 403/404)
 *   G6 토큰/Origin(토큰 없음→401, 잘못된 Origin→403)
 *
 * 사용: node editor/server/test-bridge.mjs
 * 출력: 사람용 줄 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
 * 종료코드: 전부 통과 0, 하나라도 실패 1.
 * ==========================================================================*/
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(SERVER_DIR, 'bridge.mjs');

const checks = [];
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  const passed = !!cond;
  checks.push({ name, ok: passed, detail: detail || '' });
  if (passed) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── 브리지 spawn + READY 파싱 ─────────────────────────────────────────────────
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
        done = true;
        clearTimeout(timer);
        let info;
        try { info = JSON.parse(m[1]); } catch (e) { reject(e); return; }
        resolve({ child, info });
      }
    });
    child.on('exit', (code) => { if (!done) { done = true; clearTimeout(timer); reject(new Error('브리지 조기 종료 code=' + code)); } });
  });
}

// ── HTTP 요청 헬퍼 ────────────────────────────────────────────────────────────
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

// 편의: 토큰·Origin 자동 부착 API 요청.
function api(info, method, p, bodyObj, extraHeaders) {
  const body = bodyObj != null ? JSON.stringify(bodyObj) : null;
  const headers = Object.assign({
    'X-WGF-Token': info.token,
    'Origin': `http://127.0.0.1:${info.port}`
  }, body != null ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}, extraHeaders || {});
  return request({ host: '127.0.0.1', port: info.port, path: p, method, headers }, body);
}

// ── 간이 SSE 리더 ─────────────────────────────────────────────────────────────
// 토큰을 ?token= 쿼리로, Last-Event-ID 를 헤더로 보낼 수 있다. onEvent(evt) 콜백.
function openSSE(info, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const headers = { 'Accept': 'text/event-stream', 'Origin': `http://127.0.0.1:${info.port}` };
    if (opts.lastEventId != null) headers['Last-Event-ID'] = String(opts.lastEventId);
    const tokenQ = opts.noToken ? '' : ('?token=' + encodeURIComponent(info.token));
    const req = http.request({
      host: '127.0.0.1', port: info.port, path: '/api/events' + tokenQ, method: 'GET', headers
    }, (res) => {
      if (res.statusCode !== 200) {
        let body = ''; res.on('data', (c) => body += c);
        res.on('end', () => resolve({ status: res.statusCode, body, events: [], close: () => req.destroy() }));
        return;
      }
      const handle = {
        status: 200,
        events: [],        // 파싱된 데이터 이벤트 {seq, type, ...}
        resyncCount: 0,
        raw: '',
        res,
        close: () => { try { req.destroy(); } catch (e) {} },
        onEvent: opts.onEvent || null,
        pause: () => res.pause(),
        resume: () => res.resume()
      };
      let sseBuf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        handle.raw += chunk;
        sseBuf += chunk;
        let idx;
        while ((idx = sseBuf.indexOf('\n\n')) >= 0) {
          const rawEvt = sseBuf.slice(0, idx);
          sseBuf = sseBuf.slice(idx + 2);
          parseEvent(handle, rawEvt);
        }
      });
      resolve(handle);
    });
    req.on('error', (e) => { if (!opts.tolerateError) reject(e); });
    req.end();
  });
}

function parseEvent(handle, rawEvt) {
  let eventName = 'message';
  let dataLines = [];
  for (const line of rawEvt.split('\n')) {
    if (line.startsWith(':')) continue;            // 코멘트(connected 등)
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  let obj;
  try { obj = JSON.parse(dataLines.join('\n')); } catch (e) { return; }
  if (eventName === 'resync') { handle.resyncCount++; }
  handle.events.push(obj);
  if (handle.onEvent) try { handle.onEvent(obj, eventName); } catch (e) {}
}

// 멈춘 SSE 소비자 — 응답 본문을 읽지 않고 paused 로 둔다(서버 writableLength 누적 유도).
// consume() 를 호출하면 그때까지 흘러온 데이터를 파싱해 resyncCount 등을 갱신·반환한다.
function openStalledSSE(info) {
  const headers = { 'Accept': 'text/event-stream', 'Origin': `http://127.0.0.1:${info.port}` };
  const out = { state: { resyncCount: 0, events: [] }, _started: false };
  let sseBuf = '';
  const handle = {
    resyncCount: 0, events: [],   // parseEvent 가 채울 필드
  };
  const req = http.request({
    host: '127.0.0.1', port: info.port,
    path: '/api/events?token=' + encodeURIComponent(info.token), method: 'GET', headers
  }, (res) => {
    res.setEncoding('utf8');
    res.pause();                  // 흐름 정지 — 본문을 읽지 않음(서버 송신 버퍼 누적).
    out._res = res;
    out._onData = (chunk) => {
      sseBuf += chunk;
      let idx;
      while ((idx = sseBuf.indexOf('\n\n')) >= 0) {
        const rawEvt = sseBuf.slice(0, idx);
        sseBuf = sseBuf.slice(idx + 2);
        parseEvent(handle, rawEvt);
      }
      out.state.resyncCount = handle.resyncCount;
      out.state.events = handle.events;
    };
  });
  req.on('error', () => {});
  req.end();
  out.consume = () => {
    // 멈춘 응답을 흘려 그동안 버퍼된 데이터를 모두 파싱.
    if (out._res && !out._started) {
      out._started = true;
      out._res.on('data', out._onData);
      out._res.resume();
    }
    return out.state;
  };
  out.close = () => { try { req.destroy(); } catch (e) {} };
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 조건 충족까지 폴링(타임아웃 가드).
async function waitFor(fn, timeoutMs, intervalMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeoutMs || 3000)) {
    if (fn()) return true;
    await sleep(intervalMs || 20);
  }
  return false;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  let bridge;
  try {
    bridge = await startBridge();
  } catch (e) {
    ok('브리지 기동', false, String(e));
    finish();
    return;
  }
  const { child, info } = bridge;
  ok('브리지 기동(READY 파싱)', info && info.port > 0 && typeof info.token === 'string' && info.token.length >= 16,
    `port=${info.port}`);

  try {
    // ── G1 커맨드 POST→SSE 델타 라운드트립 ─────────────────────────────────────
    {
      const sse = await openSSE(info);
      ok('G1-pre SSE 연결', sse.status === 200, `status=${sse.status}`);

      // 초기 스냅샷 — entities 2개(topdown-min).
      const snap0 = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const ents0 = snap0.scene.scenes[0].entities.length;
      ok('G1-0 초기 스냅샷 entities=2', ents0 === 2, `actual=${ents0}`);

      // addEntity 커맨드 POST.
      const cmd = { type: 'addEntity', entity: { name: 'g1-new', transform: { x: 50, y: 60 }, components: [] } };
      const postRes = await api(info, 'POST', '/api/command', { command: cmd });
      const postBody = JSON.parse(postRes.body);
      ok('G1-1 POST /api/command ok + seq', postRes.status === 200 && postBody.ok === true && postBody.seq >= 1,
        `status=${postRes.status} seq=${postBody.seq}`);

      // SSE 로 같은 seq 의 command 델타 수신.
      const got = await waitFor(() => sse.events.some((e) => e.type === 'command' && e.seq === postBody.seq), 2000);
      const delta = sse.events.find((e) => e.type === 'command' && e.seq === postBody.seq);
      ok('G1-2 SSE 델타 수신(같은 seq)', got && delta && delta.command && delta.command.type === 'addEntity',
        `delta=${JSON.stringify(delta && delta.command && delta.command.type)}`);

      // 스냅샷에 반영(entities 3개).
      const snap1 = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const ents1 = snap1.scene.scenes[0].entities.length;
      ok('G1-3 스냅샷 반영 entities=3', ents1 === 3, `actual=${ents1}`);

      sse.close();
      await sleep(50);
    }

    // ── G2 Play 중 edit 커맨드 거부 ────────────────────────────────────────────
    {
      const modeRes = await api(info, 'POST', '/api/mode', { mode: 'play' });
      ok('G2-1 mode=play 전환', modeRes.status === 200 && JSON.parse(modeRes.body).mode === 'play',
        `status=${modeRes.status}`);

      const cmd = { type: 'addEntity', entity: { name: 'g2-blocked', transform: { x: 0, y: 0 }, components: [] } };
      const blocked = await api(info, 'POST', '/api/command', { command: cmd });
      ok('G2-2 Play 중 command → 409', blocked.status === 409, `status=${blocked.status}`);

      const undoBlocked = await api(info, 'POST', '/api/undo');
      ok('G2-3 Play 중 undo → 409', undoBlocked.status === 409, `status=${undoBlocked.status}`);

      // edit 복귀 — 이후 게이트는 edit 권위에서.
      const back = await api(info, 'POST', '/api/mode', { mode: 'edit' });
      ok('G2-4 mode=edit 복귀', back.status === 200 && JSON.parse(back.body).mode === 'edit', `status=${back.status}`);
    }

    // ── G3 SSE 끊김 → Last-Event-ID 무손실 복구 ────────────────────────────────
    {
      // 첫 SSE 연결로 이벤트 N개 받기.
      const sseA = await openSSE(info);
      const c1 = { type: 'addEntity', entity: { name: 'g3-a', transform: { x: 10, y: 10 }, components: [] } };
      const r1 = JSON.parse((await api(info, 'POST', '/api/command', { command: c1 })).body);
      await waitFor(() => sseA.events.some((e) => e.seq === r1.seq), 2000);
      const lastSeen = r1.seq;
      ok('G3-1 첫 연결 델타 수신', sseA.events.some((e) => e.seq === lastSeen), `lastSeen=${lastSeen}`);

      // 끊는다.
      sseA.close();
      await sleep(80);

      // 끊긴 동안 추가 커맨드 2개 — SSE 구독자 없이도 단일 진실은 진행.
      const c2 = { type: 'addEntity', entity: { name: 'g3-b', transform: { x: 20, y: 20 }, components: [] } };
      const r2 = JSON.parse((await api(info, 'POST', '/api/command', { command: c2 })).body);
      const c3 = { type: 'addEntity', entity: { name: 'g3-c', transform: { x: 30, y: 30 }, components: [] } };
      const r3 = JSON.parse((await api(info, 'POST', '/api/command', { command: c3 })).body);

      // Last-Event-ID=lastSeen 으로 재연결 → 누락분(r2, r3) 전부 재수신.
      const sseB = await openSSE(info, { lastEventId: lastSeen });
      const recovered = await waitFor(() =>
        sseB.events.some((e) => e.seq === r2.seq) && sseB.events.some((e) => e.seq === r3.seq), 2000);
      ok('G3-2 Last-Event-ID 누락 델타 무손실 복구',
        recovered,
        `r2=${r2.seq} r3=${r3.seq} seen=${sseB.events.map((e) => e.seq).join(',')}`);

      // 재연결 클라가 lastSeen 이하 이벤트는 안 받음(중복 없음).
      const noDup = !sseB.events.some((e) => e.seq <= lastSeen);
      ok('G3-3 중복 없음(lastSeen 이하 미수신)', noDup,
        `seen=${sseB.events.map((e) => e.seq).join(',')}`);

      // 최종 상태 일치 — 스냅샷 entities 카운트가 양쪽 경로 동일(미러 재구성 가능).
      const snap = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      ok('G3-4 최종 스냅샷 seq = 마지막 커맨드 seq', snap.seq === r3.seq, `snap.seq=${snap.seq} r3=${r3.seq}`);

      sseB.close();
      await sleep(50);
    }

    // ── G4 백프레셔(느린 소비자 — 버퍼 무한적체 없음) ──────────────────────────
    {
      // 느린 소비자: SSE 응답 스트림을 pause 해 소켓 버퍼를 막고 다량 커맨드 발행.
      const sse = await openSSE(info);
      sse.pause();                       // 소비 중단(소켓 수신 버퍼 정체 유도)
      await sleep(30);

      // 대량 커맨드 — 송신 버퍼가 무한 적체되면 메모리 폭주. 상한 초과 시 resync 발행.
      let lastSeq = 0;
      for (let i = 0; i < 3000; i++) {
        const r = await api(info, 'POST', '/api/command', {
          command: { type: 'setTransform', id: 'player', transform: { x: (i % 100), y: 0 } }
        });
        const b = JSON.parse(r.body);
        if (b.ok) lastSeq = b.seq;
      }
      // 모든 POST 가 정상 처리됨(브리지가 죽지 않음 = 적체로 인한 크래시 없음).
      ok('G4-1 대량 커맨드 처리 중 브리지 생존', lastSeq > 0 && child.exitCode == null,
        `lastSeq=${lastSeq} exitCode=${child.exitCode}`);

      // 소비 재개 → 적체 해소(또는 resync 후 정상). 새 스냅샷 가져와 진실 일관 확인.
      sse.resume();
      await sleep(150);
      const snap = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      ok('G4-2 적체 해소 후 단일 진실 일관(seq 도달)', snap.seq >= lastSeq, `snap.seq=${snap.seq} lastSeq=${lastSeq}`);
      // resync 발행은 OS 소켓 버퍼 크기에 의존 — 발행되면 추가 확인(필수 아님, 정보성).
      ok('G4-3 백프레셔 처리(resync 발행 또는 무적체 생존)',
        sse.resyncCount >= 0 && child.exitCode == null,
        `resyncCount=${sse.resyncCount}`);

      sse.close();
      await sleep(50);
    }

    // ── G4b 결정적 resync(낮은 버퍼 상한 + 멈춘 소비자) ────────────────────────
    // 별도 브리지를 WGF_BRIDGE_SSE_LIMIT=5 로 띄워 resync 경로를 OS 소켓 버퍼 의존
    // 없이 결정적으로 트리거(G4-3 는 정보성 — 여기서 resync 발행을 단언).
    {
      let b2;
      try { b2 = await startBridge({ WGF_BRIDGE_SSE_LIMIT: '5', WGF_BRIDGE_SSE_BYTES: '1024', WGF_BRIDGE_SSE_FORCE_BP: '1' }); } catch (e) { b2 = null; }
      if (!b2) {
        ok('G4b resync 브리지 기동', false, '두 번째 브리지 기동 실패');
      } else {
        const info2 = b2.info;
        // 멈춘 소비자: SSE 를 열되 응답 본문을 절대 읽지 않는다(data 리스너 없음).
        // → 서버의 res.writableLength(Node 스트림 내부 버퍼)가 결정적으로 누적 → resync 트리거.
        const stalled = openStalledSSE(info2);
        await sleep(30);
        // 다량 커맨드 — 낮은 바이트 상한(1024) + 프레임 상한(5) 초과를 보장.
        for (let i = 0; i < 200; i++) {
          await api(info2, 'POST', '/api/command', { command: { type: 'setTransform', id: 'player', transform: { x: i, y: 0 } } });
        }
        await sleep(100);
        // resync 발행 검증: 멈춘 소켓을 이제 흘려보내며(읽기 시작) resync 프레임을 파싱.
        const sawResync = await waitFor(() => stalled.consume().resyncCount > 0, 2500);
        ok('G4b resync 발행(낮은 상한 강제)', sawResync, `resyncCount=${stalled.state.resyncCount}`);
        // resync 후 /api/scene 재동기 가능(최신 진실 일관).
        const snap = JSON.parse((await api(info2, 'GET', '/api/scene')).body);
        ok('G4b resync 후 스냅샷 재동기 가능', snap.ok === true && snap.seq >= 200, `seq=${snap.seq}`);
        stalled.close();
        try { b2.child.kill(); } catch (e) {}
        await sleep(50);
      }
    }

    // ── G5 path-traversal 차단 ─────────────────────────────────────────────────
    {
      // 인코딩된 ../ — 닷세그먼트 차단(403) 또는 루트 밖 정규화(403). 정상 파일은 200.
      const enc = await request({ host: '127.0.0.1', port: info.port, path: '/editor/%2e%2e/%2e%2e/secret', method: 'GET' });
      ok('G5-1 인코딩 traversal 차단', enc.status === 403 || enc.status === 404, `status=${enc.status}`);

      const raw = await request({ host: '127.0.0.1', port: info.port, path: '/../../../../etc/passwd', method: 'GET' });
      ok('G5-2 raw traversal 차단', raw.status === 403 || raw.status === 404, `status=${raw.status}`);

      const dot = await request({ host: '127.0.0.1', port: info.port, path: '/.git/config', method: 'GET' });
      ok('G5-3 dotfile(.git) 차단', dot.status === 403, `status=${dot.status}`);

      // 정상 정적 파일(편집 UI index)은 서빙됨.
      const idx = await request({ host: '127.0.0.1', port: info.port, path: '/editor/ui/index.html', method: 'GET' });
      ok('G5-4 정상 정적 파일 200 + 토큰 주입',
        idx.status === 200 && idx.body.includes('__WGF_BRIDGE__'),
        `status=${idx.status} hasToken=${idx.body.includes('__WGF_BRIDGE__')}`);
    }

    // ── G6 토큰/Origin ────────────────────────────────────────────────────────
    {
      // 토큰 없음 → 401.
      const noTok = await request({
        host: '127.0.0.1', port: info.port, path: '/api/scene', method: 'GET',
        headers: { 'Origin': `http://127.0.0.1:${info.port}` }
      });
      ok('G6-1 토큰 없음 → 401', noTok.status === 401, `status=${noTok.status}`);

      // 잘못된 토큰 → 401.
      const badTok = await request({
        host: '127.0.0.1', port: info.port, path: '/api/scene', method: 'GET',
        headers: { 'X-WGF-Token': 'wrong-token', 'Origin': `http://127.0.0.1:${info.port}` }
      });
      ok('G6-2 잘못된 토큰 → 401', badTok.status === 401, `status=${badTok.status}`);

      // 잘못된 Origin(외부 도메인) → 403(토큰은 맞아도).
      const badOrigin = await request({
        host: '127.0.0.1', port: info.port, path: '/api/scene', method: 'GET',
        headers: { 'X-WGF-Token': info.token, 'Origin': 'http://evil.example.com' }
      });
      ok('G6-3 잘못된 Origin → 403', badOrigin.status === 403, `status=${badOrigin.status}`);

      // SSE 토큰 쿼리 — 토큰 없으면 401.
      const sseNoTok = await openSSE(info, { noToken: true, tolerateError: true });
      ok('G6-4 SSE 토큰 없음 → 401', sseNoTok.status === 401, `status=${sseNoTok.status}`);
      if (sseNoTok.close) sseNoTok.close();
    }

    // ── G7 remote transport 라운드트립(addEntity newId 회수 + 미러 setTransform) ──
    // window.WGFEditor.addEntity(remote) 경로가 브리지를 거쳐 동작함을 검증:
    //  POST addEntity → 응답 newId 회수 → 그 id 로 setTransform → SSE 델타 + 스냅샷 반영.
    {
      const sse = await openSSE(info);
      const add = await api(info, 'POST', '/api/command', {
        command: { type: 'addEntity', entity: { name: 'g7-remote', transform: { x: 11, y: 22 }, components: [] } }
      });
      const addBody = JSON.parse(add.body);
      ok('G7-1 addEntity POST → newId 회수', addBody.ok === true && addBody.newId != null,
        `newId=${addBody.newId}`);

      // 회수한 newId 로 setTransform — 미러가 같은 id 를 알아야 적용됨(브리지 단일 진실 일관).
      const move = await api(info, 'POST', '/api/command', {
        command: { type: 'setTransform', id: addBody.newId, transform: { x: 99, y: 88 } }
      });
      const moveBody = JSON.parse(move.body);
      ok('G7-2 newId setTransform 적용(seq 증가)', moveBody.ok === true && moveBody.seq > addBody.seq,
        `seq=${moveBody.seq}`);

      // SSE 델타로 두 커맨드 모두 같은 id 로 수신(미러가 동일 결과 재현 가능).
      const gotAdd = await waitFor(() => sse.events.some((e) =>
        e.type === 'command' && e.command && e.command.type === 'addEntity' && e.command.entity && e.command.entity.id === addBody.newId), 2000);
      ok('G7-3 SSE 델타 addEntity 에 확정 id 포함', gotAdd, `newId=${addBody.newId}`);

      // 최종 스냅샷에 newId 엔티티가 (99,88) 로 반영.
      const snap = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const ent = snap.scene.scenes[0].entities.find((e) => e.id === addBody.newId);
      ok('G7-4 스냅샷 반영(좌표 99,88)', ent && ent.transform.x === 99 && ent.transform.y === 88,
        `ent=${JSON.stringify(ent && ent.transform)}`);

      // undo → newId 엔티티의 transform 이 직전 값(11,22)로 복원(브리지 권위 undo).
      const undoRes = await api(info, 'POST', '/api/undo');
      ok('G7-5 브리지 undo 적용', JSON.parse(undoRes.body).applied === true, `body=${undoRes.body}`);
      const snap2 = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const ent2 = snap2.scene.scenes[0].entities.find((e) => e.id === addBody.newId);
      ok('G7-6 undo 후 좌표 복원(11,22)', ent2 && ent2.transform.x === 11 && ent2.transform.y === 22,
        `ent=${JSON.stringify(ent2 && ent2.transform)}`);

      sse.close();
      await sleep(50);
    }

  } catch (e) {
    ok('테스트 실행 예외', false, String(e && e.stack || e));
  } finally {
    try { child.kill(); } catch (e) {}
    await sleep(50);
    finish();
  }
}

function finish() {
  const result = { ok: fail === 0, pass, fail, checks };
  console.log(JSON.stringify(result));
  process.exit(fail === 0 ? 0 : 1);
}

main();
