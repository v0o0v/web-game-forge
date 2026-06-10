# 능력 설계 레퍼런스 라이브러리 — 색인 (INDEX)

> [`ability-architect`](../../SKILL.md)가 게임에 **캐릭터 능력/스킬 시스템**을 입힐 때 쓰는 코드화 설계 자료다.
> 검증된 능력 설계 통념(ARPG·로그라이트·MOBA·메트로배니아/플랫포머·격투/캐릭터액션 + 자원·게임필·시너지·콤보·밸런스·
> 능력 판타지)을 **작은 2D 웹게임**(단일플레이·무서버·CC0·모바일 짧은세션·버튼 예산)에 맞게 적응시켜 약 100개 코드화
> 원칙으로 정리했다. 핵심 목적: 인터뷰에서 *참신한 능력·콤보를 제안*하고, 그것을 *밸런스 무너지지 않게* ABILITIES.md +
> abilities.json 으로 산출하는 것.
>
> **용어:** "스킬/능력"은 게임 캐릭터의 능력이다 — Claude Code 스킬과 무관.

## 이 라이브러리를 쓰는 법 (중요)
- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter 없는 순수 레퍼런스라 스킬 listing 예산을 먹지 않는다 — `reference/phaser/`·`item-design/`과 같은 **온디맨드 Read** 방식. 필요할 때만 읽는다.
- **능력 설계 단계**(`wgf-ability-architect/SKILL.md` 2단계, 인터뷰 [ability-interview.md](../ability-interview.md))에서 의사결정 도구로 쓴다.
- **먼저 [principles.md](./principles.md)를 Read**(엔진 제약·복잡도 5티어 게이트·공통 캐논·안티패턴·장르 처방) → 그다음 **항상 [scope-complexity.md](./scope-complexity.md)**(복잡도를 가장 먼저 가른다) → 복잡도 티어·장르에 맞는 도메인 파일 1~3개. 설계 결정마다 원칙 code(예: `SYN-ENABLER-PAYOFF`)를 한 줄 근거로 단다.

## 복잡도 티어 → 읽을 파일 처방

| 복잡도 티어 | 무엇 | 읽을 파일 |
|---|---|---|
| **T0 능력 없음** | 코어 동사만 | principles.md(§0·§1)만 — ABILITIES.md 불필요 |
| **T1 단일 능력** | 대시·더블점프 1개 | + [scope-complexity.md](./scope-complexity.md) |
| **T2 소수 액티브** | 쿨다운 능력 2~5개 | + [kit-taxonomy.md](./kit-taxonomy.md)·[resource-cost.md](./resource-cost.md)·[activation-feel.md](./activation-feel.md) |
| **T3 빌드·콤보** | 조합 빌드·콤보 연계 | + [synergy-combo.md](./synergy-combo.md)·[balance-counterplay.md](./balance-counterplay.md)·[progression-acquisition.md](./progression-acquisition.md) |
| **T4 스킬트리·진행** | 스킬트리·다자원·능력게이트 | + [identity-fantasy.md](./identity-fantasy.md)·[presentation-ux.md](./presentation-ux.md)·[consistency-tools.md](./consistency-tools.md) 전부 |

## 도메인 파일 라우팅

