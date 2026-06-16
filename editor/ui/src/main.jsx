/* ============================================================================
 * WGF Studio — 에디터 셸 진입점 (Preact + esbuild) / P1 → P7(도킹·메뉴바)
 * ----------------------------------------------------------------------------
 * 레이아웃: [메뉴바] / [툴바] / [DockLayout — Unity 식 도킹(스플릿·탭·리다킹)].
 * 각 섹션(Hierarchy·Viewport·Inspector·Assets·Skills·Chat)은 사용자가 자유롭게
 * 배치(드래그 리다킹)·리사이즈·탭화·표시/숨김 할 수 있고, 배치는 localStorage 에
 * 영속된다. 상단 메뉴바는 일반 에디터 기능(폰트 크기·테마·밀도·레이아웃 리셋)과
 * 플러그인 기능(스킬 2트랙·에셋·컴포넌트 15종·Play/Export 등)을 모두 노출한다.
 *
 * 기본 씬 = topdown-min(dev 서버 /games/_editor-samples/topdown-min/scene.json).
 *
 * window.WGFEditor 프로그래매틱 API(e2e 게이트 검증용) — 시그니처 불변:
 *   loadScene(doc) serialize() hash() addEntity(partial) setTransform(id,patch)
 *   select(ids) getSelection() undo() redo() undoDepth() redoDepth() save()
 *   reloadFromSaved() entityCount() …
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
import {
  DockLayout, DEFAULT_LAYOUT, normalizeLayout, serializeLayout,
  isPanelVisible, addPanelToLayout, removePanelFromLayout
} from './dock/DockLayout.jsx';
import { MenuBar } from './menu/MenuBar.jsx';
import { buildMenus } from './menu/menuModel.js';
import { createEditorSettings } from './editorSettings.js';
import { TilePalette } from './TilePalette.jsx';

// 기본 자동 로드 씬 경로(dev 서버 루트 기준).
const DEFAULT_SCENE_URL = '/games/_editor-samples/topdown-min/scene.json';

// 폴백 최소 씬(fetch 실패 시 — 빈 화면 방지, e2e 구동 보장).
const FALLBACK_SCENE = {
  format: 'wgf-scene@1', slug: 'fallback',
  meta: { title: '폴백 씬', genre: 'topdown', viewport: { w: 320, h: 240 }, pixelArt: true },
  assets: { sprites: [] }, walls: [],
  scenes: [{ id: 'main', systems: {}, entities: [] }], dataLayers: {}
};

// 도킹 가능한 패널 id 집합(panels 레지스트리 키 = layout 트리 panelId).
const PANEL_IDS = ['hierarchy', 'viewport', 'inspector', 'assets', 'skills', 'chat'];
// 레이아웃 영속 키(설정과 분리 — 배치 트리만 보관).
const LAYOUT_KEY = 'wgf-studio-layout';

// 저장된 도킹 레이아웃 로드(없거나 손상 시 null → DockLayout 이 DEFAULT 로 정규화).
function loadSavedLayout() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(LAYOUT_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch (e) { /* 사적 모드/파싱 오류 → null */ }
  return null;
}
function persistLayout(layout) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(serializeLayout(layout)));
    }
  } catch (e) { /* 무시 */ }
}

