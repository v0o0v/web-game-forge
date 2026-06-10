---
name: wgf-ability-architect
description: >
  게임의 전체 **캐릭터 능력/스킬 시스템**을 설계하고 게임에 입힌다 — 액티브·패시브·이동기(대시·더블점프·갈고리)·
  궁극기·리액션(패링)·자원(마나/스태미나/기력)·쿨다운·충전·콤보/연계·캔슬·시너지·빌드·스킬트리/특성·진행/획득까지
  "캐릭터가 *무엇을 할 수 있고, 그것이 어떻게 자라고 조합되는가*"를 담당하는 상위 스킬. **여기서 '스킬'은 게임 캐릭터의
  능력을 뜻한다 — Claude Code 의 스킬(클로드 스킬)과 다르다.** 플랫포머의 더블점프 한 개부터 디아블로급 스킬트리까지
  폭넓은 스펙트럼을 커버하되, **복잡도를 가장 먼저 가른다** — 디폴트는 코어 동사 위 능력 0~1개에서 한 칸씩 정당화한다.
  현재 게임의 코어 동사·장르·STORY.md 서사·플랫폼을 먼저 분석하고, 의도가 모호하면 탑다운 1문1답으로 끈질기게 캐물어,
  매 라운드 Claude가 먼저 참신한 능력·콤보·시너지 아이디어를 제안하며 사용자가 고르거나 비틀게 한다. 검증된 능력 설계
  이론(자원·기회비용 / 선딜·발동·후딜 게임필 / enabler·payoff 시너지로 빌드 재미 / 콤보 연계 / 스킬트리·능력게이트 진행 /
  파워예산·카운터플레이 밸런스 / 능력 판타지·정체성)으로 설계해 games/<slug>/ABILITIES.md 바이블 + abilities.json 데이터로
  산출하고, engine/abilitykit.js(쿨다운·자원·콤보·게이트 런타임) 배선·아이콘 핸드오프로 게임에 적용한다. 각 능력에 visual.*
  묘사 슬롯을 채워 sprite-forge/vector-graphics/sprite-picker 가 좋은 능력 아이콘을 만들게 한다. 정량 데이터라
  tools/lint-abilities.mjs validator 로 죽은스킬·지배전략·곱연산폭발·무한콤보·자원지속성·스킬트리도달성·게이트softlock 을
  기계 검증하고, 복잡한 킷은 tools/sim-abilities.mjs 로 빌드별 DPS·자원 지속성을 시뮬한다. 게임 제작 초반뿐 아니라 중반에도
  능력 수정·추가/삭제로 언제든 활용한다.
  캐릭터스킬/캐릭스킬/스킬시스템/스킬셋/스킬트리/특성/탈렌트/능력/액티브/패시브/궁극기/궁/이동기/대시/더블점프/벽점프/
  갈고리/패링/쿨다운/마나/스태미나/기력/자원/콤보/연계/캔슬/시너지/빌드/스킬빌드/능력조합/능력획득/능력강화를 만들·짜·
  넣·고치·추가·삭제·밸런싱·설계 해 달라는 요청에 사용.
  English: design or revise a game's whole **character ability/skill system** (NOT Claude Code skills) — actives,
  passives, mobility (dash/double-jump/grapple), ultimates, reactions (parry), resources (mana/stamina/energy),
  cooldowns, charges, combos/cancels, synergy/build-crafting, skill trees/talents, progression/acquisition.
  Spans a platformer's single double-jump to a Diablo-grade skill tree. Gates complexity first (default near-zero,
  justify upward), interviews top-down, proposes creative ability/combo/synergy ideas, applies resource/opportunity-
  cost + anticipation/active/recovery game-feel + enabler/payoff synergy + combo chains + skill-tree/ability-gating
  progression + power-budget/counterplay balance + ability fantasy theory, outputs games/<slug>/ABILITIES.md +
  abilities.json, wires engine/abilitykit.js runtime, fills visual.* slots for icons, and machine-validates with
  lint-abilities.mjs (+ sim-abilities.mjs for complex kits). Usable at start or mid-development. Keywords: ability,
  skill, skill system, skill tree, talent, active, passive, ultimate, mobility, dash, double jump, parry, cooldown,
  mana, stamina, resource, charge, combo, cancel, synergy, build, kit, ability gate, character ability.
  습득·사용하는 아이템은 item-architect, 톤·캐릭터·대사는 story-architect, 레벨 난이도는 level-architect, 진행 맵은
  world-map-architect, 사운드는 sound-architect 소관 — 이 스킬은 '캐릭터가 할 수 있는 행동(능력)' 그 자체다.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, WebSearch, WebFetch
