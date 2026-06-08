# 아이템 설계 레퍼런스 라이브러리 — 색인 (INDEX)

> [`item-architect`](../../SKILL.md)가 게임에 **습득·사용하는 모든 것(아이템)**을 입힐 때 쓰는 코드화 설계 자료다.
> 검증된 아이템 설계 통념(RPG·로그라이크·플랫포머·퍼즐·러너·생존크래프팅 + 루트 심리·이코노미·밸런싱·아이콘 디자인)을
> **작은 2D 웹게임**(단일플레이·무서버·CC0·모바일 짧은세션)에 맞게 적응시켜 약 100개 코드화 원칙으로 정리했다.
> 핵심 목적: 인터뷰에서 *참신한 아이템을 제안*하고, 그것을 *밸런스 무너지지 않게* ITEMS.md + items.json 으로 산출하는 것.

## 이 라이브러리를 쓰는 법 (중요)

- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter 없는 순수 레퍼런스라 스킬 listing 예산(컨텍스트 ~1%)을 먹지 않는다 — `reference/phaser/`·`story-design/`과 같은 **온디맨드 Read** 방식. 필요할 때만 해당 파일을 읽는다.
- **아이템 설계 단계**(`item-architect/SKILL.md`의 2단계 "아이템 설계 이론 적용", 인터뷰 [item-interview.md](../item-interview.md))에서 의사결정 도구로 쓴다.
- **먼저 [principles.md](./principles.md)를 Read**(엔진 제약·복잡도 5티어 게이트·공통 캐논 11·안티패턴·장르 처방) → 그다음 **항상 [scope-complexity.md](./scope-complexity.md)** (복잡도를 가장 먼저 가른다) → 복잡도 티어·장르에 맞는 도메인 파일 1~3개. 설계 결정마다 원칙 code(예: `SYN-ADD-VS-MULT`)를 한 줄 근거로 단다.

## 복잡도 티어 → 읽을 파일 처방

| 복잡도 티어 | 무엇 | 읽을 파일 |
|---|---|---|
| **T0 무아이템** | 점수·해금만 | principles.md(§1·§4)만 — 보통 ITEMS.md 불필요 |
| **T1 단일 픽업** | 코인·점수칩 1종 | + [scope-complexity.md](./scope-complexity.md) |
| **T2 소수 파워업** | 상태/일시 버프 2~5개 | + [taxonomy.md](./taxonomy.md)·[utility-consumables.md](./utility-consumables.md)·[visual-inventory-ux.md](./visual-inventory-ux.md) |
| **T3 빌드 시너지** | 조합 빌드·드래프트 | + [synergy-balance.md](./synergy-balance.md)·[economy-loot.md](./economy-loot.md)·[identity-narrative.md](./identity-narrative.md) |
| **T4 인벤토리 경제** | 슬롯 장비·통화·등급·제작 | + [rarity-affixes.md](./rarity-affixes.md)·[consistency-tools.md](./consistency-tools.md) 전부 |

## 도메인 파일 라우팅

