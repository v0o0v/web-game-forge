---
name: sprite-picker
description: >
  게임에 쓸 스프라이트·스프라이트시트·애니메이션을 사용자가 직접 시각적으로 골라 적용하게 한다 —
  큐레이션된 CC0 카탈로그(Kenney 등)·로컬 파일·이전 사용분을 브라우저 갤러리로 보여주고 클릭 선택,
  또는 설명을 받아 절차 생성(sprite-forge/vector-graphics)으로 위임. 화면 비주얼은 재미의 핵심이라
  '실제 에셋 소싱 vs 절차 생성'을 먼저 묻고, 의도가 모호하면 끈질기게 1문1답으로 캐묻는다. 사용자가
  어떤 식으로든 스프라이트/캐릭터/타일/아이콘/UI/이펙트 아트를 고르거나 적용하거나 바꿔야 하는 상황이
  직간접적으로 오면 사용. 카탈로그는 미리 캐싱되어 매번 웹을 뒤지지 않으며, 갱신은 sprite-catalog-refresh.
  English: let the user visually pick real sprites/spritesheets/animations for the game from a curated CC0
  catalog (Kenney etc.), local files, or a previously-used library via a browser gallery, or describe it to
  generate procedurally. Ask "source real assets vs generate" first; interview relentlessly when intent is
  unclear. Keywords: sprite picker, spritesheet, sprite selection, choose/pick sprite, game art asset, CC0
  assets, kenney, character sprite, tileset, icon, UI art, asset browser, 스프라이트 선택, 에셋 고르기,
  스프라이트시트, 캐릭터 이미지, 애셋 적용, 아이콘/타일 고르기, 외부 에셋, 이전 스프라이트.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, WebFetch
---

# sprite-picker — 스프라이트·스프라이트시트 소싱·시각 선택 허브

화면에 보이는 이미지·애니메이션은 게임의 재미를 가장 크게 좌우한다. 그래서 이 스킬은 스프라이트를
**Claude 가 임의로 정하지 않고 사용자가 직접 고르게** 한다 — 큐레이션된 CC0 카탈로그·로컬 파일·이전
사용분을 **브라우저 갤러리에서 시각적으로 구분해 클릭 선택**하거나, 설명을 받아 절차 생성으로 만든다.
web-game-builder 워크플로의 제작요소 스킬.

> **역할 분리.** 이 스킬은 *고르고·소싱하고·적용하고·보관*한다(실제 에셋 + 시각 피커 + 로컬 라이브러리 + 캐싱).
> *코드로 즉석 제작*은 [`sprite-forge`](../sprite-forge/SKILL.md)(픽셀, PixelForge) ·
> [`vector-graphics`](../vector-graphics/SKILL.md)(스무스, VectorForge) 가 한다 — 이 스킬이 절차 생성을 그쪽에 위임한다.
> 카탈로그 갱신은 [`sprite-catalog-refresh`](../sprite-catalog-refresh/SKILL.md).

## 언제 사용
- 사용자가 스프라이트/캐릭터/적/타일/아이템/배경/UI/아이콘/이펙트 아트를 **고르거나·적용하거나·바꿔야** 할 때
- "kenney에서 가져와", "이 이미지 써줘", "예전에 쓰던 캐릭터로", "스프라이트 시트 적용", "에셋 골라줘"
- 게임을 만드는 중 **아트를 어떻게 채울지** 정해야 할 때(실제 에셋 vs 절차 생성 결정 게이트)
- 절차 생성만 명확히 원하면 곧장 `sprite-forge`/`vector-graphics` 로 가도 된다 — 이 스킬은 *선택*이 끼는 경우.

## 핵심 원칙
1. **사용자가 고른다.** 비주얼은 재미의 핵심 — 임의 결정 금지. **SP1: '실제 에셋 소싱 vs 절차 생성'을 먼저 묻는다**
   (사용자가 "알아서"라고 명시하면 추천 기본값으로 진행).
2. **끈질긴 인터뷰.** 모호하면 [reference/sprite-interview.md](./reference/sprite-interview.md) 의 탑다운 1문1답으로
   출처(SP1)→스타일(SP2)→에셋 목록(SP3)→애니(SP4)→라이선스(SP5)→적용 매핑(SP6) 을 캔다. 매 라운드 Claude 가 먼저 구체안 제안.
3. **시각적 선택.** 후보를 추려 **브라우저 갤러리 피커**로 보여주고 클릭 선택받는다([reference/picker-protocol.md](./reference/picker-protocol.md)).
4. **캐싱 우선.** 매번 웹을 뒤지지 않는다 — 미리 조사·검증된 `catalog/` 를 읽는다. 외부 재조사는 사용자가
   [`sprite-catalog-refresh`](../sprite-catalog-refresh/SKILL.md) 로 명시 요청할 때만.
5. **CC0/IP-safe.** `cc0` 우선, 표기 필요는 `CREDITS.txt` 약속 시, 그 외는 게이트에서 막는다([`ip-license-guard`](../ip-license-guard/SKILL.md)).
6. **한 게임 한 스타일.** 픽셀 ↔ 스무스를 섞지 않는다. 기존 게임에 추가 시 현재 스타일을 먼저 읽는다.
7. **재사용.** 한 번 쓴 에셋은 `assets-library/` 에 보관해 "이전 사용" 탭에서 다시 고른다([reference/library.md](./reference/library.md)).

## 워크플로

