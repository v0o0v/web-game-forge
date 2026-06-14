/* ============================================================================
 * WGF Studio 에디터 컨트롤러 — P1
 * ----------------------------------------------------------------------------
 * scenekit-phaser 어댑터 인스턴스를 감싸 Undo/Redo 스택·Save/Load·이벤트 구독을
 * 관리하는 비-UI 컨트롤러. Preact 컴포넌트(UI)와 e2e 용 window.WGFEditor API 가
 * 모두 이 컨트롤러를 통해 상태를 변경한다(단일 경로).
 *
 * 불변식:
 *  - 모든 씬 상태 변경은 어댑터의 applyCommand(→ SceneKit.applyCommand) 로만.
 *  - Undo/Redo 는 코어 applyCommand 가 돌려준 undoDelta 스택을 셸이 관리(코어 미보관).
 *    redo 는 원래 커맨드 재적용. 최소 50단계(기본 200, 설계서 §7 상한).
 *  - Save = serialize → localStorage 영속 + 파일 다운로드. 재로드는 localStorage.
 *
 * 어댑터(window.SceneKitPhaser)·코어(window.SceneKit)는 무빌드 <script> 전역.
 * 셸은 전역만 참조(엔진 import 금지 — 무빌드 경계).
 * ==========================================================================*/

const UNDO_LIMIT = 200;           // Undo/Redo 스택 상한(설계서 §7, 최소 50)
const STORAGE_KEY = 'wgf-studio-scene';

