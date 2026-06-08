# 시너지 · 빌드 · 밸런스 · 검증 — SYN (15 원칙)

> [`item-architect`](../../SKILL.md)가 **아이템 조합 시너지·빌드 다양성·밸런스 검증**을 설계할 때(주로 T3+ 빌드 시너지·인벤토리 경제) 참조하는 도메인 파일. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> ★ 사용자 강조 — **"조합 시너지 = 재미"** 와 **"획득 동기 = 몰입"**. 이 파일은 그 재미를 구조로 만든다: enabler/payoff 짝, 가산·곱산 2계층 격리, 진화·세트·태그·슬롯 희소, 공통 이벤트 훅 창발 콤보. 그리고 그 재미가 **지배 전략·함정템·파워 크리프로 무너지지 않게** 막는 밸런스·검증을 둔다(Sirlin·Schreiber·Sawyer·Kidwell의 통념을 작은 웹게임용으로 코드화). 검증 4종(`SYN-EV-COMPARE`·`SYN-POWER-BUDGET`·`SYN-MONTE-CARLO`·`SYN-METRICS`)은 [consistency-tools.md](./consistency-tools.md)의 `tools/lint-items.mjs` 린트 룰과 **1:1로 매핑**된다.

## 프레임워크 요약

시너지와 밸런스는 동전의 양면이다. **시너지**는 "적은 아이템이 곱해져 빌드를 만들고 한 판 더를 부르는" 재미의 엔진이고(`SYN-ENABLER-PAYOFF`), **밸런스**는 그 엔진이 단 하나의 정답(지배 전략)이나 죽은 부품(함정템)으로 굳지 않게 하는 가드레일이다. 핵심 통찰 6가지:

- **시너지는 enabler(조건을 깐다) + payoff(조건을 현금화한다) 구조다.** payoff 1~2개가 빌드 정체성을, enabler 2~3개가 그것을 키운다(Slay the Spire set-up/pay-off, Vampire Survivors 무기+passive→진화).
- **곱산이 재미와 붕괴를 동시에 만든다.** 가산을 기본으로, 곱산 소스는 1~2종만 희소 격리한다(`SYN-ADD-VS-MULT`). 상한 없는 곱산 스택은 밸런스·성능 붕괴 1순위.
- **밸런스 ≠ 균등. 밸런스 = viable 옵션 수 최대화.** 절대 안 쓰는 함정템과 항상 쓰는 지배템은 둘 다 "선택을 무의미하게" 만든다(Sirlin, Schreiber).
- **단일플레이에서도 밸런스는 중요하다 — 이유가 다르다.** PvP 공정성이 아니라 (1) 플레이어 경험, (2) 콘텐츠 디자인 가능성이 이유(Sawyer).
- **OP를 없애지 말고 게이팅하라.** 짧은 세션·power-fantasy에서 "터지는" 순간이 재미. 단 쉽게 닿으면 trivialize → 진화 게이트·드랍률·슬롯 비용으로 강함을 비싸게(`SYN-EVOLVE-GATE`).
- **검증은 3층 방어선.** 출시 전 정량(EV 시트 + 몬테카를로 — 서버 없는 우리의 1차 안전망) → 자가/소수 플레이테스트 → 출시 후 로컬 픽률 카운터.

## 원칙 사전 (SYN)

### `SYN-ENABLER-PAYOFF` enabler-payoff 빌드 골격
- **정의:** 시너지의 최소 단위는 "조건을 까는 enabler 2~3개 + 그 조건을 폭발시키는 payoff 1~2개"의 짝이다. payoff가 빌드의 정체성("나는 화염 빌드다")을 만들고, enabler는 그 payoff를 점점 키운다. 개별 아이템은 평범해도 조합이 곱으로 작동할 때 "한 판 더"가 발생한다(사용자 강조: 조합 시너지=재미).
- **출처:** Vampire Survivors — 무기 Lv8 + 올바른 passive 보유 시 보스 상자로 진화(passive는 스탯만 올리지만 진화의 *촉매*=enabler) https://vampire.survivors.wiki/w/Evolution , https://vampire.survivors.wiki/w/Passive_items . Slay the Spire — set-up/pay-off 카드 분류, 시너지 묶음=아키타입 https://infinite-bits.com/slay-the-spire-deckbuilding-strategies-card-synergy-and-game-modes/ , https://medium.com/@felix.moll.pro/archetypes-in-deckbuilding-games-f9bb2933393f
- **우리 엔진 구현(작은 웹게임):** 아이템 레코드에 `role: 'payoff'|'enabler'|'both'` + `archetype` 태그. ITEMS.md §4에 아키타입 **2~3개만** 정의(예: 화염 archetype = payoff `flameNova` + enabler `emberDrop`·`heatStack`·`fuelTank`). arcade 스캐폴드는 `LOOT_POOL` + 레벨업 3택 1로 런 중 발견하게(`{role:'enabler',archetype:'fire',effect:{atk:+3,tag:'fire'}}`). 짧은 세션이라 발견은 빠르고 보상은 즉각. 슬롯 상한은 Vampire Survivors의 무기 6 + passive 6 관습 차용. 빌드 발견 연출=juice-fx(진화 플래시), 획득 SFX=chip-sound, 아키타입 네이밍·flavor=[identity-narrative.md](./identity-narrative.md)·story-architect 톤 상속.
- **흔한 실패:** payoff 없이 enabler만 잔뜩(스탯만 올라 빌드 정체성 없음). 아키타입을 2~3개 넘겨 작은 화면·짧은 세션에서 추적 불가. 모든 조합이 동등해 "이 방향에 올인" 결정의 무게가 사라짐.
- **연관:** `SYN-ADD-VS-MULT`, `SYN-EVOLVE-GATE`, `SYN-TAG-COHESION`, `SYN-SLOT-SCARCITY`