| 파일 | prefix | 무엇 (언제 Read) |
|---|---|---|
| **[principles.md](./principles.md)** | (공통) | ★항상 먼저. 엔진 제약·복잡도 5티어 게이트·공통 캐논·'섞지 말 것' 안티패턴·장르→핵심모델 빠른 처방. |
| **[scope-complexity.md](./scope-complexity.md)** | `SCOPE-*` (8) | ★인터뷰 최우선. 복잡도 5티어 사다리·디폴트 최소·한 게임 한 핵심모델·깊이>폭·장르 스캐폴드별 핵심모델·플랫폼/버튼 예산. 복잡도를 정할 때. |
| [kit-taxonomy.md](./kit-taxonomy.md) | `KIT-*` (13) | 6대 kind(액티브/패시브/이동기/궁극기/리액션/유틸)·역할 분담·입력 타입·이동기 우선·시그니처·스탠스 전환·소환물·작은 킷. 무엇을 둘지 분류할 때. |
| [resource-cost.md](./resource-cost.md) | `RES-*` (11) | 쿨다운(리듬)·자원 1종(마나/스태미나/에너지/과열/충전)·기회비용·리젠 균형·고갈 방지·콤보 자원·공유vs분리·지속vs폭발. 비용을 설계할 때(T2+). |
| [activation-feel.md](./activation-feel.md) | `FEEL-*` (11) | 선딜/발동/후딜·텔레그래프·입력버퍼·캔슬·차지곡선·히트스톱·피드백·커밋/무적창·모바일 입력·조준보정. 손맛을 설계할 때. |
| [progression-acquisition.md](./progression-acquisition.md) | `PROG-*` (10)·`GATE-*` (6) | 스킬트리 형태·드래프트 3택·파워커브·메타vs런·리스펙·해금 페이싱·도달성 + 능력 게이트(새 동사 열쇠·자물쇠 먼저·softlock 방지). 획득·진행·게이트를 설계할 때(T3+). |
| [synergy-combo.md](./synergy-combo.md) | `SYN-*` (8)·`COMBO-*` (7) | **enabler/payoff·태그 응집·가산vs곱산·진화·세트·창발** + **콤보 체인·캔슬·윈도·무한콤보 방지·접근성/천장**(능력 조합·연계 재미). 조합을 설계할 때(T3+). ★사용자 1순위 강조. |
| [balance-counterplay.md](./balance-counterplay.md) | `BAL-*` (11) | 파워예산·지배전략/죽은능력 제거·niche·카운터플레이(적·환경)·공정한 적 능력·스케일링 캡·파워크립·EV/시뮬·사용률. 밸런스를 검증할 때(T3+). |
| [identity-fantasy.md](./identity-fantasy.md) | `IDENT-*` (10) | 능력 판타지 먼저·동사>스탯·ludo 조화·숙련 표현·자기표현·시그니처 4요소·환기형 명명·일관 보이스·테마 패밀리·절제된 킷. 정체성·이름·서사 정합을 정할 때. |
| [presentation-ux.md](./presentation-ux.md) | `UX-*` (12) | ★**visual.* 슬롯(아이콘 생성)**·실루엣 우선·스킬바·쿨다운/자원 시각화·버튼 예산·엄지 영역·텔레그래프 가독·툴팁·등급 다채널·접근성. 아이콘·HUD·입력을 정할 때. |
| [consistency-tools.md](./consistency-tools.md) | (스펙) | **ABILITIES.md/abilities.json 섹션 스펙 + 능력 레코드 필드 + 린트 체크리스트 + 툴 매트릭스 + abilitykit 배선**. 바이블을 산출·검수할 때. |

## 빠른 처방 (장르 스캐폴드 → 핵심 모델) — 자세히는 [scope-complexity.md](./scope-complexity.md)

| 장르 스캐폴드 | 디폴트 핵심 모델 | 기본 티어 |
|---|---|---|
| platformer-game | 이동 능력(대시·더블점프) | T1 (게이트 시 T3~T4) |
| topdown-shooter | 쿨다운 액티브 2~4개 + 자원 | T2 (빌드 시 T3) |
| arcade-classic | 순간 능력 1개 | T0~T1 |
| puzzle-game | 보드 능력(제한·만능 금지) | T1~T2 |
| endless-runner | 순간 이동 능력 | T1~T2 |
| 로그라이트/서바이버 | 드래프트 빌드 + 시너지 | T3 (T4까지) |
| 액션/콤보 | 콤보 킷(캔슬 연계) + 자원 | T3 |

> 항상 **한 게임 한 핵심 모델**(`SCOPE-ONE-CORE`), 디폴트 **능력 0~1개에서 한 칸씩**(`SCOPE-DEFAULT-MINIMAL`).

## 코드 빠른 색인 (prefix별 — 정식 정의는 각 도메인 파일)

