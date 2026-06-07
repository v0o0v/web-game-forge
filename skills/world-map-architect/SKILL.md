---
name: world-map-architect
description: >
  게임의 스테이지들을 어떻게 '하나의 맵/진행 구조'로 엮을지를 설계한다 — 개별 레벨 내용이 아니라
  스테이지를 잇는 위상(선형 체인·사가맵·레벨선택 그리드·분기 노드맵(로그라이크)·액트 월드맵·
  허브앤스포크·무한/절차맵)과 게이팅·해금·내비게이션·진척 영속·리플레이를 결정한다. 현재 게임의
  진행 모델(LEVELS·진행 저장)을 먼저 분석하고, 의도가 모호하면 1문1답으로 끈질기게 캐물어,
  검증된 맵디자인 이론(MAP-* 거시 톱니 곡선·보스 케이던스·락앤키·별게이트·입력무작위성·목표구배·
  thumb-zone)으로 '계속 하고 싶은' 진행 구조를 설계하고 실제 맵 화면 빌드 패턴까지 제공한다.
  맵/월드맵/진행구조 구성·재구성, 액트·챕터·무한맵 추가, 분기·허브·노드맵 설계, 해금·게이팅·
  데일리·메타프로그레션, 스테이지 선택/진행 화면 요청 시 사용. 타일맵(레벨 내부 지형)은 level-designer,
  개별 레벨 난이도는 level-architect 소관.
  English: use when the user wants to build or restructure the map / progression that connects stages —
  pick a topology (linear, saga, level-select grid, branching node map/roguelike, act world map,
  hub-and-spoke, endless/procedural), design gating/unlocks, navigation UX, persistence and replay.
  Not for per-tile level layout (use level-designer) or single-level difficulty tuning (use level-architect).
  Keywords: 맵 구성, 맵 설계, 월드맵, 진행 맵, 스테이지 연결, 액트, 챕터, 무한맵, 노드맵, 분기, 허브,
  레벨 선택, 진행 구조, 게이팅, 해금, 별 게이트, 데일리, 메타프로그레션, map, world map, overworld,
  progression, stage select, level select, node map, branching map, act, chapter, endless, infinite map,
  hub, gating, unlock, star gate, daily, meta-progression, roguelike map.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion
---

# world-map-architect — 스테이지 연결 맵 디렉터 (위상·진행·재미)

게임의 스테이지들을 **재미있는 하나의 진행 구조(맵)** 로 엮는 상위 스킬. 한 스테이지를 *어떻게* 만드는가가
아니라, **여러 스테이지를 무엇으로·어떤 순서·어떤 모양으로 잇는가**(맵의 위상)를 설계한다. 코드를 바로
짜지 않고 **① 현재 게임의 진행 모델 분석 → ② 사용자 의도를 인터뷰로 명확화 → ③ 검증된 맵디자인 이론
(MAP-*) 적용 → ④ 맵 위상·게이팅·내비·영속을 설계 → ⑤ 맵 화면 빌드(또는 위임) → ⑥ 검증**한다.
web-game-builder 워크플로의 일부.

> **역할 분리 (3계층).** 같은 "맵"이라는 단어가 세 스킬에 걸쳐 있으니 반드시 구분한다.
> - **무엇을 만들지(게임 자체):** 재미요소 `FE-*` — [game-dna/fun-elements.md](../web-game-builder/reference/game-dna/fun-elements.md)
> - **개별 레벨의 내용·난이도 곡선:** `LD-*` — [`level-architect`](../level-architect/SKILL.md)
> - **스테이지를 잇는 진행 맵의 위상:** `MAP-*` — **이 스킬** ([reference/map-design/INDEX.md](./reference/map-design/INDEX.md))
>
> **"맵" ≠ 타일맵.** [`level-designer`](../level-designer/SKILL.md)의 "맵"은 *레벨 내부 지형(타일맵·
> staticGroup)* 이다. 이 스킬의 "맵"은 *스테이지들을 잇는 월드맵/노드맵/진행 화면* — 메타 진행 구조다.

## 언제 사용
- 스테이지들을 **하나의 맵/진행 구조로 엮거나 재구성**할 때(선형 → 분기·액트·허브·무한으로 진화 포함)
- **월드맵·액트/챕터·무한맵·분기 노드맵(로그라이크)·허브앤스포크** 같은 진행 위상을 추가·설계할 때
- **해금·게이팅**(별 게이트·락앤키·보스 관문), **진행 영속**(노드별 별/완료 저장), **리플레이**
  (데일리·메타프로그레션·NG+)를 설계할 때
- **스테이지 선택 화면 / 진행 화면 / 내비게이션 UX** 가 필요하거나 "맵이 단조롭다·진행감이 없다"를 진단할 때

