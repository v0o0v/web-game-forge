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
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(SERVER_DIR, 'bridge.mjs');
const REPO_ROOT = path.resolve(SERVER_DIR, '../..');

// SceneKit 코어(H′ 불변식 직접 검증용) — 브리지가 거치는 동일 코어를 그대로 로드.
const require = createRequire(import.meta.url);
const SceneKit = require(path.resolve(REPO_ROOT, 'engine/scenekit.js'));
require(path.resolve(REPO_ROOT, 'engine/scenekit-components.js'));  // 컴포넌트 등록(필수)

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

    // ── G3-gap 로그 상한 초과 후 오래된 Last-Event-ID 재연결 → resync 단언 ────────
    // UNDO_LIMIT(200) 초과 후 이미 잘린 seq 로 재연결 시 부분 재전송이 아닌 resync 를 발행해야 함.
    // §8 위험8: replayMissed 갭 검사 누락 시 클라 미러가 브리지와 hashState 발산.
    {
      let bgap;
      try { bgap = await startBridge(); } catch (e) { bgap = null; }
      if (!bgap) {
        ok('G3-gap 브리지 기동', false, '기동 실패');
      } else {
        const ig = bgap.info;
        // seq=1 을 확인해두기 위해 첫 커맨드 1개 전송.
        const r0 = JSON.parse((await api(ig, 'POST', '/api/command', {
          command: { type: 'addEntity', entity: { name: 'gap0', transform: { x: 0, y: 0 }, components: [] } }
        })).body);
        const staleId = r0.seq;  // 이 seq 를 Last-Event-ID 로 쓸 것.

        // UNDO_LIMIT(200) 초과 커맨드 발행 → staleId 가 로그에서 잘림.
        for (let i = 0; i < 250; i++) {
          await api(ig, 'POST', '/api/command', {
            command: { type: 'setTransform', id: 'player', transform: { x: i, y: 0 } }
          });
        }

        // staleId 로 재연결 — 로그에서 이미 잘린 구간 → resync 이벤트가 와야 함.
        const sseGap = await openSSE(ig, { lastEventId: staleId });
        const gotResync = await waitFor(() => sseGap.resyncCount > 0, 2000);
        ok('G3-gap resync 발행(잘린 구간 요청)', gotResync,
          `resyncCount=${sseGap.resyncCount} staleId=${staleId}`);

        // resync 후 /api/scene 으로 최신 상태 재동기 가능.
        const snapG = JSON.parse((await api(ig, 'GET', '/api/scene')).body);
        ok('G3-gap resync 후 스냅샷 최신 일치', snapG.ok === true && snapG.seq >= 250,
          `seq=${snapG.seq}`);

        sseGap.close();
        try { bgap.child.kill(); } catch (e) {}
        await sleep(50);
      }
    }

    // ── G3-mode SSE 끊김 중 mode 전환 → 재연결 시 mode 델타 수신 ──────────────────
    // replayMissed 의 mode 분기 수정 검증: 재연결 클라가 {type:'mode'} 이벤트를 받아야 함.
    // applyCommand({mode:'play'}) 가 아닌 올바른 mode 이벤트 타입이어야 §4.9 권위 유지.
    {
      let bmode;
      try { bmode = await startBridge(); } catch (e) { bmode = null; }
      if (!bmode) {
        ok('G3-mode 브리지 기동', false, '기동 실패');
      } else {
        const im = bmode.info;

        // SSE 연결 → 첫 커맨드 수신 확인 → 끊기.
        const sseM1 = await openSSE(im);
        const rc1 = JSON.parse((await api(im, 'POST', '/api/command', {
          command: { type: 'addEntity', entity: { name: 'gmode0', transform: { x: 0, y: 0 }, components: [] } }
        })).body);
        await waitFor(() => sseM1.events.some((e) => e.seq === rc1.seq), 2000);
        const lastModeId = rc1.seq;
        sseM1.close();
        await sleep(80);

        // 끊긴 동안 mode=play 전환.
        const modeRes = await api(im, 'POST', '/api/mode', { mode: 'play' });
        ok('G3-mode mode=play 전환', modeRes.status === 200 && JSON.parse(modeRes.body).mode === 'play',
          `status=${modeRes.status}`);

        // lastModeId 로 재연결 → mode 델타 수신 단언(type='mode' 여야 함).
        const sseM2 = await openSSE(im, { lastEventId: lastModeId });
        // 갭 없이(로그 안에 있는 경우) mode 이벤트가 재전송 되어야 함.
        // 또는 로그 잘림이 발생했다면 resync 로 대체됨(두 경우 모두 단일 진실 보장).
        const gotModeEvt = await waitFor(() =>
          sseM2.events.some((e) => e.type === 'mode') || sseM2.resyncCount > 0, 2000);
        ok('G3-mode 재연결 시 mode 이벤트(또는 resync) 수신', gotModeEvt,
          `events=${JSON.stringify(sseM2.events.map((e) => e.type))} resync=${sseM2.resyncCount}`);

        // mode=play 가 전달됐다면 type='mode' & mode='play' 여야 함(type='command' 금지).
        const modeEvt = sseM2.events.find((e) => e.type === 'mode');
        if (modeEvt) {
          ok('G3-mode 이벤트 타입 정합(type=mode, mode=play)',
            modeEvt.type === 'mode' && modeEvt.mode === 'play',
            `type=${modeEvt.type} mode=${modeEvt.mode}`);
        } else {
          // resync 로 대체된 경우 — resync 가 왔다면 타입 정합 게이트는 스킵(resync 자체가 통과).
          ok('G3-mode resync 로 대체(타입 정합 스킵)', sseM2.resyncCount > 0,
            `resync=${sseM2.resyncCount}`);
        }

        // edit 복귀.
        await api(im, 'POST', '/api/mode', { mode: 'edit' });
        sseM2.close();
        try { bmode.child.kill(); } catch (e) {}
        await sleep(50);
      }
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

    // ── G7-REPARENT-REJECT 코어 거부(자기참조·고아·사이클) → 422 ok:false + reason ──
    //  "거부가 성공처럼 보이고 undoStack 이 오염되는" 버그 회귀 가드. 핵심: 3회 거부 후 단 1회
    //  undo 로 직전 성공 reparent 가 원복되면 거부들이 스택에 안 쌓인 것(미오염 증명).
    {
      const pAdd = JSON.parse((await api(info, 'POST', '/api/command', { command: { type: 'addEntity', entity: { name: 'rj-parent', transform: {}, components: [] } } })).body);
      const cAdd = JSON.parse((await api(info, 'POST', '/api/command', { command: { type: 'addEntity', entity: { name: 'rj-child', transform: {}, components: [] } } })).body);
      const pId = pAdd.newId, cId = cAdd.newId;
      // c→p 성공(200).
      const okRep = await api(info, 'POST', '/api/command', { command: { type: 'reparent', id: cId, parentId: pId } });
      ok('G7-REPARENT-REJECT c→p 성공(200)', okRep.status === 200 && JSON.parse(okRep.body).ok === true, `status=${okRep.status}`);
      const seqAfterOk = JSON.parse((await api(info, 'GET', '/api/scene')).body).seq;

      // (1) 자기참조 → 422 ok:false reason=self-parent.
      const selfR = await api(info, 'POST', '/api/command', { command: { type: 'reparent', id: cId, parentId: cId } });
      const selfB = JSON.parse(selfR.body);
      ok('G7-REPARENT-REJECT 자기참조 → 422 ok:false', selfR.status === 422 && selfB.ok === false, `status=${selfR.status} ok=${selfB.ok}`);
      ok('G7-REPARENT-REJECT 자기참조 reason=self-parent', selfB.reason === 'self-parent', `reason=${selfB.reason}`);

      // (2) 고아(없는 부모) → 422 reason=orphan-parent.
      const orphanR = await api(info, 'POST', '/api/command', { command: { type: 'reparent', id: cId, parentId: 'NO_SUCH' } });
      const orphanB = JSON.parse(orphanR.body);
      ok('G7-REPARENT-REJECT 고아 → 422 reason=orphan-parent', orphanR.status === 422 && orphanB.reason === 'orphan-parent', `status=${orphanR.status} reason=${orphanB.reason}`);

      // (3) 사이클(p→c, 이미 c→p) → 422 reason=cycle.
      const cycleR = await api(info, 'POST', '/api/command', { command: { type: 'reparent', id: pId, parentId: cId } });
      const cycleB = JSON.parse(cycleR.body);
      ok('G7-REPARENT-REJECT 사이클 → 422 reason=cycle', cycleR.status === 422 && cycleB.reason === 'cycle', `status=${cycleR.status} reason=${cycleB.reason}`);

      // 거부는 seq 를 올리지 않음 + 계층 불변(거짓 성공·로그 오염 차단).
      const snapR = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      ok('G7-REPARENT-REJECT 거부는 seq 불변(상태 무변이)', snapR.seq === seqAfterOk, `before=${seqAfterOk} after=${snapR.seq}`);
      const cEnt = snapR.scene.scenes[0].entities.find((e) => e.id === cId);
      const pEnt = snapR.scene.scenes[0].entities.find((e) => e.id === pId);
      ok('G7-REPARENT-REJECT 거부 후 계층 불변(c.parentId=p, p 루트)',
        cEnt && cEnt.parentId === pId && pEnt && pEnt.parentId == null, `c.parentId=${cEnt && cEnt.parentId} p.parentId=${pEnt && pEnt.parentId}`);

      // undo 미오염 증명: 거부가 스택에 안 쌓였다면 단 1회 undo 로 직전 성공 reparent 가 원복(c 루트).
      await api(info, 'POST', '/api/undo');
      const snapU = JSON.parse((await api(info, 'GET', '/api/scene')).body);
      const cU = snapU.scene.scenes[0].entities.find((e) => e.id === cId);
      ok('G7-REPARENT-REJECT 거부 미오염: 1회 undo 로 reparent 원복(c 루트)', cU && cU.parentId == null, `c.parentId=${cU && cU.parentId}`);
    }

    // ── G8 멀티 씬(추가/전환/삭제/이름변경 + 모든 scenes 직렬화 보존) ─────────────
    //  전용 브리지를 띄워(앞 게이트 상태와 분리) E1 멀티씬 권위를 실제 실행 검증한다.
    {
      let bms;
      try { bms = await startBridge(); } catch (e) { bms = null; }
      if (!bms) {
        ok('G8 멀티씬 브리지 기동', false, '기동 실패');
      } else {
        const im = bms.info;
        const sseS = await openSSE(im);

        // 초기: 단일 씬('main') — 단일 씬이면 기존 모양 유지(scenes 길이 1).
        const snap0 = JSON.parse((await api(im, 'GET', '/api/scene')).body);
        ok('G8-0 초기 단일 씬(scenes 길이 1 + activeSceneId)',
          snap0.scene.scenes.length === 1 && snap0.scene.activeSceneId === 'main',
          `len=${snap0.scene.scenes.length} active=${snap0.scene.activeSceneId}`);

        // list — 1개 + activeSceneId.
        const list0 = JSON.parse((await api(im, 'GET', '/api/scene/list')).body);
        ok('G8-1 list 1개 + activeSceneId',
          list0.ok === true && Array.isArray(list0.scenes) && list0.scenes.length === 1 &&
          list0.activeSceneId === 'main' && typeof list0.scenes[0].entityCount === 'number',
          `scenes=${JSON.stringify(list0.scenes)}`);
        const baseId = list0.scenes[0].id;

        // list 는 read-only(보안 MED): 권위 문서를 변이하지 않는다.
        //  list 호출 전후 /api/scene 스냅샷이 동일해야 한다(특히 seq 불변 — flush 부작용 0).
        const before = JSON.parse((await api(im, 'GET', '/api/scene')).body);
        await api(im, 'GET', '/api/scene/list');
        await api(im, 'GET', '/api/scene/list');
        const after = JSON.parse((await api(im, 'GET', '/api/scene')).body);
        ok('G8-1b list 호출이 상태 변이 안 함(seq·스냅샷 동일)',
          before.seq === after.seq && JSON.stringify(before.scene) === JSON.stringify(after.scene),
          `seqBefore=${before.seq} seqAfter=${after.seq}`);

        // 활성 씬(main)에 엔티티 1개 추가(이후 전환 시 보존 검증용).
        await api(im, 'POST', '/api/command', { command: { type: 'addEntity', entity: { name: 'main-mark', transform: { x: 7, y: 7 }, components: [] } } });

        // add — list +1, 전환 안 함(active 그대로).
        const add = JSON.parse((await api(im, 'POST', '/api/scene/add', { name: '레벨 2' })).body);
        ok('G8-2 add → scenes +1, 전환 안 함',
          add.ok === true && add.scenes.length === 2 && add.activeSceneId === baseId &&
          add.scene && typeof add.scene.id === 'string' && add.scene.id !== baseId,
          `scenes=${add.scenes.length} active=${add.activeSceneId} newId=${add.scene && add.scene.id}`);
        const newId = add.scene.id;
        ok('G8-2b add name 위생화 반영', add.scene.name === '레벨 2', `name=${add.scene.name}`);

        // add 가 SSE 'scene' 델타(op=add) 발행.
        const gotSceneDelta = await waitFor(() => sseS.events.some((e) => e.type === 'scene' && e.op === 'add'), 2000);
        ok('G8-2c SSE scene 델타(op=add) 발행', gotSceneDelta,
          `events=${JSON.stringify(sseS.events.filter((e) => e.type === 'scene').map((e) => e.op))}`);

        // switch → activeSceneId 변경 + 비활성(main) 씬 엔티티 보존 + 활성(newId) 빈 씬.
        const sw = JSON.parse((await api(im, 'POST', '/api/scene/switch', { id: newId })).body);
        ok('G8-3 switch → activeSceneId 변경', sw.ok === true && sw.activeSceneId === newId, `active=${sw.activeSceneId}`);

        const snapSw = JSON.parse((await api(im, 'GET', '/api/scene')).body);
        ok('G8-3b 스냅샷 scenes 길이 보존(2)', snapSw.scene.scenes.length === 2, `len=${snapSw.scene.scenes.length}`);
        const mainSceneAfter = snapSw.scene.scenes.find((s) => s.id === baseId);
        const newSceneAfter = snapSw.scene.scenes.find((s) => s.id === newId);
        // main = 초기 2(topdown-min) + 추가 1 = 3, 비활성이지만 보존.
        ok('G8-3c 비활성 씬(main) 엔티티 보존(3)', mainSceneAfter && mainSceneAfter.entities.length === 3,
          `main=${mainSceneAfter && mainSceneAfter.entities.length}`);
        ok('G8-3d 활성 씬(level2) 빈 씬(0)', newSceneAfter && newSceneAfter.entities.length === 0,
          `new=${newSceneAfter && newSceneAfter.entities.length}`);
        ok('G8-3e 스냅샷 activeSceneId=level2', snapSw.scene.activeSceneId === newId, `active=${snapSw.scene.activeSceneId}`);

        // 새 활성 씬에 엔티티 추가 → 그 씬에만 반영(다른 씬 무영향).
        await api(im, 'POST', '/api/command', { command: { type: 'addEntity', entity: { name: 'lvl2-ent', transform: { x: 3, y: 3 }, components: [] } } });
        const snapAdd = JSON.parse((await api(im, 'GET', '/api/scene')).body);
        const newSceneAdded = snapAdd.scene.scenes.find((s) => s.id === newId);
        const mainStillThree = snapAdd.scene.scenes.find((s) => s.id === baseId);
        ok('G8-4 활성 씬 커맨드 격리(level2=1, main=3 불변)',
          newSceneAdded && newSceneAdded.entities.length === 1 && mainStillThree && mainStillThree.entities.length === 3,
          `level2=${newSceneAdded && newSceneAdded.entities.length} main=${mainStillThree && mainStillThree.entities.length}`);

        // rename.
        const rn = JSON.parse((await api(im, 'POST', '/api/scene/rename', { id: newId, name: '리네임됨' })).body);
        const renamed = rn.scenes.find((s) => s.id === newId);
        ok('G8-5 rename 반영', rn.ok === true && renamed && renamed.name === '리네임됨', `name=${renamed && renamed.name}`);

        // 다시 main 으로 전환 후 level2 의 추가분 보존 확인(왕복 무손실).
        await api(im, 'POST', '/api/scene/switch', { id: baseId });
        const snapBack = JSON.parse((await api(im, 'GET', '/api/scene')).body);
        const lvl2Back = snapBack.scene.scenes.find((s) => s.id === newId);
        ok('G8-6 왕복 후 level2 추가분 보존(1)', lvl2Back && lvl2Back.entities.length === 1,
          `level2=${lvl2Back && lvl2Back.entities.length} active=${snapBack.scene.activeSceneId}`);

        // remove(비활성 level2) → scenes -1.
        const rm = JSON.parse((await api(im, 'POST', '/api/scene/remove', { id: newId })).body);
        ok('G8-7 remove → scenes -1', rm.ok === true && rm.scenes.length === 1 && rm.activeSceneId === baseId,
          `scenes=${rm.scenes.length} active=${rm.activeSceneId}`);

        // 마지막 1개 씬 삭제 거부(400).
        const rmLast = await api(im, 'POST', '/api/scene/remove', { id: baseId });
        ok('G8-8 마지막 1개 씬 삭제 거부(400)', rmLast.status === 400, `status=${rmLast.status}`);

        // 없는 씬 전환/이름변경/삭제 → 404.
        const swMissing = await api(im, 'POST', '/api/scene/switch', { id: 'no-such-scene' });
        ok('G8-9 없는 씬 switch → 404', swMissing.status === 404, `status=${swMissing.status}`);

        // Play 모드 중 switch 거부(409).
        await api(im, 'POST', '/api/mode', { mode: 'play' });
        const swPlay = await api(im, 'POST', '/api/scene/switch', { id: baseId });
        ok('G8-10 Play 중 switch → 409', swPlay.status === 409, `status=${swPlay.status}`);
        // Play 중 add·rename 도 씬 구조 read-only(§4.9 불변식 정합) → 409.
        const addPlay = await api(im, 'POST', '/api/scene/add', { name: 'play-add' });
        ok('G8-11 Play 중 add → 409', addPlay.status === 409, `status=${addPlay.status}`);
        const renPlay = await api(im, 'POST', '/api/scene/rename', { id: baseId, name: 'play-rename' });
        ok('G8-12 Play 중 rename → 409', renPlay.status === 409, `status=${renPlay.status}`);
        await api(im, 'POST', '/api/mode', { mode: 'edit' });

        // MAX_SCENES 가드(보안 MED): 256회 호출은 과하므로 상수 존재만 정적 확인.
        //  add 핸들러가 MAX_SCENES 로 상한·400 '씬 수 상한 초과' 를 반환하도록 배선됐는지 소스 확인.
        const bridgeSrc = fs.readFileSync(BRIDGE, 'utf8');
        ok('G8-13 MAX_SCENES 상한 가드 존재(소스)',
          /MAX_SCENES\s*=\s*256/.test(bridgeSrc) &&
          bridgeSrc.includes('scenes.length >= MAX_SCENES') &&
          bridgeSrc.includes('씬 수 상한 초과'),
          'MAX_SCENES guard');

        sseS.close();
        try { bms.child.kill(); } catch (e) {}
        await sleep(50);
      }
    }

    // ── G9 다중 프레임/캐릭터 드롭 → AnimatedSprite 엔티티(anims 보유) + t=0=프레임0(H′) ──
    // 뷰포트 드롭 경로(Viewport.onDrop → controller.createEntityAtFromAsset)가 만들어 보내는
    //  addEntity 커맨드 모양을 그대로 브리지에 POST 해, 다중 프레임 드래그→AnimatedSprite 엔티티화가
    //  실제 단일 진실(world)에 반영되는지 + 코어 H′ 불변식(t=0=프레임0)이 유지되는지 검증한다.
    //  (createEntityAtFromAsset: as==='AnimatedSprite' → {type:'AnimatedSprite', sprite, anims, play}.)
    {
      let bdrop;
      try { bdrop = await startBridge(); } catch (e) { bdrop = null; }
      if (!bdrop) {
        ok('G9 드롭 브리지 기동', false, '기동 실패');
      } else {
        const id = bdrop.info;
        const sseD = await openSSE(id);

        // 드롭 페이로드(다중 프레임 선택으로 만든 즉석 클립). 샘플 씬 자산 spr_player 참조.
        const dropClip = { key: 'clip', frames: [0, 1, 2, 3], fps: 10, loop: true };
        // createEntityAtFromAsset 가 만드는 컴포넌트와 동일한 모양.
        const animComponent = { type: 'AnimatedSprite', sprite: 'spr_player', anims: [dropClip], play: 'clip' };
        const dropCmd = { type: 'addEntity', entity: { name: 'animated', transform: { x: 120, y: 90 }, components: [animComponent] } };

        const dropRes = await api(id, 'POST', '/api/command', { command: dropCmd });
        const dropBody = JSON.parse(dropRes.body);
        ok('G9-1 드롭 addEntity(AnimatedSprite) POST → ok + newId',
          dropRes.status === 200 && dropBody.ok === true && dropBody.newId != null,
          `status=${dropRes.status} newId=${dropBody.newId}`);

        // SSE 델타에 같은 newId 의 addEntity 가 AnimatedSprite 컴포넌트를 달고 도착.
        const gotDrop = await waitFor(() => sseD.events.some((e) =>
          e.type === 'command' && e.command && e.command.type === 'addEntity' &&
          e.command.entity && e.command.entity.id === dropBody.newId), 2000);
        ok('G9-2 SSE 델타에 AnimatedSprite addEntity 수신', gotDrop, `newId=${dropBody.newId}`);

        // 스냅샷에 그 엔티티가 AnimatedSprite + anims(클립 4프레임) + play 로 반영.
        const snap = JSON.parse((await api(id, 'GET', '/api/scene')).body);
        const dropped = snap.scene.scenes[0].entities.find((e) => e.id === dropBody.newId);
        const animComp = dropped && (dropped.components || []).find((c) => c.type === 'AnimatedSprite');
        ok('G9-3 스냅샷 엔티티가 AnimatedSprite 컴포넌트 보유', !!animComp,
          `components=${dropped && JSON.stringify((dropped.components || []).map((c) => c.type))}`);
        ok('G9-4 AnimatedSprite anims 보유(클립 4프레임)',
          animComp && Array.isArray(animComp.anims) && animComp.anims.length === 1 &&
          Array.isArray(animComp.anims[0].frames) && animComp.anims[0].frames.length === 4,
          `anims=${animComp && JSON.stringify(animComp.anims)}`);
        ok('G9-5 AnimatedSprite play 기본키 보존(clip)', animComp && animComp.play === 'clip',
          `play=${animComp && animComp.play}`);
        ok('G9-6 sprite ref 보존(spr_player)', animComp && animComp.sprite === 'spr_player',
          `sprite=${animComp && animComp.sprite}`);

        // H′ 불변식 — 스냅샷 씬 문서를 코어로 직접 load(play) 후 t=0 에서 _frame===0.
        //  (createEntityAtFromAsset 가 t=0=프레임0 계약을 깨지 않는지 엔드투엔드 확인.)
        const wH = SceneKit.load(snap.scene, { mode: 'play', sceneId: snap.scene.scenes[0].id, seed: 1 });
        const entH = SceneKit.findEntity(wH, dropBody.newId);
        const compH = entH && SceneKit.getComponentOn(entH, 'AnimatedSprite');
        ok('G9-7 H′ — 드롭 AnimatedSprite t=0 = 프레임0', compH && compH._frame === 0,
          `_frame=${compH && compH._frame}`);
        ok('G9-8 H′ — 초기 재생 애니 = play 키(clip)', compH && compH._anim === 'clip',
          `_anim=${compH && compH._anim}`);

        // dt 진행 후에도 프레임 인덱스가 클립 범위(0..3) 안 — 어댑터 슬라이싱 전제 데이터 정합.
        for (let i = 0; i < 15; i++) SceneKit.step(wH, 1 / 60);  // 0.25s @ fps10 → 프레임 2
        ok('G9-9 H′ — dt 진행 후 프레임 2(fps10·0.25s)', compH && compH._frame === 2,
          `_frame=${compH && compH._frame}`);

        sseD.close();
        try { bdrop.child.kill(); } catch (e) {}
        await sleep(50);
      }
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