### `SYN-ADD-VS-MULT` 가산 기본 · 곱산 격리 (2계층)
- **정의:** 대부분의 효과는 **가산(additive)** 스택으로 두고, 곱연산(multiplicative) 소스는 **1~2종만 희소하게 격리**한다. 가산은 이해·밸런싱이 쉽고(50%+50%=100%) 후반 diminishing returns로 안정화·역전이 자연스럽다. 곱산은 강력한 빌드 클라이맥스를 주지만(×1.5×1.5=...) 상한 없이 스택되면 수백 배 폭발 → 밸런스·성능 붕괴의 1순위 원인.
- **출처:** 가산 vs 곱연산 통념(가산=이해·밸런싱 쉬움·DR로 안정, 곱산 스택=파워크립 위험) — Paradox Forums "Additive vs Multiplicative" https://forum.paradoxplaza.com/forum/threads/additive-bonuses-vs-multiplicative-bonuses.1144836/ , Hypixel Forums "[Experiment] Additive vs Multiplicative" https://hypixel.net/threads/experiment-additive-vs-multiplicative.5242583/
- **우리 엔진 구현(작은 웹게임):** 데미지 공식을 `dmg = (base + Σ장비.atk) × (1 + Σ가산% ) × Π곱산소스`로 두되, `Π곱산소스`는 archetype payoff 1~2개만(예: "크리티컬 시 ×2"). `effect` 벡터는 가산 우선(`{atk:+4}`), 곱산은 명시 플래그(`{mult:'crit',x:2}`)로 구분해 린터가 셀 수 있게. 모바일 짧은 세션이라 복잡한 스택 시뮬레이션은 피하고, 곱산 소스 종수에 하드 상한(≤2)을 둔다. → 곱산 폭발은 `SYN-MONTE-CARLO`의 상위 1% 폭주 배수로 사후 검증.
- **흔한 실패:** 곱연산 보너스를 무제한 스택 가능하게 해 파워크립·계산 폭발(`SYN-EMERGENT-COMBO`의 proc 캡 누락과 결합 시 최악). 가산만 무한히 쌓아 후반 +5%가 무의미해지는 죽은 스탯 구간. 표시값과 실제가 반대(−10% = ×0.9)로 직관 위반.
- **연관:** `SYN-EMERGENT-COMBO`, `SYN-POWER-BUDGET`, `SYN-MONTE-CARLO`, `SYN-ANTI-CREEP`

### `SYN-EVOLVE-GATE` 진화 게이트 (파워 스파이크 통제)
- **정의:** base 아이템 + catalyst(촉매 조건)가 맞을 때만 강력한 진화체로 승급시킨다 — `{base, catalyst, when, into}`. 진화는 빌드의 클라이맥스 파워 스파이크를 주되, 그 강함을 **획득 난이도/조건으로 게이팅**해 쉽게 닿으면 trivialize하는 것을 막는다(risk/reward). OP를 없애지 말고 비싸게 만든다.
- **출처:** Vampire Survivors — 무기 Lv8 + 특정 passive 보유 + 보스 상자라는 3중 조건으로 진화 https://www.pcgamesn.com/vampire-survivors/weapon-evolutions , https://vampire.survivors.wiki/w/Evolution . OP 게이팅 통념 — Sawyer(FNV x5 저격총 → x2 튜닝으로 역할 유지·지배 제거) https://www.tumblr.com/jesawyer/161302725596/balance-in-single-player-crpgs , McMillen risk/reward https://www.gamedeveloper.com/pc/analysis-mcmillen-on-risk-reward-in-video-games
- **우리 엔진 구현(작은 웹게임):** ITEMS.md §4에 진화 레시피 테이블 `EVOLVE = { base:'whip', need:'spinach', when:'lvl8', into:'bladeWhip' }`. registry에 장착·레벨 상태를 검사하는 순수 함수 하나(`checkEvolve(inventory)`)로 구현 — 게임 코드와 린터가 공유. 진화체 외형은 base의 실루엣·팔레트를 유지한 강화판(`visual.evolve_from`, [visual-inventory-ux.md](./visual-inventory-ux.md)·`IDENT-MIRROR-PROGRESS`). 한 판 안의 스노우볼은 허용하되 다음 세션엔 리셋(런 단위). 진화 순간 연출=juice-fx, SFX=chip-sound로 "노력에 값한 보상" 감각 전달.
- **흔한 실패:** 진화 조건을 숨겨 플레이어가 우연에만 의존 → 발견의 쾌감 대신 좌절(단서를 `UTIL-SHOW-LOCK-FIRST`처럼 미리 노출). 진화체가 너무 쉽게/이르게 나와 게임 루프 trivialize. 진화 전후 외형이 무관해 "내 무기가 자랐다"는 연속성이 깨짐.
- **연관:** `SYN-ENABLER-PAYOFF`, `SYN-SET-SOFTCAP`, `SYN-POWER-BUDGET`, `SYN-MONTE-CARLO`