---

# ability-architect — 게임 캐릭터 능력/스킬 시스템 디렉터

> **용어 주의 — 캐릭터 스킬 ≠ 클로드 스킬.** 이 스킬이 다루는 "스킬"은 **게임 속 캐릭터가 쓰는 능력**(대시·파이어볼·
> 궁극기·패시브·스킬트리)이다. Claude Code 의 스킬(이 파일 같은 것)과 혼동하지 않는다. 문서·대화에서 헷갈릴 여지가
> 있으면 "능력(ability)"으로 부른다.

게임에 **'캐릭터가 무엇을 할 수 있고, 그 능력이 어떻게 자라고(획득) 조합되고(시너지) 쓰이는가(사용)'를 입히는** 상위 스킬.
플랫포머의 더블점프 한 개부터 디아블로급 스킬트리까지, **캐릭터의 능력 전체**(액티브·패시브·이동기·궁극기·리액션 + 자원·
쿨다운·콤보·진행)를 설계한다. 코드를 바로 짜지 않고 **① 현재 게임 분석 → ② 복잡도부터 의도를 인터뷰로 명확화 → ③ 검증된
능력 설계 이론 적용 → ④ ABILITIES.md 바이블 + abilities.json 데이터로 산출 → ⑤ 게임 적용(engine/abilitykit.js 배선·쿨다운/
자원/콤보/게이트·**아이콘 이미지 핸드오프**) 또는 위임 → ⑥ 밸런스 검수(validator + 수동, 작성과 분리)**한다. web-game-builder
워크플로의 일부. `reference/ability-design/`(검증된 능력 설계 통념을 광범위 웹 리서치로 모아 작은 2D 웹게임용으로 정리한
라이브러리)로 설계하고, 런타임은 `engine/abilitykit.js`, 이미지·연출·UI·사운드 구현은 제작요소 스킬에 위임한다.

> **역할 분리 (7계층).** 같은 게임을 일곱 스킬이 다른 층에서 본다 — 반드시 구분한다.
> - **무엇을 플레이하나(재미·메카닉):** 재미요소 `FE-*` — [game-dna/fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md) (이 스킬은 `FE-MASTERY`·`FE-BUILD`·`FE-COMBO`·`FE-POWER-FANTASY`를 깊게 확장한다)
> - **개별 레벨의 내용·난이도:** `LD-*` — [`level-architect`](../wgf-level-architect/SKILL.md)
> - **스테이지를 잇는 진행 맵:** `MAP-*` — [`world-map-architect`](../wgf-world-map-architect/SKILL.md)
> - **톤·이야기·캐릭터·대사·반전:** [`story-architect`](../wgf-story-architect/SKILL.md)
> - **습득·사용하는 모든 것(아이템):** [`item-architect`](../wgf-item-architect/SKILL.md)
> - **그 위에 입히는 소리:** [`sound-architect`](../wgf-sound-architect/SKILL.md)
> - **캐릭터가 할 수 있는 행동(능력) 그 자체:** `SCOPE KIT RES FEEL PROG GATE SYN COMBO BAL IDENT UX-*` — **이 스킬** ([reference/ability-design/INDEX.md](./reference/ability-design/INDEX.md))
>
> **능력 ≠ 무조건 많이.** 우리 게임은 작은 2D 웹게임이다. **디폴트는 코어 동사 위 능력 0~1개**(`SCOPE-DEFAULT-MINIMAL`) —
> 많은 게임은 점프·쏘기 같은 코어 동사 + 능력 1개(대시)로 완결된다. 복잡도를 5티어로 가르고 한 칸씩 정당화한다.
> 무과금 단일플레이라 도박형 가챠 능력해금은 차용 금지(가변비율 추진력 + 천장만).

