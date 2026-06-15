---
name: wgf-item-architect
description: >
  게임의 전체 아이템 시스템을 설계하고 게임에 입힌다 — 소모품(포션·버프)뿐 아니라 장비(무기·방어구·장신구)·
  특수기능/능력부여(열쇠·대시·갈고리)·통화·제작재료·코스메틱까지 "사용자가 습득·사용하는 모든 것"을 담당하는 상위 스킬.
  현재 게임의 코어 동사·장르·STORY.md 서사·플랫폼을 먼저 분석하고, 의도가 모호하면 탑다운 1문1답으로 끈질기게 캐물어,
  매 라운드 Claude가 먼저 참신한 아이템 아이디어를 제안하며 사용자가 고르거나 비틀게 한다. **복잡도를 가장 먼저 가른다** —
  많은 작은 게임은 코인 1개로 충분하므로 디폴트 0개에서 한 칸씩 정당화한다(간단/복잡을 사용자에게 적극적으로 물음).
  검증된 아이템 설계 이론(루트·획득 심리로 몰입 / enabler·payoff 시너지로 빌드 재미 / 등급·접사 / 파워커브·이코노미 /
  호딩 회피 소모품 / lock&key 진행 게이트)으로 설계해 games/<slug>/ITEMS.md 바이블 + items.json 데이터로 산출하고,
  획득 연출·HUD·아이콘으로 게임에 적용한다. **각 아이템에 visual.* 묘사 슬롯(실루엣·재질·팔레트·focal_motif·등급
  시각언어)을 충분히 채워** sprite-forge/vector-graphics/sprite-picker가 좋은 아이템 이미지를 만들게 한다. 정량 데이터라
  tools/lint-items.mjs validator로 죽은아이템·지배전략·곱연산 폭발·밸런스를 기계 검증한다. 게임 제작 초반뿐 아니라
  중반에도 아이템 수정·추가/삭제로 언제든 활용한다.
  아이템/장비/무기/방어구/장신구/소모품/포션/버프/파워업/인벤토리/전리품/루트/드랍/획득/희귀도/등급/레어/시너지/빌드/
  세트/제작/크래프팅/강화/업그레이드/통화/재화/골드/코인/열쇠/능력/보상/수집/아이템시스템을 만들·짜·넣·고치·추가·삭제·
  밸런싱 해 달라는 요청에 사용.
  English: design or revise a game's whole item system — consumables (potions/buffs), equipment (weapons/armor/
  accessories), special/ability items (keys, dash, grapple), currency, crafting materials, cosmetics — everything
  the player acquires and uses. Gates complexity first (default zero, justify upward), interviews top-down,
  proposes creative item ideas, applies loot psychology + enabler/payoff synergy + rarity/affixes + economy
  theory, outputs games/<slug>/ITEMS.md + items.json, fills visual.* slots so sprite tools make great icons, and
  machine-validates balance with lint-items.mjs. Usable at start or mid-development. Keywords: item, items,
  equipment, weapon, armor, accessory, consumable, potion, buff, powerup, inventory, loot, drop, rarity, tier,
  legendary, synergy, build, set bonus, crafting, upgrade, currency, gold, coin, key item, ability, reward,
  collectible, loadout, relic, item system, item balance.
  레벨 난이도는 level-architect, 진행 맵은 world-map-architect, 톤·캐릭터·대사는 story-architect 소관 — 이 스킬은 그 위에 얹는 '습득·사용하는 것'이다.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, WebSearch, WebFetch
---

# item-architect — 게임 아이템 시스템 디렉터 (소모품·장비·특수기능·시너지)