### `SYN-SET-SOFTCAP` 세트 보너스 + 소프트캡
- **정의:** 여러 아이템이 같은 세트일 때 문턱(2피스·3피스)에서 보너스를 주되, 누적에 **소프트캡(diminishing returns)**을 걸어 "세트만 정답"이 되지 않게 한다. 작은 게임에서는 PoE식 수천 조합이 아니라 2~3피스 세트 1~3종 + 명시적 조합 1~2개로 제한한다.
- **출처:** Path of Exile / Diablo 세트 보너스(특정 스탯 시너지) — PoE Wiki "Diablo Player's Guide to PoE", poedb.tw "Modifiers"(EQUIP-SYNERGY 도시에 인용). 소프트캡/diminishing returns — gamedesignskills.com "Video Game Balance" https://gamedesignskills.com/game-design/game-balance/
- **우리 엔진 구현(작은 웹게임):** ITEMS.md §4에 세트 테이블 `SETS = [{tag:'ember', thresholds:{2:{atk:+3}, 3:{mult:'fire',x:1.3}}}]`. 장착 조합을 검사하는 순수 함수 하나로 구현, 효과를 명시 한 줄로 표기("불 무기 2피스 = +3 공격"). 소프트캡은 3피스 이후 추가 효과를 둔화시키거나 상한. 세트 보너스가 EQUIP-STAT-BUDGET(=`SYN-POWER-BUDGET`)을 깨지 않게 코스팅. 짧은 세션이라 발견은 빠르고 보상은 즉각.
- **흔한 실패:** 세트 보너스가 너무 강해 비세트 선택을 모두 죽임(`SYN-NO-DOMINANT` 위반). 소프트캡 없는 무한 누적으로 후반 trivialize. 세트 조합을 너무 많이·불투명하게 만들어 메타 빌드 1개만 정답(PoE식 함정, 작은 게임엔 과함).
- **연관:** `SYN-EVOLVE-GATE`, `SYN-TAG-COHESION`, `SYN-NO-DOMINANT`, `SYN-POWER-BUDGET`

### `SYN-TAG-COHESION` 태그 응집 (공유 스케일링)
- **정의:** 아이템에 계열 태그(`fire`/`ice`/`melee`/`crit`…)를 달고, payoff가 "해당 태그를 가진 아이템 수/스택"으로 스케일하게 한다. 같은 태그를 모으는 행동이 곧 빌드를 만들고, 드랍을 같은 태그로 밀어주면(태그 드롭 푸시) 빌드 완성 경로가 또렷해진다. 적은 아이템으로 깊은 조합을 만드는 가장 싼 장치.
- **출처:** Slay the Spire 아키타입(태그/색 묶음으로 시너지 식별) https://infinite-bits.com/slay-the-spire-deckbuilding-strategies-card-synergy-and-game-modes/ . Vampire Survivors passive가 무기 태그의 진화 촉매 https://vampire.survivors.wiki/w/Passive_items . 비추이적 속성 태그(빨강=화염 약점)는 [rarity-affixes.md](./rarity-affixes.md)의 등급 시각언어 및 적 상성과 시각적으로 정합해야 함.
- **우리 엔진 구현(작은 웹게임):** `tags: ['fire']` 필드 + payoff effect `{type:'scalePerTag', tag:'fire', per:0.1}`(화염 아이템 1개당 +10%). 드랍 테이블이 현재 빌드 태그를 약하게 가중(태그 드롭 푸시)해 빌드 완성을 돕되, 운에 막히지 않게. 태그 색은 스프라이트 팔레트(sprite-forge/vector-graphics/sprite-picker)와 일관 — 빨강 모티프=화염. 린터가 "고립 태그"(payoff는 있는데 enabler가 없는 태그)를 시너지 정합 룰로 검출.
- **흔한 실패:** 태그가 시각(스프라이트)과 어긋나(파란 아이템에 fire 태그) 학습 혼란. 태그 종수가 슬롯 수보다 많아 어떤 빌드도 못 완성. 태그 드롭 푸시가 너무 강해 사실상 빌드가 강제됨(선택 소멸).
- **연관:** `SYN-ENABLER-PAYOFF`, `SYN-SET-SOFTCAP`, `SYN-EMERGENT-COMBO`, `SYN-NO-TRAP`

### `SYN-SLOT-SCARCITY` 슬롯 희소 (기회비용 강제)
- **정의:** 동시 장착/보유 슬롯을 유한(4~6)하게 두면, 새 아이템을 끼울 때 기존 것을 빼야 하는 구조 자체가 **기회비용**이 된다. 슬롯 희소는 "무엇을 함께 끼나"라는 의미 있는 선택을 *공짜로* 생성하는 가장 싼 엔진이다. 슬롯을 늘려 전부 누적시키면 이 엔진이 꺼진다.
- **출처:** 슬롯 비누적=기회비용 통념(EQUIP 도시에 핵심 인사이트: "트레이드오프는 슬롯 유한성에서 공짜로 나온다"). Vampire Survivors 6슬롯 관습 https://vampire.survivors.wiki/w/Passive_items . Slay the Spire 덱 희석(추가=영구 비용, 거절에 가치 부여) https://www.eneba.com/hub/games-guides/slay-the-spire-tips/
- **우리 엔진 구현(작은 웹게임):** 무기 6 + passive 6, 또는 장비 슬롯 3~5(모바일 작은 화면). 슬롯이 차면 교체 결정 UI=game-ui-hud(델타 비교 `+5`/`−2`, `UX-COMPARE`). 덱빌더 변주는 "거절 보상"(픽업 거절 시 점수)이라는 한 메커닉만 차용. 슬롯 수는 인벤토리 UI 수용량([visual-inventory-ux.md](./visual-inventory-ux.md))과 직접 연동 — 슬롯이 화면을 깨면 너무 많은 것.
- **흔한 실패:** 슬롯을 늘려 모든 아이템을 누적 → 교체 고민 소멸, auto-equip 버튼화. 반대로 슬롯이 너무 적어(1~2) 빌드가 성립 안 됨. 슬롯 교체 시 델타를 안 보여줘 암산을 강요.
- **연관:** `SYN-ENABLER-PAYOFF`, `SYN-NO-TRAP`, `SYN-MINIMAL-CATALOG`, `SYN-POWER-BUDGET`