## 아이템과의 경계 (item-architect)
- **이 스킬(ability-architect)이 능력의 권위다** — 능력의 정의·자원·쿨다운·진행(스킬트리)·시너지·콤보·게이트는 abilities.json 이 단일 진실.
- **아이템이 능력을 부여/강화**하면(예: 대시 부츠, 갈고리 아이템) item-architect 의 items.json 에서 `grantsAbility: "<abilities.json의 id>"` 로 **id 교차참조**한다 — 능력 자체는 여기서 정의하고, 아이템은 그 능력을 *전달하는 그릇*이다.
- 거꾸로 "줍는 즉시 끝나는 단순 파워업"(잠깐 무적·자석)은 능력 시스템이 아니라 [`item-architect`](../wgf-item-architect/SKILL.md)의 소모품/파워업이다. **능력 = 캐릭터가 반복해서 쓰는 행동**(쿨다운·자원·진행이 붙는 것), 파워업 = 일회성 픽업으로 가른다.

## 언제 사용
- 새 게임에 **캐릭터 능력/스킬 시스템을 처음 설계**할 때(web-game-builder가 "능력 시스템 만들까요?"로 위임)
- **액티브·패시브·이동기·궁극기·콤보·스킬트리·시너지**를 추가/설계하고 싶을 때("대시 넣어줘", "스킬 3개 만들어줘", "스킬트리 짜줘", "콤보로 잇는 재미", "조합하면 강해지는 빌드")
- **능력을 획득·조합·사용하는 재미 루프**(획득의 몰입 / enabler+payoff 빌드 / 콤보 연계 / 후반 압도)를 만들고 싶을 때
- **제작 중반에 능력을 수정**하거나 **추가/삭제·리밸런싱**할 때(ABILITIES.md/abilities.json을 단일 진실로 갱신)
- 능력이 "밋밋하다/안 쓰인다/한 스킬만 정답이다/너무 복잡하다/콤보가 안 터진다"를 진단하고 **밸런스 리뷰**를 할 때
- **능력 아이콘이 필요**할 때 — 충분한 `visual.*` 묘사를 만들어 sprite 스킬로 핸드오프(아래 "아이콘 이미지 핸드오프")

## 핵심 원칙
1. **분석 먼저.** 진공에서 능력을 발명하지 않는다 — 현재 game.js 의 **코어 동사·장르·기존 입력/능력(점프·발사·대시)·STORY.md 톤·플랫폼·세션 길이**를 찾아 *그 위에* 설계한다. 능력이 코어 동사·주제와 같은 말을 하게 한다(`IDENT-LUDO-HARMONY`). 점프 게임의 최고 능력은 +5 방어가 아니라 더블점프다(`IDENT-VERB-OVER-STAT`).
2. **복잡도를 가장 먼저 못 박는다.** story-architect가 톤을, item-architect가 아이템 복잡도를 먼저 정하듯, 이 스킬은 **복잡도 티어(0~4)와 핵심 모델 1개**를 먼저 확정한다(`SCOPE-DEFAULT-MINIMAL`·`SCOPE-ONE-CORE`). 간단해도 되는 게임에 스킬트리를 욱여넣지 않는다 — **간단/복잡을 사용자에게 적극적으로 묻는다**.
3. **의도가 모호하면 끈질기게 묻고, Claude가 먼저 참신한 능력·콤보를 제안한다.** 탑다운 1문1답 인터뷰([reference/ability-interview.md](./reference/ability-interview.md))로 약점 차원을 캔다. 빈 객관식 금지 — 매 라운드 *그림이 그려지는 한 컷*(능력 한 줄 + 어떻게 콤보/시너지가 터지나)을 먼저 내고 의견을 밝힌다. 사용자는 고르거나 비틀거나 자유 입력.
4. **획득→조합→사용의 재미가 1순위.** 빌드 깊이가 필요하면 enabler+payoff 구조로 능력 조합이 곱이 되게 하고(`SYN-ENABLER-PAYOFF`), 콤보 연계로 능력이 능력을 부르게 하며(`COMBO-CHAIN`), 획득(스킬트리·드래프트)은 가변비율·의미있는 분기로 몰입을 만든다(`PROG-MEANINGFUL-CHOICE`) — 단 도박 구조는 차용 금지.
5. **능력은 손맛으로 산다.** 능력의 1차 가치는 *쓸 때의 감각*이다 — 선딜·발동·후딜(`FEEL-ANTICIPATION`)·텔레그래프(`FEEL-TELEGRAPH`)·입력 버퍼(`FEEL-BUFFER`)로 공정하고 시원하게. 기회비용(쿨다운·자원)이 선택을 의미있게 만든다(`RES-OPPORTUNITY-COST`).
6. **묘사는 슬롯으로(아이콘 생성).** 좋은 능력 아이콘을 위해 산문이 아니라 `visual.*` 슬롯을 채워 sprite-forge/vector-graphics/sprite-picker에 결정론적으로 넘긴다(`UX-DESC-SLOTS`·`UX-SILHOUETTE-FIRST`).
7. **단일 진실 + 작성/검수 분리.** 모든 능력·자원·진행·비주얼은 `games/<slug>/ABILITIES.md`(설계 바이블) + `abilities.json`(기계 데이터 = abilitykit 로드 + 린터 입력)을 **유일한 출처**로 생성한다(`ABILITIES-SINGLE-SOURCE`). 설계(③④)와 **밸런스 검수(⑥: `lint-abilities.mjs` + 수동)는 반드시 다른 패스**로 분리한다.
8. **과설계 금지.** 한 게임 한 핵심 모델, 작은 킷, 지배전략·죽은스킬·곱연산폭발·무한콤보 차단(`BAL-NO-DOMINANT`·`BAL-NO-DEAD-SKILL`·`SYN-ADD-VS-MULT`·`COMBO-NO-INFINITE`). 모바일 버튼 예산을 지킨다(`UX-BUTTON-BUDGET`).