게임에 **'무엇을 습득하고 사용하는가'를 입히는** 상위 스킬. 코인 한 개부터 시너지 빌드까지, **사용자가 얻고 쓰는 모든 것**
(소모품·장비·특수기능/능력·통화·재료·코스메틱)을 설계한다. 코드를 바로 짜지 않고 **① 현재 게임 분석 → ② 복잡도부터
의도를 인터뷰로 명확화 → ③ 검증된 아이템 설계 이론 적용 → ④ ITEMS.md 바이블 + items.json 데이터로 산출 →
⑤ 게임 적용(획득 연출·HUD·**아이콘 이미지 핸드오프**) 또는 위임 → ⑥ 밸런스 검수(validator + 수동, 작성과 분리)**한다.
web-game-builder 워크플로의 일부. `reference/item-design/`(검증된 아이템 설계 통념을 광범위 웹 리서치로 모아 작은
2D 웹게임용으로 정리한 라이브러리)로 설계하고, 이미지·연출·UI·사운드 구현은 제작요소 스킬에 위임한다.

> **역할 분리 (5계층).** 같은 게임을 다섯 스킬이 다른 층에서 본다 — 반드시 구분한다.
> - **무엇을 플레이하나(재미·메카닉):** 재미요소 `FE-*` — [game-dna/fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md) (이 스킬은 그중 `FE-BUILD`·`FE-COLLECT`·`FE-RISK-REWARD`를 깊게 확장한다)
> - **개별 레벨의 내용·난이도:** `LD-*` — [`level-architect`](../wgf-level-architect/SKILL.md)
> - **스테이지를 잇는 진행 맵:** `MAP-*` — [`world-map-architect`](../wgf-world-map-architect/SKILL.md)
> - **톤·이야기·캐릭터·대사·반전:** [`story-architect`](../wgf-story-architect/SKILL.md)
> - **습득·사용하는 모든 것(아이템):** `SCOPE CAT ECON AFX SYN UTIL IDENT UX-*` — **이 스킬** ([reference/item-design/INDEX.md](./reference/item-design/INDEX.md))
>
> **아이템 ≠ 무조건 풍부.** 우리 게임은 작은 2D 웹게임이다. **디폴트는 아이템 0개**(`SCOPE-DEFAULT-ZERO`) — 많은 게임은
> 코인 1개·파워업 1개로 완결된다. 복잡도를 5티어로 가르고 한 칸씩 정당화한다. 무과금 단일플레이라 loot box·gacha는
> 차용 금지(가변비율 추진력만 + 천장·시드).

## 언제 사용
- 새 게임에 **아이템 시스템을 처음 설계**할 때(web-game-builder가 "아이템 시스템 만들까요?"로 위임)
- **소모품·장비·특수기능·통화·제작·시너지**를 추가/설계하고 싶을 때("포션 넣어줘", "무기 종류 만들어줘", "빌드 짜는 재미 주고 싶어", "더블점프 능력 아이템")
- **전리품·드랍·등급·희귀도·보상 루프**로 "획득하는 재미·몰입"을 만들고 싶을 때
- **제작 중반에 아이템을 수정**하거나 **추가/삭제·리밸런싱**할 때(ITEMS.md/items.json을 단일 진실로 갱신)
- 아이템이 "밋밋하다/안 쓰인다/한 빌드만 정답이다/너무 복잡하다"를 진단하고 **밸런스 리뷰**를 할 때
- **아이템 이미지가 필요**할 때 — 충분한 `visual.*` 묘사를 만들어 sprite 스킬로 핸드오프(아래 "아이콘 이미지 핸드오프")

