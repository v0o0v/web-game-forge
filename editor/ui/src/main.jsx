/* ============================================================================
 * WGF Studio — 에디터 셸 진입점 (Preact + esbuild) / P1
 * ----------------------------------------------------------------------------
 * 레이아웃: [툴바] / [Hierarchy | Viewport | Inspector].
 * 기본 씬 = topdown-min(dev 서버 /games/_editor-samples/topdown-min/scene.json).
 *
 * window.WGFEditor 프로그래매틱 API(e2e 게이트 검증용):
 *   loadScene(doc) serialize() hash() addEntity(partial) setTransform(id,patch)
 *   select(ids) getSelection() undo() redo() undoDepth() save() reloadFromSaved()
 *   entityCount()
 * 이 API 만으로 "10엔티티 추가→save→reload→hash/좌표 동일", "10커맨드→undo×10→
 * redo×10 hash 일치" 를 콘솔에서 구동 가능.
 * ==========================================================================*/
import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { createController } from './editorController.js';
import { createTransport, getBridgeConfig } from './bridgeTransport.js';
import { Toolbar } from './Toolbar.jsx';
import { Hierarchy } from './Hierarchy.jsx';
import { Viewport } from './Viewport.jsx';
import { Inspector } from './Inspector.jsx';
import { ChatPanel } from './ChatPanel.jsx';
import { SkillMenu } from './SkillMenu.jsx';
import { AssetBrowser } from './AssetBrowser.jsx';

// 기본 자동 로드 씬 경로(dev 서버 루트 기준).
const DEFAULT_SCENE_URL = '/games/_editor-samples/topdown-min/scene.json';

// 폴백 최소 씬(fetch 실패 시 — 빈 화면 방지, e2e 구동 보장).
const FALLBACK_SCENE = {
  format: 'wgf-scene@1', slug: 'fallback',
  meta: { title: '폴백 씬', genre: 'topdown', viewport: { w: 320, h: 240 }, pixelArt: true },
  assets: { sprites: [] }, walls: [],
  scenes: [{ id: 'main', systems: {}, entities: [] }], dataLayers: {}
};