## 워크플로

### 0) 현재 게임 분석 (필수 · 설계 전)
대상 게임의 `game.js`(또는 게임 디렉터리)와 있으면 기존 `ABILITIES.md`/`abilities.json`·`STORY.md`·`ITEMS.md`를 Read 해서 파악한다:
- **코어 동사·장르·스캐폴드** — 플레이어가 매 순간 하는 행동(점프·쏘기·매치·달리기)과 장르(platformer/shooter/arcade/puzzle/runner). 핵심 능력 모델을 거의 정한다(`SCOPE-GENRE-FIT`).
- **기존 입력·능력** — 이미 있는 입력(좌우·점프·발사)·능력(대시·차지)·키 바인딩. *어디에 능력을 얹을 자리(빈 버튼·새 동사)가 있는지*.
- **서사·톤** — STORY.md가 있으면 톤·Glossary·세계관을 상속(`IDENT-CONSISTENT-VOICE`). 능력 판타지가 캐릭터/톤과 같은 말을 하게 한다.
- **아이템 경계** — ITEMS.md가 있으면 능력 부여 아이템(grantsAbility)·파워업을 확인해 중복/충돌을 피한다(위 "아이템과의 경계").
- **플랫폼·세션·입력** — 모바일/데스크톱, 한 판 길이, 동시 입력 버튼 수. 능력 개수·복잡도·콤보 깊이의 하드 상한(`SCOPE-PLATFORM-BUDGET`·`UX-BUTTON-BUDGET`).

분석 결과를 **한 화면 요약**(코어 동사 · 장르/스캐폴드 · 기존 입력·능력 · 톤 · 플랫폼/세션/버튼 예산 · 추정 복잡도 티어)으로 읽어준 뒤 1)로 간다.

### 1) 의도 분석 + 능력 인터뷰 (복잡도 먼저, 모호하면 계속 질문)
요청이 한 줄·모호하거나 핵심 차원이 비면 **온디맨드로 [reference/ability-interview.md](./reference/ability-interview.md)를 Read** 해 탑다운 1문1답 인터뷰를 수행한다. `deep-interview` / story·item-interview 방법론을 능력 설계에 적응시킨 것:
- **탑다운 순서**(A1 **복잡도·범위 ★먼저** → A2 서사·장르·플랫폼 정합 → A3 킷·역할 구성 → A4 자원·비용 → A5 발동·게임필 → A6 진행·획득 → A7 시너지·콤보 → A8 능력 게이트 → A9 정체성·판타지 → A10 밸런스·검증), 약점 차원 하나씩 + "왜 지금".
- **A1에서 복잡도 티어(0~4)를 못 박는다.** Tier 0(코어 동사만)·1(능력 1개)이면 인터뷰 대부분을 건너뛰고 바로 청사진으로 — **간단해도 된다고 적극 안내**한다.
- **매 라운드 Claude가 먼저 참신한 능력·콤보·시너지를 제안**(백지 금지)하고 의견을 밝힌다. 추상적 답("멋진 스킬")은 구체 능력·자원·콤보로 되묻는다.
- **준비도 게이트**(A1 복잡도+핵심모델 + A2 정합 + A3 킷) 충족 전엔 바이블을 확정하지 않는다.
- 사용자가 "알아서/그냥 만들어"면 분석 기반 추천 기본값(장르 디폴트 킷)으로 채워 진행한다.