## 핵심 원칙
1. **분석 먼저.** 진공에서 아이템을 발명하지 않는다 — 현재 game.js 의 **코어 동사·장르·기존 아이템(코인·파워업)·STORY.md 톤·플랫폼·세션 길이**를 찾아 *그 위에* 설계한다. 효과가 코어 동사·주제와 같은 말을 하게 한다(`IDENT-LUDO-HARMONY`).
2. **복잡도를 가장 먼저 못 박는다.** story-architect가 톤을 먼저 정하듯, 이 스킬은 **복잡도 티어(0~4)와 핵심 모델 1개**를 먼저 확정한다(`SCOPE-DEFAULT-ZERO`·`SCOPE-ONE-CORE`). 간단해도 되는 게임에 RPG 인벤토리를 욱여넣지 않는다 — **간단/복잡을 사용자에게 적극적으로 묻는다**.
3. **의도가 모호하면 끈질기게 묻고, Claude가 먼저 참신한 아이템을 제안한다.** 탑다운 1문1답 인터뷰([reference/item-interview.md](./reference/item-interview.md))로 약점 차원을 캔다. 빈 객관식 금지 — 매 라운드 *창의적 아이템 아이디어를 먼저* 내고 의견을 밝힌다. 사용자는 고르거나 비틀거나 자유 입력.
4. **시너지로 재미, 심리로 몰입.** 빌드 깊이가 필요하면 enabler+payoff 구조로 조합이 곱이 되게 하고(`SYN-ENABLER-PAYOFF`), 획득 동기는 가변비율·등급·천장으로 만든다(`ECON-VARIABLE-RATIO`) — 단 도박 구조는 차용 금지.
5. **묘사는 슬롯으로(이미지 생성).** 좋은 아이템 이미지를 위해 산문이 아니라 `visual.*` 슬롯을 채워 sprite-forge/vector-graphics/sprite-picker에 결정론적으로 넘긴다(`UX-DESC-SLOTS`·`UX-SILHOUETTE-FIRST`).
6. **단일 진실 + 작성/검수 분리.** 모든 효과·드랍·비주얼은 `games/<slug>/ITEMS.md`(설계 바이블) + `items.json`(기계 데이터)을 **유일한 출처**로 생성한다(`ITEMS-SINGLE-SOURCE`). 설계(③④)와 **밸런스 검수(⑥: `lint-items.mjs` + 수동)는 반드시 다른 패스**로 분리한다.
7. **과설계 금지.** 한 게임 한 핵심 모델, 작은 카탈로그, 지배전략·함정템·곱연산 폭발 차단(`SYN-NO-DOMINANT`·`SYN-ADD-VS-MULT`).

## 워크플로

### 0) 현재 게임 분석 (필수 · 설계 전)
대상 게임의 `game.js`(또는 게임 디렉터리)와 있으면 기존 `ITEMS.md`/`items.json`·`STORY.md`를 Read 해서 파악한다:
- **코어 동사·장르·스캐폴드** — 플레이어가 매 순간 하는 행동(점프·쏘기·매치·달리기)과 장르(platformer/shooter/arcade/puzzle/runner). 핵심 아이템 모델을 거의 정한다(`SCOPE-GENRE-FIT`).
- **기존 아이템** — 이미 있는 픽업·파워업·통화(super-runner=`coin`/`qblock`/`mushroom`, runeburst=gem 매치). *어디에 아이템을 얹을 자리가 있는지*.
- **서사·톤** — STORY.md가 있으면 톤·Glossary·세계관을 상속(`IDENT-CONSISTENT-VOICE`). 없으면 장르·아트에서 추론.
- **플랫폼·세션·아트** — 모바일/데스크톱, 한 판 길이, 픽셀(PixelForge) vs 스무스(VectorForge). 분량·복잡도·인벤토리 UX의 하드 상한(`SCOPE-PLATFORM-BUDGET`).

분석 결과를 **한 화면 요약**(코어 동사 · 장르/스캐폴드 · 기존 아이템 · 톤 · 플랫폼/세션 · 추정 복잡도 티어)으로 읽어준 뒤 1)로 간다.