function App({ controller }) {
  const [world, setWorld] = useState(null);
  const [selection, setSelection] = useState([]);
  const [gizmoMode, setGizmoMode] = useState('move');
  const [snap, setSnap] = useState(false);
  const [snapSize, setSnapSize] = useState(16);
  const [mode, setMode] = useState('edit');
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [docState, setDocState] = useState(null);

  // syncState 가 강제 재렌더를 트리거하기 위한 카운터. useRef 가 아니라 useState 여야
  // 한다 — getWorld() 는 어댑터의 안정적(in-place 변형) 참조라 setWorld(sameRef) 만으로는
  // Preact 가 재렌더를 bail 한다. 이 카운터 bump 로 매 변경마다 Hierarchy/Inspector 를 갱신.
  const [, forceRender] = useState(0);

  // 컨트롤러 변경 → 상태 동기화.
  function syncState() {
    setWorld(controller.getWorld());
    setSelection(controller.getSelection());
    setGizmoMode(controller.getGizmoMode());
    setMode(controller.getMode());
    setUndoDepth(controller.undoDepth());
    setRedoDepth(controller.redoDepth());
    forceRender((n) => n + 1);
  }

  useEffect(() => {
    const offChange = controller.onChange(syncState);
    const offSel = controller.onSelectionChange(() => syncState());
    return () => { offChange(); offSel(); };
  }, []);

  // 초기 씬 로드. 마운트는 Viewport 가 담당.
  //  - remote(브리지): /api/scene 스냅샷으로 부트(브리지 = 단일 진실). Viewport 마운트 후
  //    startRemote() 가 SSE 연결 + 재동기. setDocState 로 어댑터 초기 마운트 문서 제공.
  //  - local: P1 처럼 topdown-min fetch.
  useEffect(() => {
    if (controller.isRemote) {
      controller.startRemote()
        .then((snap) => { setDocState((snap && snap.scene) ? snap.scene : FALLBACK_SCENE); })
        .catch(() => { setDocState(FALLBACK_SCENE); });
    } else {
      fetch(DEFAULT_SCENE_URL)
        .then((r) => r.ok ? r.json() : Promise.reject(new Error('fetch ' + r.status)))
        .then((doc) => { setDocState(doc); })
        .catch(() => { setDocState(FALLBACK_SCENE); });
    }
  }, []);

  function onSnapChange(on, size) {
    setSnap(on); setSnapSize(size);
    controller.setSnap(on, size);
  }

  if (!docState) {
    return <div style={{ padding: '20px', color: '#8a93a8' }}>씬 로딩 중…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar controller={controller} gizmoMode={gizmoMode} snap={snap} snapSize={snapSize}
               mode={mode} undoDepth={undoDepth} redoDepth={redoDepth} onSnapChange={onSnapChange} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 좌측: Hierarchy + AssetBrowser 스택 */}
        <div style={{ width: '230px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: '1 1 50%', minHeight: 0 }}>
            <Hierarchy controller={controller} world={world} selection={selection} />
          </div>
          <div style={{ flex: '1 1 50%', minHeight: 0 }}>
            <AssetBrowser controller={controller} selection={selection} />
          </div>
        </div>
        <Viewport controller={controller} sceneDoc={docState} />
        {/* 우측: Inspector + SkillMenu 스택 */}
        <div style={{ width: '290px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: '1 1 60%', minHeight: 0 }}>
            <Inspector controller={controller} world={world} selection={selection} />
          </div>
          <div style={{ flex: '1 1 40%', minHeight: 0 }}>
            <SkillMenu controller={controller} />
          </div>
        </div>
        <div style={{ width: '250px', flexShrink: 0 }}>
          <ChatPanel controller={controller} />
        </div>
      </div>
    </div>
  );
}

// ── 부트 ──────────────────────────────────────────────────────────────────────
function boot() {
  if (typeof window === 'undefined') return;
  if (!window.SceneKit || !window.SceneKitPhaser) {
    document.getElementById('app').textContent =
      'SceneKit/SceneKitPhaser 전역이 없습니다 — engine/*.js 로드 순서를 확인하세요.';
    return;
  }

  // transport 선택: window.__WGF_BRIDGE__ 주입 시 remote(브리지 구독자), 없으면 local(P1).
  const transport = createTransport();
  const controller = createController({ transport });

  // window.WGFEditor — e2e 프로그래매틱 API(편집 인스턴스 래핑).
  // local·remote 둘 다에서 동일 시그니처. remote 에선 명령이 브리지를 거쳐 Promise 반환.
  window.WGFEditor = {
    _controller: controller,
    _transport: transport,
    _bridge: getBridgeConfig(),
    isRemote: controller.isRemote,
    loadScene: (doc) => controller.loadScene(doc),
    serialize: () => controller.serialize(),
    hash: () => controller.hash(),
    addEntity: (partial) => controller.addEntity(partial),
    setTransform: (id, patch) => controller.setTransform(id, patch),
    select: (ids) => controller.select(ids),
    getSelection: () => controller.getSelection(),
    undo: () => controller.undo(),
    redo: () => controller.redo(),
    undoDepth: () => controller.undoDepth(),
    redoDepth: () => controller.redoDepth(),
    save: () => controller.save(false),       // API 경유 save 는 파일 다운로드 없이 localStorage + 직렬화 반환
    reloadFromSaved: () => controller.reloadFromSaved(),
    entityCount: () => controller.entityCount(),
    // 보조(편의)
    getWorld: () => controller.getWorld(),
    setSnap: (on, size) => controller.setSnap(on, size),
    setMode: (m) => controller.setMode(m),
    // P4 — 스킬(2트랙) + 에셋(브라우저 검증용)
    runSkill: (tool, args) => controller.runSkill(tool, args),
    dispatchCreative: (prompt) => controller.dispatchCreative(prompt),
    getAssets: () => controller.getAssets(),
    addProceduralAsset: (p) => controller.addProceduralAsset(p),
    addCc0Asset: (p) => controller.addCc0Asset(p),
    assignAssetToEntity: (id, spriteId) => controller.assignAssetToEntity(id, spriteId)
  };

  render(<App controller={controller} />, document.getElementById('app'));
}

boot();