### 2) 능력 설계 이론 적용 (설계 전 필수 Read)
[reference/ability-design/INDEX.md](./reference/ability-design/INDEX.md) 라우팅으로 **[principles.md](./reference/ability-design/principles.md)**
(엔진 제약·복잡도 게이트·공통 캐논·안티패턴·장르 처방) + **항상 [scope-complexity.md](./reference/ability-design/scope-complexity.md)** 먼저 + 복잡도 티어·장르에 맞는 도메인 파일 1~3개를 Read 하고, 설계 결정마다 원칙 code를 한 줄 근거로 단다:
- **복잡도·장르 정합** → [scope-complexity.md](./reference/ability-design/scope-complexity.md) (`SCOPE-*`). 항상 먼저.
- **킷·분류** → [kit-taxonomy.md](./reference/ability-design/kit-taxonomy.md) (`KIT-*`). 액티브/패시브/이동기/궁극기/리액션·역할 분담·입력 타입.
- **자원·비용** → [resource-cost.md](./reference/ability-design/resource-cost.md) (`RES-*`). 쿨다운·마나/스태미나·충전·기회비용·자원 지속성.
- **발동·게임필** → [activation-feel.md](./reference/ability-design/activation-feel.md) (`FEEL-*`). 선딜/발동/후딜·텔레그래프·버퍼·캔슬·히트스톱.
- **진행·획득·게이트** → [progression-acquisition.md](./reference/ability-design/progression-acquisition.md) (`PROG-*`·`GATE-*`). 스킬트리·드래프트·레벨업·능력게이트·softlock 방지.
- **시너지·콤보·밸런스** → [synergy-combo.md](./reference/ability-design/synergy-combo.md) (`SYN-*`·`COMBO-*`) + [balance-counterplay.md](./reference/ability-design/balance-counterplay.md) (`BAL-*`). enabler/payoff·콤보 연계·가산vs곱산·지배전략 제거.
- **정체성·판타지** → [identity-fantasy.md](./reference/ability-design/identity-fantasy.md) (`IDENT-*`). 능력 판타지·ludo 조화·숙련 표현·명명.
- **비주얼·HUD·UX** → [presentation-ux.md](./reference/ability-design/presentation-ux.md) (`UX-*`). visual.* 슬롯·스킬바·쿨다운 시각화·모바일 버튼 예산.
- **바이블 스펙·린트·툴** → [consistency-tools.md](./reference/ability-design/consistency-tools.md). ABILITIES.md/abilities.json 스펙 + 밸런스 린트 체크리스트 + 툴 매트릭스.
- **라이브 웹 리서치(WebSearch/WebFetch):** 내장 원칙은 광범위 웹 리서치(`.omc/research/ability-system-research-dossier.md`)를 작은 웹게임용으로 정리한 1차 라이브러리이니 **항상 먼저 적용**. 그 위에, 특정 장르·레퍼런스 게임의 능력 *결*이 필요하면 그 장르 관습·유사작 구조를 능동 리서치해 보강한다. **IP 안전 가드**: 메카닉·구조·기법만 차용, 고유 능력 이름·외형·시그니처는 오리지널 재구성([`ip-license-guard`](../wgf-ip-license-guard/SKILL.md)).

### 3) ABILITIES.md 바이블 + abilities.json 산출 (games/<slug>/ · 단일 진실)
이론을 적용해 game.js 옆에 **`games/<slug>/ABILITIES.md`(사람용 설계 바이블)** + **`games/<slug>/abilities.json`(기계용 데이터 = abilitykit 로드 + 린터 입력)**을 만든다(스펙: [consistency-tools.md](./reference/ability-design/consistency-tools.md)). 복잡도 티어에 비례해 섹션을 켜고 끈다(Tier 0~1은 §0·§1·§3만).
- ABILITIES.md 섹션: §0 메타(티어·핵심모델) · §1 킷·역할 · §2 자원·이코노미 · §3 능력 카탈로그 · §4 발동·게임필 · §5 진행·획득(스킬트리) · §6 시너지·콤보 · §7 능력 게이트 · §8 비주얼 스타일가이드(헤더 상수) · §9 HUD·입력 · §10 밸런스 점검 로그.
- **각 능력 레코드**: `id·name·kind·input·slot·resource·cost·cooldown·charges·cast/active/recovery·effect·scaling·tags·role·grantsVerb·unlocks/requires·combo·budget·flavor` + **`visual.*` 슬롯**(아래 핸드오프). 작은 킷 강제(액티브 동시 바인딩 ≤ 모바일 버튼 예산, 전체 카탈로그 상한, `SYN-MINIMAL-KIT`).