### 1) 의도 분석 + 아이템 인터뷰 (복잡도 먼저, 모호하면 계속 질문)
요청이 한 줄·모호하거나 핵심 차원이 비면 **온디맨드로 [reference/item-interview.md](./reference/item-interview.md)를 Read** 해 탑다운 1문1답 인터뷰를 수행한다. `deep-interview` / story-interview 방법론을 아이템 설계에 적응시킨 것:
- **탑다운 순서**(I1 **복잡도·범위 ★먼저** → I2 서사·장르·플랫폼 정합 → I3 활성 범주 → I4 이코노미·획득 → I5 희귀도·등급 → I6 시너지·빌드 → I7 특수기능·진행 게이트 → I8 비주얼·정체성 → I9 밸런스·검증), 약점 차원 하나씩 + "왜 지금".
- **I1에서 복잡도 티어(0~4)를 못 박는다.** Tier 0(무아이템)·1(단일 픽업)이면 인터뷰 대부분을 건너뛰고 바로 청사진으로 — **간단해도 된다고 적극 안내**한다(`SCOPE-PROGRESSION-MIN`).
- **매 라운드 Claude가 먼저 참신한 아이템 아이디어를 제안**(백지 금지)하고 의견을 밝힌다. 추상적 답("좋은 아이템")은 구체 사례로 되묻는다.
- **준비도 게이트**(I1 복잡도+핵심모델 + I2 ludo 정합 + I3 활성 범주) 충족 전엔 바이블을 확정하지 않는다.
- 사용자가 "알아서/그냥 만들어"면 분석 기반 추천 기본값(장르 디폴트 모델)으로 채워 진행한다.

### 2) 아이템 설계 이론 적용 (설계 전 필수 Read)
[reference/item-design/INDEX.md](./reference/item-design/INDEX.md) 라우팅으로 **[principles.md](./reference/item-design/principles.md)**
(엔진 제약·복잡도 게이트·공통 캐논 11·안티패턴·장르 처방) + 복잡도 티어·장르에 맞는 도메인 파일 1~3개를 Read 하고, 설계 결정마다 원칙 code를 한 줄 근거로 단다:
- **복잡도·장르 정합** → [scope-complexity.md](./reference/item-design/scope-complexity.md) (`SCOPE-*`). 항상 먼저.
- **분류** → [taxonomy.md](./reference/item-design/taxonomy.md) (`CAT-*`). 행위축 6범주.
- **이코노미·획득·루트 심리** → [economy-loot.md](./reference/item-design/economy-loot.md) (`ECON-*`). 파워커브·드랍·천장·보상 페이싱.
- **희귀도·접사·절차 롤** → [rarity-affixes.md](./reference/item-design/rarity-affixes.md) (`AFX-*`). T3~T4.
- **시너지·빌드·밸런스** → [synergy-balance.md](./reference/item-design/synergy-balance.md) (`SYN-*`). enabler/payoff·가산vs곱산·검증.
- **소모품·특수기능·게이트** → [utility-consumables.md](./reference/item-design/utility-consumables.md) (`UTIL-*`). 호딩 회피·lock&key·softlock 방지.
- **정체성·플레이버·서사** → [identity-narrative.md](./reference/item-design/identity-narrative.md) (`IDENT-*`). 미니캐릭터·테마·STORY.md 정합.
- **비주얼묘사·아이콘·인벤·UX** → [visual-inventory-ux.md](./reference/item-design/visual-inventory-ux.md) (`UX-*`). visual.* 슬롯·등급 다채널·모바일 UX.
- **바이블 스펙·린트·툴** → [consistency-tools.md](./reference/item-design/consistency-tools.md). ITEMS.md/items.json 스펙 + 밸런스 린트 체크리스트(a~h) + 툴 매트릭스.
- **라이브 웹 리서치(WebSearch/WebFetch):** 내장 원칙은 광범위 웹 리서치를 작은 웹게임용으로 정리한 1차 라이브러리이니 **항상 먼저 적용**. 그 위에, 특정 장르·레퍼런스 게임의 아이템 *결*이 필요하면 그 장르 관습·유사작 구조를 능동 리서치해 보강한다. **IP 안전 가드**: 메카닉·구조·기법만 차용, 고유 아이템 이름·외형·세트는 오리지널 재구성([`ip-license-guard`](../wgf-ip-license-guard/SKILL.md)).

