# WGF Studio 워크플로 레퍼런스

기동 → 편집(GUI/Claude) → Play → export 전체 워크플로와 Claude 협업 루프 상세.

---

## 1. 전체 워크플로

```
[1] UI 셸 빌드(최초 1회)   →  [2] 브리지 기동  →  [3] 브라우저 오픈
        cd editor/ui              node editor/server/bridge.mjs 5180     http://127.0.0.1:5180/editor/ui/
        npm install
        npm run build
                                          │
                                          ▼
[4] 편집  ──────────────────────────────────────────────────────────
     ├ GUI: Hierarchy 선택 · Inspector 편집 · 기즈모(이동/회전/스케일) · 에셋 드래그 배정
     └ Claude 협업: 챗 메시지 → editor_next_message → 씬 편집 도구 → editor_reply
                                          │
                                          ▼
[5] 2-트랙 스킬 적용
     ├ 결정형: lint-scene/lint-rng/lint-juice/lint-kit-deps/qa-score (skill_run_tool, file=current)
     └ 창작형: story/style 등 현재 씬 문맥으로 Claude 디스패치
                                          │
                                          ▼
[6] Play (POST /api/mode {mode:'play'}) — 씬 read-only, Stop 시 휘발 상태 폐기
                                          │
                                          ▼
[7] export — node editor/server/export.mjs <slug> → games/<slug>/{index.html,game.js,CREDITS.txt}
                                          │
                                          ▼
[8] QA — game-qa(replay·qa-score) · ip-license-guard
```

---

## 2. 기동 (3.1~3.5 요약)

상세 명령은 [SKILL.md](../SKILL.md) §3. 핵심만:

1. **UI 셸 빌드(최초 1회):** `cd editor/ui` → `npm install` → `npm run build`.
2. **브리지 기동:** `node editor/server/bridge.mjs 5180` → 브라우저 `http://127.0.0.1:5180/editor/ui/`.
3. **특정 게임:** `WGF_BRIDGE_SCENE=games/<slug>/scene.json` 환경변수로 부트 씬 지정.
4. **MCP:** 루트 `.mcp.json` 으로 Claude Code 가 `editor/server/mcp.mjs` 자동 spawn — 브리지가
   떠 있어야 프록시 동작.

---

## 3. GUI 편집 (브라우저 셸)

`editor/ui/` 셸이 제공하는 패널(P1):

| 패널 | 파일 | 역할 |
|------|------|------|
| Viewport | `src/Viewport.jsx` | scenekit-phaser 어댑터 마운트, 현재 씬 t=0 표시 |
| Hierarchy | `src/Hierarchy.jsx` | 엔티티 트리(선택·다중선택) |
| Inspector | `src/Inspector.jsx` | 선택 엔티티의 transform + 컴포넌트를 `inspectorFields` 로 자동 폼 생성 |
| Toolbar | `src/Toolbar.jsx` | 기즈모 토글·스냅·Undo/Redo·Save·엔티티 추가·Play/Edit |

- 모든 씬 상태 변경은 어댑터의 `applyCommand`(= `SceneKit.applyCommand`)로만 이뤄진다
  (Undo 일관성).
- 브리지 연결 시(remote) 명령은 `POST /api/command` 로 가고 SSE 델타로 미러가 동기된다.
  local dev(`serve.mjs`)는 localStorage Save 까지(브리지 단일 진실·Play 권위 없음).

---

## 4. Claude 협업 루프 (상세)

사용자가 에디터 챗에 메시지를 보내면(`POST /api/chat {text}`) 브리지 챗 큐에 enqueue 되고
SSE 로 에코된다(role=user). Claude 는 다음 루프를 돈다:

### 4.1 메시지 수신 — `editor_next_message`

- 미처리 메시지 1건을 long-poll 로 디큐. 없으면 브리지가 ~25초 후 `message:null` 반환 → 재호출.
- **이 호출 자체가 하트비트**다(Claude 루프 생존 신호). 브리지 `recordHeartbeat()` 갱신.

### 4.2 씬 편집

받은 지시를 씬 편집 도구로 반영(전부 브리지 프록시):

- `scene_get`·`scene_query` — 현재 씬 조회(필터: name 부분일치·componentType·id).
- `scene_add_entity` — 새 엔티티 추가, 반환 `newId`(이후 도구에서 사용).
- `scene_set_transform`·`scene_update_entity` — 트랜스폼 패치.
- `scene_add_component`·`scene_update_component`·`scene_remove_component` — 컴포넌트 CRUD.
- `scene_delete_entity` — 엔티티 삭제.
- `asset_add_procedural`·`asset_add_cc0` — 에셋 추가 후 `Sprite.sprite` 가 그 id 를 ref.
- `undo`·`redo` — 브리지 권위 Undo/Redo.