### `SYN-EMERGENT-COMBO` 창발 콤보 (공통 이벤트 훅 + proc 캡)
- **정의:** on-hit/on-kill/on-crit 같은 **공통 이벤트 훅**에 효과를 매달면, 설계자가 일일이 짜지 않은 조합이 창발한다(A의 on-kill이 B의 on-hit를 트리거…). 적은 부품으로 깊이를 만드는 장치지만, 반드시 **proc 캡**(프레임당/초당 발동 상한)을 둬 무한 연쇄·성능 붕괴를 막는다.
- **출처:** 폭보다 깊이·창발 통념(`SCOPE-DEPTH-NOT-BREADTH`, principles.md §2). 곱산 스택 폭발 위험(Hypixel/Paradox additive-vs-mult). 절차생성의 함정(시각 다양성 ≠ 기계 다양성)은 `SYN-MINIMAL-CATALOG`.
- **우리 엔진 구현(작은 웹게임):** 이벤트 버스 `on('kill'|'hit'|'crit', fn)`에 아이템 효과 등록. 각 proc에 `cooldownMs` 또는 프레임당 발동 카운터 상한(예: `maxProcsPerFrame: 8`)을 강제. 콤보 발동 연출=juice-fx(체이닝 파티클), SFX=chip-sound. 무한 연쇄/곱산 폭발 가능성은 `SYN-MONTE-CARLO`로 상위 1% 런 파워 배수를 사후 점검. 모바일이라 프레임당 proc 수가 성능 상한이기도 함.
- **흔한 실패:** proc 캡 없는 on-hit 연쇄가 곱산 소스(`SYN-ADD-VS-MULT`)와 만나 무한 루프·프레임 드랍. 훅이 불투명해 플레이어가 콤보를 영영 발견 못 함. 모든 아이템이 같은 훅에 몰려(on-hit만) 다양성 없음.
- **연관:** `SYN-ADD-VS-MULT`, `SYN-TAG-COHESION`, `SYN-MONTE-CARLO`, `SYN-NO-DOMINANT`

### `SYN-NO-DOMINANT` 지배 전략 제거 (viable 다수)
- **정의:** 무지성 정답 하나가 다른 모든 선택을 무의미하게 만들면(지배 전략 / strictly-better) 게임의 전략성이 사라진다. 밸런스의 목표는 "모든 옵션 동등"이 아니라 **의미 있게 선택 가능한(viable) 옵션 수를 최대화**하는 것 — 모든 아이템에 *빛나는 한 순간(niche)*이 있어야 한다.
- **출처:** Sirlin "Balancing Multiplayer Games Part 2: Viable Options"(Yomi 20캐릭 전원 viable vs MvC2 54중 ~10) https://www.sirlin.net/articles/balancing-multiplayer-games-part-2-viable-options . Schreiber "Level 16: Game Balance"(dominated strategy: 다른 옵션이 모든 시나리오에서 ≥) https://gamedesignconcepts.wordpress.com/2009/08/20/level-16-game-balance/ . 단일플레이도 유효(trivialize 방지) — Sawyer https://www.tumblr.com/jesawyer/161302725596/balance-in-single-player-crpgs
- **우리 엔진 구현(작은 웹게임):** 각 아이템에 의도된 `role`/niche 태그 + 비추이적 상성 `counterTags`(갑옷=관통에 약함, 군집=범위에 약함)를 주고, 스테이지마다 적 구성을 바꿔(soft counter, level-architect 연동) "이 무기가 항상 최선"을 못 만든다. 수동 테스트: **"이거 한 번도 안 써도 클리어 가능한가?"** 가 모든 아이템에 true여야 한다(false면 지배템). 자동: `tools/lint-items.mjs`가 파레토 지배 쌍을 검출([consistency-tools.md](./consistency-tools.md) 린트 룰).
- **흔한 실패:** 모든 아이템을 같은 축(순수 데미지)에 놓아 추이적 사다리로 만들면 항상 1등만 의미. 상성을 너무 hard하게(특정 무기 없으면 특정 적 절대 못 잡음) 만들어 드랍 운에 막히는 dead-end.
- **연관:** `SYN-NO-TRAP`, `SYN-POWER-BUDGET`, `SYN-EV-COMPARE`, `SYN-METRICS`

