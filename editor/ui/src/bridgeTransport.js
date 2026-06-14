/* ============================================================================
 * WGF Studio 브리지 transport — remote(구독자) / local(인메모리) (P2)
 * ----------------------------------------------------------------------------
 * editorController 가 transport 추상화 뒤에서 동작하게 한다.
 *  - remote: 브리지가 단일 진실. 명령은 POST /api/command 로 보내고, 브리지가
 *    SSE 델타로 돌려주면 그 델타를 콜백(onDelta)으로 흘려 컨트롤러가 자기 로컬
 *    미러(어댑터 world)에 applyCommand 동기화한다(결정적 — 같은 커맨드=같은 결과).
 *  - local: 브리지 없음(P1). 명령을 즉시 어댑터에 적용하고 같은 모양의 델타를 동기
 *    콜백으로 돌려준다(컨트롤러 경로 단일화).
 *
 * window.__WGF_BRIDGE__ ({token, base}) 존재 시 remote, 없으면 local 폴백.
 *
 * remote 의 동시편집 직렬화·무손실 복구는 브리지가 보장(§7·§8). 이 모듈은
 *  - SSE 자동 재연결(Last-Event-ID) + resync 처리(/api/scene 재스냅샷)
 *  - 명령 POST(addEntity 의 확정 id 는 POST 응답 newId 로 회수)
 * 를 담당한다.
 * ==========================================================================*/

// 브리지 주입 설정 조회(없으면 null → local).
export function getBridgeConfig() {
  if (typeof window === 'undefined') return null;
  return (window.__WGF_BRIDGE__ && typeof window.__WGF_BRIDGE__ === 'object') ? window.__WGF_BRIDGE__ : null;
}

// ── local transport(P1 인메모리) ──────────────────────────────────────────────
// 어댑터를 직접 거치므로 델타 콜백은 동기적. seq 는 로컬 단조 증가(미러 동기 불필요).
export function createLocalTransport() {
  let seq = 0;
  let deltaCb = null;
  let mode = 'edit';
  return {
    kind: 'local',
    isRemote: false,
    getMode: () => mode,
    onDelta(cb) { deltaCb = cb; },
    // local 은 컨트롤러가 직접 어댑터에 적용 → transport 는 seq 관리만. 델타 재방출 안 함
    // (컨트롤러가 local 분기에서 직접 처리). sendCommand 는 사용 안 됨(local 경로 분리).
    async start() { /* no-op */ },
    async sendCommand() { seq += 1; return { seq, newId: null }; },
    async sendUndo() { seq += 1; return { seq, applied: true }; },
    async sendRedo() { seq += 1; return { seq, applied: true }; },
    async setMode(m) { mode = (m === 'play') ? 'play' : 'edit'; return { mode }; },
    async snapshot() { return null; },
    // local(P3): 브리지 없음 → 챗 역채널·하트비트 미동작. UI 가 안전히 비활성 표시.
    onChat() {},
    onStatus() {},
    async sendChat() { return { ok: false, error: '브리지 없음(local 모드) — 챗 비활성' }; },
    async fetchStatus() { return { status: 'disconnected' }; },
    // local(P4): 결정형 스킬·에셋도 브리지 전용 → 안전 비활성.
    onAsset() {},
    async runSkill() { return { ok: false, error: '브리지 없음(local 모드) — 스킬 실행은 /wgf-editor 브리지에서만 동작' }; },
    async addAsset() { return { ok: false, error: '브리지 없음(local 모드) — 에셋 추가는 브리지에서만 동작' }; },
    async listAssets() { return { sprites: [] }; },
    stop() {}
  };
}