> Play 모드면 편집 도구는 409 로 거부된다(read-only). Stop 후 편집.

### 4.3 응답 — `editor_reply`

처리 결과(diff 요약)를 에디터 챗에 표시(`text` 필수, `replyTo` = 처리한 메시지 id).
SSE 로 사용자에게 전달(role=assistant). 이 호출도 하트비트 갱신.

### 4.4 견고성

- **하트비트 인디케이터:** 에디터가 `/api/status` 를 폴링해 `connected`/`waiting`/`disconnected`
  를 표시. 마지막 하트비트 5초(기본) 초과 → `disconnected`.
- **큐 영속:** 챗 큐는 `.omc/wgf-editor/chat-queue.json` 에 원자적(tmp→rename)으로 영속.
  터미널 강종·재진입에도 미처리 메시지 무손실 복원(`test-mcp.mjs` G-REENTER 게이트).

---

## 5. 2-트랙 스킬

### 결정형 트랙 (에디터 직접 실행)

`skill_run_tool` 로 호출. `file`/`target` 에 `"current"` 를 주면 브리지가 현재 씬을 임시
직렬화해 그 경로로 실행한다. 5종:

| 도구 | 인자 | 검증 |
|------|------|------|
| `lint-scene` | `file`(path), `json`(bool) | scene.json 스키마·댕글링 ref·15컴포넌트 화이트리스트 |
| `lint-rng` | `file`(path), `json`·`strict`(bool) | game.js 결정론(Math.random/월클럭 금지) |
| `lint-juice` | `file`(path), `json`·`strict`(bool) | juice(game feel) 정적 린트 |
| `lint-kit-deps` | `file`(path, 선택), `json`·`strict`(bool) | 엔진 킷 의존성 그래프 |
| `qa-score` | `target`(slug), `json`(bool) | BH/VU/IA 종합 점수 |

### 창작형 트랙 (Claude 디스패치)

story-architect·style-architect 등 창작 스킬을 현재 씬 문맥으로 Claude 에 디스패치. 에디터가
씬 요약을 챗 큐에 enqueue(예: `[창작 요청] 이 게임에 스토리를 입혀줘. (현재 씬 엔티티: ...)`)
→ Claude 가 `editor_next_message` 로 받아 처리.

---

## 6. Play

- **모드 전환:** `POST /api/mode {mode}` (`edit`↔`play`). 전환도 SSE 델타로 미러·UI 에 동기.
- **Play 권위:** Play 중 씬 문서 read-only — edit 커맨드(`/api/command`·undo/redo)는 409 거부.
- **휘발 상태:** Play 라이브 상태(물리·AI·쿨다운·RNG)는 브라우저 코어 인스턴스 휘발 상태.
  Stop 시 폐기(유니티 play-mode 모델).

---

## 7. export

```
node editor/server/export.mjs <scene.json 경로 또는 slug> [--out <slug>]
```

- 입력은 경로(`games/<slug>/scene.json`) 또는 slug(자동 탐색: `games/<slug>/` 또는
  `games/_editor-samples/<slug>/`).
- 출력 `games/<slug>/{index.html, game.js, CREDITS.txt}`. slug 충돌 시 `--out` 으로 분리.
- 산출 game.js 는 `window.<Slug>` 노출 + `?autostart=1`·`?seed=N` 지원(QA 가능성 계약).
- 마지막 줄 단일 JSON `{ok, slug, Slug, outDir, files, warnings, ...}`, 종료코드 ok 면 0.

---

## 8. QA (export 후)

- **결정성·동형성:** [game-qa](../../wgf-game-qa/SKILL.md) 의 replay-determinism — 같은 seed
  2회 재생 해시 일치.
- **종합 점수:** `qa-score` — BH(빌드)·VU(시각)·IA(의도) 임계 통과. VU 픽셀은 외부 캡처
  `--frames` 주입(미주입 시 skipped 중립).
- **라이선스:** [ip-license-guard](../../wgf-ip-license-guard/SKILL.md) — CC0/IP 안전. CC0 에셋은
  `CREDITS.txt` 에 출처·라이선스 기록.

---

## 9. 오케스트레이터 연계

web-game-builder 워크플로의 게임 제작 경로:

- **손코딩 레인:** `wgf-make-game` → Phaser `game.js` 직접 생성.
- **에디터 레인(이 스킬):** WGF Studio → 선언형 `scene.json` GUI·Claude 협업 편집 → 무빌드
  export. "에디터로 만들래"·"유니티처럼" 의도면 이 레인.

`wgf-web-game-builder` 오케스트레이터에 에디터 레인 라우팅이 추가된다(병렬 레인 B 소관 —
이 문서는 상호 참조만).