### `SYN-NO-TRAP` 함정템 제거 (모든 아이템 niche 1줄)
- **정의:** 함정 옵션은 "유익해 보이지만 합리적 플레이어는 절대 안 고르는" 아이템이다. 디자인 공간 낭비 + 의미 있는 의사결정 훼손. 약한 옵션은 그냥 버프(→파워크립)도 방치(→죽은 아이템)도 아니라, **다른 축의 가치**를 부여해 "어떤 플레이스타일엔 이게 낫다"를 만든다(Kidwell식 수술).
- **출처:** Brandon Kidwell "Avoiding Design Traps"(Lucky Coin을 양면 가치로 고쳐 살림; "필러는 정당한 핑계가 아니다") https://www.gamedeveloper.com/design/kgd---avoiding-design-traps-in-game-mechanics . Sirlin(MvC2 "garbage pile"). Sawyer(AD&D "trap choices, garbage feats") https://www.tumblr.com/jesawyer/161302725596/balance-in-single-player-crpgs
- **우리 엔진 구현(작은 웹게임):** 각 아이템에 **"왜 이걸 고르는가" 한 줄(`whyPick`)** 설계 주석을 강제(설계 리뷰 게이트). 비슷한 슬롯 두 아이템은 Kidwell식으로 약한 쪽에 다른 축(확정 vs 도박, 즉발 vs 지속, 단독 약하지만 시너지 핵심)을 부여. 수동 테스트: **"이것만 항상 써도 클리어 가능한가?"** 가 false여야 정상(true면 함정템의 반대=지배템). 모바일 짧은 세션이라 정보 비대칭보다 명확한 트레이드오프 가시화(game-ui-hud 툴팁)가 적합.
- **흔한 실패:** "채우기용(filler)" 아이템(Kidwell 경고). 화려한 연출로 EV 낮은 도박 옵션을 좋아 보이게 함(50% 도박 < 확정 옵션인데 화려해서 넣음). 초보자 함정(설명만 좋아 보임)을 경고 없이 던짐.
- **연관:** `SYN-NO-DOMINANT`, `SYN-EV-COMPARE`, `SYN-TAG-COHESION`, `SYN-METRICS`

### `SYN-POWER-BUDGET` 공통 파워 예산 코스팅 ★린터 룰
- **정의:** 각 아이템의 총 "파워"를 공통 통화(power budget)로 환산해, 강한 스탯·효과는 예산을 더 쓰고 다운사이드는 예산을 환급한다. **같은 등급 아이템은 비슷한 총 예산**을 갖게 강제 → strictly-better가 구조적으로 불가능해진다. 등급별 예산 밴드는 파워 크리프 차단의 고정 기준선이기도 하다(`SYN-ANTI-CREEP`).
- **출처:** Apothecary Press "Design Insights: Power Budget"(능력이 100% 예산을 분담, 다운사이드가 환급) https://apothecary.press/2021/12/20/design-insights-power-budget/ . "Point Build System"(GURPS·D&D 5e, 바람직한 특성에 더 높은 비용) https://tvtropes.org/pmwiki/pmwiki.php/Main/PointBuildSystem . Schreiber 코스트 곡선.
- **우리 엔진 구현(작은 웹게임):** ITEMS.md §2에 스탯→포인트 환산표(예: atk +1 = 2pt, 사거리 +1 = 3pt, 쿨다운 −10% = 4pt, 다운사이드는 음수 pt) + 등급별 예산 밴드(common 8~12pt, rare 16~22pt). **`tools/lint-items.mjs`가 각 아이템 budget을 합산해 밴드 이탈을 자동 검출**([consistency-tools.md](./consistency-tools.md) 린트 룰). 강한 효과엔 반드시 명시 다운사이드(`downsides`). 메타 진행(localStorage 강화)도 같은 통화로 누적 추적.
- **흔한 실패:** 예산 없이 "느낌"으로 수치를 찍어 같은 등급인데 하나만 압도(지배) 또는 하나만 쓰레기(죽은). 등급을 곧 파워와 1:1로 묶어 낮은 등급을 구조적 죽은 아이템화(낮은 등급은 "다른 역할"이어야지 "약한 같은 역할"이면 안 됨).
- **연관:** `SYN-NO-DOMINANT`, `SYN-ANTI-CREEP`, `SYN-EV-COMPARE`, `SYN-SET-SOFTCAP` / 등급 시각언어는 [rarity-affixes.md](./rarity-affixes.md)의 `AFX-RARITY-MEANS-MORE`(상위 등급=수치 아닌 접사 슬롯폭) 참조.

### `SYN-EV-COMPARE` 출시 전 기대값(EV) 비교 ★린터 룰
- **정의:** 확률·쿨다운·지속시간이 섞인 아이템은 직관으로 우열을 못 가린다. 모든 아이템을 **공통 단위 EV**(초당 기대 데미지, 회피당 기대 생존 등)로 환산해 한 표에서 비교하면 지배·죽은 아이템이 드러난다. 같은 슬롯/등급 EV가 ±20% 밴드 안인지 확인하고, 벗어나면 "왜 다른가(역할 차이?)"를 설명할 수 있어야 통과.
- **출처:** Kidwell(Lucky Coin 50% × scarce < Quick Acting → EV로 우열 판명) https://www.gamedeveloper.com/design/kgd---avoiding-design-traps-in-game-mechanics . "Design 101: Balancing Games" https://www.gamedeveloper.com/design/design-101-balancing-games . Schreiber payoff matrix.
- **우리 엔진 구현(작은 웹게임):** 각 아이템 EV 계산식을 데이터로(무기 = 데미지 × 명중률 × 발사율 − 자원 환산; 확률 효과 = 효과값 × 발동확률). **`tools/lint-items.mjs`가 같은 등급/슬롯 EV의 ±20% 밴드 이탈을 검출**([consistency-tools.md](./consistency-tools.md) 린트 룰); 보조로 `.xlsx`(anthropic-skills:xlsx) EV 시트. CC0·서버 없음이라 이 정량 비교가 사실상 유일한 1차 안전망. 평균만 보지 말고 분산은 `SYN-MONTE-CARLO`로 보완.
- **흔한 실패:** "느낌상 비슷"으로 확률·쿨다운 아이템을 검증 없이 출고. 50% 도박이 확정보다 EV 낮은데 "화려해 보여" 넣음(Kidwell). 평균만 보고 분산(터졌을 때/꽝일 때 편차)을 무시.
- **연관:** `SYN-POWER-BUDGET`, `SYN-MONTE-CARLO`, `SYN-NO-DOMINANT`, `SYN-NO-TRAP`