// ── remote transport(브리지 구독자) ───────────────────────────────────────────
export function createRemoteTransport(config) {
  const base = (config && config.base) || '';
  const token = (config && config.token) || '';
  let deltaCb = null;             // (delta) => void — 컨트롤러가 미러에 반영
  let resyncCb = null;            // (snapshot) => void — 컨트롤러가 미러 재구성
  let modeCb = null;              // (mode) => void
  let chatCb = null;              // (chatEvt) => void — 챗 델타(user/assistant)
  let assetCb = null;             // (assetEvt) => void — 에셋 델타(P4 asset add)
  let statusCb = null;            // (status) => void — Claude 연결 상태(connected/waiting/disconnected)
  let statusTimer = null;         // 상태 폴링 타이머
  let lastSeq = 0;                // 마지막으로 처리한 seq(Last-Event-ID 재연결용)
  let es = null;                  // EventSource
  let stopped = false;
  let reconnectTimer = null;
  let authFailCount = 0;          // [수정] SSE onerror 연속 실패 카운터(401 무한 루프 방지)
  let authWarnSent = false;       // 콘솔 경고 1회만 출력

  function apiUrl(p) {
    // 토큰은 헤더로(POST/GET). SSE 만 쿼리로.
    return base + p;
  }

  async function apiFetch(method, p, bodyObj) {
    const opts = {
      method,
      headers: { 'X-WGF-Token': token },
    };
    if (bodyObj != null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(bodyObj);
    }
    const res = await fetch(apiUrl(p), opts);
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  // SSE 연결(자동 재연결 + Last-Event-ID 복구).
  function connect() {
    if (stopped || typeof EventSource === 'undefined') return;
    // EventSource 는 헤더 못 넣으므로 토큰을 쿼리로. lastSeq>0 이면 lastEventId 쿼리로 누락 복구.
    let url = apiUrl('/api/events') + '?token=' + encodeURIComponent(token);
    if (lastSeq > 0) url += '&lastEventId=' + encodeURIComponent(lastSeq);
    es = new EventSource(url);

    es.onmessage = (ev) => {
      // 정상 메시지 수신 → 인증 실패 카운터 리셋(연결 성공 확인).
      authFailCount = 0;
      let delta;
      try { delta = JSON.parse(ev.data); } catch (e) { return; }
      // ev.lastEventId = 서버 id:(=seq). lastSeq 갱신.
      const idNum = parseInt(ev.lastEventId, 10);
      if (isFinite(idNum)) lastSeq = Math.max(lastSeq, idNum);
      else if (delta && typeof delta.seq === 'number') lastSeq = Math.max(lastSeq, delta.seq);
      dispatchDelta(delta);
    };

    // resync 이벤트 — 브리지 백프레셔. /api/scene 재요청해 미러 재구성.
    es.addEventListener('resync', async () => {
      await doResync();
    });

    es.onerror = (ev) => {
      // EventSource 는 자체 재연결하지만, 우리는 Last-Event-ID 를 쿼리로 넣어 무손실 복구하기
      // 위해 직접 닫고 재연결한다(브라우저 기본 재연결은 Last-Event-ID 헤더를 쓰지만 쿼리 토큰
      // 유지·복구 일관을 위해 수동 제어).
      if (stopped) return;
      // [수정] 401 인증 실패 시 무한 재시도 방지 — 토큰이 바뀌었거나 만료된 경우 루프 중단.
      // EventSource onerror 의 HTTP 상태는 브라우저마다 노출 방식이 달라 직접 확인이 어렵다.
      // 대신 EventSource.readyState === CLOSED(2) + 연결 직후(lastSeq===0) 면 auth 실패 가능성.
      // 실용적 접근: onerror 에서 연속 재시도 횟수를 카운트해 상한 초과 시 중단 + 경고 1회.
      authFailCount = (authFailCount || 0) + 1;
      if (authFailCount > 5) {
        if (!authWarnSent) {
          authWarnSent = true;
          console.warn('[wgf-transport] SSE 재연결 반복 실패 — 토큰 갱신 필요. 재연결 중단.');
        }
        // 중단: 재연결 타이머 설정 안 함.
        try { es.close(); } catch (e) {}
        es = null;
        return;
      }
      try { es.close(); } catch (e) {}
      es = null;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 500);
      }
    };
  }

  function dispatchDelta(delta) {
    if (!delta || typeof delta !== 'object') return;
    if (delta.type === 'mode') { if (modeCb) modeCb(delta.mode); return; }
    if (delta.type === 'chat') { if (chatCb) chatCb(delta); return; }   // 챗 델타는 씬 미러 미반영
    if (delta.type === 'asset') { if (assetCb) assetCb(delta); return; }  // 에셋 델타(P4) — assets 미러 동기
    if (deltaCb) deltaCb(delta);
  }

  // 연결 상태 폴링(하트비트 인디케이터). 1초 간격으로 GET /api/status.
  function startStatusPolling() {
    if (statusTimer) return;
    const tick = async () => {
      if (stopped) return;
      try {
        const { json } = await apiFetch('GET', '/api/status');
        if (json && json.status && statusCb) statusCb(json.status);
      } catch (e) { if (statusCb) statusCb('disconnected'); }
    };
    tick();
    statusTimer = setInterval(tick, 1000);
  }

  async function doResync() {
    const snap = await snapshot();
    if (snap && resyncCb) resyncCb(snap);
  }

  async function snapshot() {
    const { json } = await apiFetch('GET', '/api/scene');
    if (json && json.ok) {
      if (typeof json.seq === 'number') lastSeq = json.seq;
      return json;
    }
    return null;
  }

  return {
    kind: 'remote',
    isRemote: true,
    getMode: () => undefined,            // 모드는 브리지 권위 — 델타로 통지
    onDelta(cb) { deltaCb = cb; },
    onResync(cb) { resyncCb = cb; },
    onMode(cb) { modeCb = cb; },
    onChat(cb) { chatCb = cb; },
    onAsset(cb) { assetCb = cb; },
    onStatus(cb) { statusCb = cb; },
    async start() {
      // 초기 스냅샷 → 미러 부트 → SSE 연결 → 상태 폴링.
      const snap = await snapshot();
      if (snap && resyncCb) resyncCb(snap);
      connect();
      startStatusPolling();
      return snap;
    },
    // 어댑터 마운트 순서 제어용 분리 진입점:
    //  1) fetchInitial(): 스냅샷만 가져온다(어댑터 마운트 문서 확보 — SSE 미연결).
    //  2) connectStream(): 어댑터 준비 후 SSE 연결(델타 흐름 시작).
    async fetchInitial() { return await snapshot(); },
    connectStream() { connect(); startStatusPolling(); },
    // 챗 송신(에디터 → Claude). POST /api/chat. SSE 로 user 에코 + 이후 assistant reply.
    async sendChat(text) {
      const { status, json } = await apiFetch('POST', '/api/chat', { text });
      if (status !== 200 || !json || json.ok !== true) {
        return { ok: false, error: (json && json.error) || ('전송 실패 status=' + status) };
      }
      return { ok: true, id: json.id, queued: json.queued };
    },
    async fetchStatus() {
      const { json } = await apiFetch('GET', '/api/status');
      return { status: (json && json.status) || 'disconnected' };
    },
    // ── P4 결정형 스킬 실행(에디터 직접 트랙) ──────────────────────────────────
    // POST /api/skill/run {tool, args}. 반환 {ok, exit, json, stdout, error?}.
    async runSkill(tool, args) {
      const { status, json } = await apiFetch('POST', '/api/skill/run', { tool, args: args || {} });
      if (status !== 200 || !json || json.ok !== true) {
        return { ok: false, error: (json && json.error) || ('스킬 실행 실패 status=' + status) };
      }
      return { ok: true, tool: json.tool, exit: json.exit, json: json.json, stdout: json.stdout, stderr: json.stderr, timedOut: json.timedOut };
    },
    // ── P4 에셋 ────────────────────────────────────────────────────────────────
    async addAsset(kind, asset) {
      const { status, json } = await apiFetch('POST', '/api/asset/add', { kind, asset });
      if (status !== 200 || !json || json.ok !== true) {
        return { ok: false, error: (json && json.error) || ('에셋 추가 실패 status=' + status) };
      }
      return { ok: true, asset: json.asset, seq: json.seq };
    },
    async listAssets() {
      const { json } = await apiFetch('GET', '/api/asset/list');
      return (json && json.assets) || { sprites: [] };
    },
    // ── Unity 로컬 폴더 임포트 ────────────────────────────────────────────────
    async scanUnityFolder(folder) {
      const { status, json } = await apiFetch('POST', '/api/asset/unity-scan', { folder });
      if (status !== 200 || !json || json.ok !== true) {
        return { ok: false, error: (json && json.error) || ('스캔 실패 status=' + status) };
      }
      return { ok: true, root: json.root, items: json.items || [], skipped: json.skipped || [],
               totals: json.totals || { count: 0, bytes: 0 }, truncated: !!json.truncated };
    },
    async importUnityAssets(folder, selections) {
      const { status, json } = await apiFetch('POST', '/api/asset/unity-import', { folder, selections: selections || [] });
      if (status !== 200 || !json || json.ok !== true) {
        return { ok: false, error: (json && json.error) || ('임포트 실패 status=' + status) };
      }
      return { ok: true, added: json.added || [], rejected: json.rejected || [], seq: json.seq };
    },
    async sendCommand(cmd) {
      const { status, json } = await apiFetch('POST', '/api/command', { command: cmd });
      if (status === 409) return { rejected: true, reason: 'play-readonly' };
      return { seq: json && json.seq, newId: json && json.newId };
    },
    async sendUndo() {
      const { json } = await apiFetch('POST', '/api/undo');
      return { seq: json && json.seq, applied: json && json.applied };
    },
    async sendRedo() {
      const { json } = await apiFetch('POST', '/api/redo');
      return { seq: json && json.seq, applied: json && json.applied };
    },
    async setMode(m) {
      const { json } = await apiFetch('POST', '/api/mode', { mode: m });
      return { mode: json && json.mode };
    },
    snapshot,
    stop() {
      stopped = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
      if (es) { try { es.close(); } catch (e) {} es = null; }
    }
  };
}

// 환경에 맞는 transport 선택(remote 가능하면 remote, 아니면 local).
export function createTransport() {
  const cfg = getBridgeConfig();
  if (cfg) return createRemoteTransport(cfg);
  return createLocalTransport();
}
