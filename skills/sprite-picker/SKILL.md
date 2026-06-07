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

### 2) 대상(targets) + 광범위 후보 → 피커 주입 → 서빙
- **적용 대상 슬롯(targets)** 을 만든다 — 각 대상에 이름+설명(+추천용 `tags/contentTypes/style`, 예:
  `{id:"player",name:"플레이어",description:"주인공 걷기/점프",tags:["player","run"],contentTypes:["character"],style:"pixel"}`).
  사용자는 *순서를 외워 찍는 대신* 슬롯에 이미지를 배정한다(SP3·SP6에서 도출).
- **후보는 광범위하게, 웹사이트별로.** `catalog/sources.json`(웹사이트 메타 → `sources[]`) +
  `catalog/packs.json`(각 카드 **`sourceId` 필수**) + `assets-library` 를 **수십~수백 개** 넣는다.
  피커가 하단 4탭(**추천 / 전체(웹사이트→팩 아코디언) / 다운로드(풀뷰) / 후보**)으로 보여주고 사용자가
  웹사이트→팩, 검색·필터로 좁힌다. 팩 `preview`(커밋 썸네일)/`previewUrl` 을 최대한 채운다.
- **추천은 피커가 자동 계산** — `targets` 메타가 정확할수록 '추천' 탭이 잘 맞는다.
- **다운로드분 풀뷰.** `library` 항목은 미리보기가 아니라 풀로 렌더되고, 스프라이트시트는 프레임 분해로
  **개별 프레임 선택**이 된다(`full`=작업공간 루트 기준 경로, `frameConfig` 또는 `frames[]`).
- `skills/sprite-picker/picker/data.js` 로 주입(`data.example.js` 템플릿). 스키마: [reference/catalog-schema.md](./reference/catalog-schema.md).
- **커밋 썸네일 미리 받기(빠른 실행):** 카탈로그의 CC0 팩 커버는 [`sprite-catalog-refresh`](../sprite-catalog-refresh/SKILL.md)
  의 `catalog/prefetch.mjs` 로 미리 받아 `catalog/thumbnails/` 에 둔다. 평소엔 이 캐시만 쓴다.
- **컴패니언 서버로 서빙(자동 회수+풀뷰용):** `node skills/sprite-picker/picker/serve.mjs` (background) →
  `http://127.0.0.1:8770/`. `/`(피커)·`/catalog/`(커밋 썸네일)·`/ws/`(다운로드분 풀뷰)를 서빙. (정적
  `python -m http.server` 는 자동 회수·풀뷰가 안 되므로 폴백 전용 — 그땐 붙여넣기.)
  프로토콜·경로는 [reference/picker-protocol.md](./reference/picker-protocol.md).

### 2-b) 팩 다운로드·분석·편집 (다운로드 버튼 → 큐 → Claude 실행)

피커 카탈로그 카드의 "⬇ 다운로드" 버튼(`safetyTier:"cc0"` + 미다운로드 팩만 표시)을 클릭하면
서버 큐(`.sprite-picker-downloads.json`)에 적재된다. **사용자가 채팅으로 돌아오면** Claude 가 큐를
읽고 다음을 순서대로 실행한다:

1. **팩 다운로드:**
   ```
   node skills/sprite-picker/catalog/fetch-pack.mjs --pack <packId> [--out <dir>] [--dry]
   ```
   CC0 게이트 통과 후 소스별 리졸버(kenney/gameart2d/opengameart/generic)로 실제 파일 URL 추출 →
   `assets-library/<packId>/raw/` 에 원본 저장(ZIP 해제 포함, 최대 40MB).

2. **분석 및 library.json 갱신:**
   ```
   node skills/sprite-picker/catalog/analyze-pack.mjs --pack <packId> [--lib <dir>]
   ```
   분석 방법 자동 결정(atlas → grid → alpha → single) → `<packId>/<sheetSlug>.png` + `.thumb.png` 생성 →
   `library.json` 에 항목 upsert(`analysisVersion:2`, `sourcePackId`, `frames[]`, `anims[]` 포함) →
   `analysis.json` 기록 → 큐 status `"done"` 으로 갱신.

3. **편집기 모달(선택):** 다운로드된 카드의 "편집" 버튼 → `frameConfig`/`frames[]`/`excludedFrames`/`anims[]` 조정 →
   `POST /__sprite_picker_library_edit` 로 `library.json` + `analysis.json` 동기 저장.

스크립트 상세·엔드포인트는 [reference/sourcing.md](./reference/sourcing.md) 경로 A 와
[reference/picker-protocol.md](./reference/picker-protocol.md) 참고.

### 3) 사용자 탐색·슬롯 배정 → "선택 완료" 자동 회수
사용자가 탭(추천/전체/다운로드/후보)에서 찾아 슬롯을 클릭해 활성화하고 이미지(또는 다운로드 시트의 개별
프레임)를 클릭(또는 드래그)하면 그 대상에 배정된다(다음 빈 슬롯 자동 이동).
**"✓ 선택 완료"** 를 누르면 회수한다:
- **자동(권장):** 피커가 `POST /__sprite_picker_submit` → `serve.mjs` 가 선택을
  `.sprite-picker-selection.json` 에 저장 → **그 파일을 Read** 한다(없으면 잠깐 대기 후 재시도).
  preview MCP 환경이면 `window.__spritePickerSelection()` eval 로도 읽는다.
- **폴백:** 정적 서버면 피커가 선택 코드를 클립보드 복사+노출 → 사용자가 채팅에 붙여넣기.

### 4) 소싱·적용 ([reference/sourcing.md](./reference/sourcing.md))
- 웹 카탈로그/후보 → 라이선스 재확인 → **온디맨드 다운로드** → `games/<slug>/assets/` 벤더링 →
  `assets.json` 등록 → `this.load.spritesheet/atlas/image/svg` 로드 → 애니 등록.
- 로컬 파일 → 출처/라이선스 확인 후 벤더링·등록.
- 이전 사용분 → 다운로드 없이 즉시 참조.
- 절차 생성 → [`sprite-forge`](../sprite-forge/SKILL.md)/[`vector-graphics`](../vector-graphics/SKILL.md) 위임.
- **배정대로 적용:** `assignments[].targetId` → 그 대상에 해당 `image` 를 적용(슬롯 설명이 곧 적용처).
  `image.group:"library"` 면 다운로드분 재사용(경로 C), `image.frame` 이 있으면 `load.spritesheet`(그 `frameConfig`)
  후 해당 프레임 인덱스를 쓴다. `unassignedTargets` 는 절차 생성으로 채우거나 다시 묻는다. 선택의 `note` 반영.

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