### `SYN-MONTE-CARLO` 드랍·런 몬테카를로 시뮬 ★린터/툴 룰
- **정의:** 평균(EV)만으로는 "운 나쁜 플레이어가 핵심 아이템을 못 봐서 막히는" 코너케이스나 "운 좋으면 너무 강해지는" 폭주를 못 잡는다. 드랍 테이블·런을 수천~수만 번 무작위 시뮬레이션해 결과 **분포**(p95 꼬리)를 본다. (한계: 시뮬은 재미·전략을 검증하지 못한다 — 플레이테스트 대체 아님.)
- **출처:** Boards and Barley "Monte Carlo Simulations for Game Design" https://boardsandbarley.com/2013/09/17/monte-carlo-simulations-for-game-design/ . Machinations.io(taps/sinks 경제 시뮬) https://machinations.io/articles/what-are-game-simulations-and-why-should-you-care . excelmontecarlo https://excelmontecarlo.com/how-the-montecarlo-model-can-help-when-designing-a
- **우리 엔진 구현(작은 웹게임):** 드랍·진화 로직을 게임과 공유하는 순수 JS 함수로 빼고(`src/loot/dropTable.js`·`checkEvolve`), `tools/loot-sim.mjs`(또는 `tools/lint-items.mjs`의 시뮬 룰)로 10k 런을 돌려 (a) 필수급 아이템 미발견율, (b) 총 파워 상위 1% 런이 평균 대비 몇 배(폭주=곱산 폭발 점검), (c) 아이템 등장률 CSV. 모바일 짧은 세션 특성상 "1~3분 안에 게임이 결정되는가"의 분포가 핵심 지표. **반드시 게임과 같은 함수 재사용** — 따로 짜면 검증이 무의미([consistency-tools.md](./consistency-tools.md) 참조).
- **흔한 실패:** 시뮬 숫자만 믿고 "재미·전략을 검증했다"고 착각(명시적 한계). 게임 코드와 별도로 시뮬용 드랍 로직을 따로 작성 → 둘이 어긋남.
- **연관:** `SYN-EV-COMPARE`, `SYN-ADD-VS-MULT`, `SYN-EMERGENT-COMBO`, `SYN-EVOLVE-GATE` / 천장(pity)·드랍 가중은 [economy-loot.md](./economy-loot.md)의 `ECON-VARIABLE-RATIO`·`ECON-PITY` 참조.

### `SYN-METRICS` 로컬 픽률 텔레메트리 ★린터/런타임 룰
- **정의:** 출시 후 어떤 아이템이 실제로 안 쓰이는지는 사용률(pick/use rate)이 가장 정직한 신호다. 서버 없는 작은 게임은 **로컬 카운터 + 자발적 공유**로 축소 재현한다. seen 대비 picked가 현저히 낮은 아이템 = 죽은/함정 후보. 사용률은 "왜 안 쓰는가(약함? 안 보임? 이해 안 됨?)"의 진단 시작점일 뿐.
- **출처:** 게임 텔레메트리 일반(아이템 사용·픽률·진행 막힘 추적) — Talo https://trytalo.com/game-analytics . 밸런스는 출시 후에도 계속 — Sawyer https://www.tumblr.com/jesawyer/161302725596/balance-in-single-player-crpgs (사람은 이득보다 손실을 더 기억 → 인상은 편향).
- **우리 엔진 구현(작은 웹게임):** localStorage `itemStats: {itemId:{seen,picked,used}}` 카운터 + 디버그 오버레이/콘솔에서 본인 후속 점검. 서버·PII 없음과 완전 정합(전부 로컬). 플레이테스터 localStorage 덤프를 복붙받거나 본인 다회 플레이로 대체. ITEMS.md §9 밸런스 점검 로그에 픽률 메모. **`tools/lint-items.mjs`가 (제공 시) itemStats를 읽어 저픽률 항목을 죽은아이템 후보로 리포트**([consistency-tools.md](./consistency-tools.md) 린트 룰).
- **흔한 실패:** 단일 디자이너의 기억·인상만으로 "잘 쓰이겠지" 판단(Sawyer: 인상은 편향). 사용률만 보고 무지성 버프 → 파워 크리프(`SYN-ANTI-CREEP`와 충돌).
- **연관:** `SYN-NO-DOMINANT`, `SYN-NO-TRAP`, `SYN-ANTI-CREEP`, `SYN-EV-COMPARE`

