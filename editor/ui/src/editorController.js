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

  let adapter = null;             // scenekit-phaser 인스턴스
  let parentEl = null;
  let currentDoc = null;          // 마지막으로 로드한 sceneDoc(reload 기준)

  // Undo/Redo 스택. undoStack: {cmd, undoDelta}[], redoStack: {cmd, undoDelta}[].
  const undoStack = [];
  const redoStack = [];
  // 재진입 가드: undo/redo 중 어댑터 onCommand 콜백이 스택을 다시 조작하지 않게 한다.
  // (redo 는 어댑터 applyCommand 로 재적용하므로 onCommand 가 발화되는데, 그 콜백이
  //  redoStack 을 비우면 두 번째 redo 가 불가능해진다 — 이 플래그로 차단.)
  let stackGuard = false;

  // 변경 알림 리스너(UI 가 구독 → 재렌더).
  const changeListeners = [];
  const selectionListeners = [];

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
      // 어댑터 내부에서 발생한 커맨드(기즈모 드래그 등)를 Undo 스택에 적재.
      onCommand: (cmd, undoDelta) => {
        // 재진입 가드: undo/redo 가 어댑터를 통해 재적용 중이면 스택을 조작하지 않는다.
        if (!stackGuard && undoDelta && undoDelta.type !== 'noop') {
          pushUndo(cmd, undoDelta);
        }
        notifyChange();
      },
      onSelectionChange: (ids) => { notifySelection(ids); notifyChange(); }
    }, mountOpts || {}));
    return adapter;
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
  // 어댑터를 거쳐 적용 → onCommand 콜백이 Undo 스택에 적재(중복 적재 방지).
  function applyCommand(cmd) {
    if (!adapter) return { type: 'noop' };
    return adapter.applyCommand(cmd);
  }

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  function undo() {
    if (!adapter || undoStack.length === 0) return false;
    const entry = undoStack.pop();
    adapter.applyUndo(entry.undoDelta);
    redoStack.push(entry);
    if (redoStack.length > UNDO_LIMIT) redoStack.shift();
    notifyChange();
    return true;
  }
  function redo() {
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
  function undoDepth() { return undoStack.length; }
  function redoDepth() { return redoStack.length; }

  // ── 선택 ────────────────────────────────────────────────────────────────────
  function select(ids) { if (adapter) adapter.select(ids); }
  function getSelection() { return adapter ? adapter.getSelection() : []; }

  // ── 엔티티 추가 헬퍼 ────────────────────────────────────────────────────────
  // partial: { name?, transform?, components? }. applyCommand(addEntity) → 새 id 반환.
  function addEntity(partial) {
    if (!adapter) return null;
    partial = partial || {};
    const entity = {
      name: partial.name || 'entity',
      transform: partial.transform || { x: 160, y: 120 },
      components: partial.components || []
    };
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
  function setMode(m) { if (adapter) adapter.setMode(m); notifyChange(); }
  function getMode() { return adapter ? adapter.getMode() : 'edit'; }

  // ── 구독 ────────────────────────────────────────────────────────────────────
  function onChange(cb) {
    changeListeners.push(cb);
    return () => { const i = changeListeners.indexOf(cb); if (i >= 0) changeListeners.splice(i, 1); };
  }
  function onSelectionChange(cb) {
    selectionListeners.push(cb);
    return () => { const i = selectionListeners.indexOf(cb); if (i >= 0) selectionListeners.splice(i, 1); };
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
