<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-15 | Updated: 2026-06-15 -->

# editor/ui/src/

## Purpose
WGF Studio 에디터 셸의 **Preact 소스**. 비-UI 컨트롤러(`editorController.js`)가 모든 씬 상태 변경의 단일 경로이고, transport(`bridgeTransport.js`)가 remote(브리지 SSE/POST) ↔ local(인메모리) 을 추상화한다. `main.jsx` 가 부트해 메뉴바·툴바·도킹 레이아웃에 패널(계층·뷰포트·속성·에셋·스킬·챗)을 배치한다. 모든 컴포넌트는 `controller`/`props` 구동(명령형 구독 최소화)이며, 엔진은 `window.*` 전역으로만 참조한다(무빌드 경계).

## Key Files
| File | Description |
|------|-------------|
| `main.jsx` | 부트 + `App`(상태 동기·patterns 레지스트리·전역 단축키)·`window.WGFEditor` e2e API. transport→controller→settings→render |
| `editorController.js` | **비-UI 컨트롤러(단일 경로)**. applyCommand(remote=POST/ local=어댑터)·Undo/Redo 스택·Save/Load(localStorage)·선택·에셋(getAssets/addProcedural/addCc0/`assignAssetToEntity(id,spriteId,opts)`/onAssetChange)·스킬 2트랙(runSkill/dispatchCreative)·챗 역채널·Unity 임포트 |
| `bridgeTransport.js` | remote/local transport. `window.__WGF_BRIDGE__` 주입 시 remote(토큰 apiFetch·SSE onDelta/onResync/onMode/onChat/onStatus/onAsset). `apiFetch` 가 `/api/*` 공통 |
| `editorSettings.js` | 폰트·테마 강조색·밀도 환경설정(CSS 변수 + localStorage `wgf-studio-settings`) |
| `Toolbar.jsx` | 기즈모 모드·스냅·Play/Stop·Undo/Redo 툴바 |
| `Hierarchy.jsx` | 엔티티 트리 + 선택 + **에셋 드롭(raw spriteId 또는 라이브러리 프레임 JSON `{relPath,frame,as}` → spriteApi.use→assign)** |
| `Viewport.jsx` | Phaser 어댑터 마운트(`SceneKitPhaser.create`) 호스트 |
| `Inspector.jsx` | 컴포넌트 편집(inspectorFields 자동 생성 + Sprite `frame` 필드 + AnimatedSprite anims 구조화 폼 + asset-ref 썸네일) |
| `ChatPanel.jsx` | 에디터↔Claude 챗 역채널 + 연결 상태 인디케이터 |
| `SkillMenu.jsx` | 2-트랙 스킬 메뉴(결정형 execFile/창작형 디스패치) |
| `AssetBrowser.jsx` | "에셋" 패널 — 본문은 `sprite/SpriteBrowser` 렌더(export 이름 유지). 기존 절차/CC0-URL/Unity 임포트 어더 보존 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `dock/` | 유니티식 자유배치 도킹(스플릿·탭·드래그 리다킹) (see `dock/AGENTS.md`) |
| `menu/` | 상단 메뉴바 + 메뉴 모델(전 기능 배선) (see `menu/AGENTS.md`) |
| `sprite/` | 통합 유니티식 스프라이트 브라우저·슬라이서·API (see `sprite/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **모든 씬 변경은 `controller` 경유**(직접 어댑터/world 변형 금지). remote 는 브리지가 권위 → POST 후 SSE 델타로 미러 동기, local 은 어댑터 직접 + Undo 스택.
- **엔진은 전역으로만**: `window.SceneKit`/`window.SceneKitPhaser`. `engine/*` 를 `import` 하지 말 것(번들 경계).
- **`window.WGFEditor` 시그니처 불변**: e2e 게이트가 의존. 메서드 추가는 가능하나 기존 시그니처 변경 금지.
- 재렌더: `getWorld()` 는 안정(in-place) 참조라 `main.jsx` 가 `forceRender` 카운터로 갱신 — 새 컴포넌트는 controller `onChange`/`onSelectionChange`/`onAssetChange` 구독으로 동기.
- 스타일은 CSS 변수(`--panel`·`--accent`·`--border`·`--font-size`…) 사용해 테마/밀도 일관.

### Testing Requirements
- 변경 후 `node editor/ui/build.mjs` 빌드 성공 + 브라우저 e2e(패널 렌더·콘솔 0). LSP 진단 0 확인.
- Preact hooks 규칙(최상위 호출). rAF/IntersectionObserver/이벤트 리스너는 effect cleanup 등록(언마운트 누수 가드).

### Common Patterns
- 컴포넌트는 `{ controller, ... }` props 받음 → controller 메서드 호출 + 구독으로 갱신.
- 적용 흐름: 라이브러리 선택 → `spriteApi.use({relPath,frameConfig?,frame?})` → `controller.assignAssetToEntity(entityId, asset.id, {frame, as, anims?, play?})`.

## Dependencies

### Internal
- `editor/server/bridge.mjs`(remote /api·SSE), `engine/scenekit*`(전역 코어/어댑터).

### External
- **preact** / **preact/hooks**(번들). 그 외 외부 의존 없음(엔진은 전역).

<!-- MANUAL: -->