### `SYN-ANTI-CREEP` 파워 크리프 차단 (고정 기준선 + 버프/너프 혼용)
- **정의:** 약한 신규 아이템을 강한 기존에 맞춰 "올리기만(buff-only)" 하면 적이 무의미해질 때까지 끝없이 상승하는 양의 피드백 루프가 생긴다. 해법: **고정된 파워 기준선**(=등급별 예산 밴드)을 두고 그 기준선 대비 너프와 버프를 모두 사용. 통념상 버프:너프 ≈ 80:20.
- **출처:** Bruno Dias "On Power Creep" https://brunodias.dev/2021/11/27/power-creep.html . "no nerf only buff" 실패(Helldivers 2 커뮤니티) https://steamcommunity.com/app/553850/discussions/0/4358995462057059574/ . 소프트캡/DR — gamedesignskills.com https://gamedesignskills.com/game-design/game-balance/ . Sawyer(x5→x2 너프).
- **우리 엔진 구현(작은 웹게임):** `SYN-POWER-BUDGET`의 등급별 예산 밴드를 **고정 기준선**으로 — 신규 아이템도 같은 밴드 안에서만(린터가 강제). 메타 진행(localStorage 강화)엔 소프트캡/체감보상을 넣어 누적 파워가 적 난이도를 영원히 추월하지 못하게(level-architect 난이도 곡선 연동). 콘텐츠 업데이트 시 "강한 1개 너프 > 약한 99개 버프". 단일플레이라 너프 반발이 PvP만큼 크지 않아 과감히 가능.
- **흔한 실패:** "플레이어가 너프를 싫어하니까" 무조건 버프만 → 적이 위협이 안 됨. 신규 super-rare 등급을 계속 추가해 기존 최고 등급을 죽임(rarity creep). 소프트캡 없는 무한 메타 강화로 후반 trivialize.
- **연관:** `SYN-POWER-BUDGET`, `SYN-MINIMAL-CATALOG`, `SYN-ADD-VS-MULT`, `SYN-MONTE-CARLO`

### `SYN-MINIMAL-CATALOG` 작고 살아있는 카탈로그
- **정의:** "필요 없는 선택지를 생략하라"(Strunk을 Sirlin이 게임에 적용). 옵션이 많을수록 좋은 게 아니라, viable한 옵션만 남기고 나머지는 잘라야 한다. **작은 풀이 큰 garbage pile보다 낫다.** 특히 절차생성(sprite-forge/vector-graphics)이 시각적으로 다른 아이템을 싸게 찍어낼 수 있다는 점이 "모양만 다르고 기능은 같은" 죽은 아이템 양산의 유혹 — **시각 다양성 ≠ 기계적 viable 다양성**.
- **출처:** Sirlin "Omit needless choices"(MvC2 비판) https://www.sirlin.net/articles/balancing-multiplayer-games-part-2-viable-options . Wayline "Roguelike Itemization"(과도한 스탯/시너지 → decision paralysis) https://www.wayline.io/blog/roguelike-itemization-balancing-randomness-player-agency
- **우리 엔진 구현(작은 웹게임):** 카탈로그 상한을 명시(세션 등장 풀 12~24, 전체 24~40). 새 아이템 추가 시 게이트: "기존 어느 것의 viable 영역을 침범하지 않는가? 침범하면 둘 중 하나를 자르거나 차별화." game-ui-hud 인벤토리·툴팁이 작은 화면에서 감당 가능한 규모인지와 연동(아이템 수가 UI를 깨면 너무 많은 것). 절차 양산은 [identity-narrative.md](./identity-narrative.md)의 "소수 정예 수작업 + 절차 양산 2층"과 정합.
- **흔한 실패:** "콘텐츠 많아 보이게" 절차생성으로 아이템 무한 양산(시각 다양성을 기계 다양성으로 착각). 수집 욕구만 좇아 큰 카탈로그를 만들되 대부분이 1~2개 핵심의 열화판.
- **연관:** `SYN-SLOT-SCARCITY`, `SYN-NO-TRAP`, `SYN-ANTI-CREEP`, `SYN-POWER-BUDGET`

## SYN 검증 4종 → `tools/lint-items.mjs` 룰 매핑 (치트)

아래 4개 원칙은 [consistency-tools.md](./consistency-tools.md)가 정식화하는 밸런스 린트 체크리스트의 자동화 룰과 **1:1로 매핑**된다. 설계(작성 패스)와 밸런스 검수(린터 = 검수 패스)는 다른 패스로 분리한다(`ITEMS-SINGLE-SOURCE`, 자기검수 금지).

| SYN 코드 | 린터 룰 그룹 | 입력 | 검출 | 통과 기준 |
|---|---|---|---|---|
| `SYN-POWER-BUDGET` | 등급별 예산 밴드 | `effect`·`downsides`·`rarity` | 밴드 이탈(같은 등급 과/소 파워) | 모든 아이템이 등급 밴드 안 |
| `SYN-EV-COMPARE` | EV ±20% 밴드 | EV 계산식 필드 | 같은 슬롯/등급 EV 이상치 | 밴드 이탈은 역할 차이로 설명 가능 |
| `SYN-MONTE-CARLO` | 10k 런 시뮬(공유 드랍 함수) | `src/loot/dropTable.js`·`checkEvolve` | 필수템 미발견율·상위 1% 폭주 배수 | 미발견율↓·폭주 배수 임계 이하 |
| `SYN-METRICS` | 픽률 카운터(런타임/사후) | localStorage `itemStats` | seen 대비 저 picked = 죽은/함정 후보 | 모든 아이템 픽률 하한 이상 |

보조 룰: `SYN-NO-DOMINANT`(파레토 지배 쌍), `SYN-NO-TRAP`(`whyPick` 누락·EV 최저권), `SYN-ADD-VS-MULT`(곱산 소스 ≤2 초과), `SYN-EMERGENT-COMBO`(proc 캡 미설정), 시너지 정합(고립 태그·과밀 허브·도달 불가 세트). stdout 마지막 줄 단일 JSON 계약은 [consistency-tools.md](./consistency-tools.md)의 툴 결정 매트릭스 참조.