| 파일 | prefix | 무엇 (언제 Read) |
|---|---|---|
| **[principles.md](./principles.md)** | (공통) | ★항상 먼저. 엔진 제약·복잡도 5티어 게이트·공통 캐논 11개·'섞지 말 것' 안티패턴·장르→핵심모델 빠른 처방. |
| **[scope-complexity.md](./scope-complexity.md)** | `SCOPE-*` (8) | ★인터뷰 최우선. 복잡도 5티어 사다리·디폴트 0·한 게임 한 핵심모델·깊이>폭·렌티큘러·**장르 스캐폴드별 핵심모델·티어 정합 표**·플랫폼 예산. 복잡도를 정할 때. |
| [taxonomy.md](./taxonomy.md) | `CAT-*` (11) | 행위축 6범주 분류(소모품/장비/키/재화/재료/코스메틱)·소모품 4하위·슬롯·렐릭·키 게이트·통화 최소·재료 싱크·코스메틱 무료. 무엇을 둘지 분류할 때. |
| [economy-loot.md](./economy-loot.md) | `ECON-*` (14) | faucet/sink·파워커브·비용곡선·희귀도·**가변비율 드랍·천장(pity)·보상 페이싱(루트 심리=몰입)**·메타 진행·보상 유형·anticipation 연출. 획득·진행을 설계할 때. |
| [rarity-affixes.md](./rarity-affixes.md) | `AFX-*` (8) | 등급=접사 슬롯폭·prefix/suffix 풀·item level 게이트·가중롤+범위롤·legendary=수작업·등급 다채널 시각 신호·이름 자동조립. 등급·접사·절차생성(T3~T4)을 둘 때. |
| [synergy-balance.md](./synergy-balance.md) | `SYN-*` (15) | **enabler/payoff·가산vs곱산·진화·세트·태그 응집·슬롯 희소·창발 콤보(빌드 재미)** + 지배전략/함정템 제거·파워예산·EV·몬테카를로·픽률(밸런스 검증). 조합·밸런스를 설계할 때(T3+). |
| [utility-consumables.md](./utility-consumables.md) | `UTIL-*` (18) | 호딩 회피·재충전·쿨다운·use-or-lose·무마찰 사용(소모품) + 새 동사·lock&key·자물쇠 먼저·게이트 그래프·softlock 방지·환경 상호작용·퍼즐 부스터(특수기능·진행). 소모품·열쇠·능력을 둘 때. |
| [identity-narrative.md](./identity-narrative.md) | `IDENT-*` (15) | 동사>스탯·미니캐릭터 4요소·환기형 명명·플레이버 이중목적·빙산·테마 패밀리·ludo 조화·배치=환경서사·거울 진행·일관 보이스(STORY.md 상속)·의미있는 수집. 이름·flavor·서사 정합을 정할 때. |
| [visual-inventory-ux.md](./visual-inventory-ux.md) | `UX-*` (24) | ★**visual.* 슬롯 스키마(이미지 생성)**·실루엣 우선·최종크기 판정·등급 다채널·재질 램프·제한 팔레트 + 탭타겟·엄지영역·작은 그리드·델타 비교·점진 툴팁·자동관리·localStorage·세션 적합(인벤·플랫폼). 아이콘 묘사·UI·저장을 정할 때. |
| [consistency-tools.md](./consistency-tools.md) | (스펙) | **ITEMS.md/items.json 섹션 스펙 + 아이템 레코드 필드 + 밸런스 린트 체크리스트(a~h) + 툴 결정 매트릭스**. 바이블을 산출·검수할 때. |

## 빠른 처방 (장르 스캐폴드 → 핵심 모델) — 자세히는 [scope-complexity.md](./scope-complexity.md)

| 장르 스캐폴드 | 디폴트 핵심 모델 | 기본 티어 |
|---|---|---|
| platformer-game | 상태 파워업(+능력 키 게이트면 메트로배니아) | T2 (게이트 시 T3) |
| topdown-shooter | 누적 픽업 + 빌드(레벨업 3택·무기/패시브) | T3 |
| arcade-classic | 순간 부스트/파워업 | T1~T2 |
| puzzle-game | 보드 부스터(제한 사용·만능키 금지) | T2 |
| endless-runner | 순간 픽업(자석·실드) + 코인(+메타 상점) | T2~T3 |

> 항상 **한 게임 한 핵심 모델**(`SCOPE-ONE-CORE`), 디폴트 **0개에서 한 칸씩**(`SCOPE-DEFAULT-ZERO`).

## 코드 빠른 색인 (prefix별 — 정식 정의는 각 도메인 파일)