### 4) 게임 적용 / 위임 (★abilitykit 배선 + 아이콘 핸드오프)
abilities.json을 game.js에 1:1로 연결하고, 획득·사용·콤보 루프를 연출과 함께 적용하거나 web-game-builder로 위임한다:
- **런타임 엔진(index.html):** SoundForge 패턴과 동일하게 `engine/abilitykit.js` 를 **phaser 다음·game 이전**에 추가. T0~T1(능력 1~2개)이면 abilitykit 없이 game.js 에 직접 코딩해도 된다(과설계 금지).
- **인스턴스·전역 등록(game.js):** `var KIT = AbilityKit.attach(this, ABILITIES_SPEC, { onActivate, unlockedAtStart });` → `window.GAME_ABILITIES = KIT;`. `ABILITIES_SPEC` = abilities.json(fetch 또는 인라인). `tick` 은 attach 가 씬 update 에 자동 훅.
- **데이터 구동 디스패치:** abilitykit 은 **쿨다운·자원·콤보·게이트·해금 타이밍**만 굴린다. 능력의 *효과*(대미지·발사체·이동·CC)는 게임이 `onActivate(ability, ctx)`에서 `ability.effect` 를 읽어 실행한다 — 효과를 코드에 중복 하드코딩하지 않는다(`ABILITIES-SINGLE-SOURCE`).
- **입력 배선:** 키/버튼/제스처에서 `KIT.use('<id>', ctx)`. 쿨다운/자원 부족/잠김은 `onReject` 로 피드백. 모바일은 [`virtual-joystick`](../wgf-virtual-joystick/SKILL.md)/`MobileHarness` D-패드와 능력 버튼을 조합(버튼 예산 `UX-BUTTON-BUDGET`).
- **아이콘 이미지 핸드오프:** 각 능력의 `visual.*` 슬롯을 → 픽셀이면 [`sprite-forge`](../wgf-sprite-forge/SKILL.md), 스무스면 [`vector-graphics`](../wgf-vector-graphics/SKILL.md), CC0 실물이면 [`sprite-picker`](../wgf-sprite-picker/SKILL.md) 로 넘긴다. §8 스타일가이드 헤더 상수(팔레트·역할 색·광원)를 함께 전달해 한 게임 한 스타일을 유지한다.
- **발동·콤보 연출:** 능력 이펙트·히트스톱·스크린셰이크는 [`juice-fx`](../wgf-juice-fx/SKILL.md), 발동/타격 SFX는 [`sound-architect`](../wgf-sound-architect/SKILL.md)/[`chip-sound`](../wgf-chip-sound/SKILL.md), 스킬바·쿨다운 스윕·자원바·스킬트리 화면 UI는 [`game-ui-hud`](../wgf-game-ui-hud/SKILL.md), flavor·이름 톤은 [`story-architect`](../wgf-story-architect/SKILL.md), 탄막/경로 능력은 [`path-motion`](../wgf-path-motion/SKILL.md), 조준 입력은 [`virtual-joystick`](../wgf-virtual-joystick/SKILL.md).
- **진행 정합:** 능력 게이트(새 동사로 잠긴 곳 열기)는 [`level-architect`](../wgf-level-architect/SKILL.md)의 난이도·[`world-map-architect`](../wgf-world-map-architect/SKILL.md)의 진행과 교차(자물쇠 먼저 노출 `GATE-SHOW-LOCK-FIRST`). 능력 부여 아이템은 [`item-architect`](../wgf-item-architect/SKILL.md)와 grantsAbility id 로 교차.
- **중반 수정·추가/삭제:** ABILITIES.md/abilities.json을 단일 진실로 갱신한 뒤 영향받은 코드/아이콘만 재생성(바이블 → 코드 한 방향).
  - **추가:** 인터뷰 미니 라운드로 의도를 캐고 §3 카탈로그에 레코드 등록(visual.* 채움) → 아이콘 핸드오프 → linter 재실행.
  - **삭제:** §3에서 제거 후 그 능력이 흩어진 **§5 스킬트리 노드·§6 시너지/콤보·§7 게이트 그래프·requires/cooldownReset 참조**에서 함께 제거하고, 그 능력이 맡던 시너지 역할(enabler/payoff)·콤보 링크를 재배치한다. 잔존(고아) 참조와 softlock은 ⑥ 린터로 기계 점검한다.