- **`SCOPE-*` 복잡도(8):** DEFAULT-MINIMAL · ONE-CORE · LADDER · DEPTH-NOT-BREADTH · PROGRESSION-MIN · READABILITY-CAP · GENRE-FIT · PLATFORM-BUDGET
- **`KIT-*` 킷·분류(13):** VERB-AXIS · FIVE-KIND · ROLE-SPREAD · INPUT-TYPE · MOBILITY-FIRST · PASSIVE-INVISIBLE · ULTIMATE-CLIMAX · REACTION-COUNTERPLAY · SIGNATURE-CORE · STANCE-SWAP · SUMMON-ENTITY · MINIMAL-KIT · SCOPE-FIT
- **`RES-*` 자원·비용(11):** OPPORTUNITY-COST · COOLDOWN-AS-RHYTHM · RESOURCE-PICK-ONE · REGEN-BALANCE · NO-STARVE · CHARGES · CAST-COMMIT · GLOBAL-COOLDOWN · COMBO-AS-RESOURCE · SHARED-VS-SEPARATE · SUSTAIN-VS-BURST
- **`FEEL-*` 발동·게임필(11):** ANTICIPATION · TELEGRAPH · BUFFER · COYOTE-CANCEL · CHARGE-CURVE · HITSTOP · FEEDBACK-CLARITY · COMMIT-WINDOW · MOBILE-INPUT · AIM-ASSIST · JUICE-RESTRAINT
- **`PROG-*` 진행·획득(10):** MEANINGFUL-CHOICE · TREE-SHAPE · DRAFT-THREE · POWER-CURVE · META-VS-RUN · RESPEC · EARN-THE-FANTASY · NO-FILLER-NODE · UNLOCK-PACING · REACHABLE
- **`GATE-*` 능력 게이트(6):** VERB-KEY · SHOW-LOCK-FIRST · ABILITY-AS-SOLUTION · MORE-THAN-KEY · NO-SOFTLOCK · GRAPH
- **`SYN-*` 시너지(8):** ENABLER-PAYOFF · TAG-COHESION · ADD-VS-MULT · EMERGENT-COMBO · EVOLVE-GATE · SET-SOFTCAP · CROSS-VERB · MINIMAL-KIT
- **`COMBO-*` 콤보(7):** CHAIN · CANCEL · WINDOW · AS-BUILD · REWARD-LOOP · NO-INFINITE · ACCESSIBLE-DEPTH
- **`BAL-*` 밸런스(11):** POWER-BUDGET · NO-DOMINANT · NO-DEAD-SKILL · NICHE · COUNTERPLAY · FAIR-ENEMY-ABILITY · SCALING-CAP · ANTI-CREEP · EV-COMPARE · METRICS · SUSTAIN-VS-BURST-PARITY
- **`IDENT-*` 정체성·판타지(10):** FANTASY-FIRST · VERB-OVER-STAT · LUDO-HARMONY · MASTERY-EXPRESSION · SELF-EXPRESSION · SIGNATURE-ABILITY · NAME-EVOCATIVE · CONSISTENT-VOICE · THEME-FAMILY · CONSTRAINED-KIT
- **`UX-*` 제시·UX(12):** DESC-SLOTS · SILHOUETTE-FIRST · SKILLBAR · COOLDOWN-VIZ · RESOURCE-VIZ · BUTTON-BUDGET · THUMB-ZONE · TELEGRAPH-READ · TOOLTIP-PROGRESSIVE · RARITY-MULTI-CHANNEL · ACCESSIBILITY · MIN-CLUTTER

## 산출물

능력 설계의 산출물은 **`games/<slug>/ABILITIES.md`(사람용 설계 바이블) + `games/<slug>/abilities.json`(기계용 데이터 = `engine/abilitykit.js` 런타임 로드 + `lint-abilities.mjs` 입력)**이다.
섹션 스펙·능력 레코드 필드(visual.* 포함)·린트 체크리스트·툴 결정 매트릭스·abilitykit 배선은 [consistency-tools.md](./consistency-tools.md). 이 라이브러리는 그 바이블을 *설계*하는 자료다.
밸런스 검수 도구는 [`tools/lint-abilities.mjs`](../../tools/lint-abilities.mjs)(정적, 무의존성) + [`tools/sim-abilities.mjs`](../../tools/sim-abilities.mjs)(동적 DPS·자원 시뮬, 복잡 킷 온디맨드).

## 출처 · 원칙
- 본 자료는 공개된 게임 디자인 통념(자원·쿨다운·스킬트리·enabler/payoff·콤보 캔슬·능력게이트·파워예산·능력 판타지 등)을 작은 웹게임용으로 정리한 것이다. 1차 리서치 도시에: `.omc/research/ability-system-research-dossier.md`(광범위 웹 리서치 + 적대적 검증 종합). 각 파일 ## 출처 참고.
- **IP 안전:** 능력 메카닉·구조·기법은 저작권 대상이 아니므로 자유 차용. 단 특정 상용 게임의 고유 능력 이름·외형·시그니처는 복제하지 않고 오리지널로 재구성. 고유명사는 ABILITIES.md·STORY.md `## 8. Glossary`에 오리지널로 정의. 무과금 단일플레이라 도박형 능력해금은 차용하지 않는다. 상세는 [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md).
