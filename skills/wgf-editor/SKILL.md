---
name: wgf-editor
description: "WGF Studio 브라우저 게임 에디터를 기동해 유니티식 GUI 로 씬·게임오브젝트를 직접 편집하고, 에디터 안에서 Claude 와 협업 편집하며, 2-트랙 스킬을 적용하고, 에디터 내 Play 후 무빌드 정적 게임으로 export 한다. 키워드: 게임 에디터, WGF Studio, 씬 편집, scene.json, 비주얼 편집, 에디터 기동, 레벨 에디터, editor, scene editor, game editor, visual editing."
allowed-tools: Read, Write, Edit, Bash
---

# wgf-editor — WGF Studio 브라우저 게임 에디터 런처

브라우저에서 도는 유니티식 게임 에디터 "WGF Studio" 를 기동하고, Claude Code 가 그 안에서
사용자와 **협업 편집**하게 한다. 사람은 GUI 로 씬·게임오브젝트를 직접 조작하고, Claude 는
에디터 챗으로 받은 지시를 MCP 도구로 씬에 반영한다. 만든 게임은 에디터에서 바로 Play 하고
**무빌드 정적 게임**으로 export 한다. web-game-builder 워크플로의 "에디터로 만들기" 레인.

## 1. 무엇인가

WGF Studio 는 **선언형 `scene.json`** 을 단일 진실로 삼는 브라우저 게임 에디터다. 핵심 설계:

- **SceneKit 로직코어 / Phaser 어댑터 분리.** `engine/scenekit.js`(+ `scenekit-components.js`)
  는 Phaser 비의존·결정적 로직코어다(주입 `dt` 만 소비, 무작위는 RngForge 스트림만).
  `engine/scenekit-phaser.js` 는 그 위에 얹는 브라우저 렌더·기즈모 어댑터다. 코어가 분리돼
  있어 Node 헤드리스로 결정성을 검증할 수 있다.
- **브리지 = 단일 진실.** `editor/server/bridge.mjs` 가 라이브 씬 상태·커맨드 로그·Undo/Redo
  의 단일 권위자다. 모든 변경은 커맨드 → 직렬 apply → SSE 델타 브로드캐스트.
- **무상태 MCP 프록시.** `editor/server/mcp.mjs` 는 Claude Code 가 `.mcp.json` 으로 spawn 하는
  stdio JSON-RPC 어댑터다. 자체 씬 상태 0 — 모든 도구 호출을 브리지에 localhost HTTP 로
  프록시한다. 그래서 "브리지 = 단일 진실" 이 프로세스 수준에서도 성립하고, Claude 세션
  재시작에 강건하다.
- **무빌드 export.** `editor/server/export.mjs` 가 `scene.json` → `games/<slug>/{index.html,
  game.js, CREDITS.txt}` 정적 게임을 생성한다(번들러 0, `<script>` vendoring).
- **동형성 H / H′.** 같은 `scene.json` 의 edit t=0 트랜스폼 = play 0프레임 = export 0프레임
  (계약 H, 동일 코어가 t=0 를 만들므로 구성적 성립). 절차 텍스처 베이크 결정성 +
  AnimatedSprite t=0=프레임0 으로 외형까지 동형(계약 H′).

자세한 토폴로지는 [reference/architecture.md](./reference/architecture.md).

## 2. 언제 사용

- **새 선언형 게임을 GUI 로 만들·편집**할 때 — 엔티티 배치, 컴포넌트 부착, 트랜스폼 조작.
- **Claude 협업 편집**할 때 — 사용자가 에디터 챗에 "적 3마리 추가" 같은 지시를 보내면 Claude 가
  씬 편집 도구로 반영.
- **에디터에서 바로 Play** 해보고, **무빌드 정적 게임으로 export** 할 때.
- 2-트랙 스킬(결정형 린트·창작형 스킬)을 현재 씬에 적용할 때.