### 5) 검수 패스 + 밸런스 린트 (작성과 분리 · 필수)
**별도 패스로** abilities.json을 validator로 기계 검증하고 ABILITIES.md §10에 결과를 적는다(체크리스트: [consistency-tools.md](./reference/ability-design/consistency-tools.md)):
```bash
node skills/wgf-ability-architect/tools/lint-abilities.mjs games/<slug>/abilities.json
```
- 검출: (a) 스키마/비주얼 슬롯/참조 무결성, (b) 죽은스킬, (c) 지배전략(파레토 지배), (d) 곱연산 폭발, (e) 자원 지속성(영구 사용불가·무비용), (f) 쿨다운/파워예산, (g) 시너지 정합(고립·과밀·도달불가 세트), (h) 스킬트리 도달성, (i) 게이트 softlock, (j) 무한 콤보 루프, (k) 모바일 버튼 예산. 임계값은 abilities.json `balanceConfig`에서 읽는다.
- **수동 보강:** "아무 능력 안 써도 클리어 가능? 한 빌드만 항상 정답? 콤보가 실제로 터지나? 손맛이 있나?"(`BAL-NO-DOMINANT`·`FEEL-*`).
- **조건부 툴(온디맨드):** 빌드 시너지·자원 로테이션이 핵심인 복잡한 킷(T3~T4)이면 DPS·자원 지속성 시뮬을 돌려 지배 능력·자원 고갈을 검증한다 — 작은 킷엔 과하다:
```bash
node skills/wgf-ability-architect/tools/sim-abilities.mjs games/<slug>/abilities.json --build a,b,c --duration 60
```
- 위반은 **사람이 보게 리포트**하고 재생성한다. 가능하면 로컬 서버로 띄워 획득→조합→사용→콤보 루프를 [`game-qa`](../wgf-game-qa/SKILL.md)로 점검 후 **근거와 함께 보고**한다.

## 아이콘 이미지 핸드오프 (묘사가 충분해야 한다)
좋은 능력 아이콘의 전제는 **충분한 묘사**다. 산문 한 줄이 아니라 **`visual.*` 고정 슬롯**을 채워, 어떤 생성 경로든 같은 입력을 결정론적으로 소비하게 한다(`UX-DESC-SLOTS`).
- **슬롯:** `silhouette`(외곽 한 단어·실루엣 우선) · `material`(불·얼음·강철·전기·그림자…) · `palette`(§8 master_palette 참조, 자유 hex 금지) · `focal_motif`(이 아이콘이 말하는 단 하나) · `vfx_motif`(발동 시 화면 이펙트의 결) · `telegraph_read`(적 입장에서 무엇을 보고 피하나, 적/위험 능력일 때) · `rarity_visual`(등급/궁극 테두리, 색 단독 금지) · `lighting`(기본 NW 상속).
- **어댑터:** visual.* 한 블록이 → sprite-forge(픽셀 팔레트·프레임 시드) / vector-graphics(베지어·글로우·재질 램프 명세) / sprite-picker(태그·contentType·style 검색쿼리 + 대상 슬롯) 입력으로 변환된다. 자세히는 [presentation-ux.md](./reference/ability-design/presentation-ux.md)의 `UX-DESC-SLOTS` 표.
- **일관성:** §8 스타일가이드 헤더 상수(팔레트·역할 색·궁극 강조·광원·display_px·kind 시각문법)를 모든 능력이 상속해 한 게임 한 스타일을 유지한다.
- **master_palette 상류 권위(D6):** §8의 `master_palette`/`assets/palette.master.json`은 상류 디렉터 [`style-architect`](../wgf-style-architect/SKILL.md)(`style.json`)이 정한다 — `games/<slug>/style.json`이 있으면 §8은 이를 **상속**(능력 아이콘이 게임 전체 룩과 응집), 없으면 §8이 **인라인으로 정의**(기존 동작 그대로, 하위호환).

