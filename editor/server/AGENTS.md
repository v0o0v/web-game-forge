<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-15 | Updated: 2026-06-15 -->

# editor/server/

## Purpose
WGF Studio 의 **zero-dep Node 백엔드**. `bridge.mjs` 가 라이브 씬 상태·커맨드 로그·Undo/Redo 의 단일 권위자이며, 정적 서빙(REPO_ROOT, 토큰+Origin 게이트)·SSE 델타 스트림·결정형 스킬 실행·에셋(절차/CC0/Unity 임포트/스프라이트 라이브러리)·export 를 담당한다. `mcp.mjs` 는 Claude 가 spawn 하는 무상태 MCP 프록시로 브리지 HTTP 를 감싼다. 모든 모듈은 Node 빌트인만 쓰며(npm 0), 상태 변경은 `SceneKit.applyCommand`/`applyUndo` 로만 일어난다(결정론 불변식).

## Key Files
| File | Description |
|------|-------------|
| `bridge.mjs` | **단일 진실 브리지**(장수명). http+SSE+POST, 127.0.0.1, 토큰[crypto.randomBytes24]+Origin, 커맨드 직렬 apply 큐·Undo/Redo·Last-Event-ID 복구·백프레셔 resync, Play 권위(409). 라우트: `/api/scene`(ETag 304)·`/api/command`·`/api/undo|redo`·`/api/mode`·`/api/events`(SSE)·`/api/chat*`(역채널)·`/api/heartbeat`·`/api/skill/run`(화이트리스트)·`/api/asset/*`·`/api/sprite/*`(catalog·library·slice·use·download) |
| `mcp.mjs` | newline-delimited JSON-RPC 2.0 MCP stdio 프록시(무상태). 도구 호출 → 브리지 HTTP. 엔드포인트는 `.omc/wgf-editor/bridge-endpoint.json`(또는 env) |
| `export.mjs` | `scene.json` → `games/<slug>/{index.html,game.js,CREDITS.txt}` 무빌드 export. 로컬 이미지 vendoring·game-root url 재작성·QA가능 계약(window.<Slug>+autostart+seed) |
| `asset-import.mjs` | Unity 로컬 폴더 스캔/벤더링. `scanLocalFolder`·`vendorFile`·`suggestIdFromPath`·`normalizeLicense`·`MAX_FILES` export. warn-attest 라이선스 분류 |
| `sprite-library.mjs` | **스프라이트 브라우저 백엔드**(순수 함수). `readCatalog`(packs.json+sources.json, 다운로드여부)·`scanLibrary`(assets-library/**+게임 assets → sheet/collection)·`readSlices`/`writeSlice`(`assets-library/wgf-slices.json` 사이드카)·`resolveLibraryPath`(traversal·dotfile 가드)·`sanitizeFrameConfig`/`sanitizeFramesArray` |
| `test-bridge.mjs` | 브리지 게이트(38) — 커맨드 라운드트립·Play 409·SSE 복구·갭 resync·백프레셔·traversal·토큰·Origin·newId·ETag |
| `test-mcp.mjs` | MCP 게이트(27) — JSON-RPC 프레이밍·도구→브리지 프록시 |
| `test-skill.mjs` | 결정형 스킬 게이트(49) — 화이트리스트·인자 스키마·execFile 안전 |
| `test-export.mjs` | export 게이트(24) — 동형성 H·qaable·seed/rng·bakeHash |
| `test-demo.mjs` | 데모 게이트(13) — wgf-demo-arena 구조/계약 |
| `test-security.mjs` | 보안 게이트(16) — 토큰 상수시간·경로 가드·dotfile·스킴 |
| `test-asset-import.mjs` | Unity 임포트 게이트(54) — 스캔 분류·벤더링·attestation |
| `test-image-sprites.mjs` | 비트맵 시트 게이트(17) — frameConfig/frame·cross-slug 복사·AnimatedSprite 코어 진행 |
| `test-sprite-library.mjs` | 스프라이트 브라우저 게이트(46) — catalog/library/slice/use 라운드트립·collection filesRel·frames[]·경로 가드 |

## For AI Agents

### Working In This Directory
- **zero-dep 불변식**: Node 빌트인만. npm import 금지(`require('node:*')`·전역만).
- **상태 변경은 `SceneKit.applyCommand`/`applyUndo` 로만** — 직접 world 변형 금지(에셋 def 슬롯 추가는 예외이나 `asset` 델타로 브로드캐스트해 미러 동기).
- **보안 패턴을 따르라**: 새 `/api/*` 라우트는 토큰+Origin 게이트(공통 경로) 안에서, 경로 인자는 `resolveScopedPath`(repo/games) 또는 `sprite-library.resolveLibraryPath` 로 정규화, 외부 폴더는 `resolveExternalFolder`(절대경로·실존), 도구 실행은 `execFile`(배열인자·셸 미경유)+화이트리스트.
- **장수명 주의**: 코드 변경은 브리지 재기동 후 반영. 게이트가 엔드포인트 파일을 덮어쓰므로 라이브 MCP 사용 전 복원.
- 새 기능은 가능하면 순수 함수 모듈(예: `sprite-library.mjs`)로 분리하고 `bridge.mjs` 는 라우트만 — 테스트 용이.

### Testing Requirements
- 변경 모듈의 대응 `test-*.mjs` 통과 + 인접 게이트 회귀 0. 테스트 하니스는 `WGF_BRIDGE_PORT=0`(임의 포트)·`WGF_NO_OPEN=1` 로 브리지를 spawn 해 fetch 검증한다.
- 새 엔드포인트는 라운드트립 + 경로/권한 가드(traversal·dotfile·범위 밖) 거부 케이스를 함께 테스트.

### Common Patterns
- 라우트 핸들러: `readBody` → `JSON.parse`(실패 400) → 검증 → 동작 → `sendJSON`. 씬 변경은 `pushCommand`(seq+SSE), 에셋은 `addAsset`(asset 델타).
- `current` 토큰 인자(file/target)는 현재 씬을 임시 직렬화(`writeTempScene`, `_wgf-tmp`)해 결정형 도구에 전달.

## Dependencies

### Internal
- `engine/scenekit.js`·`scenekit-components.js`(Node require — authoritative world).
- `editor/ui/`(브리지가 `index.html` 에 토큰 주입해 서빙 → remote 모드).
- 카탈로그/다운로드: `skills/wgf-sprite-picker/catalog/{packs.json,sources.json,fetch-pack.mjs,analyze-pack.mjs,thumbnails/}`.

### External
- **Node.js 빌트인만**(http·fs·path·crypto·child_process·url·module).

<!-- MANUAL: -->