**비대상:** 기존 손코딩 `game.js` 게임의 **역편집은 대상이 아니다**. WGF Studio 는 신규
`wgf-scene@1` 포맷만 다룬다(설계 결정 #4). 손코딩 게임 신규 제작·수정은 web-game-builder 의
손코딩 레인(`wgf-make-game` 등)이 담당한다.

## 3. 기동 방법

### 3.1 최초 1회 — UI 셸 빌드

에디터 UI 셸(Preact + esbuild)은 `editor/ui/` 에만 npm 의존이 격리돼 있다. 최초 1회만 빌드한다.
**이 디렉터리에서** 실행한다:

```
cd editor/ui
```

의존 설치:

```
npm install
```

번들 빌드(`editor/ui/dist/bundle.js` 생성):

```
npm run build
```

빌드 산출물(`dist/`)과 `node_modules/` 는 `.gitignore` 로 커밋 제외된다(재생성 가능).

### 3.2 브리지 기동 (remote · 단일 진실)

협업 편집 전체 루프를 쓰려면 브리지 서버를 기동한다(127.0.0.1 전용, zero-dep). **프로젝트
루트에서** 실행한다:

```
node editor/server/bridge.mjs 5180
```

그 다음 브라우저에서 다음 주소를 연다:

```
http://127.0.0.1:5180/editor/ui/
```

기본으로 `games/_editor-samples/topdown-min/scene.json` 이 로드된다.

### 3.3 특정 게임 열기

`WGF_BRIDGE_SCENE` 환경변수로 다른 씬을 지정해 기동한다(PowerShell):

```powershell
$env:WGF_BRIDGE_SCENE="games/wgf-demo-arena/scene.json"; node editor/server/bridge.mjs 5180
```

bash 계열이면:

```bash
WGF_BRIDGE_SCENE=games/wgf-demo-arena/scene.json node editor/server/bridge.mjs 5180
```

### 3.4 local dev (브리지 없이 셸만)

협업 루프·라이브 단일 진실 없이 UI 셸만 띄워 보려면 dev 서버를 쓴다(P1 정적 서빙):

```
node editor/serve.mjs 5174
```

브라우저:

```
http://127.0.0.1:5174/editor/ui/
```

local dev 는 Claude 협업·브리지 단일 진실·Play 권위가 없다(localStorage Save 까지). 협업
편집·Play·export 전체 루프는 3.2 의 브리지 경로를 쓴다.

### 3.5 Claude Code MCP 어댑터 연결

루트 `.mcp.json` 에 `wgf-editor` MCP 서버가 등록돼 있어 Claude Code 가 자동으로
`editor/server/mcp.mjs` 를 spawn 한다:

```json
{ "mcpServers": { "wgf-editor": { "command": "node", "args": ["editor/server/mcp.mjs"] } } }
```

MCP 어댑터는 **무상태 프록시**다 — 브리지가 떠 있어야 도구 호출이 동작한다. 브리지 미기동
시 도구는 "브리지 미기동" 구조화 에러를 반환한다(엔드포인트 파일 부재). 브리지가 기동 시
`.omc/wgf-editor/bridge-endpoint.json` 에 `{port, token}` 을 쓰고, MCP 어댑터가 매 호출마다
그것을 읽어 프록시에 사용한다(브리지 재기동에 강건).

## 4. Claude Code 협업 루프

사용자가 에디터 챗에 메시지를 보내면 Claude 가 다음 루프로 처리한다(설계서 §4.7):

1. **`editor_next_message`** (long-poll) — 미처리 사용자 메시지 1건을 가져온다. 없으면
   브리지가 ~25초 대기 후 `message:null` 로 응답 → 재호출. 이 호출 자체가 Claude 루프
   하트비트(생존 신호)다.
2. **씬 편집 도구** — `scene_add_entity`·`scene_set_transform`·`scene_add_component` 등으로
   지시를 씬에 반영한다(전부 브리지 프록시).
3. **`editor_reply`** — 처리 결과(diff 요약)를 에디터 챗에 표시한다. `replyTo` 에 처리한
   메시지 id 를 넣는다.

- **하트비트.** 브리지는 마지막 하트비트로부터 5초(기본) 초과 시 연결을 `disconnected` 로
  표시한다. 에디터가 "Claude 연결/대기/끊김" 인디케이터를 보여준다(`/api/status` 폴링).
- **큐 영속.** 챗 큐는 `.omc/wgf-editor/chat-queue.json` 에 원자적으로 영속된다. 터미널
  강종·재진입에도 미처리 메시지가 무손실 복원된다.

도구 목록·시그니처는 [reference/tools.md](./reference/tools.md), 워크플로 상세는
[reference/workflow.md](./reference/workflow.md).

## 5. 2-트랙 스킬 메뉴

에디터 스킬 메뉴는 두 트랙으로 갈린다(설계 결정 #6):

- **결정형 트랙** — 에디터가 직접 `execFile`(배열 인자, 셸 미경유)로 실행하는 화이트리스트
  검증 도구. `lint-scene`·`lint-rng`·`lint-juice`·`lint-kit-deps`·`qa-score` 5종. MCP 에서는
  `skill_run_tool` 로 호출하고, `file`/`target` 에 `"current"` 를 주면 브리지가 현재 씬을 임시
  직렬화해 실행한다. 화이트리스트 외 도구·인자 스키마 위반·경로 traversal 은 브리지가 거부한다.
- **창작형 트랙** — story-architect·style-architect 등 창작 스킬을 **현재 씬 문맥으로 Claude 에
  디스패치**한다. 에디터가 씬 요약을 챗 큐에 enqueue → Claude 가 `editor_next_message` 로
  받아 처리.

화이트리스트·인자 스키마 상세는 [reference/tools.md](./reference/tools.md),
보안 경계는 [reference/security.md](./reference/security.md).

## 6. 에셋

씬 에셋은 두 소스다(설계 결정 #11):

- **절차 생성** — PixelForge/VectorForge def 슬롯. `asset_add_procedural`(id 필수, desc·w·h·def
  선택)로 `assets.sprites` 에 추가한다.
- **CC0 라이브러리** — sprite-picker 가 고른 CC0 에셋. `asset_add_cc0`(id·url 필수,
  license 기본 `CC0-1.0`·credit·desc·w·h 선택)로 추가한다. `javascript:`·`data:`·`file:`·
  `vbscript:` 스킴 url 은 거부된다(저장형 XSS 방지).

추가한 에셋 id 를 엔티티의 `Sprite.sprite` 필드가 참조한다. `asset_list` 로 현재 목록을 조회한다.

## 7. 컴포넌트 15종

씬 엔티티에 부착하는 컴포넌트는 정확히 **15종 화이트리스트**다. `lint-scene` 이 이 목록
밖(미등록·16번째) 타입에 `UNKNOWN_COMPONENT` error + exit 1 을 낸다.

| # | 타입 | 단계 | 요약 |
|---|------|------|------|
| 1 | `Sprite` | P0a | 정적 렌더 메타(sprite ref) |
| 2 | `Body` | P0a | 충돌 바디(aabb/circle, isStatic) |
| 3 | `TopDownController` | P0a | 8방향 탑다운 이동(speed·input) |
| 4 | `AnimatedSprite` | P0b | 프레임 애니메이션(결정적 타이머, t=0=프레임0) |
| 5 | `Shooter` | P0b | 주기 발사(Projectile 생성) |
| 6 | `Projectile` | P0b | 직선 이동 발사체(수명·데미지) |
| 7 | `EnemyAI` | P0b | 적 AI(chase/flee/patrol/shoot) |
| 8 | `Health` | P0b | 체력·무적·사망 처리 |
| 9 | `ContactDamage` | P0b | 접촉 데미지 |
| 10 | `Pickup` | P0b | 수집 아이템(heal/coin) |
| 11 | `Spawner` | P0b | 주기적 엔티티 생성(template) |
| 12 | `CameraFollow` | P0b | 카메라 추적 데이터 |
| 13 | `AbilityBinding` | P0b | 능력 쿨다운/발동 |
| 14 | `AudioEmitter` | P0b | 오디오 이벤트 누적 |
| 15 | `HUDBinding` | P0b | HUD 데이터 바인딩 |

각 컴포넌트의 필드·예시는 [reference/components.md](./reference/components.md).
정식 스키마 원본은 [games/_editor-samples/SCHEMA.md](../../games/_editor-samples/SCHEMA.md).

## 8. Play & export

### Play 권위 (유니티 모델)

- 편집-시 권위 = 브리지 씬 문서. **Play 중에는 씬 문서가 read-only** — GUI·Claude 의 edit
  커맨드(`/api/command`·undo/redo)는 409 로 거부된다.
- Play 라이브 상태(물리 위치·AI·쿨다운·RNG 스트림)는 브라우저 코어 인스턴스의 휘발 상태이며
  Stop 시 폐기된다(유니티 play-mode 모델).
- 모드 전환은 `POST /api/mode {mode}` 로 한다(`edit`↔`play`).

### export

```
node editor/server/export.mjs <scene.json 경로 또는 slug> [--out <slug>]
```

예:

```
node editor/server/export.mjs games/wgf-demo-arena/scene.json
```

산출물은 `games/<slug>/{index.html, game.js, CREDITS.txt}`. **QA 가능성 계약**(필수):
산출 `game.js` 는 `window.<Slug> = { game, input: GAME_INPUT, audio, rng, scene, seed,
start, stop, __bakeHash }` 를 노출하고 `?autostart=1`·`?seed=N` 을 지원한다. 엔진 로드 순서는
phaser → pixelforge → vectorforge → audio → mobile → joystickkit → scenekit →
scenekit-components → scenekit-phaser → game.js 로 보존된다. 내보낸 게임은 본질적으로
`SceneKitPhaser.create(parent, SCENE_DOC, {mode, chrome:false})` 부트스트랩이라 에디터 play 와
동형(계약 H)이다.

> 참고: MCP `project_export` 도구는 v1 에서 안내성 스텁이다 — 위 CLI 로 실행한다.

## 9. 보안

로컬 도구라도 신뢰경계가 있다(설계서 §6). 브리지는 다음을 강제한다:

- **바인딩** — `127.0.0.1` 전용(0.0.0.0 금지, LAN 비노출). 기동 시 `crypto.randomBytes(24)`
  무작위 토큰 발급, 모든 `/api/*` 에 토큰(상수시간 `timingSafeEqual` 비교) + Origin 검사.
- **경로** — 모든 파일 I/O 를 리포 루트(또는 `games/`)로 정규화 후 prefix 검사, `../`
  traversal·dotfile 세그먼트 거부.
- **명령 실행** — 결정형 스킬도구는 도구명 화이트리스트 + 인자 JSON 스키마 검증 후
  `execFile(node, [argv])` 배열 인자로만 실행한다(**셸 미경유** — `;`·`&&`·`$()` 등 메타문자
  무력화).
- **파일 권한** — 토큰 공유 파일·챗 큐는 `0o600`(소유자 rw only), 보관 디렉터리는 `0o700`
  으로 격리한다(POSIX). Windows 는 read-only 비트만 반영돼 무해.

상세·게이트 매핑은 [reference/security.md](./reference/security.md).

## 10. QA 게이트

7개 헤드리스 하니스가 단계별 수용 게이트를 실제 실행 검증한다(전부 마지막 줄 단일 JSON
`{"ok":bool,"pass":n,"fail":n}`, 통과 시 exit 0).

| 하니스 | 게이트 | 검증 대상 |
|--------|--------|-----------|
| `skills/wgf-editor/tools/test-scenekit.mjs` | 98 | SceneKit 코어 — 결정성·벽 AABB 충돌·15컴포넌트 step·apply/undo·lint-scene |
| `editor/server/test-bridge.mjs` | 38 | 브리지 — 커맨드 라운드트립·Play 권위·SSE Last-Event-ID 복구·백프레셔·traversal·토큰 |
| `editor/server/test-mcp.mjs` | 27 | MCP — initialize·tools/list(22종)·프록시·챗 큐 재진입·하트비트·무빌드 불변식 |
| `editor/server/test-skill.mjs` | 31 | 2-트랙 스킬 — 결정형 exit 0·화이트리스트 거부·인자 traversal·셸 미경유·에셋 ref |
| `editor/server/test-export.mjs` | 24 | export — 동형성 H·QA 가능성 계약·로드순서·lint-rng·replay·qa-score |
| `editor/server/test-demo.mjs` | 13 | 데모(wgf-demo-arena) — lint-scene·export·결정성·생성형 동작·qa-score |
| `editor/server/test-security.mjs` | 16 | 보안 — 바인딩·traversal·화이트리스트·셸 미경유 증명·토큰 타이밍·파일 권한 |

실행(프로젝트 루트에서, 예):

```
node skills/wgf-editor/tools/test-scenekit.mjs
```

```
node editor/server/test-bridge.mjs
```

게이트 카탈로그 상세는 [reference/tools.md](./reference/tools.md).

## 11. 오케스트레이터 연계

web-game-builder 워크플로에서 게임 제작 경로가 둘로 갈린다:

- **손코딩 레인** — 기존 `wgf-make-game` 등으로 Phaser `game.js` 를 직접 생성·편집.
- **에디터 레인(이 스킬)** — WGF Studio 로 선언형 `scene.json` 을 GUI·Claude 협업 편집 후
  무빌드 export. 사용자가 "에디터로 만들래"·"유니티처럼 짜고 싶어" 라고 하면 이 레인.

`wgf-web-game-builder` 오케스트레이터에 에디터 레인 라우팅이 추가된다(병렬 레인 B 소관).
상호 참조는 [reference/workflow.md](./reference/workflow.md).

## 12. 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `http://127.0.0.1:5180/editor/ui/` 가 빈 화면·404 | UI 셸 미빌드(`dist/bundle.js` 없음) | `cd editor/ui` → `npm install` → `npm run build` |
| 브리지 기동 시 `EADDRINUSE` | 포트 5180 점유 | 다른 포트로 기동(`node editor/server/bridge.mjs 5200`) 또는 점유 프로세스 종료 |
| MCP 도구가 "브리지 미기동" 에러 | 브리지가 안 떠 있음(엔드포인트 파일 부재) | 먼저 `node editor/server/bridge.mjs 5180` 으로 브리지 기동 |
| Play 중 편집이 409 거부 | Play 권위 read-only(정상) | Stop(`/api/mode {mode:'edit'}`) 후 편집 |
| `scene_screenshot` 이 "뷰포트 없음" | 브라우저 미오픈(헤드리스) 또는 v1 캡처 파이프라인 미도입 | 헤드리스 편집은 계속 가능. 시각 확인은 SSE 페이지 직접 관찰 |
| SSE 페이지 스크린샷이 정지/타임아웃 | EventSource 스트림 특성(라이브 캡처 함정) | 라이브 스크린샷 대신 `/api/scene` 동기 GET 으로 상태 확인 |
| 브라우저에서 `GAME_INPUT.<dir>=true` 줬는데 안 움직임 | 어댑터가 매 프레임 Phaser 키보드로 `GAME_INPUT` 덮어씀(합성 쓰기 클로버) | 진짜 `KeyboardEvent` 를 `window.dispatchEvent` ([browser-verify.md](./reference/browser-verify.md)) |
| 수동 `setMode('play')` 후 엔티티 정지(스폰·이동 없음) | rAF 스텝 루프는 `?autostart=1`→`start()` 경로만 구동 | `?autostart=1` 로 로드해 스텝 구동 확인 |
| `export` 가 "scene.json 을 찾을 수 없습니다" | 경로/slug 오인 | `games/<slug>/scene.json` 경로 또는 slug 직접 지정, `--out` 으로 출력 slug 명시 |

## 연계 / 레퍼런스

- **상위:** [`web-game-builder`](../wgf-web-game-builder/SKILL.md) 오케스트레이션의 에디터 제작 레인.
- **품질:** [`game-qa`](../wgf-game-qa/SKILL.md)(헤드리스 QA·replay·qa-score) ·
  [`ip-license-guard`](../wgf-ip-license-guard/SKILL.md)(CC0/IP 안전).
- **에셋:** [`sprite-picker`](../wgf-sprite-picker/SKILL.md)(CC0 시각 선택) ·
  [`sprite-forge`](../wgf-sprite-forge/SKILL.md)/[`vector-graphics`](../wgf-vector-graphics/SKILL.md)(절차 생성).
- **레퍼런스(한글):** [architecture.md](./reference/architecture.md) ·
  [workflow.md](./reference/workflow.md) · [components.md](./reference/components.md) ·
  [security.md](./reference/security.md) · [tools.md](./reference/tools.md) ·
  [browser-verify.md](./reference/browser-verify.md)(브라우저 상호작용 검증 함정).
- **스키마 원본:** [games/_editor-samples/SCHEMA.md](../../games/_editor-samples/SCHEMA.md) ·
  설계서 [.omc/plans/wgf-editor-plan.md](../../.omc/plans/wgf-editor-plan.md).