## make-game 적용 게이트 (반드시 묻는 항목)
- **make-game 적용:** web-game-builder/make-game 흐름에서 게임 청사진 인터뷰(+서사 게이트) 직후, **아이템 게이트 전에** **"이 게임에 ability-architect로 캐릭터 능력/스킬 시스템을 설계해 적용할까요?"를 반드시 묻는다**(능력은 코어 동사에 가장 가깝고, 아이템이 능력을 부여하므로 능력을 먼저 정한다). '네'면 이 워크플로로(복잡도부터), '아니요'면 코어 동사 기본 입력만(능력 0~1개), '나중에'면 게임부터 만들고 중반에 이 스킬로 추가(초·중반 어디서든 가능).
- **복잡도 적극 안내:** 작은 게임이면 "능력 없이 코어 동사로/대시 하나로도 충분합니다"를 먼저 제시한다 — 과설계를 권하지 않는다(`SCOPE-DEFAULT-MINIMAL`).

## 연계 / 라우팅
- **상위:** [`web-game-builder`](../wgf-web-game-builder/SKILL.md) 오케스트레이션의 능력 설계 레인. 명시 호출은 [`commands/wgf-make-game.md`](../../commands/wgf-make-game.md), 게임 인터뷰는 [game-interview.md](../wgf-web-game-builder/reference/game-interview.md)(`FE-MASTERY`/`FE-BUILD`/`FE-COMBO` 선택 시 연계).
- **자매:** [`item-architect`](../wgf-item-architect/SKILL.md)(능력 부여 아이템 grantsAbility 교차) · [`story-architect`](../wgf-story-architect/SKILL.md)(능력 판타지·flavor 정합) · [`level-architect`](../wgf-level-architect/SKILL.md)(능력 게이트↔난이도) · [`world-map-architect`](../wgf-world-map-architect/SKILL.md)(능력 게이트↔진행).
- **이미지·구현:** [`sprite-forge`](../wgf-sprite-forge/SKILL.md)/[`vector-graphics`](../wgf-vector-graphics/SKILL.md)/[`sprite-picker`](../wgf-sprite-picker/SKILL.md)(아이콘) · [`game-ui-hud`](../wgf-game-ui-hud/SKILL.md)(스킬바·쿨다운·스킬트리 UI) · [`juice-fx`](../wgf-juice-fx/SKILL.md)(발동 연출) · [`sound-architect`](../wgf-sound-architect/SKILL.md)/[`chip-sound`](../wgf-chip-sound/SKILL.md)(SFX) · [`path-motion`](../wgf-path-motion/SKILL.md)(탄막/경로 능력) · [`virtual-joystick`](../wgf-virtual-joystick/SKILL.md)(조준) · [`game-qa`](../wgf-game-qa/SKILL.md)(검증).
- **레퍼런스:** 색인 [reference/ability-design/INDEX.md](./reference/ability-design/INDEX.md) · 공통 원칙 [principles.md](./reference/ability-design/principles.md) · 인터뷰 [ability-interview.md](./reference/ability-interview.md) · 바이블/툴 스펙 [consistency-tools.md](./reference/ability-design/consistency-tools.md) · 재미요소 [fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md)(`FE-MASTERY`·`FE-BUILD`·`FE-COMBO`) · Phaser4 [INDEX](../wgf-web-game-builder/reference/phaser/INDEX.md). 런타임 [engine/abilitykit.js](../../engine/abilitykit.js) · 툴 [tools/lint-abilities.mjs](./tools/lint-abilities.mjs) · [tools/sim-abilities.mjs](./tools/sim-abilities.mjs).

## IP 안전
- 능력 **메카닉·구조·기법**(쿨다운·자원·스킬트리·특성·enabler/payoff·콤보 캔슬·능력 게이트·진화 등)은 저작권 대상이 아니므로 자유롭게 차용한다.
- 단, **특정 상용 게임의 고유 능력 이름·외형·시그니처 조합**(예: 특정 게임의 궁극기 이름·아이콘·이펙트)을 그대로 복제하지 않는다 — 메카닉만 가져와 **오리지널로 재구성**한다.
- 이름·고유명사는 ABILITIES.md 와 STORY.md `## 8. Glossary`에 오리지널로 정의한다. 아이콘 아트는 전부 CC0/절차생성(PixelForge·VectorForge) 또는 CC0(sprite-picker). 무과금 단일플레이라 능력 해금에 도박형 가챠·페이월은 차용하지 않는다. 상세는 [`ip-license-guard`](../wgf-ip-license-guard/SKILL.md).
