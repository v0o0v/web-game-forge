# WGF Studio 도구·게이트 레퍼런스

MCP 도구 전체 목록(`editor/server/mcp.mjs` 1:1) + 결정형 스킬도구 화이트리스트 + 게이트
하니스 카탈로그.

---

## 1. MCP 도구 (22종)

Claude Code 가 `.mcp.json` 으로 spawn 하는 `wgf-editor` MCP 서버가 노출하는 도구. 전부
무상태 — 브리지에 localhost HTTP 프록시. (`test-mcp.mjs` 의 `tools/list` 게이트가 count=22 확인.)

### 씬 조회

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `scene_get` | — | 현재 씬 전체 스냅샷(엔티티·트랜스폼·컴포넌트·walls·meta) + seq·연결 상태 |
| `scene_query` | — | 필터 조회 — `name`(부분일치)·`componentType`·`id`. 일치 엔티티 배열 |

### 엔티티 CRUD

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `scene_add_entity` | — | 새 엔티티 추가(name·transform·components 선택). 반환 `newId` |
| `scene_update_entity` | `id` | 엔티티 transform 패치(setTransform 경로) |
| `scene_delete_entity` | `id` | 엔티티 삭제 |
| `scene_reparent` | `id` | **미지원**(v1 flat 모델) — 호출 시 구조화 에러 |

### 컴포넌트 CRUD

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `scene_add_component` | `id`·`component`(type 포함) | 컴포넌트 추가(15종 화이트리스트) |
| `scene_update_component` | `id`·`componentType`·`patch` | 컴포넌트 필드 패치 |
| `scene_remove_component` | `id`·`componentType` | 컴포넌트 제거 |
| `scene_set_transform` | `id`·`transform` | 트랜스폼 패치(x·y·rotation·scaleX·scaleY·depth) |

### 뷰포트

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `scene_screenshot` | — | 뷰포트 스크린샷. **헤드리스(브라우저 미오픈)면 "뷰포트 없음" 구조화 에러**(편집은 계속 가능) |

### 역채널(에디터 챗)

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `editor_next_message` | — | 미처리 사용자 메시지 1건 long-poll 디큐. 없으면 `message:null`. 이 호출이 하트비트 |
| `editor_reply` | `text` | 에디터 챗에 Claude 응답 표시(`replyTo` = 처리한 메시지 id, 선택) |

### Undo/Redo

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `undo` | — | 브리지 권위 Undo(직전 커맨드 되돌림). Play 모드면 거부 |
| `redo` | — | 브리지 권위 Redo. Play 모드면 거부 |

### 프로젝트

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `project_list` | — | `games/` 하위 scene.json 보유 slug 목록 |
| `project_open` | `slug` | **동적 교체 미지원**(v1) — `WGF_BRIDGE_SCENE` 로 브리지 기동 안내 |
| `project_export` | — | **v1 안내 스텁** — CLI `node editor/server/export.mjs <slug>` 로 실행 |

### 스킬

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `skill_run_tool` | `tool` | 결정형 도구 실행(아래 §2 화이트리스트). `args.file`/`target="current"` → 현재 씬 |

### 에셋

| 도구 | 필수 인자 | 설명 |
|------|-----------|------|
| `asset_list` | — | 현재 씬 `assets.sprites`(절차·CC0) 목록 |
| `asset_add_procedural` | `id` | 절차 스프라이트(PixelForge/VectorForge def) 추가(desc·w·h·def 선택) |
| `asset_add_cc0` | `id`·`url` | CC0 라이브러리 스프라이트 추가(license 기본 `CC0-1.0`·credit·desc·w·h 선택) |

> 도구 결과는 MCP content `[{type:"text", text: JSON}]` 형식. 구조화 에러는 `isError:true` +
> `{ok:false, error, detail}`. 브리지 연결류 오류(`BridgeError`)는 tools/call `isError` 로
> 변환되고, 알 수 없는 도구는 JSON-RPC `-32602` 에러.

---

## 2. 결정형 스킬도구 화이트리스트

`POST /api/skill/run`(MCP `skill_run_tool`)이 `execFile`(배열 인자, 셸 미경유)로 실행하는 5종.
`bridge.mjs` 의 `SKILL_TOOLS` 가 도구 경로·인자 스키마를 고정한다.

| 도구 | 경로 | 인자 스펙 |
|------|------|-----------|
| `lint-scene` | `skills/wgf-editor/tools/lint-scene.mjs` | `file`(flag, path, required), `json`(boolflag) |
| `lint-rng` | `skills/wgf-game-qa/tools/lint-rng.mjs` | `file`(positional, path, required), `json`·`strict`(boolflag) |
| `lint-juice` | `skills/wgf-game-qa/tools/lint-juice.mjs` | `file`(positional, path, required), `json`·`strict`(boolflag) |
| `lint-kit-deps` | `skills/wgf-game-qa/tools/lint-kit-deps.mjs` | `file`(positional, path, 선택), `json`·`strict`(boolflag) |
| `qa-score` | `skills/wgf-game-qa/tools/qa-score.mjs` | `target`(positional, slug, required), `json`(boolflag) |

