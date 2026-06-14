# WGF Studio 아키텍처 레퍼런스

설계서 §3·§4.1 의 시스템 토폴로지를 실제 구현(`editor/server/*.mjs`·`engine/scenekit*.js`)
기준으로 정리한다.

---

## 1. 3-프로세스 토폴로지

```
브라우저(에디터 UI 셸)            브리지 서버(장수명, 사람이 기동)          Claude Code(이 세션)
  ─ Viewport(Phaser 어댑터)          ─ 라이브 씬 상태 = 단일 진실               ─ 협업 루프:
  ─ Hierarchy/Inspector              ─ 커맨드 로그 · Undo/Redo                     editor_next_message
  ─ AssetBrowser/SkillMenu/Chat      ─ 챗 메시지 큐(파일 영속)                     → 씬 편집 도구
        │  HTTP POST(/api/command)   ─ 정적 서빙(127.0.0.1, editor/·games/·engine/) → editor_reply
        │  SSE(/api/events 델타·챗)   ─ 결정형 스킬도구 execFile(화이트리스트)            │ stdio JSON-RPC
        └────────────►  ◄────────────┤                                                  │
                                     └────────── localhost HTTP ◄── MCP stdio 어댑터(무상태) ◄┘
                                                                    (Claude Code 가 .mcp.json 으로 spawn)
                                              │ 읽기/쓰기
                                              ▼
                              games/<slug>/scene.json
                                              │ export.mjs
                                              ▼
                  games/<slug>/{index.html, game.js, CREDITS.txt}  (무빌드, window.<Slug>)
```

| 프로세스 | 파일 | 역할 | 수명 |
|----------|------|------|------|
| 브리지 | `editor/server/bridge.mjs` | 씬 상태·커맨드 로그의 단일 권위자, 정적 서빙, SSE/POST | 장수명(사람이 기동) |
| MCP 어댑터 | `editor/server/mcp.mjs` | stdio JSON-RPC 무상태 프록시 | Claude Code 가 spawn |
| 브라우저 UI | `editor/ui/` (Preact+esbuild) | 구독자 — POST 명령, SSE 수신 | 브라우저 탭 |

- **브리지**가 라이브 씬 상태·커맨드 로그·Undo/Redo 의 단일 권위자다. 모든 변경 = 커맨드 →
  직렬 apply 큐(전순서) → 델타 SSE 브로드캐스트.
- **MCP 어댑터**는 자체 씬 상태 0(무상태). 모든 도구 호출을 브리지에 localhost HTTP 로
  프록시 → "브리지 = 단일 진실" 이 프로세스 수준에서도 성립, Claude 세션 재시작에 강건.
- **브라우저 UI** 는 구독자. 명령을 브리지에 POST, 델타·챗을 SSE 로 수신.

---

## 2. SceneKit 로직코어 / Phaser 어댑터 분리

`engine/abilitykit.js` 의 검증된 패턴("헤드리스 순수 코어 + 얇은 Phaser 어댑터 + dt 결정론")
을 따른다.

### `engine/scenekit.js` — 로직코어 (Phaser 비의존)

- **양형(dual-form):** IIFE + `module.exports` — 브라우저 `<script>` 와 Node `require` 양쪽 로드.
- **컴포넌트 레지스트리:** 타입별 `{ schema, init(entity,world), step(entity,world,dt,rng),
  inspectorFields }`. 등록은 `engine/scenekit-components.js` 가 한다(브리지·테스트가 함께 require).
- **결정적 시스템 진행:** 입력→의도, AI 결정, 트랜스폼 적분, 능력/자원 틱. **주입 dt 만 소비**
  (`Date.now()`·실시간 금지), 무작위는 **RngForge 스트림만**(`lint-rng` 통과 필수).
- **자체 경량 충돌:** 동적 바디 간 AABB·원-원 오버랩 + 정적 벽 AABB vs 동적 바디 분리.
  Phaser Arcade 물리에 의존하지 않음 → play 루프 전체가 Node 헤드리스로 결정 검증 가능.
  정적 충돌 그리드는 `scene.json` 의 `walls`(AABB 배열) 입력.
- **커맨드 apply:** `applyCommand(world, command)` → `undoDelta` 반환. `applyUndo(world,
  undoDelta)`. 커맨드 타입: `addEntity`·`removeEntity`·`setTransform`·`addComponent`·
  `updateComponent`·`removeComponent`.
- **직렬화:** `serialize(world)` / `load(doc, {mode})` / `hashState(world)`(라운드트립·결정성 비교).

### `engine/scenekit-phaser.js` — 어댑터 (브라우저 전용)

- 코어 상태를 Phaser 스프라이트/그래픽으로 렌더, 기즈모·선택 아웃라인·그리드, 입력 브리지
  (GAME_INPUT·JoystickKit), 사운드(soundforge/chipaudio) 배선.