## 핵심 원칙
1. **분석 먼저.** 새 진행 모델을 발명하지 않는다 — 현재 game.js 가 스테이지를 어떻게 잇는지(`LEVELS` 배열·
   `loadProgress`/localStorage·Title→Game 흐름)를 찾아 **그 모델을 출발점**으로 진화시킨다.
2. **위상이 재미를 가른다.** 같은 스테이지들도 선형이냐·분기냐·액트냐·무한이냐에 따라 재미가 완전히 달라진다.
   먼저 **어떤 모양의 여정**인지를 [topologies.md](./reference/map-design/topologies.md)의 위상 선택표로 정한다.
3. **의도가 모호하면 끈질기게 묻는다.** 1문1답 탑다운 인터뷰([map-interview.md](./reference/map-interview.md))로
   진행 판타지(M2)→위상(M3)→게이팅(M4)→거시 페이싱(M5) 약점 차원을 캔다. 4문항 한 방으로 끝내지 않는다.
4. **이론으로 설계한다.** 감이 아니라 `MAP-*` 원칙([principles.md](./reference/map-design/principles.md))으로
   결정하고 *왜 이 위상·이 게이트인지* 한 줄 근거를 남긴다.
5. **모바일·무서버 제약 우선.** 한손·1~3분 세션·작은 화면·localStorage만(서버 메타 없음). 진행은 시드+소수
   카운터로, 내비는 thumb-zone·색+형태 이원부호화로. 과금·FOMO 다크패턴은 구조적으로 배제(`MAP-ETHICS`).
6. **검증.** 그래프 도달가능성(soft-lock 없음)·게이트 임계값 적정성·거시 곡선 단조성·진행 저장 마이그레이션을
   확인하고 보고한다.

## 워크플로

### 0) 현재 진행 모델 분석 (필수 · 코드 작성 전)
대상 게임의 `game.js`를 Read 해서 다음을 파악한다:
- **진행 데이터·저장** — `LEVELS`/`STAGES` 배열, `loadProgress`/`saveProgress`, localStorage 키
  (예: runeburst `rb-progress` 단일 정수, per-level `rb-best-*`), 데일리/별도 모드 유무.
- **현재 위상** — 선형 인덱스 전진? 레벨 선택 화면? 월드/액트 구분? 분기·허브? (대부분 초기엔 **순수 선형**.)
- **씬 흐름** — Title → (맵 화면?) → Game 의 연결. 맵 화면이 없으면 그게 곧 삽입 지점.
- **해금/게이트** — 무엇이 다음을 여는가(직전 클리어? 별? 없음?).
- **장르·세션·리플레이 의도** — 캐주얼 퍼즐/러너/플랫포머인지, 한 판 길이, 영속 캠페인인지 런 기반인지.

> 저장소 예시(분석 본보기): runeburst=`LEVELS[]` + `rb-progress`(선형 진행) + `daily` 모드(시드=날짜),
> is-rule=`LEVELS[]` 순수 선형(진행 저장 없음), super-runner=단일 `LEVEL`(맵 없음).

분석 결과를 **한 화면 요약**(현재 위상 · 저장 모델 · 씬 흐름 · 게이트 · 장르/세션)으로 읽어준 뒤 1)로 간다.

### 1) 의도 분석 + 맵 인터뷰 (모호하면 계속 질문)
요청이 한 줄·모호하거나 핵심 차원이 비어 있으면 **온디맨드로 [map-interview.md](./reference/map-interview.md)를
Read** 해 탑다운 1문1답 인터뷰를 수행한다(M1 분석확인 → M2 진행 판타지/목적 → M3 위상 선택 → M4 게이팅·해금
→ M5 거시 페이싱·난이도 분포 → M6 내비·가독성 → M7 영속·리플레이 → M8 분기·비밀·메타).
- **매 라운드 Claude가 먼저 구체안을 제안**(백지 금지)하고 본인 의견을 밝힌다. 추상답("재밌게")은 위상·게이트의
  구체 선택지로 되묻는다.
- **준비도 게이트**(M2 목적 + M3 위상 + M4 게이팅 + M5 페이싱) 충족 전엔 설계를 확정하지 않는다.
- "알아서/그냥 해줘"라면 분석 기반 추천 기본값(보통 **선형 베이스 + 가벼운 분기/액트** + saga 화면)으로 채운다.