function App({ controller, settings }) {
  const [world, setWorld] = useState(null);
  const [selection, setSelection] = useState([]);
  const [gizmoMode, setGizmoMode] = useState('move');
  const [mode, setMode] = useState('edit');
  // 타일 페인팅 상태(2C 규약).
  const [paintMode, setPaintMode] = useState(false);
  const [selectedTile, setSelectedTile] = useState(null);   // {assetId, frame} | null
  const [activeLayerId, setActiveLayerId] = useState(null); // TilemapLayer 컨테이너 id
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [docState, setDocState] = useState(null);
  // 도킹 레이아웃 트리(저장본 → 정규화). 패널 집합과 불일치하면 자동 흡수.
  const [layout, setLayout] = useState(() => normalizeLayout(loadSavedLayout(), PANEL_IDS));
  // 환경설정 미러(폰트·테마·밀도·스냅) — 메뉴 체크 상태·툴바 스냅 동기용.
  const [settingsState, setSettingsState] = useState(() => settings.get());

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

  // 환경설정 변경 → 미러 갱신(재렌더로 메뉴 체크/툴바 스냅 동기). CSS 반영은 settings 가 직접.
  useEffect(() => {
    const off = settings.subscribe((s) => setSettingsState(s));
    return off;
  }, []);

  // scene_screenshot 캡처 왕복(2B) — 브리지가 SSE 로 캡처를 요청하면 뷰포트를 PNG 로 캡처해
  //  브리지에 회신한다. remote 전용(local 은 컨트롤러가 무동작).
  //  [ACC-1] WebGL 뷰포트는 컴포지팅 후 드로잉버퍼가 비어 canvas.toDataURL 이 검은 PNG 를
  //   줄 수 있다(preserveDrawingBuffer 미설정). Phaser 의 renderer.snapshot(cb) 은 다음
  //   프레임에 스냅샷을 강제 렌더해 그 값과 무관하게 올바른 PNG 를 준다 — 이를 우선하고,
  //   미가용/실패/타임아웃이면 canvas.toDataURL 로 폴백한다. 캡처는 Promise(비동기).
  useEffect(() => {
    if (!controller.isRemote || !controller.onScreenshotRequest) return;

    // 뷰포트 host 의 <canvas>(Phaser 생성) 직접 캡처 — 폴백 경로.
    function captureCanvasFallback() {
      const host = (typeof document !== 'undefined') ? document.getElementById('wgf-viewport') : null;
      const canvas = host ? host.querySelector('canvas') : null;
      if (!canvas) return null;
      let dataUrl = null;
      try { dataUrl = canvas.toDataURL('image/png'); } catch (e) { return null; }
      if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/png;base64,') !== 0) return null;
      return { dataUrl, width: canvas.width, height: canvas.height };
    }

    controller.onScreenshotRequest(() => {
      // Phaser game.renderer.snapshot 우선(WebGL 드로잉버퍼 무관 — 다음 프레임 강제 렌더).
      const adapter = controller.getAdapter ? controller.getAdapter() : null;
      const game = adapter && adapter._game ? adapter._game : null;
      const renderer = game && game.renderer ? game.renderer : null;
      if (!renderer || typeof renderer.snapshot !== 'function') {
        // snapshot 미가용 → 폴백.
        return captureCanvasFallback();
      }
      return new Promise((resolve) => {
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } };
        // snapshot 콜백이 늦거나 안 오면(렌더 정지 등) 폴백으로 회신.
        const fbTimer = setTimeout(() => done(captureCanvasFallback()), 1500);
        try {
          renderer.snapshot((image) => {
            clearTimeout(fbTimer);
            // image = HTMLImageElement(WebGL/Canvas 공통, type 기본 image/png). .src 가 PNG dataURL.
            const src = image && typeof image.src === 'string' ? image.src : null;
            if (src && src.indexOf('data:image/png;base64,') === 0) {
              done({ dataUrl: src, width: (image.width || game.scale.width), height: (image.height || game.scale.height) });
            } else {
              done(captureCanvasFallback());
            }
          });
        } catch (e) {
          clearTimeout(fbTimer);
          done(captureCanvasFallback());
        }
      });
    });
  }, []);

  // 전역 키보드 단축키 — 메뉴에 표시된 단축키를 실제 바인딩. 입력 위젯(INPUT/TEXTAREA/
  // SELECT/contentEditable) 포커스 시엔 가로채지 않는다(텍스트 편집·네이티브 undo 보존).
  useEffect(() => {
    function onKey(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target;
      const tag = (el && el.tagName) ? el.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
      const k = e.key;
      if (k === 's' || k === 'S') { e.preventDefault(); e.shiftKey ? controller.reloadFromSaved() : controller.save(true); }
      else if (k === 'z' || k === 'Z') { e.preventDefault(); e.shiftKey ? controller.redo() : controller.undo(); }
      else if (k === 'y' || k === 'Y') { e.preventDefault(); controller.redo(); }
      else if (k === '=' || k === '+') { e.preventDefault(); settings.increaseFont(); }
      else if (k === '-' || k === '_') { e.preventDefault(); settings.decreaseFont(); }
      else if (k === '0') { e.preventDefault(); settings.resetFont(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 초기 씬 로드. 마운트는 Viewport 가 담당.
  //  - remote(브리지): /api/scene 스냅샷으로 부트(브리지 = 단일 진실).
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

  // 저장된 스냅 기본값을 어댑터 마운트 후(=docState 준비 후) 코어에 1회 반영.
  useEffect(() => {
    if (docState && settings.get().snapDefault) {
      controller.setSnap(true, settings.get().snapSize);
    }
  }, [docState]);

  // 스냅은 settings 단일 진실에서 파생 — 툴바·메뉴 토글이 같은 상태를 공유.
  function onSnapChange(on, size) {
    settings.set({ snapDefault: on, snapSize: size });
    controller.setSnap(on, size);
  }

  // 레이아웃 갱신 + 영속(항상 정규화 — 패널 집합 불일치/손상 흡수).
  function updateLayout(next) {
    const norm = normalizeLayout(next, PANEL_IDS);
    setLayout(norm);
    persistLayout(norm);
  }

  if (!docState) {
    return <div style={{ padding: '20px', color: '#8a93a8' }}>씬 로딩 중…</div>;
  }

  const snap = settingsState.snapDefault;
  const snapSize = settingsState.snapSize;

  // 메뉴바 "보기" 메뉴가 쓰는 레이아웃 API — 현재 layout 클로저로 매 렌더 생성.
  const layoutApi = {
    isVisible: (id) => isPanelVisible(layout, id),
    showPanel: (id) => updateLayout(addPanelToLayout(layout, id)),
    hidePanel: (id) => updateLayout(removePanelFromLayout(layout, id)),
    togglePanel: (id) => updateLayout(
      isPanelVisible(layout, id) ? removePanelFromLayout(layout, id) : addPanelToLayout(layout, id)
    ),
    resetLayout: () => updateLayout(serializeLayout(DEFAULT_LAYOUT))
  };

  // 패널 레지스트리 — 매 렌더 최신 props 클로저(prop 구동). DockLayout 이 render() 호출.
  const panels = {
    hierarchy: { title: '계층', icon: '🗂', render: () => <Hierarchy controller={controller} world={world} selection={selection} /> },
    viewport: { title: '뷰포트', icon: '🎬', render: () => (
      <Viewport controller={controller} sceneDoc={docState}
                paintMode={paintMode} selectedTile={selectedTile}
                snapSize={snapSize} activeLayerId={activeLayerId}
                onLayerCreated={(id) => setActiveLayerId(id)} />
    ) },
    inspector: { title: '속성', icon: '🔧', render: () => <Inspector controller={controller} world={world} selection={selection} /> },
    assets: { title: '에셋', icon: '🖼', render: () => <AssetBrowser controller={controller} selection={selection} /> },
    skills: { title: '스킬', icon: '✨', render: () => <SkillMenu controller={controller} /> },
    chat: { title: 'Claude 챗', icon: '💬', render: () => <ChatPanel controller={controller} /> }
  };

  // 메뉴는 순수 빌더 — 매 렌더 재호출해 최신 상태(selection·mode·undo·settings) 반영.
  const menus = buildMenus({
    controller, settings, layoutApi, selection,
    undoDepth, redoDepth, mode, panelIds: PANEL_IDS
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <MenuBar menus={menus} />
      <Toolbar controller={controller} gizmoMode={gizmoMode} snap={snap} snapSize={snapSize}
               mode={mode} undoDepth={undoDepth} redoDepth={redoDepth} onSnapChange={onSnapChange}
               paintMode={paintMode}
               onPaintToggle={() => setPaintMode((p) => !p)} />
      {paintMode && (
        <TilePalette controller={controller} selectedTile={selectedTile}
                     onSelect={setSelectedTile} />
      )}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <DockLayout panels={panels} layout={layout} onLayoutChange={updateLayout} />
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
  // 환경설정 스토어(생성 시 저장된 CSS 변수 즉시 반영 — applyToDocument 자동 호출).
  const settings = createEditorSettings();

  // window.WGFEditor — e2e 프로그래매틱 API(편집 인스턴스 래핑).
  // local·remote 둘 다에서 동일 시그니처. remote 에선 명령이 브리지를 거쳐 Promise 반환.
  window.WGFEditor = {
    _controller: controller,
    _transport: transport,
    _bridge: getBridgeConfig(),
    _settings: settings,
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
    assignAssetToEntity: (id, spriteId) => controller.assignAssetToEntity(id, spriteId),
    // 멀티씬 + 뷰포트 드롭(기능 C/E — e2e 검증용)
    createEntityAtFromAsset: (payload, assetId, x, y) => controller.createEntityAtFromAsset(payload, assetId, x, y),
    listScenes: () => controller.listScenes(),
    addScene: (name) => controller.addScene(name),
    renameScene: (id, name) => controller.renameScene(id, name),
    removeScene: (id) => controller.removeScene(id),
    switchScene: (id) => controller.switchScene(id)
  };

  render(<App controller={controller} settings={settings} />, document.getElementById('app'));
}

boot();
