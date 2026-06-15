<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-15 | Updated: 2026-06-15 -->

# editor/ui/

## Purpose
WGF Studio 의 **에디터 셸(Preact + esbuild)** — 저장소에서 **유일하게 빌드되는 영역**이다(루트 무빌드 불변식을 깨지 않도록 npm 의존을 이 디렉터리에만 격리). `src/main.jsx` 를 `dist/bundle.js` 로 번들하며, 엔진(`engine/*.js`)·게임 산출물은 무빌드 `<script>` 전역으로 남는다. `index.html` 이 엔진 전역(SceneKit·SceneKitPhaser·Phaser)을 로드한 뒤 번들을 띄우고, 브리지가 서빙할 때 `<head>` 에 `window.__WGF_BRIDGE__`(토큰·base)를 주입하면 remote 모드로, 없으면 local 폴백으로 동작한다.

## Key Files
| File | Description |
|------|-------------|
| `index.html` | 셸 HTML. 엔진 전역 `<script>` 로드 + `dist/bundle.js` + `#app` 마운트. `--font-size` 등 CSS 변수·도킹 hover 스타일. 브리지가 토큰 주입 지점(`</head>`) |
| `build.mjs` | esbuild 번들러. `node build.mjs`(prod: `minify:true`·`sourcemap:false`) / `--watch`(dev: minify off·sourcemap on). JSX=automatic+preact. 엔진은 번들 제외(전역 참조) |
| `package.json` | `wgf-studio-ui` — `type:module`, scripts `build`/`watch`, devDeps `esbuild`·`preact`. **루트 무빌드 격리 경계** |
| `package-lock.json` | 잠금 파일 |
| `README.md` | UI 셸 빌드/실행 안내 |
| `.gitignore` | `node_modules/`·`dist/` 무시(산출물·의존은 커밋 대상 아님) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | 셸 소스(Preact 컴포넌트·컨트롤러·transport·도킹·메뉴·스프라이트 브라우저) (see `src/AGENTS.md`) |
| `dist/` | esbuild 산출(`bundle.js`) — **gitignore, 커밋 안 함**. 변경 후 `node build.mjs` 로 재생성 |
| `node_modules/` | esbuild·preact — **gitignore** |

## For AI Agents

### Working In This Directory
- **무빌드 엔진 경계 보존**: esbuild·preact 는 여기서만. `src/` 는 `engine/*` 를 `import` 하지 말고 `window.SceneKit`/`window.SceneKitPhaser` 전역으로 접근(번들에 엔진 미포함).
- **소스 변경 후 빌드 필요**: `src/*.jsx` 를 바꾸면 `node editor/ui/build.mjs` 로 `dist/bundle.js` 재생성해야 브라우저에 반영(브리지는 prebuilt 번들을 서빙).
- **빌드 경합 주의**: 여러 에이전트가 동시에 `node build.mjs` 를 돌리면 `dist/bundle.js` 쓰기 충돌 — 통합 빌드는 1회만(리드).
- prod 번들은 minify(charset 기본 ascii → 한글이 `\uXXXX` 이스케이프됨, grep 시 ASCII 문자열로 확인).

### Testing Requirements
- 빌드 성공 확인(`node build.mjs`, 에러 0). 단일 파일 파스 점검: `npx esbuild src/<file>.jsx --bundle --jsx=automatic --jsx-import-source=preact --outfile=NUL`(또는 /dev/null).
- 렌더/상호작용은 DOM 전용 → 브라우저 e2e(`http://127.0.0.1:<port>/editor/ui/`). SSE 상시연결 페이지는 동기 eval 사용(스크린샷이 진실).
- `window.WGFEditor` 프로그래매틱 API 로 e2e 구동(loadScene/serialize/hash/addEntity/setTransform/select/undo/redo/save…).

### Common Patterns
- 부트(`main.jsx boot()`): transport 선택(remote/local) → controller 생성 → settings → `render(<App/>, #app)`.
- 패널은 `App` 의 `panels` 레지스트리(매 렌더 최신 props 클로저) → `DockLayout` 이 호출. 탭 전환은 unmount 아닌 display 토글(Phaser 캔버스/스크롤 보존).

## Dependencies

### Internal
- `engine/scenekit.js`·`scenekit-phaser.js`·`scenekit-components.js`(window 전역, 무빌드).
- `editor/server/bridge.mjs`(remote 모드 토큰 주입·SSE·/api).

### External
- **esbuild ^0.21**(번들)·**preact ^10.22**(UI) — 이 디렉터리에만 격리.

<!-- MANUAL: -->