### 2) 맵디자인 이론 적용 (설계 전 필수 Read)
[INDEX.md](./reference/map-design/INDEX.md)에서 라우팅 → **[topologies.md](./reference/map-design/topologies.md)**
(위상 선택표 + 아키타입)로 위상을 고르고, **[principles.md](./reference/map-design/principles.md)**(MAP-* 캐논)로
게이팅·페이싱·내비·영속을 결정한다. 설계 결정마다 MAP-* 근거를 단다:
- 위상 → `MAP-TOPOLOGY-CURVE`(선형/분기/허브의 곡선 강제력 차이), 무한이면 `MAP-INFINITE`+`MAP-SEED`.
- 게이팅 → `MAP-GATE`(하드/소프트·자물쇠를 열쇠보다 먼저)·`MAP-LOCKKEY`·`MAP-STAR`(진행≠숙련 분리).
- 거시 곡선 → `MAP-MACRO`(톱니)·`MAP-BOSS`(케이던스)·`MAP-REST`(휴식)·`MAP-CLOSE`(정점 후 하강).
- 내비 → `MAP-NAV`(현재위치·다음노드)·`MAP-PROGRESS`(목표구배)·`MAP-MOBILE`·`MAP-A11Y`.
- 영속·리플레이 → `MAP-PERSIST`·`MAP-DAILY`·`MAP-RUN`·`MAP-META`.

### 3) 맵 설계 (게임의 진행 모델을 진화시켜 산출)
이론을 적용해 **구체적 맵 설계**를 만든다 — 위상 그래프(노드·엣지·게이트), 게이팅 규칙, 내비/화면 레이아웃,
진행 저장 스키마. 데이터 모델은 [build-patterns.md](./reference/map-design/build-patterns.md)의
`MAP-SCHEMA`(평평한 `LEVELS[]` → 노드 그래프) 진화 경로를 따른다(선형은 그래프의 특수형이므로 기존 게임을 깨지
않고 점진 확장). 각 결정에 **한 줄 근거**(적용 MAP-*)를 남긴다.

### 4) 맵 화면 빌드 / 적용 (이 스킬의 범위)
- **맵 화면·내비게이션:** [build-patterns.md](./reference/map-design/build-patterns.md)의 패턴으로 Title↔Game 사이에
  **Map 씬**(saga 스크롤/노드 그래프/액트맵)을 빌드한다. 연출·HUD가 무거우면 [`game-ui-hud`](../game-ui-hud/SKILL.md),
  타일/배치 빌드는 [`level-designer`](../level-designer/SKILL.md)로 라우팅.
- **각 노드의 레벨 내용·난이도:** [`level-architect`](../level-architect/SKILL.md)에 위임(LD-* 곡선).
- **진행 저장:** `MAP-PERSIST` 봉투형(version+migration)으로 기존 localStorage 키를 마이그레이션.

### 5) 검증 (필수)
- **그래프 무결성:** 모든 노드 도달 가능(고립 노드 0), 키가 락보다 위상상 앞에 옴(soft-lock 0), 데드엔드 없음.
- **게이팅:** 별/누적 임계값 < 접근 가능 총량(잉여 마진), 하드 게이트 연속 2개 금지, 진행≠숙련 분리.
- **거시 곡선:** 톱니 단조성(정점-휴식 교대), 보스 케이던스 규칙성, 정점 직후 하강.
- **저장 마이그레이션:** v1(단일 정수)→v2(노드맵) 변환이 기존 진행을 보존하는지, 손상 JSON에 폴백하는지.
- 로컬 서버(`python -m http.server 8766`)로 띄워 맵 화면·진행·해금을 확인, 가능하면 game-qa 헤드리스로 점검 후
  **결과를 근거와 함께 보고**한다.

## 연계 / 라우팅
- **상위:** [`web-game-builder`](../web-game-builder/SKILL.md) 오케스트레이션의 진행 구조 설계 레인.
- **자매:** [`level-architect`](../level-architect/SKILL.md)(개별 레벨 내용·난이도) — 맵의 각 노드를 채운다.
- **빌드:** [`game-ui-hud`](../game-ui-hud/SKILL.md)(맵 화면·메뉴·HUD) · [`level-designer`](../level-designer/SKILL.md)
  (타일/보드 빌드) · [`juice-fx`](../juice-fx/SKILL.md)(해금·전진 연출) · [`chip-sound`](../chip-sound/SKILL.md).
- **레퍼런스:** 색인 [reference/map-design/INDEX.md](./reference/map-design/INDEX.md) · 원칙
  [principles.md](./reference/map-design/principles.md) · 위상 카탈로그 [topologies.md](./reference/map-design/topologies.md)
  · 빌드 패턴·스키마 [build-patterns.md](./reference/map-design/build-patterns.md) · 인터뷰
  [map-interview.md](./reference/map-interview.md) · Phaser4 [INDEX](../web-game-builder/reference/phaser/INDEX.md).

## IP 안전
- 맵디자인 **원칙·기법·위상**(분기-병목·락앤키·톱니 곡선·데일리 시드·허브앤스포크 등)은 저작권 대상이 아니므로
  자유롭게 차용한다.
- 단, **특정 상용 게임의 고유 맵 레이아웃**(예: Candy Crush 특정 사가맵 배치, Mario 특정 오버월드)을 그대로
  복제하지 않는다 — 구조·기법만 가져와 절차생성/오리지널 배치로 재구성한다.
- 에셋은 전부 CC0/절차생성. 상세는 [`ip-license-guard`](../ip-license-guard/SKILL.md).