### 3) ITEMS.md 바이블 + items.json 산출 (games/<slug>/ · 단일 진실)
이론을 적용해 game.js 옆에 **`games/<slug>/ITEMS.md`(사람용 설계 바이블)** + **`games/<slug>/items.json`(기계용 데이터 = 게임 로드 + 린터 입력)**을 만든다(스펙: [consistency-tools.md](./reference/item-design/consistency-tools.md)). 복잡도 티어에 비례해 섹션을 켜고 끈다(Tier 0~1은 §0·§1·§3만).
- ITEMS.md 섹션: §0 메타(티어·핵심모델) · §1 활성 범주 · §2 이코노미&파워커브 · §3 아이템 카탈로그 · §4 시너지&세트 · §5 드랍&획득 · §6 진행 게이트 · §7 비주얼 스타일가이드(헤더 상수) · §8 인벤토리&UX · §9 밸런스 점검 로그.
- **각 아이템 레코드**: `id·name·kind·sub·rarity·slot·effect·cost/dropWeight·tags·role·grantsVerb·unlocks/requires·flavor` + **`visual.*` 슬롯**(아래 핸드오프). 작은 카탈로그 강제(세션풀 12~24·전체 24~40 상한, `SYN-MINIMAL-CATALOG`).

### 4) 게임 적용 / 위임 (★아이콘 이미지 핸드오프 포함)
items.json을 game.js에 1:1로 연결하고, 획득·사용 루프를 연출과 함께 적용하거나 web-game-builder로 위임한다:
- **데이터 로드:** items.json을 단일 진실로 `effect` 디스패치(`kind` enum=dispatch 키), 효과를 코드에 중복 하드코딩하지 않는다(`ITEMS-SINGLE-SOURCE`).
- **아이콘 이미지 핸드오프:** 각 아이템의 `visual.*` 슬롯을 → 픽셀이면 [`sprite-forge`](../wgf-sprite-forge/SKILL.md)(PixelForge 파라미터), 스무스면 [`vector-graphics`](../wgf-vector-graphics/SKILL.md)(VectorForge 명세), CC0 실물이면 [`sprite-picker`](../wgf-sprite-picker/SKILL.md)(검색쿼리·대상 슬롯) 로 넘긴다. §7 스타일가이드 헤더 상수(팔레트·등급 색·광원)를 함께 전달해 한 게임 한 스타일을 유지한다.
- **획득·사용 연출:** 드랍 팝·픽업 반짝임·등급 글로우·콤보는 [`juice-fx`](../wgf-juice-fx/SKILL.md), 획득/사용 SFX는 [`chip-sound`](../wgf-chip-sound/SKILL.md), 인벤토리·툴팁·상점·3택 카드 UI는 [`game-ui-hud`](../wgf-game-ui-hud/SKILL.md), flavor·이름 톤은 [`story-architect`](../wgf-story-architect/SKILL.md).
- **진행 정합:** 능력 게이트(키·새 동사)는 [`level-architect`](../wgf-level-architect/SKILL.md)의 난이도·[`world-map-architect`](../wgf-world-map-architect/SKILL.md)의 진행과 교차(자물쇠 먼저 노출 `UTIL-SHOW-LOCK-FIRST`).
- **중반 수정·추가/삭제:** ITEMS.md/items.json을 단일 진실로 갱신한 뒤 영향받은 코드/아이콘만 재생성(바이블 → 코드 한 방향).
  - **추가:** 인터뷰 미니 라운드로 의도를 캐고 §3 카탈로그에 레코드 등록(visual.* 채움) → 아이콘 핸드오프 → linter 재실행.
  - **삭제:** §3에서 제거 후 그 아이템이 흩어진 **§4 시너지/세트·§5 드랍 테이블·§6 게이트 그래프·gates 요구 키**에서 참조를 함께 제거하고, 그 아이템이 맡던 시너지 역할(enabler/payoff)을 재배치하거나 빌드를 재설계한다. 잔존(고아) 참조와 softlock은 ⑥ 린터로 기계 점검한다.