## 수동 2-테스트 (린터로 못 잡는 것 — 자가/소수 플레이테스트)

시뮬은 재미·전략을 검증하지 못한다(명시적 한계). 출시 전 모든 아이템에 아래 2개 질문을 사람이 통과시킨다 — 작은 게임의 실용 밸런싱 게이트.

1. **"이 아이템을 한 번도 안 써도 클리어 가능한가?"** → 모든 아이템에 **true** 여야 한다. false면 그 아이템은 **지배템**(`SYN-NO-DOMINANT` 위반).
2. **"이 아이템만 항상 써도 클리어 가능한가?"** → **false** 여야 정상. true면 그 아이템 외 선택이 의미 없어진다(역시 지배 신호). 반대로 *어떤 빌드/상황에서도 고를 이유가 없으면* **함정템**(`SYN-NO-TRAP` 위반) — `whyPick` 한 줄을 못 쓰면 탈락.

## 출처

- Sirlin, "Balancing Multiplayer Games Part 2: Viable Options" — https://www.sirlin.net/articles/balancing-multiplayer-games-part-2-viable-options (viable 옵션 수 최대화, "omit needless choices", MvC2 garbage pile)
- Ian Schreiber, "Level 16: Game Balance" — https://gamedesignconcepts.wordpress.com/2009/08/20/level-16-game-balance/ (dominated strategy 정의, payoff matrix)
- Ian Schreiber, "Level 9: Intransitive Mechanics" — https://gamebalanceconcepts.wordpress.com/2010/09/01/level-9-intransitive-mechanics/ (비추이적 상성, soft/hard counter)
- Brandon Kidwell, "Avoiding Design Traps in Game Mechanics" — https://www.gamedeveloper.com/design/kgd---avoiding-design-traps-in-game-mechanics (함정 옵션, Lucky Coin EV 수술, filler 경고)
- Josh Sawyer, "Balance in Single-Player CRPGs" — https://www.tumblr.com/jesawyer/161302725596/balance-in-single-player-crpgs (단일플레이 밸런스 이유, x5→x2 너프, 인상 편향)
- "Video Game Balance: A Definitive Guide" (gamedesignskills.com) — https://gamedesignskills.com/game-design/game-balance/ (소프트캡·diminishing returns)
- "Design 101: Balancing Games" (Game Developer) — https://www.gamedeveloper.com/design/design-101-balancing-games (EV 비교)
- Apothecary Press, "Design Insights: Power Budget" — https://apothecary.press/2021/12/20/design-insights-power-budget/ (능력=예산 분담, 다운사이드 환급)
- "Point Build System" (TV Tropes) — https://tvtropes.org/pmwiki/pmwiki.php/Main/PointBuildSystem (바람직한 특성=더 높은 비용)
- Bruno Dias, "On Power Creep" — https://brunodias.dev/2021/11/27/power-creep.html (버프-only 양의 피드백 루프)
- "Why 'no nerfs only buffs' is bad balancing" (Helldivers 2 커뮤니티) — https://steamcommunity.com/app/553850/discussions/0/4358995462057059574/
- "Monte Carlo Simulations for Game Design" (Boards and Barley) — https://boardsandbarley.com/2013/09/17/monte-carlo-simulations-for-game-design/
- "What are game simulations..." (Machinations.io) — https://machinations.io/articles/what-are-game-simulations-and-why-should-you-care (taps/sinks 경제 시뮬)
- excelmontecarlo, "How the Monte Carlo model can help..." — https://excelmontecarlo.com/how-the-montecarlo-model-can-help-when-designing-a (분포로 단순 평균 대체)
- "Roguelike Itemization: Balancing Randomness and Player Agency" (Wayline) — https://www.wayline.io/blog/roguelike-itemization-balancing-randomness-player-agency (decision paralysis, 작은 풀)
- "Analysis: McMillen On Risk & Reward" (Game Developer) — https://www.gamedeveloper.com/pc/analysis-mcmillen-on-risk-reward-in-video-games (OP 게이팅, risk/reward)
- 게임 텔레메트리/애널리틱스 일반 (Talo) — https://trytalo.com/game-analytics (아이템 사용·픽률 추적)
- Vampire Survivors Wiki — Evolution: https://vampire.survivors.wiki/w/Evolution / Passive items: https://vampire.survivors.wiki/w/Passive_items (무기+passive→진화, enabler/payoff·진화 게이트)
- PCGamesN — Vampire Survivors weapon evolution guide: https://www.pcgamesn.com/vampire-survivors/weapon-evolutions
- infinite-bits — Slay the Spire Deckbuilding Strategies, Card Synergy: https://infinite-bits.com/slay-the-spire-deckbuilding-strategies-card-synergy-and-game-modes/ (set-up/pay-off, 아키타입)
- Medium (Félix Moll) — Archetypes in deckbuilding games: https://medium.com/@felix.moll.pro/archetypes-in-deckbuilding-games-f9bb2933393f
- Eneba — Slay the Spire Tips: https://www.eneba.com/hub/games-guides/slay-the-spire-tips/ (작고 집중된 덱, 덱 희석=기회비용)
- Paradox Forums — Additive vs Multiplicative bonuses: https://forum.paradoxplaza.com/forum/threads/additive-bonuses-vs-multiplicative-bonuses.1144836/
- Hypixel Forums — [Experiment] Additive vs Multiplicative: https://hypixel.net/threads/experiment-additive-vs-multiplicative.5242583/