export function createController(opts) {
  opts = opts || {};
  const SceneKit = (typeof window !== 'undefined') ? window.SceneKit : null;
  const SceneKitPhaser = (typeof window !== 'undefined') ? window.SceneKitPhaser : null;

  // transport: remote(브리지 구독자) | local(P1 인메모리). 미주입 시 local.
  const transport = opts.transport || null;
  const isRemote = !!(transport && transport.isRemote);

  let adapter = null;             // scenekit-phaser 인스턴스
  let parentEl = null;
  let currentDoc = null;          // 마지막으로 로드한 sceneDoc(reload 기준)
  let remoteMode = 'edit';        // remote 권위 모드 미러(브리지 델타로 갱신)
  let sseStarted = false;         // remote: SSE 델타 흐름 시작 여부(어댑터 마운트 후 1회)
  let remoteBootSnap = null;      // remote: 초기 부트 스냅샷 보관

  // Undo/Redo 스택. undoStack: {cmd, undoDelta}[], redoStack: {cmd, undoDelta}[].
  const undoStack = [];
  const redoStack = [];
  // 재진입 가드: undo/redo 중 어댑터 onCommand 콜백이 스택을 다시 조작하지 않게 한다.
  // (redo 는 어댑터 applyCommand 로 재적용하므로 onCommand 가 발화되는데, 그 콜백이
  //  redoStack 을 비우면 두 번째 redo 가 불가능해진다 — 이 플래그로 차단.)
  let stackGuard = false;
  // remote 미러 가드: 브리지 델타를 어댑터에 재적용하는 동안 onCommand 가 다시 브리지로
  // 되돌려 보내지 않게 한다(에코 루프 차단).
  let mirrorGuard = false;

  // 변경 알림 리스너(UI 가 구독 → 재렌더).
  const changeListeners = [];
  const selectionListeners = [];

  // ── P3 챗 역채널 + Claude 연결 상태 ──────────────────────────────────────────
  const chatLog = [];                 // [{role:'user'|'assistant', text, at, id?}]
  let claudeStatus = isRemote ? 'disconnected' : 'local';   // local 은 브리지 없음
  const chatListeners = [];           // (chatLog) => void
  const statusListeners = [];         // (status) => void
  const assetListeners = [];          // (assets) => void — P4 에셋 목록 변경
  function notifyChat() { for (const cb of chatListeners) { try { cb(chatLog); } catch (e) {} } }
  function notifyStatus() { for (const cb of statusListeners) { try { cb(claudeStatus); } catch (e) {} } }
  function notifyAsset() { const a = getAssets(); for (const cb of assetListeners) { try { cb(a); } catch (e) {} } }

  function notifyChange() {
    for (const cb of changeListeners) { try { cb(); } catch (e) { /* 격리 */ } }
  }
  function notifySelection(ids) {
    for (const cb of selectionListeners) { try { cb(ids); } catch (e) { /* 격리 */ } }
  }

  // ── 어댑터 마운트 ───────────────────────────────────────────────────────────
  function mount(el, sceneDoc, mountOpts) {
    parentEl = el;
    currentDoc = sceneDoc;
    if (adapter && adapter.destroy) adapter.destroy();
    adapter = SceneKitPhaser.create(el, sceneDoc, Object.assign({
      // 어댑터 내부에서 발생한 커맨드(기즈모 드래그 등) 처리.
      //  - local: Undo 스택에 직접 적재(P1).
      //  - remote: 어댑터가 직접 변경하면 안 됨(브리지 권위). 기즈모 드래그는 onCommand 대신
      //    별도 경로로 브리지에 POST 하도록 어댑터가 알려주지만, 미러 동기 applyCommand(델타
      //    재적용)도 이 콜백을 발화한다 — mirrorGuard 로 그때는 무시(브리지가 이미 권위 반영).
      onCommand: (cmd, undoDelta) => {
        if (isRemote) {
          // remote: 미러 동기 적용(mirrorGuard ON) 중이면 무시. 사용자 입력(기즈모)으로 인한
          //  커맨드면 브리지로 전달(adapter 미러는 델타가 되돌아올 때 동기).
          if (!mirrorGuard) forwardToRemote(cmd, undoDelta);
          notifyChange();
          return;
        }
        // local: 재진입 가드 — undo/redo 재적용 중이면 스택 조작 안 함.
        if (!stackGuard && undoDelta && undoDelta.type !== 'noop') {
          pushUndo(cmd, undoDelta);
        }
        notifyChange();
      },
      onSelectionChange: (ids) => { notifySelection(ids); notifyChange(); },
      // Phaser 비동기 부트(world 로드) 완료 시 셸 UI 동기화 — remote/local 초기 Hierarchy 채움.
      onReady: () => { notifyChange(); notifySelection(getSelection()); }
    }, mountOpts || {}));
    wireRemote();
    // remote: 어댑터(미러)가 준비됐으니 이제 SSE 델타 흐름을 켠다(첫 델타 무손실 적용 보장).
    if (isRemote && transport && transport.connectStream && !sseStarted) {
      sseStarted = true;
      transport.connectStream();
    }
    return adapter;
  }

  // ── remote transport 배선 ───────────────────────────────────────────────────
  // 브리지 델타를 미러(어댑터 world)에 적용. 결정적이라 브리지와 동일 결과(§ 단일 코어).
  //  - command 델타 → adapter.applyCommand(delta.command)  (확정 id 포함)
  //  - undo 델타    → adapter.applyUndo(delta.undoDelta)
  //  - mode 델타    → remoteMode 갱신 + 어댑터 setMode
  function wireRemote() {
    if (!isRemote || !transport) return;
    transport.onDelta((delta) => {
      if (!adapter || !delta) return;
      mirrorGuard = true;            // 미러 재적용 중 — onCommand 가 브리지로 에코 안 하게.
      try {
        if (delta.type === 'undo') {
          if (delta.undoDelta) adapter.applyUndo(delta.undoDelta);
        } else if (delta.type === 'command') {
          if (delta.command) adapter.applyCommand(delta.command);
        }
      } catch (e) { /* 미러 적용 격리 */ }
      finally { mirrorGuard = false; }
      notifyChange();
    });
    transport.onResync((snap) => {
      // 백프레셔/초기 — 브리지 스냅샷으로 미러 재구성.
      if (snap && snap.scene) {
        currentDoc = snap.scene;
        if (typeof snap.mode === 'string') applyRemoteMode(snap.mode);
        if (adapter) adapter.reload(snap.scene);
        else if (parentEl) mount(parentEl, snap.scene);
        notifyChange();
        notifySelection(getSelection());
      }
    });
    transport.onMode((m) => { applyRemoteMode(m); notifyChange(); });
    // 챗 델타(user 에코 + assistant reply) → 챗 로그 적재.
    if (transport.onChat) transport.onChat((evt) => {
      if (!evt) return;
      chatLog.push({ role: evt.role || 'assistant', text: String(evt.text || ''), at: evt.at || Date.now(), id: evt.id });
      notifyChat();
    });
    // Claude 연결 상태(connected/waiting/disconnected) → 인디케이터.
    if (transport.onStatus) transport.onStatus((s) => {
      if (s !== claudeStatus) { claudeStatus = s; notifyStatus(); }
    });
    // 에셋 델타(P4) → 미러 world.assets.sprites 동기. 에셋은 SceneKit 커맨드가 아니라
    // 자산 def 슬롯이므로 applyCommand 미러 경로와 분리(mirrorGuard 무관) — 직접 추가.
    if (transport.onAsset) transport.onAsset((evt) => {
      if (!evt || evt.op !== 'add' || !evt.asset) return;
      const w = adapter && adapter.getWorld ? adapter.getWorld() : null;
      if (w) {
        if (!w.assets || typeof w.assets !== 'object') w.assets = {};
        if (!Array.isArray(w.assets.sprites)) w.assets.sprites = [];
        if (!w.assets.sprites.some((s) => s && s.id === evt.asset.id)) w.assets.sprites.push(evt.asset);
      }
      notifyAsset();
    });
  }

  function applyRemoteMode(m) {
    remoteMode = (m === 'play') ? 'play' : 'edit';
    if (adapter && adapter.setMode) adapter.setMode(remoteMode);
  }

  // remote: 어댑터 내부에서 사용자 입력(기즈모 드래그 등)으로 발생한 커맨드를 브리지에 전달.
  // 어댑터는 이미 로컬 미러에 적용했지만, 브리지가 권위이므로 같은 커맨드를 POST 한다.
  // setTransform 은 절대값 멱등이라 델타 재적용이 안전(같은 결과). 브리지가 Play 면 거부되고
  // 다음 resync/델타로 미러가 권위 상태로 되돌아온다.
  function forwardToRemote(cmd, undoDelta) {
    if (!transport) return;
    // addEntity 는 로컬 미러가 임시 id 로 추가했을 수 있다(어댑터 직접). 브리지가 확정 id 를
    // 발급하므로, P2 에서 구조 변경은 API(addEntity) 경로로만 발생하게 하고(기즈모는 transform
    // 만), 여기서는 그대로 전달한다. 충돌 시 resync 가 정정.
    Promise.resolve(transport.sendCommand(cmd)).catch(() => {});
  }

  function pushUndo(cmd, undoDelta) {
    // redo 안정성: addEntity 는 코어가 새 id 를 발급하므로, redo 재적용 시 같은 id 가
    // 나오도록 발급된 id 를 커맨드 entity 에 박아 넣는다(undoDelta={removeEntity,id} 에서 회수).
    // 그래야 undo→redo 후에도 hashState 가 정확히 일치한다.
    let stored = cmd;
    if (cmd.type === 'addEntity' && undoDelta && undoDelta.type === 'removeEntity' && undoDelta.id != null) {
      const ent = Object.assign({}, cmd.entity, { id: undoDelta.id });
      stored = Object.assign({}, cmd, { entity: ent });
    }
    undoStack.push({ cmd: stored, undoDelta: undoDelta });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.length = 0;       // 새 동작 시 redo 무효화.
  }

  // ── 커맨드 적용(UI/API 진입점) ──────────────────────────────────────────────
  //  - local: 어댑터를 거쳐 적용 → onCommand 콜백이 Undo 스택에 적재(P1).
  //  - remote: 브리지에 POST → SSE 델타로 미러 동기. 직접 어댑터 변경 안 함.
  //    반환은 Promise({seq,newId,rejected}) — addEntity 의 newId 회수에 사용.
  function applyCommand(cmd) {
    if (isRemote) {
      if (!transport) return Promise.resolve({ rejected: true });
      return Promise.resolve(transport.sendCommand(cmd));
    }
    if (!adapter) return { type: 'noop' };
    return adapter.applyCommand(cmd);
  }

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  //  - local: 셸이 관리하는 undoStack/redoStack(P1).
  //  - remote: 브리지 권위 — POST /api/undo|redo. 델타로 미러 동기.
  function undo() {
    if (isRemote) {
      if (!transport) return Promise.resolve(false);
      return Promise.resolve(transport.sendUndo()).then((r) => !!(r && r.applied));
    }
    if (!adapter || undoStack.length === 0) return false;
    const entry = undoStack.pop();
    adapter.applyUndo(entry.undoDelta);
    redoStack.push(entry);
    if (redoStack.length > UNDO_LIMIT) redoStack.shift();
    notifyChange();
    return true;
  }
  function redo() {
    if (isRemote) {
      if (!transport) return Promise.resolve(false);
      return Promise.resolve(transport.sendRedo()).then((r) => !!(r && r.applied));
    }
    if (!adapter || redoStack.length === 0) return false;
    const entry = redoStack.pop();
    // 원래 커맨드 재적용 → 새 undoDelta 로 갱신(상태 복원 일관).
    // 가드 ON: 어댑터 onCommand 콜백이 스택을 다시 조작/redo 비움 하지 않게 한다.
    stackGuard = true;
    let newUndo;
    try { newUndo = adapter.applyCommand(entry.cmd); }
    finally { stackGuard = false; }
    undoStack.push({ cmd: entry.cmd, undoDelta: newUndo });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    notifyChange();
    return true;
  }
  // remote 는 Undo 깊이를 셸이 모름(브리지 권위) — UI 버튼 활성화는 보수적으로 항상 허용(0 반환
  // 대신 큰 값) 하면 오히려 혼란이므로, remote 에선 깊이 미상=−1 로 두고 UI 가 버튼을 항상 노출.
  function undoDepth() { return isRemote ? -1 : undoStack.length; }
  function redoDepth() { return isRemote ? -1 : redoStack.length; }

  // ── 선택 ────────────────────────────────────────────────────────────────────
  function select(ids) { if (adapter) adapter.select(ids); }
  function getSelection() { return adapter ? adapter.getSelection() : []; }

  // ── 엔티티 추가 헬퍼 ────────────────────────────────────────────────────────
  // partial: { name?, transform?, components? }. applyCommand(addEntity) → 새 id 반환.
  function addEntity(partial) {
    partial = partial || {};
    const entity = {
      name: partial.name || 'entity',
      transform: partial.transform || { x: 160, y: 120 },
      components: partial.components || []
    };
    if (isRemote) {
      // remote: 브리지가 id 발급 → POST 응답 newId 회수 후 select. Promise<newId> 반환.
      return Promise.resolve(applyCommand({ type: 'addEntity', entity: entity })).then((r) => {
        const newId = r && r.newId != null ? r.newId : null;
        if (newId != null) select([newId]);
        return newId;
      });
    }
    if (!adapter) return null;
    // addEntity 의 undoDelta = {type:'removeEntity', id} → 거기서 새 id 를 정확히 회수.
    const undoDelta = applyCommand({ type: 'addEntity', entity: entity });
    const newId = (undoDelta && undoDelta.type === 'removeEntity') ? undoDelta.id : null;
    if (newId) select([newId]);
    return newId;
  }

  // ── 트랜스폼 편집 ───────────────────────────────────────────────────────────
  function setTransform(id, patch) {
    return applyCommand({ type: 'setTransform', id: id, transform: patch });
  }

  // ── 컴포넌트 편집 ───────────────────────────────────────────────────────────
  function updateComponent(id, index, patch) {
    return applyCommand({ type: 'updateComponent', id: id, index: index, patch: patch });
  }
  function addComponent(id, component) {
    return applyCommand({ type: 'addComponent', id: id, component: component });
  }
  function removeComponent(id, index) {
    return applyCommand({ type: 'removeComponent', id: id, index: index });
  }
  function removeEntity(id) {
    return applyCommand({ type: 'removeEntity', id: id });
  }

  // ── 직렬화 / 해시 ───────────────────────────────────────────────────────────
  function getWorld() { return adapter ? adapter.getWorld() : null; }
  function serialize() { return adapter ? adapter.serialize() : null; }
  function hash() { return adapter ? adapter.hashState() : null; }
  function entityCount() { const w = getWorld(); return w ? w.entities.length : 0; }

  // ── Save / Load ─────────────────────────────────────────────────────────────
  // Save = serialize → localStorage 영속 + 파일 다운로드(P1; 디스크 저장은 P2).
  function save(downloadFile) {
    const doc = serialize();
    if (!doc) return null;
    // serialize 는 entities 평면 배열을 돌려준다. 원본 wgf-scene@1 래퍼(meta/slug/
    // scenes)를 보존해 라운드트립 정합 — currentDoc 의 래퍼에 직렬화 결과를 합친다.
    const out = wrapForSave(doc);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
      }
    } catch (e) { /* 사적 모드 등 localStorage 불가 — 무시 */ }
    if (downloadFile && typeof document !== 'undefined') {
      downloadJSON(out, (out.slug || 'scene') + '.json');
    }
    return out;
  }

  // serialize 결과(평면 entities)를 currentDoc 의 wgf-scene@1 래퍼에 채워 넣는다.
  function wrapForSave(serialized) {
    const base = currentDoc && typeof currentDoc === 'object' ? currentDoc : {};
    const out = {
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
    return out;
  }

  // localStorage 에서 재로드(어댑터 재마운트). 저장본 없으면 false.
  function reloadFromSaved() {
    let raw = null;
    try { raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORAGE_KEY) : null; }
    catch (e) { raw = null; }
    if (!raw) return false;
    let doc;
    try { doc = JSON.parse(raw); } catch (e) { return false; }
    loadScene(doc);
    return true;
  }

  // remote 부트(2단계 — 어댑터 마운트 순서 보장):
  //  1) startRemote(): 브리지 스냅샷만 가져온다(SSE 미연결). main.jsx 가 이 문서로 Viewport
  //     를 마운트 → 어댑터 생성. 그때 mount() 가 connectStream() 을 호출해 SSE 흐름을 켠다.
  //  이렇게 해야 첫 델타가 도착할 때 어댑터 미러가 이미 준비돼 무손실 적용된다.
  function startRemote() {
    if (!isRemote || !transport) return Promise.resolve(null);
    return Promise.resolve(transport.fetchInitial()).then((snap) => {
      remoteBootSnap = snap;
      return snap;
    });
  }

  // ── 씬 로드(새 문서로 재마운트) ─────────────────────────────────────────────
  function loadScene(doc) {
    currentDoc = doc;
    undoStack.length = 0;
    redoStack.length = 0;
    if (adapter) adapter.reload(doc);
    else if (parentEl) mount(parentEl, doc);
    notifyChange();
    notifySelection(getSelection());
  }

  // ── 스냅 / 기즈모 / 모드 위임 ───────────────────────────────────────────────
  function setSnap(on, size) { if (adapter) adapter.setSnap(on, size); }
  function setGizmoMode(m) { if (adapter) adapter.setGizmoMode(m); notifyChange(); }
  function getGizmoMode() { return adapter ? adapter.getGizmoMode() : 'move'; }
  // setMode:
  //  - local: 어댑터가 곧 권위(P1) — 직접 전환.
  //  - remote: 브리지가 권위(§4.9). POST /api/mode → mode 델타가 미러 갱신. Play 진입 시
  //    브라우저 코어가 step+렌더(휘발), Stop 시 edit 복귀 + 브리지 스냅샷 재로드(resync 경로).
  function setMode(m) {
    if (isRemote) {
      const want = (m === 'play') ? 'play' : 'edit';
      // 어댑터는 즉시 전환(브라우저 Play 렌더 시작). 권위 통지는 브리지 POST.
      if (adapter && adapter.setMode) adapter.setMode(want);
      remoteMode = want;
      notifyChange();
      const p = transport ? Promise.resolve(transport.setMode(want)) : Promise.resolve();
      return p.then(() => {
        // Stop(edit 복귀) 시 휘발 Play 상태 폐기 후 브리지 권위 스냅샷 재로드.
        if (want === 'edit' && transport) {
          return Promise.resolve(transport.snapshot()).then((snap) => {
            if (snap && snap.scene && adapter) { currentDoc = snap.scene; adapter.reload(snap.scene); notifyChange(); }
          });
        }
      });
    }
    if (adapter) adapter.setMode(m);
    notifyChange();
  }
  function getMode() {
    if (isRemote) return remoteMode;
    return adapter ? adapter.getMode() : 'edit';
  }

  // ── 구독 ────────────────────────────────────────────────────────────────────
  function onChange(cb) {
    changeListeners.push(cb);
    return () => { const i = changeListeners.indexOf(cb); if (i >= 0) changeListeners.splice(i, 1); };
  }
  function onSelectionChange(cb) {
    selectionListeners.push(cb);
    return () => { const i = selectionListeners.indexOf(cb); if (i >= 0) selectionListeners.splice(i, 1); };
  }

  // ── P3 챗 역채널 공개 API ─────────────────────────────────────────────────────
  // 사용자 메시지 전송(에디터 → Claude). remote 는 user 에코를 SSE 로 돌려받아 표시하므로
  // 여기서 로그에 직접 넣지 않는다(이중 표시 방지). local 은 비활성 안내만.
  async function sendChat(text) {
    const t = String(text || '').trim();
    if (!t) return { ok: false, error: '빈 메시지' };
    if (!isRemote || !transport || !transport.sendChat) {
      chatLog.push({ role: 'system', text: '브리지 미연결 — 챗은 브리지 모드에서만 동작합니다.', at: Date.now() });
      notifyChat();
      return { ok: false, error: 'local 모드 — 챗 비활성' };
    }
    return await transport.sendChat(t);
  }
  function onChatChange(cb) {
    chatListeners.push(cb);
    return () => { const i = chatListeners.indexOf(cb); if (i >= 0) chatListeners.splice(i, 1); };
  }
  function onStatusChange(cb) {
    statusListeners.push(cb);
    return () => { const i = statusListeners.indexOf(cb); if (i >= 0) statusListeners.splice(i, 1); };
  }
  function getChatLog() { return chatLog; }
  function getClaudeStatus() { return claudeStatus; }

  // ── P4 결정형 스킬 트랙(에디터 직접 실행) ─────────────────────────────────────
  // tool(화이트리스트) + args → 브리지가 execFile 안전 실행. 반환 {ok, exit, json, ...}.
  // local 모드는 브리지 없음 → 안내 반환.
  async function runSkill(tool, args) {
    if (!isRemote || !transport || !transport.runSkill) {
      return { ok: false, error: 'local 모드 — 결정형 스킬은 /wgf-editor 브리지에서만 동작' };
    }
    return await transport.runSkill(tool, args || {});
  }

  // ── P4 창작형 스킬 트랙(Claude 디스패치) ──────────────────────────────────────
  // 현재 씬 문맥(엔티티 요약)을 포함한 창작 요청을 챗 큐로 enqueue → /loop 가 디큐해 편집.
  // prompt = 사용자 의도(예 "스토리 입혀줘"). 씬 문맥을 자동 동봉해 Claude 가 맥락을 안다.
  async function dispatchCreative(prompt) {
    const p = String(prompt || '').trim();
    if (!p) return { ok: false, error: '빈 요청' };
    const ctx = sceneContextSummary();
    const text = '[창작 요청] ' + p + '\n(현재 씬 문맥: ' + ctx + ')';
    return await sendChat(text);
  }

  // 현재 씬 요약(엔티티 이름·컴포넌트 타입) — 창작 디스패치 문맥에 동봉.
  function sceneContextSummary() {
    const w = getWorld();
    if (!w || !Array.isArray(w.entities)) return '엔티티 없음';
    const parts = w.entities.slice(0, 20).map((e) => {
      const comps = Array.isArray(e.components) ? e.components.map((c) => c.type).join('/') : '';
      return (e.name || e.id) + (comps ? '[' + comps + ']' : '');
    });
    return parts.join(', ') + (w.entities.length > 20 ? ` 외 ${w.entities.length - 20}개` : '');
  }

  // ── P4 에셋(절차/CC0) ─────────────────────────────────────────────────────────
  // 현재 world.assets.sprites 반환(미러). 브리지 모드는 onAsset 델타로 동기됨.
  function getAssets() {
    const w = getWorld();
    const a = (w && w.assets && typeof w.assets === 'object') ? w.assets : {};
    return { sprites: Array.isArray(a.sprites) ? a.sprites : [] };
  }
  // 절차 스프라이트 추가. partial = {id, desc?, w?, h?, def?}.
  async function addProceduralAsset(partial) {
    if (!isRemote || !transport || !transport.addAsset) {
      return { ok: false, error: 'local 모드 — 에셋 추가는 브리지에서만 동작' };
    }
    return await transport.addAsset('procedural', partial || {});
  }
  // CC0 스프라이트 추가. partial = {id, url, license?, credit?, desc?, w?, h?}.
  async function addCc0Asset(partial) {
    if (!isRemote || !transport || !transport.addAsset) {
      return { ok: false, error: 'local 모드 — 에셋 추가는 브리지에서만 동작' };
    }
    return await transport.addAsset('cc0', partial || {});
  }
  // Unity 로컬 폴더 스캔(복사 없음 — 미리보기).
  async function scanUnityFolder(folder) {
    if (!isRemote || !transport || !transport.scanUnityFolder) {
      return { ok: false, error: '브리지 필요 — local 모드에서는 동작하지 않습니다' };
    }
    return await transport.scanUnityFolder(folder);
  }
  // Unity 에셋 가져오기. selections = [{relPath, id?, credit?, attested?:{owner,declaredLicense}}].
  async function importUnityAssets(folder, selections) {
    if (!isRemote || !transport || !transport.importUnityAssets) {
      return { ok: false, error: '브리지 필요 — local 모드에서는 동작하지 않습니다' };
    }
    return await transport.importUnityAssets(folder, selections || []);
  }
  // 에셋을 엔티티에 드래그 배정 — 그 엔티티에 Sprite(sprite=자산 id) 컴포넌트 추가.
  //  applyCommand(addComponent) 경유 → 결정론 불변식 준수 + scene.json 자산 ref 유효.
  function assignAssetToEntity(entityId, spriteId) {
    return applyCommand({ type: 'addComponent', id: entityId, component: { type: 'Sprite', sprite: spriteId } });
  }
  function onAssetChange(cb) {
    assetListeners.push(cb);
    return () => { const i = assetListeners.indexOf(cb); if (i >= 0) assetListeners.splice(i, 1); };
  }

  // 컴포넌트 레지스트리에서 inspectorFields 조회(Inspector UI 구동).
  function getComponentDef(type) {
    return SceneKit && SceneKit.getComponentDef ? SceneKit.getComponentDef(type) : null;
  }

  // 어댑터 인스턴스 접근(e2e 에서 Phaser scene 입력 emit 으로 기즈모 검증용).
  function getAdapter() { return adapter; }

  return {
    mount, applyCommand, undo, redo, undoDepth, redoDepth,
    select, getSelection, addEntity, setTransform,
    updateComponent, addComponent, removeComponent, removeEntity,
    getWorld, serialize, hash, entityCount,
    save, reloadFromSaved, loadScene,
    setSnap, setGizmoMode, getGizmoMode, setMode, getMode,
    onChange, onSelectionChange, getComponentDef, getAdapter,
    startRemote, isRemote,
    sendChat, onChatChange, onStatusChange, getChatLog, getClaudeStatus,
    // P4 — 스킬(2트랙) + 에셋
    runSkill, dispatchCreative, sceneContextSummary,
    getAssets, addProceduralAsset, addCc0Asset, assignAssetToEntity, onAssetChange,
    scanUnityFolder, importUnityAssets,
    STORAGE_KEY
  };
}

// ── 파일 다운로드 헬퍼 ────────────────────────────────────────────────────────
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