### 5) 검수 패스 + 밸런스 린트 (작성과 분리 · 필수)
**별도 패스로** items.json을 validator로 기계 검증하고 ITEMS.md §9에 결과를 적는다(체크리스트: [consistency-tools.md](./reference/item-design/consistency-tools.md)):
```bash
node skills/wgf-item-architect/tools/lint-items.mjs games/<slug>/items.json
```
- 검출: (a) 스키마/비주얼 슬롯 채움, (b) 죽은 아이템, (c) 지배전략(파레토 지배), (d) 곱연산 폭발, (e) 등급 파워예산 밴드 이탈, (f) 시너지 정합(고립·과밀·도달불가 세트), (g) softlock(게이트 도달가능성). 임계값은 items.json `balanceConfig`에서 읽는다.
- **수동 보강:** "아무것도 안 써도 클리어 가능? 한 빌드만 항상 정답?"(`SYN-NO-DOMINANT`), 런타임 픽률 카운터(localStorage)로 사후 죽은아이템 탐지(`SYN-METRICS`).
- **조건부 툴(온디맨드):** 랜덤 드랍/수집/가챠형 루프가 핵심이면 드랍 몬테카를로 시뮬(`tools/loot-sim.mjs`)을 생성해 기대 획득·불운 꼬리·천장을 검증, 아이콘 배정된 큰 셋(30+)이면 갤러리 뷰어(sprite-picker `picker/`+`serve.mjs` 포크)를 생성한다 — 작은 셋은 채팅 마크다운 표로 충분.
- 위반은 **사람이 보게 리포트**하고 재생성한다. 가능하면 로컬 서버로 띄워 획득→사용→payoff 루프를 [`game-qa`](../wgf-game-qa/SKILL.md)로 점검 후 **근거와 함께 보고**한다.

## 아이콘 이미지 핸드오프 (묘사가 충분해야 한다)
좋은 아이템 이미지의 전제는 **충분한 묘사**다. 이 스킬은 산문 한 줄이 아니라 **`visual.*` 고정 슬롯**을 채워, 어떤 생성 경로든 같은 입력을 결정론적으로 소비하게 한다(`UX-DESC-SLOTS`).
- **슬롯:** `silhouette`(외곽 한 단어·실루엣 우선) · `primary_shape`(베지어/픽셀 시드) · `material`(metal/wood/gem/cloth/stone/glass…) · `palette`(§7 master_palette 참조, 자유 hex 금지) · `focal_motif`(이 아이콘이 말하는 단 하나) · `negative_space` · `rarity_visual`(테두리+핍+글로우, 색 단독 금지 `UX-RARITY-MULTI-CHANNEL`) · `lighting`(기본 NW 상속) · `evolve_from`(진화체 base).
- **어댑터:** visual.* 한 블록이 → sprite-forge(픽셀 팔레트·프레임 시드) / vector-graphics(베지어·글로우·재질 램프 명세) / sprite-picker(태그·contentType·style 검색쿼리 + 대상 슬롯) 입력으로 변환된다. 자세히는 [visual-inventory-ux.md](./reference/item-design/visual-inventory-ux.md)의 `UX-DESC-SLOTS` 표.
- **일관성:** §7 스타일가이드 헤더 상수(팔레트·등급 색·광원·display_px·카테고리 시각문법)를 모든 아이템이 상속해 한 게임 한 스타일을 유지한다.
- **master_palette 상류 권위(D6):** §7의 `master_palette`/`assets/palette.master.json`은 상류 디렉터 [`style-architect`](../wgf-style-architect/SKILL.md)(`style.json`)이 정한다 — `games/<slug>/style.json`이 있으면 §7은 이를 **상속**(아이템 아이콘이 게임 전체 룩과 응집), 없으면 §7이 **인라인으로 정의**(기존 동작 그대로, 하위호환).