- **`SCOPE-*` 복잡도(8):** DEFAULT-ZERO · ONE-CORE · LADDER · DEPTH-NOT-BREADTH · LENTICULAR · GENRE-FIT · PLATFORM-BUDGET · PROGRESSION-MIN
- **`CAT-*` 택소노미(11):** VERB-AXIS · SIX-BUCKET · CONSUMABLE-SUBTYPE · EQUIP-SLOT · RELIC · KEY-GATE · CURRENCY-MINIMAL · MATERIAL-SINK · COSMETIC-FREE · SCOPE-FIT · NARRATIVE-PLACE
- **`ECON-*` 이코노미·루트(14):** CURVE · FAUCET-SINK · COST-CURVE · RARITY · VARIABLE-RATIO · PITY · REWARD-PACING · MEANINGFUL-UPGRADE · HORIZONTAL · GATE · VENDOR · META-PROGRESSION · REWARD-TYPE · TELEGRAPH
- **`AFX-*` 희귀도·접사(8):** RARITY-LADDER · RARITY-MEANS-MORE · PREFIX-SUFFIX · LEVEL-GATES · ROLL-WEIGHTED · LEGENDARY · VISUAL-DIFF · PITY-FLOOR
- **`SYN-*` 시너지·밸런스(15):** ENABLER-PAYOFF · ADD-VS-MULT · EVOLVE-GATE · SET-SOFTCAP · TAG-COHESION · SLOT-SCARCITY · EMERGENT-COMBO · NO-DOMINANT · NO-TRAP · POWER-BUDGET · EV-COMPARE · MONTE-CARLO · METRICS · ANTI-CREEP · MINIMAL-CATALOG
- **`UTIL-*` 특수기능·소모품(18):** HOARD-TRAP · REFILL-CADENCE · CHEAP-ABUNDANT · COOLDOWN-GATE · USE-OR-LOSE · FRICTIONLESS · MEANINGFUL-CHOICE · VERB-NOT-STAT · LOCK-KEY · SHOW-LOCK-FIRST · MORE-THAN-KEY · GATE-GRAPH · SOFT-GATE · NO-SOFTLOCK · ENV-DIEGETIC · PUZZLE-BOOSTER · TELEGRAPH-EFFECT · KEY-VS-CONSUMABLE
- **`IDENT-*` 정체성·서사(15):** VERB-OVER-STAT · MICRO-CHARACTER · NAME-EVOCATIVE · DUAL-PURPOSE · FLAVOR-INTANGIBLE · ICEBERG · THEME-FAMILY · LUDO-HARMONY · PLACEMENT-AS-STORY · EARNED-FLAVOR · MIRROR-PROGRESS · CONSTRAINED-CATALOG · MEANINGFUL-COLLECT · CONSISTENT-VOICE · OPTIONAL-LAYER
- **`UX-*` 비주얼·인벤·플랫폼(24):** SILHOUETTE-FIRST · SMALL-SIZE-TRUTH · ONE-SUBJECT · FAMILIAR-METAPHOR · RARITY-MULTI-CHANNEL · MATERIAL-RAMP · CONSISTENT-LIGHT · PALETTE-DISCIPLINE · CATEGORY-GRAMMAR · DESC-SLOTS · TAP-TARGET · THUMB-ZONE · SMALL-GRID · COMPARE · TAP-NOT-DRAG · TOOLTIP-PROGRESSIVE · AUTO-MANAGE · LOCAL-SAVE · QUOTA-GUARD · NO-TAMPER · SESSION-FIT · MIN-CLUTTER · SAFE-AREA · INV-MINIMAL

## 산출물

아이템 설계의 산출물은 **`games/<slug>/ITEMS.md`(사람용 설계 바이블) + `games/<slug>/items.json`(기계용 데이터 = 게임 로드 + 린터 입력)**이다.
섹션 스펙·아이템 레코드 필드(visual.* 포함)·밸런스 린트 체크리스트·툴 결정 매트릭스는 [consistency-tools.md](./consistency-tools.md). 이 라이브러리는 그 바이블을 *설계*하는 자료다.
밸런스 검수 도구는 [`tools/lint-items.mjs`](../../tools/lint-items.mjs)(무의존성 validator).

## 출처 · 원칙

- 본 자료는 공개된 게임 디자인 통념(루트 심리·variable-ratio·rarity·affix·set bonus·power curve·faucet/sink·enabler/payoff·lock&key·아이콘 디자인 등)을 작은 웹게임용으로 정리한 것이다(각 파일 ## 출처 참고).
- **IP 안전 원칙:** 아이템 메카닉·구조·기법은 저작권 대상이 아니므로 자유롭게 차용한다. 단, 특정 상용 게임의 고유 아이템 이름·외형·세트는 복제하지 않고 오리지널로 재구성한다. 고유명사는 ITEMS.md·STORY.md `## 8. Glossary`에 오리지널로 정의. 무과금 단일플레이라 loot box·gacha·페이월은 차용하지 않는다. 상세는 [`ip-license-guard`](../../../ip-license-guard/SKILL.md).