### 0) 맥락 분석 (코드/다운로드 전)
- 기존 게임에 추가면 `games/<slug>/game.js` 의 **현재 아트 스타일**(`pixelArt` 설정, PixelForge/VectorForge,
  타일 크기)과 이미 쓰는 에셋을 읽는다 — 스타일 충돌을 막기 위해.
- `assets-library/library.json`(이전 사용분)과 `catalog/sources.json`·`packs.json`(후보)을 파악한다.

### 1) SP1 결정 게이트 + 인터뷰 (모호하면 계속 질문)
`AskUserQuestion` 으로 **출처**를 먼저 가른다: 실제 에셋 소싱 / 로컬 파일 / 이전 사용분 / 절차 생성.
요청이 한 줄·모호하거나 SP2(스타일)·SP3(에셋 목록)가 비면 [reference/sprite-interview.md](./reference/sprite-interview.md)
온디맨드 Read 후 탑다운 1문1답으로 끈질기게 캔다. **준비도 게이트(SP1·SP2·SP3) 충족 전엔 피커를 안 띄운다.**

### 2) 후보 추림 → 피커 주입 → 서빙
- 좁힌 조건으로 `catalog/packs.json` + `assets-library/library.json` 에서 20~40개로 추리고, 절차 제안·로컬
  파일은 `candidate` 그룹으로 합쳐 `skills/sprite-picker/picker/data.js` 를 쓴다(`data.example.js` 템플릿).
- 로컬 서버로 띄운다: `python -m http.server 8766` → `http://127.0.0.1:8766/skills/sprite-picker/picker/index.html`
  (또는 preview MCP). 프로토콜·경로는 [reference/picker-protocol.md](./reference/picker-protocol.md).

### 3) 사용자 클릭 선택 → 회수
사용자가 카드를 클릭해 고르면 선택이 `localStorage` 에 자동 저장된다. 다 골랐다고 하면 회수한다:
- **MCP 우선:** preview 로 `window.__spritePickerSelection()` 를 eval(또는 스냅샷으로 토큰 textarea 읽기).
- **폴백:** "선택 코드 복사" 버튼 → 사용자가 채팅창에 붙여넣기.

### 4) 소싱·적용 ([reference/sourcing.md](./reference/sourcing.md))
- 웹 카탈로그/후보 → 라이선스 재확인 → **온디맨드 다운로드** → `games/<slug>/assets/` 벤더링 →
  `assets.json` 등록 → `this.load.spritesheet/atlas/image/svg` 로드 → 애니 등록.
- 로컬 파일 → 출처/라이선스 확인 후 벤더링·등록.
- 이전 사용분 → 다운로드 없이 즉시 참조.
- 절차 생성 → [`sprite-forge`](../sprite-forge/SKILL.md)/[`vector-graphics`](../vector-graphics/SKILL.md) 위임.
- 선택의 `note`(어느 스프라이트를 어느 객체에·색 보정 등, SP6 매핑)를 반영.

### 5) 라이브러리 누적 + 검증
- 적용한 에셋을 `assets-library/` 에 복사 + `library.json` 갱신([reference/library.md](./reference/library.md)).
- 로컬 서버로 띄워 스프라이트·애니 렌더와 콘솔 에러 0 확인, 스타일 일관성·모바일 부담 점검,
  최종 라이선스 게이트는 [`ip-license-guard`](../ip-license-guard/SKILL.md). 결과를 근거와 함께 보고.

## 연계 / 라우팅
- **상위:** [`web-game-builder`](../web-game-builder/SKILL.md) 오케스트레이션의 아트 소싱 레인. 게임 생성 중 아트 결정 게이트로 호출.
- **위임 대상(절차 생성):** [`sprite-forge`](../sprite-forge/SKILL.md)(픽셀) · [`vector-graphics`](../vector-graphics/SKILL.md)(스무스).
- **갱신:** [`sprite-catalog-refresh`](../sprite-catalog-refresh/SKILL.md)(카탈로그 웹 재조사·캐싱).
- **품질:** [`ip-license-guard`](../ip-license-guard/SKILL.md)(라이선스) · [`perf-60fps`](../perf-60fps/SKILL.md)(텍스처 부담) · [`game-ui-hud`](../game-ui-hud/SKILL.md)(UI 아트).
- **레퍼런스:** 데이터 스키마 [catalog-schema.md](./reference/catalog-schema.md) · 피커 프로토콜 [picker-protocol.md](./reference/picker-protocol.md)
  · 인터뷰 [sprite-interview.md](./reference/sprite-interview.md) · 소싱 [sourcing.md](./reference/sourcing.md)
  · 라이브러리 [library.md](./reference/library.md). 캐시 [catalog/](./catalog/) · 피커 [picker/](./picker/).
  · Phaser4 로딩 [loading-assets](../web-game-builder/reference/phaser/loading-assets.md) · [animations](../web-game-builder/reference/phaser/animations.md).

## IP 안전
- 카탈로그는 `cc0`/`permissive-attribution` 위주로 큐레이션하며 `safetyTier` 로 등급을 단다. `mixed-per-item`·`avoid`
  는 적용 전 항목별 확인 필수.
- 닌텐도 등 상용 IP 리핑 소스는 카탈로그에 넣지 않는다. 보호된 이름·시그니처 조합 금지(상세 [`ip-license-guard`](../ip-license-guard/SKILL.md)).
- 표기 필요(CC-BY 등) 항목은 `CREDITS.txt` 에 출처·라이선스를 남긴다.