- **edit 모드:** 코어를 step 하지 않음(정적 t=0 표현 + 선택/기즈모).
- **play 모드:** 코어를 주입 dt 로 step + 렌더.
- 진입점 `SceneKitPhaser.create(parent, doc, opts)` — `mode`·`chrome`(에디터 크롬 on/off)·
  `width`·`height`·`seed`·`rng`·`onReady`. export 게임은 `chrome:false` 로 부트한다.

### 단일 코어 원칙

편집 프리뷰·Play·내보낸 게임이 **동일 `scenekit.js` 코어**로 t=0 를 만들고 같은 코어로
step → 계약 H 가 구성적으로 성립.

---

## 3. 동형성 계약 H / H′

> **계약 H (트랜스폼 동형):** 같은 `scene.json` 에 대해 `edit 뷰의 엔티티 t=0 트랜스폼` =
> `play 0프레임 트랜스폼` = `export 게임 0프레임 트랜스폼`. 세 경로가 동일 SceneKit 코어로
> t=0 를 만드므로 구성적으로 성립. t>0 의 물리·AI 진행도 **같은 seed 면 결정적**(RngForge).

> **계약 H′ (외형 동형):** (1) 절차 텍스처 베이크 결정성 — 같은 PixelForge/VectorForge def 는
> edit·play·export 에서 동일 비트맵. (2) AnimatedSprite t=0 = 프레임0 고정.

`test-export.mjs` 가 edit t=0 = play 0프레임 = export 부트 0프레임 트랜스폼 diff 0 을 실제
검증한다(`__bakeHash` 훅으로 외형 H′ 검증 경로 노출).

---

## 4. 전송·빌드 경계 (무빌드 불변식)

| 계층 | 구현 | 의존성 | 빌드 |
|------|------|--------|------|
| 런타임 코어 `engine/scenekit*.js` | IIFE + `module.exports` 양형 | 0 | 무빌드 |
| 게임 export 산출물 `games/<slug>/*` | `<script>` vendoring | 0 | 무빌드 |
| 브리지 `editor/server/bridge.mjs` | Node 빌트인 `http` + SSE + POST | 0 | 무빌드 |
| MCP 어댑터 `editor/server/mcp.mjs` | stdio JSON-RPC 2.0 직접 구현 | 0 | 무빌드 |
| 에디터 UI 셸 `editor/ui/` | Preact + esbuild | npm(격리) | 빌드 허용 |

- **루트 무빌드 불변식:** 루트에 `package.json`/`node_modules` 절대 없음. npm 의존은 오직
  `editor/ui/package.json` 에 격리, `node_modules`·`dist` 는 `.gitignore`. `test-mcp.mjs` 의
  `G-NOBUILD` 게이트가 루트 `package.json`/`node_modules` 부재를 회귀 검증한다.
- MCP 전송은 **newline-delimited JSON-RPC**(MCP 현행 stdio 스펙) — 한 줄당 JSON 1개, `\n`
  구분. WebSocket·MCP SDK 미도입(zero-dep). 프로토콜 버전 `2025-06-18`.

---

## 5. SSE 무손실·백프레셔

- **델타 시퀀스:** 모든 델타에 `id:=seq`. 클라가 끊겼다 재연결하면 `Last-Event-ID`(또는
  `?lastEventId=`)로 누락 델타를 재전송받는다(무손실 복구).
- **갭 복구 불가 시 resync:** 로그 상한(`UNDO_LIMIT=200`)에 잘린 구간을 요청하면 `resync`
  이벤트를 발행 → 클라가 `/api/scene` 으로 스냅샷 재동기.
- **백프레셔:** 느린 소비자로 송신 버퍼가 상한 초과면 적체를 멈추고 `resync` 1회 발행
  (무한 적체 방지). 환경변수 `WGF_BRIDGE_SSE_LIMIT`·`WGF_BRIDGE_SSE_BYTES` 로 상한 조정.

---

## 6. 주요 환경변수

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `WGF_BRIDGE_PORT` | `5180` | 브리지 포트(인자 `process.argv[2]` 우선) |
| `WGF_BRIDGE_SCENE` | `games/_editor-samples/topdown-min/scene.json` | 부트 씬 경로 |
| `WGF_BRIDGE_HEARTBEAT_MS` | `5000` | 하트비트 임계(초과 시 disconnected) |
| `WGF_BRIDGE_CHAT_POLL_MS` | `25000` | `editor_next_message` long-poll 타임아웃 |
| `WGF_BRIDGE_CHAT_FILE` | `.omc/wgf-editor/chat-queue.json` | 챗 큐 영속 경로 |
| `WGF_BRIDGE_ENDPOINT_FILE` | `.omc/wgf-editor/bridge-endpoint.json` | 브리지↔MCP 토큰 공유 파일 |
| `WGF_BRIDGE_TOKEN`/`WGF_BRIDGE_PORT` | — | MCP 어댑터가 파일보다 우선 사용(둘 다 있을 때) |