## make-game 적용 게이트 (반드시 묻는 항목)
- **make-game 적용:** web-game-builder/make-game 흐름에서 게임 청사진 인터뷰(+서사 게이트) 직후 **"이 게임에 item-architect로 아이템 시스템을 설계해 적용할까요?"를 반드시 묻는다**. '네'면 이 워크플로로(복잡도부터), '아니요'면 장르 기본 픽업(코인·파워업 1개)만, '나중에'면 게임부터 만들고 중반에 이 스킬로 추가(초·중반 어디서든 가능).
- **복잡도 적극 안내:** 작은 게임이면 "아이템 없이/코인 1개로도 충분합니다"를 먼저 제시한다 — 과설계를 권하지 않는다(`SCOPE-DEFAULT-ZERO`).

## 연계 / 라우팅
- **상위:** [`web-game-builder`](../wgf-web-game-builder/SKILL.md) 오케스트레이션의 아이템 설계 레인. 명시 호출은 [`commands/wgf-make-game.md`](../../commands/wgf-make-game.md), 게임 인터뷰는 [game-interview.md](../wgf-web-game-builder/reference/game-interview.md)(`FE-BUILD`/`FE-COLLECT` 선택 시 연계).
- **자매:** [`story-architect`](../wgf-story-architect/SKILL.md)(flavor·톤 정합) · [`level-architect`](../wgf-level-architect/SKILL.md)(보상↔난이도 곡선) · [`world-map-architect`](../wgf-world-map-architect/SKILL.md)(능력 게이트↔진행).
- **이미지·구현:** [`sprite-forge`](../wgf-sprite-forge/SKILL.md)/[`vector-graphics`](../wgf-vector-graphics/SKILL.md)/[`sprite-picker`](../wgf-sprite-picker/SKILL.md)(아이콘) · [`game-ui-hud`](../wgf-game-ui-hud/SKILL.md)(인벤·툴팁·상점) · [`juice-fx`](../wgf-juice-fx/SKILL.md)(획득 연출) · [`chip-sound`](../wgf-chip-sound/SKILL.md)(SFX) · [`game-qa`](../wgf-game-qa/SKILL.md)(검증).
- **레퍼런스:** 색인 [reference/item-design/INDEX.md](./reference/item-design/INDEX.md) · 공통 원칙 [principles.md](./reference/item-design/principles.md) · 인터뷰 [item-interview.md](./reference/item-interview.md) · 바이블/툴 스펙 [consistency-tools.md](./reference/item-design/consistency-tools.md) · 재미요소 [fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md)(`FE-BUILD`·`FE-COLLECT`) · Phaser4 [INDEX](../wgf-web-game-builder/reference/phaser/INDEX.md). 툴 [tools/lint-items.mjs](./tools/lint-items.mjs).

## IP 안전
- 아이템 **메카닉·구조·기법**(등급 사다리·접사 롤·세트 보너스·enabler/payoff·lock&key·진화 등)은 저작권 대상이 아니므로 자유롭게 차용한다.
- 단, **특정 상용 게임의 고유 아이템 이름·외형·세트·시그니처 조합**(예: 특정 게임의 전설템 이름·아이콘)을 그대로 복제하지 않는다 — 메카닉만 가져와 **오리지널로 재구성**한다.
- 이름·고유명사는 ITEMS.md 와 STORY.md `## 8. Glossary`에 오리지널로 정의한다. 아트는 절차 생성(PixelForge·VectorForge) 또는 라이선스 안전한 외부 에셋(sprite-picker). 무과금 단일플레이라 loot box·gacha·페이월은 차용하지 않는다. 상세는 [`ip-license-guard`](../wgf-ip-license-guard/SKILL.md).