- 인자 `type`: `path`(스코프 정규화·traversal 차단), `slug`(영숫자._-/, `..`·절대경로 금지),
  `enum`·`string`·`bool`.
- `file`/`target` 값이 `"current"` 면 브리지가 현재 씬을 임시 직렬화해 그 경로로 치환.
- 화이트리스트 외 도구명 403, 스펙 밖 인자·타입 위반·traversal 400.

---

## 3. 브리지 HTTP API (참고)

MCP 도구가 프록시하는 브리지 엔드포인트(전부 `/api/*`, 토큰+Origin 검사).

| 메서드·경로 | 용도 |
|-------------|------|
| `GET /api/bootstrap` | 토큰·base·seq·mode |
| `GET /api/scene` | 현재 스냅샷 + seq + 연결 상태 |
| `GET /api/status` | 연결 상태만(경량 폴링) |
| `POST /api/command` | applyCommand → seq++ → SSE 델타. Play 모드면 409 |
| `POST /api/undo`·`/api/redo` | 서버측 undo/redo. Play 모드 409 |
| `POST /api/mode` | 권위 모드 전환(edit↔play) |
| `GET /api/events` | SSE 델타 스트림(`Last-Event-ID` 무손실 복구) |
| `POST /api/chat` | 에디터 → Claude 메시지 enqueue |
| `GET /api/chat/next` | 미처리 메시지 long-poll 디큐(하트비트) |
| `POST /api/chat/reply` | Claude → 에디터 응답 |
| `POST /api/heartbeat` | 연결 생존 신호 |
| `POST /api/skill/run` | 결정형 스킬도구 실행 |
| `GET /api/asset/list`·`POST /api/asset/add` | 에셋 조회·추가 |

---

## 4. 게이트 하니스 카탈로그 (7종)

각 하니스는 단계별 수용 게이트를 실제 node 실행으로 검증한다. 전부 마지막 줄 단일 JSON
`{"ok":bool,"pass":n,"fail":n,...}`, 통과 시 exit 0. (게이트 수는 실제 실행으로 확인.)

| 하니스 | 게이트 | 검증 대상 |
|--------|--------|-----------|
| `skills/wgf-editor/tools/test-scenekit.mjs` | 98 | SceneKit 코어 P0a/P0b — 결정성(동일 seed 120프레임 해시)·벽 AABB 막힘·15컴포넌트 step·apply/undo 해시 복원·lint-scene·lint-rng |
| `editor/server/test-bridge.mjs` | 38 | 브리지 P2 — 커맨드 POST→SSE 라운드트립·Play 권위 409·Last-Event-ID 복구·갭 resync·백프레셔·traversal·토큰·Origin·newId 회수 |
| `editor/server/test-mcp.mjs` | 27 | MCP P3 — initialize·tools/list(22종)·프록시·챗 enqueue/디큐/reply·하트비트(disconnected/connected/waiting)·재진입 무손실·무빌드 불변식 |
| `editor/server/test-skill.mjs` | 31 | 2-트랙 스킬 P4 — 결정형 exit 0·화이트리스트 거부·인자 traversal·셸 메타문자 미실행·창작 디스패치·에셋 ref·CC0 스킴 거부 |
| `editor/server/test-export.mjs` | 24 | export P2.5 — 동형성 H(edit=play=export 0프레임)·QA 가능성 계약·로드순서·lint-rng·replay·qa-score |
| `editor/server/test-demo.mjs` | 13 | 데모(wgf-demo-arena) — lint-scene·export 산출물·결정성·생성형 동작·qa-score |
| `editor/server/test-security.mjs` | 16 | 보안 P5 — 바인딩 127.0.0.1·traversal·화이트리스트·CANARY 미생성(셸 미경유)·토큰 타이밍·파일 권한 |

총 247 게이트. 실행(프로젝트 루트, 예):

```
node skills/wgf-editor/tools/test-scenekit.mjs
```

```
node editor/server/test-mcp.mjs
```

> 게이트 하니스는 헤드리스(Node)다 — 브라우저 e2e(GUI 기즈모·뷰포트 렌더)는 chrome-devtools
> 로 별도 검증한다(P1 좌표 라운드트립·Undo/Redo·콘솔 에러 0). 브라우저 베이크 골든 이미지
> 픽셀 diff(계약 H′)도 외부 캡처 경계다.

---

## 5. 보안 경계 요약

결정형 도구 실행·경로·토큰의 신뢰경계 상세는 [security.md](./security.md). 핵심:
`execFile` 셸 미경유, 화이트리스트 5종, 경로 traversal 차단, 토큰 timing-safe 비교,
파일 `0o600`.
