<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-15 | Updated: 2026-06-15 -->

# editor/

## Purpose
**WGF Studio** — 브라우저에서 유니티식 GUI 로 씬·게임오브젝트를 직접 편집하고, 에디터 안에서 Claude 와 협업 편집하며, 2-트랙 스킬(결정형=에디터 직접 실행·창작형=Claude 디스패치)을 적용하고, 에디터 내 Play 후 **무빌드 정적 게임으로 export** 하는 선언형 게임 에디터다. 손코딩 `game.js` 트랙과 별개로, 단일 진실은 `games/<slug>/scene.json`(wgf-scene@1)이며 로직은 `engine/scenekit.js`(코어)·`engine/scenekit-phaser.js`(어댑터)가 담당한다. 이 디렉터리는 그 위에 **에디터 셸(UI)과 백엔드(브리지·MCP·export)**를 얹는다. 무빌드 엔진 불변식을 깨지 않도록 npm 의존은 `editor/ui` 에만 격리된다.

## Key Files
| File | Description |
|------|-------------|
| `serve.mjs` | zero-dep http 정적 dev 서버(127.0.0.1, traversal 다층 차단). **local 모드** 진입점 — 브리지 없이 `editor/ui` 셸을 띄워 P1 인메모리 편집만 할 때 사용(`node editor/serve.mjs 5174`). 권위 편집은 `server/bridge.mjs` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `server/` | zero-dep Node 백엔드 — 브리지(라이브 씬 단일 진실)·MCP 프록시·export·에셋 임포트·스프라이트 라이브러리 + 게이트 테스트 (see `server/AGENTS.md`) |
| `ui/` | Preact + esbuild 에디터 셸(저장소에서 유일하게 빌드되는 영역) (see `ui/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **두 실행 모드를 구분하라.** `remote`(권위) = `server/bridge.mjs` 가 라이브 씬 상태·커맨드 로그·Undo/Redo 의 단일 진실이고 UI 는 SSE 구독자(미러). `local`(P1) = `serve.mjs` 가 정적 서빙만, UI 가 인메모리 어댑터로 직접 편집(브리지 기능·스킬·에셋 추가 비활성).
- **장수명 프로세스 주의(중요).** 브리지/MCP 는 사람이 기동하는 장수명 프로세스라 **코드 변경이 즉시 반영되지 않는다** — `server/*.mjs`·`engine/*` 을 바꾸면 브리지 재기동(+브라우저 reload) 필요, MCP 는 다음 세션부터 새 코드.
- **게이트가 공유 엔드포인트 파일을 덮어쓴다.** `test-*.mjs` 게이트는 `.omc/wgf-editor/bridge-endpoint.json` 을 ephemeral 포트로 덮어써 라이브 MCP 프록시가 죽은 포트를 가리키게 만들 수 있다 — 게이트 후 라이브 MCP 를 쓰려면 엔드포인트 복원.
- 보안 1급: 127.0.0.1 전용 바인딩, `/api/*` 토큰(crypto.randomBytes)+Origin 검사, 모든 경로 REPO_ROOT 정규화 + traversal·dotfile 차단, 결정형 스킬은 execFile 배열인자(셸 미경유).
- 산출 문서·주석·커밋은 한글(코드 식별자·경로·라이브러리명은 원문).

### Testing Requirements
- 백엔드 게이트: `node editor/server/test-bridge.mjs`(38)·`test-mcp.mjs`(27)·`test-skill.mjs`(49)·`test-export.mjs`(24)·`test-demo.mjs`(13)·`test-security.mjs`(16)·`test-asset-import.mjs`(54)·`test-image-sprites.mjs`(17)·`test-sprite-library.mjs`(46). 코어 회귀는 `node skills/wgf-editor/tools/test-scenekit.mjs`(98).
- UI 빌드: `cd editor/ui && node build.mjs`(prod minify). 렌더/기즈모/스프라이트 브라우저는 DOM 전용이라 헤드리스 불가 → 브라우저 e2e(스크린샷이 진실).
- 라이브 기동: `node editor/server/bridge.mjs 5180` → `http://127.0.0.1:5180/editor/ui/`(특정 게임은 `WGF_BRIDGE_SCENE=games/<slug>/scene.json`).

### Common Patterns
- 편집 흐름: 사용자 GUI 조작 또는 Claude 명령 → `applyCommand`(SceneKit.applyCommand) → 브리지 seq 부여 → SSE 델타 → 미러 동기. 모든 씬 변경은 이 단일 경로.
- 에셋 def(`world.assets.sprites[]`)는 엔티티가 `Sprite`/`AnimatedSprite` 로 ref 할 때만 렌더에 들어간다.

## Dependencies

### Internal
- `engine/scenekit.js`(코어·결정적 t=0)·`scenekit-phaser.js`(Phaser 어댑터)·`scenekit-components.js`(컴포넌트 등록) — 브리지(Node require)·UI(window 전역) 양쪽이 동일 코어 사용.
- 결정형 스킬 도구: `skills/wgf-game-qa/tools/*`·`skills/wgf-editor/tools/lint-scene.mjs`(화이트리스트 execFile).
- 런처/문서: `skills/wgf-editor/`(SKILL.md + reference).

### External
- **Node.js 빌트인만**(http·fs·path·crypto·child_process·url·module) — 백엔드 zero-dep.
- **esbuild·preact** — `ui/` 에만 격리(루트 무빌드 불변식 보존).

<!-- MANUAL: -->
