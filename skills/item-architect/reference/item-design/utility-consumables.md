# 특수기능·소모품·능력부여 — UTIL (18 원칙)

> [`item-architect`](../../SKILL.md)가 **소모품·열쇠·능력부여(traversal) 아이템·진행 게이트**를 설계할 때 참조하는 도메인 파일. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 이 도메인은 "숫자가 아니라 *할 수 있는 일*을 바꾸는 아이템"을 다룬다 — 소모품(포션·부스터)과 기능형 아이템(더블점프·대시·갈고리·열쇠·스위치). lock-and-key 이론·메트로배니아 능력 게이팅·호딩 함정 연구·softlock 방지 통념을 **단일플레이·무서버·CC0·모바일 짧은세션** 제약에 맞춰 코드화했다. 스탯형 장비는 본 도메인이 아니라 [synergy-balance.md](./synergy-balance.md)·[rarity-affixes.md](./rarity-affixes.md) 소관.

## 프레임워크 요약

두 갈래다. **(A) 소모품 모델** — 강력+희소+영구손실의 삼중 결합은 아이템을 "박물관에 박제"(호딩 함정)하므로, 보충식 리필·use-or-lose·풍부저렴 중 하나로 *사용을 강제*한다(액티브는 거의 항상 쿨다운 > 소모품). **(B) 기능/능력 모델** — 좋은 특수 아이템은 스탯이 아니라 **새 동사**를 준다(더블점프·대시·갈고리). 이는 lock-and-key 패턴 위에서 작동하며, 단일 최강 기법은 "열쇠보다 자물쇠를 먼저 보여라"(Chekhov's gun과 동형). 진행 게이팅은 `nodes/edges` 의존 그래프로 먼저 설계하고, 무서버 단일플레이라 **softlock(교착) 방지**가 더 중요하다(서버 복구 없음 → 필수 key는 영구·비소모 + 도달가능성 검증). 메트로배니아식 능력 게이트는 [`level-architect`](../../../level-architect/SKILL.md)/[`world-map-architect`](../../../world-map-architect/SKILL.md)의 진행 위상과 교차한다.

| 결정 | 디폴트 | 근거 코드 |
|---|---|---|
| 액티브 능력을 어떻게 줄까 | 쿨다운 > 소모품 | `UTIL-COOLDOWN-GATE` |
| 한 번에 새 능력 몇 개 | 1개 + 안전 연습 | `UTIL-FRICTIONLESS`(도입), `UTIL-VERB-NOT-STAT` |
| 진행 필수 key 소모성 | 영구·비소모 | `UTIL-NO-SOFTLOCK`, `UTIL-LOCK-KEY` |
| 자물쇠 vs 열쇠 노출 순서 | 자물쇠 먼저 | `UTIL-SHOW-LOCK-FIRST` |
| 진행 골격 | nodes/edges 그래프 먼저 | `UTIL-GATE-GRAPH` |

---

## 원칙 사전 (UTIL)

### `UTIL-HOARD-TRAP` 호딩 함정 삼중금지
- **정의:** **강력 + 희소 + 영구손실** 세 조건이 한 소모품에 겹치면 "Too Good to Use(아까워서 안 씀)" 증후군과 resource anxiety가 생겨, 경제적 플레이어는 끝까지 쟁여두고 시스템이 사실상 작동하지 않는다. 셋 중 최소 하나를 깨서 사용을 유도한다.
- **출처:** Game Developer "Avoiding the Hoarder Trap"(Diablo 3·Estus flask 사례) https://www.gamedeveloper.com/design/avoiding-the-hoarder-trap-in-game-design ; SuperJump "How Hoarding Encourages Bad Game Design" https://www.superjumpmagazine.com/how-hoarding-encourages-bad-game-design/
- **우리 엔진 구현(작은 웹게임):** 소모품 정의에 `power`·`scarcity`·`loss` 세 축을 의식적으로 평가하고 셋이 동시에 high면 린트 경고. 해법 3택을 곡선처럼 적용 — 보충식 리필(`UTIL-REFILL-CADENCE`)·런 한정 휘발(`UTIL-USE-OR-LOSE`)·풍부저렴(`UTIL-CHEAP-ABUNDANT`). 모바일 짧은 세션(1~3분)은 호딩을 더 악화시키므로(쓸 기회가 적어 더 아낌) 거의 항상 보충식/휘발로 설계. 인벤토리 노출에 "다음 체크포인트에 리필됨"을 명시(game-ui-hud)해 anxiety 제거.
- **흔한 실패:** "강력하지만 1회뿐"인 전설 포션 — 절대 안 쓴다. 99개 무제한 스택은 사용 압력을 0으로 만든다.
- **연관:** `UTIL-REFILL-CADENCE`, `UTIL-USE-OR-LOSE`, `UTIL-CHEAP-ABUNDANT`, `UTIL-COOLDOWN-GATE`

### `UTIL-REFILL-CADENCE` 보충식 리필 박자
- **정의:** 소모품을 영구 손실이 아니라 **정해진 박자로 재충전**되는 자원으로 주면(체크포인트·레벨 시작·화톳불), 플레이어는 "다음에 또 받으니 지금 쓰자"고 판단한다. 손실의 영구성을 깨서 호딩을 해소하는 1순위 수단.
- **출처:** Game Developer "Avoiding the Hoarder Trap"(Dark Souls Estus flask = 화톳불 재충전) https://www.gamedeveloper.com/design/avoiding-the-hoarder-trap-in-game-design
- **우리 엔진 구현(작은 웹게임):** `consumable: { refillTo: 3, refillOn: 'levelStart' | 'checkpoint' }`. localStorage엔 *해금/보유 상한*만 저장하고, 현재 잔량은 세션 메모리(registry)에 두어 레벨 시작 시 `refillTo`로 리셋. 박자는 짧은 세션에 맞춰 레벨/체크포인트 단위(런 단위가 아님). 리필 순간 chip-sound 신호 + game-ui-hud 게이지 채움 연출(juice-fx). 퍼즐 부스터(`UTIL-PUZZLE-BOOSTER`)도 레벨당 N개 리필 모델이 기본.
- **흔한 실패:** 리필 박자가 너무 드물면(런당 1회) 사실상 영구손실과 같아져 다시 호딩. 리필 상한을 안 보여주면 플레이어가 박자를 학습 못 함.
- **연관:** `UTIL-HOARD-TRAP`, `UTIL-USE-OR-LOSE`, `UTIL-COOLDOWN-GATE`, `UTIL-PUZZLE-BOOSTER`

### `UTIL-USE-OR-LOSE` 안 쓰면 잃는다 (런 한정 휘발)
- **정의:** 소모품을 런(run)/스테이지 끝에 **휘발**시키면 "어차피 사라지니 지금 쓰자"는 압력이 생겨 호딩이 불가능해진다. 영구성을 끊는 또 다른 해법으로, 로그라이트의 런 단위 자원과 정합.
- **출처:** SuperJump "How Hoarding Encourages Bad Game Design" https://www.superjumpmagazine.com/how-hoarding-encourages-bad-game-design/ ; ResetEra 호딩 해법 토론 https://www.resetera.com/threads/how-would-you-solve-the-consumable-item-hoarding-problem.1382920/
- **우리 엔진 구현(작은 웹게임):** `consumable: { scope: 'run', volatile: true }` — registry에만 보관, 런 종료 시 폐기(localStorage로 영속화하지 않음). 로그라이트형 게임(topdown-shooter·endless-runner 런)에 특히 적합. 런 막바지엔 "남은 자원 소진" UI 힌트(game-ui-hud). 단, *진행 필수* key에는 절대 쓰지 않는다(`UTIL-NO-SOFTLOCK` 충돌) — 휘발은 옵션 보상 소모품에만.
- **흔한 실패:** 진행에 필요한 아이템을 휘발시켜 다음 단계에서 막힘(softlock). 휘발을 예고 없이 적용해 "내 아이템 어디 갔어?" 억울함.
- **연관:** `UTIL-HOARD-TRAP`, `UTIL-REFILL-CADENCE`, `UTIL-NO-SOFTLOCK`, `UTIL-KEY-VS-CONSUMABLE`

### `UTIL-CHEAP-ABUNDANT` 풍부하고 저렴하게 (사용 부담 제로)
- **정의:** 소모품을 *흔하고 싸게* 만들면 "아껴야 한다"는 심리가 사라져 자유롭게 쓴다. 희소성을 깨서 호딩을 해소하는 세 번째 해법. 강력함은 유지하되 공급을 넉넉히.
- **출처:** Game Developer "Avoiding the Hoarder Trap"(공급 풍부화로 사용 장려) https://www.gamedeveloper.com/design/avoiding-the-hoarder-trap-in-game-design ; bitsnpixels "Cooldowns vs Consumables"(resource anxiety) https://bitsnpixels.org/p/cooldowns-vs-consumables-game-design-innovation
- **우리 엔진 구현(작은 웹게임):** 드랍률/생성 빈도를 높게 잡고(`drop.weight` 상향), 효과는 중간 강도로 — "자주 얻고 자주 쓰는" 리듬. 픽업=즉시효과로 만들면(인벤토리 없이 바로 발동) 사용 마찰까지 0(`UTIL-FRICTIONLESS`). 통화로 사는 부스터라면 가격을 낮게(`ECON-CURVE` 곡선의 저가 구간, [economy-loot.md](./economy-loot.md) 참조). endless-runner의 코인/순간 픽업 모델이 전형.
- **흔한 실패:** 풍부+강력+영구보관이 겹치면 오히려 무지성 남용으로 난이도 붕괴 — 풍부하게 할 땐 효과 강도를 낮추거나 즉시 소비형으로. 너무 흔해서 줍는 행위가 지겨워짐(수집 패딩, principles §3).
- **연관:** `UTIL-HOARD-TRAP`, `UTIL-FRICTIONLESS`, `UTIL-MEANINGFUL-CHOICE`

### `UTIL-COOLDOWN-GATE` 소모품보다 쿨다운 (액티브 능력 기본형)
- **정의:** 액티브 유틸리티(대시·폭발·시간정지)는 유한 소모품보다 **쿨다운/재충전 자원**으로 줄 때 실험과 사용이 촉진된다. 호딩·resource anxiety를 구조적으로 제거하므로, 액티브 능력의 *디폴트*는 거의 항상 쿨다운이다.
- **출처:** bitsnpixels "Cooldowns vs Consumables"(Too Good to Use) https://bitsnpixels.org/p/cooldowns-vs-consumables-game-design-innovation ; Game Developer "Avoiding the Hoarder Trap"(Diablo 3 포션 45초 쿨다운) https://www.gamedeveloper.com/design/avoiding-the-hoarder-trap-in-game-design
- **우리 엔진 구현(작은 웹게임):** `ability: { activation:'active', cooldownMs: 4000 }` — 세션 메모리 타이머. localStorage엔 *해금 여부*만, 잔여 쿨다운은 저장 안 함(휘발). 모바일 HUD에 원형/바 쿨다운 게이지(game-ui-hud), 재충전 완료 시 chip-sound 신호. 짧은 세션이므로 쿨다운은 한 판에 수 회 쓸 수 있게 짧게(2~6초대). 발동 임팩트는 juice-fx.
- **흔한 실패:** 쿨다운이 너무 길어 한 세션에 1~2회뿐 → 사실상 소모품과 동일(호딩 부활). 쿨다운 게이지를 안 보여주면 언제 다시 쓸지 몰라 능력을 신뢰 못 함.
- **연관:** `UTIL-HOARD-TRAP`, `UTIL-VERB-NOT-STAT`, `UTIL-TELEGRAPH-EFFECT`, `UTIL-FRICTIONLESS`

### `UTIL-FRICTIONLESS` 무마찰 사용 (픽업=즉시, 발동=한 동작)
- **정의:** 소모품·능력의 사용 마찰(메뉴 열기·선택·확인)이 크면 안 쓰게 된다. 픽업은 가능하면 **즉시 효과**, 액티브 발동은 **한 입력**으로. 마찰 제거는 호딩 해소와 별개로 "쓰는 게 귀찮아서 안 씀"을 막는다. 또한 새 능력을 안전한 공간에서 부담 없이 도입(점진 학습)하는 "무마찰 도입"도 포함한다.
- **출처:** bitsnpixels "Cooldowns vs Consumables"(사용 마찰과 미사용) https://bitsnpixels.org/p/cooldowns-vs-consumables-game-design-innovation ; Game Developer "Introducing Mechanics"(Portal: 안전 챔버로 점진 도입) https://www.gamedeveloper.com/design/game-design-introducing-mechanics
- **우리 엔진 구현(작은 웹게임):** 픽업형은 `instant: true`로 충돌 즉시 적용(인벤토리 경유 X). 액티브는 기존 입력 확장(점프 2연타·스와이프)으로 새 버튼 폭증을 피함(모바일 `UX-THUMB-ZONE`, principles §0). 새 능력 획득 직후 1개의 *위험 0 연습 구간*(적·구덩이 없는 방)을 절차생성 규칙으로 삽입 → [`level-architect`](../../../level-architect/SKILL.md)의 도입 비트(LD-TEACH/LD-ONE-IDEA)로 위임. 능력 순서는 `ABILITY_ORDER = ['dash','doubleJump','grapple']` 배열로 명시.
- **흔한 실패:** 동사마다 새 화면 버튼을 추가해 작은 화면이 버튼밭. 튜토리얼 텍스트만 띄우고 연습 공간을 안 줘서 학습 실패. 한 번에 능력 2개를 던져 인지 과부하.
- **연관:** `UTIL-CHEAP-ABUNDANT`, `UTIL-VERB-NOT-STAT`, `UTIL-COOLDOWN-GATE`, `UTIL-MEANINGFUL-CHOICE`

### `UTIL-MEANINGFUL-CHOICE` 소모품 사용은 의미 있는 결정
- **정의:** 소모품이 흥미로우려면 "언제·어디에 쓰는가"가 **의미 있는 트레이드오프**여야 한다 — 지금 쓸까 아낄까, A상황 vs B상황. 무마찰로 쓰게 하되(`UTIL-FRICTIONLESS`), 그 사용이 전술적 판단이 되도록 효과·타이밍을 설계한다. 호딩 방지(써라)와 균형: *쉽게 쓰되 아무 때나 쓰면 손해*.
- **출처:** bitsnpixels "Cooldowns vs Consumables"(소모품의 결정 가치) https://bitsnpixels.org/p/cooldowns-vs-consumables-game-design-innovation ; 가짜 선택 금지는 `ECON-MEANINGFUL-UPGRADE` 정합([economy-loot.md](./economy-loot.md))
- **우리 엔진 구현(작은 웹게임):** 소모품 효과를 상황 의존적으로 — 실드는 위기에, 폭탄은 군집에, 자석은 코인 밀집에. 효과를 `context` 태그로 표기해 "이건 이럴 때"가 읽히게(game-ui-hud 툴팁). 곱연산 한 방보다 *타이밍 가치*를 설계(곱산 격리는 `SYN-ADD-VS-MULT`, [synergy-balance.md](./synergy-balance.md)). 짧은 세션이라 결정은 빠르고 즉각적이어야 — 깊은 메뉴 고민이 아니라 순간 판단.
- **흔한 실패:** 모든 소모품이 "그냥 HP 회복"이면 결정이 없다(언제 써도 똑같음). 반대로 결정이 너무 무거우면(`UTIL-FRICTIONLESS` 위반) 안 쓴다.
- **연관:** `UTIL-FRICTIONLESS`, `UTIL-HOARD-TRAP`, `UTIL-KEY-VS-CONSUMABLE`, `UTIL-CHEAP-ABUNDANT`

### `UTIL-VERB-NOT-STAT` 숫자가 아니라 새 동사
- **정의:** 좋은 특수 아이템은 스탯을 올리는 게 아니라 **플레이어가 할 수 있는 행동의 종류**를 바꾼다 — 더블점프·대시·벽타기·갈고리·수영. 이는 게임 공간 자체의 해석을 바꿔(전에 못 가던 곳이 갈 수 있게) 탐험감과 전능감을 동시에 자극한다. 공통 캐논 `IDENT-VERB-OVER-STAT`(principles §2-4)의 도메인 구현.
- **출처:** nintendolife/Hollow Knight(Crystal Heart=슈퍼대시, Isma's Tear=산성 수영 → 지역 해금) https://www.nintendolife.com/news/2021/10/soapbox-what-makes-a-game-a-good-metroidvania-anyway ; howtomakeanrpg("double jump has gameplay effects as well as access") https://howtomakeanrpg.com/r/a/zelda-lock-and-key.html ; ResetEra traversal 만족감 https://www.resetera.com/threads/double-jump-and-dash-are-incredibly-satisfying-traversal-mechanics
- **우리 엔진 구현(작은 웹게임):** 능력은 player controller의 *상태 플래그*로 모델링 — `player.abilities = { doubleJump:false, dash:false, grapple:false }`. 획득 시 플래그 on → 입력 핸들러가 새 분기 활성화. localStorage bitmask 1개로 해금 영속(`UX-LOCAL-SAVE`). 모바일은 동사를 기존 입력의 확장으로(점프 2연타=더블점프) 설계해 버튼 폭증 회피. 첫 사용에 강한 감각 피드백(트레일·임팩트)을 juice-fx로 — "내가 강해졌다"를 체감. 아이콘은 sprite-forge(픽셀)/vector-graphics(벡터), off-catalog는 sprite-picker(CC0).
- **흔한 실패:** "이동속도 +10%"를 '특수 능력'이라 부름(신선함 0, 그건 스탯 측면 소관). 모바일에서 동사마다 새 버튼 추가. 한 번에 동사 2개 이상.
- **연관:** `UTIL-FRICTIONLESS`, `UTIL-COOLDOWN-GATE`, `UTIL-LOCK-KEY`, `UTIL-GATE-GRAPH`

### `UTIL-LOCK-KEY` 자물쇠-열쇠 1:1 매칭
- **정의:** 각 특수 아이템(key)은 특정 장애물(lock)을 넘기 위해 설계된다. 진행을 막는 lock과 그것을 해제하는 key를 명시적 쌍으로 두면, 플레이어는 "이 아이템은 무엇에 쓰는가"를 추론할 수 있고 진행이 *해독 가능한 퍼즐*이 된다(폭탄=금 간 벽, 갈고리=넓은 균열).
- **출처:** BorisTheBrave "Lock and Key Dungeons"(lock 분류 strict/or/and, mission graph) https://www.boristhebrave.com/2021/02/27/lock-and-key-dungeons/ ; Critical-Gaming "Locks, Keys & Obstacles"(lock 4종/key 6종 taxonomy) https://critical-gaming.com/blog/2009/11/7/locks-keys-obstacles-pt1.html
- **우리 엔진 구현(작은 웹게임):** 아이템에 *해제 태그* `unlocks: ['gate:rock', 'gate:gap-wide']`를 선언하고, 레벨 오브젝트에 `requires: 'gate:rock'`를 단다. 충돌/상호작용 시 인벤토리·해금 bitmask에 해당 key가 있으면 lock 토글. 작은 게임엔 lock 타입 2종이면 충분 — **or-lock**(아무 같은 종류 key나 소모)과 **upgrade-lock**(영구 능력). [`level-architect`](../../../level-architect/SKILL.md)의 도달가능성 검증(LD-SOLVABLE)과 결합해 모든 lock이 도달 가능한 key로 풀리는지 검증.
- **흔한 실패:** key와 lock 관계가 임의적("event flag"처럼 논리적 연결 없는 숨은 변수)이면 추리 불가 → 막연한 헤맴. lock 종류 5종 이상 동시 운용 → 모바일 짧은 세션 인지 과부하.
- **연관:** `UTIL-SHOW-LOCK-FIRST`, `UTIL-MORE-THAN-KEY`, `UTIL-GATE-GRAPH`, `UTIL-NO-SOFTLOCK`

### `UTIL-SHOW-LOCK-FIRST` 열쇠보다 자물쇠를 먼저 (도메인 북극성)
- **정의:** 해당 key를 손에 넣기 *전에* 그것이 풀 lock을 먼저 노출한다. 그러면 "이 막힌 곳에 맞는 무언가"를 기대하도록 뇌가 점화(prime)되고, 나중에 아이템을 얻는 순간 "아! 거기!"라는 자가 유도 목표와 발견의 쾌감이 생긴다. 서사의 Chekhov's gun(1막의 총은 3막에 발사)과 동형 구조. principles §2 도메인 북극성으로 등재된 *단일 최강 기법*.
- **출처:** howtomakeanrpg "How Zelda Gets Lock and Key Right"(금 간 벽을 폭탄 이전 노출) https://howtomakeanrpg.com/r/a/zelda-lock-and-key.html ; Chekhov's gun(Wikipedia) https://en.wikipedia.org/wiki/Chekhov%27s_gun ; "items need presence before use"(Tropedia) https://tropedia.fandom.com/wiki/Chekhov%27s_Gun
- **우리 엔진 구현(작은 웹게임):** 레벨 생성 시 *아직 못 푸는* lock을 의도적으로 시야에 1~2개 배치(절차생성이면 "다음 능력으로 풀릴 lock"을 현재 레벨 시드로 심기). 모바일은 lock을 **색+형태 이중부호화**(빨강 균열=폭탄, 파랑 게이트=대시)로 작은 화면에서도 매칭 가능하게 — `UX-RARITY-MULTI-CHANNEL`과 같은 다채널 부호화 철학([visual-inventory-ux.md](./visual-inventory-ux.md)). 잠긴 lock에 "거부" 흔들림 피드백(juice-fx)으로 "지금은 안 됨" 명시. [`level-architect`](../../../level-architect/SKILL.md) LD-FORESHADOW와 직접 동치.
- **흔한 실패:** key를 먼저 주고 lock을 나중에 보여주면 점화 효과 소멸 → 평범한 '주워서 쓴다'. 풀 수 없는 lock에 피드백이 없으면 버그처럼 느껴짐. 예고한 lock을 끝내 풀 key를 안 주면(Chekhov's gun 미발사) 신뢰 붕괴.
- **연관:** `UTIL-LOCK-KEY`, `UTIL-GATE-GRAPH`, `UTIL-TELEGRAPH-EFFECT`, `UTIL-VERB-NOT-STAT`

### `UTIL-MORE-THAN-KEY` 열쇠 그 이상 (다용도성)
- **정의:** 단일 용도 '멍청한 열쇠'보다 부가 효과가 있는 다용도 아이템이 훨씬 흥미롭다. 폭탄은 벽을 부수는 동시에 적과 자신을 다치게 하고, 지연 폭발하고, 던질 수 있다 — 이 추가 속성들이 더 풍부한 퍼즐·전투를 만든다. 적은 에셋으로 깊이를 내므로 CC0/절차생성 제약에 특히 유리하다.
- **출처:** howtomakeanrpg("keys that are more than just a key are better") https://howtomakeanrpg.com/r/a/zelda-lock-and-key.html ; BorisTheBrave("extra uses allow for more interesting puzzles") https://www.boristhebrave.com/2021/02/27/lock-and-key-dungeons/ ; Critical-Gaming "Versatile Key" https://critical-gaming.com/blog/2009/11/7/locks-keys-obstacles-pt1.html
- **우리 엔진 구현(작은 웹게임):** 아이템 1개에 여러 상호작용 태그 — 폭탄 = `{ destroys:['rock'], damages:['enemy','player'], throwable:true, fuse:1.2 }`. 같은 아이템이 전투·퍼즐·이동 3맥락에서 재사용되면 콘텐츠 대비 표면적이 커진다(절차생성·CC0에 이상적). 의도치 않은 조합(폭탄으로 적+벽 동시 처리)이 '아하' 순간을 만듦 — 공통 캐논 `SYN-EMERGENT-COMBO`([synergy-balance.md](./synergy-balance.md))와 연결. 위험한 부가 효과(self-damage)는 반드시 텔레그래프(`UTIL-TELEGRAPH-EFFECT`).
- **흔한 실패:** 모든 아이템을 다용도로 만들면 각자 정체성이 흐려진다 — *코어 몇 개만* 다용도로, 나머지는 명확한 단일 용도. self-damage가 텔레그래프 없으면 모바일 짧은 세션에서 억울한 죽음.
- **연관:** `UTIL-LOCK-KEY`, `UTIL-TELEGRAPH-EFFECT`, `UTIL-ENV-DIEGETIC`, `UTIL-PUZZLE-BOOSTER`

### `UTIL-GATE-GRAPH` 게이트 의존 그래프 (nodes/edges 먼저)
- **정의:** 어떤 key가 어떤 lock을 열고 그 너머에 어떤 key가 있는지를 **의존 그래프(nodes=아이템, edges=게이트 요구)** 로 *먼저* 설계한다. 물리적 디테일을 추상화한 그래프로 진행 골격을 보면, 선형/분기/허브 구조와 백트래킹 동선을 의도적으로 통제할 수 있다.
- **출처:** BorisTheBrave "mission graphs"(top-down 설계·절차생성 지원) https://www.boristhebrave.com/2021/02/27/lock-and-key-dungeons/ ; nintendolife/Hollow Knight("능력 진행 순서를 먼저 잡고 세계 구조를 함께 논의") https://www.nintendolife.com/news/2021/10/soapbox-what-makes-a-game-a-good-metroidvania-anyway ; pudgycat "맵=퍼즐, 능력=열쇠" https://pudgycat.io/what-is-a-metroidvania-game-genre-explained/
- **우리 엔진 구현(작은 웹게임):** 능력/열쇠와 게이트를 작은 JSON 그래프로 — `{ nodes:[{id:'dash'},{id:'grapple'}], edges:[{from:'dash', gate:'gap-wide', to:'zone-2'}] }`. 레벨 배치 전 위상 검증(도달가능성). 작은 게임은 노드 **4~8개의 얕은 선형+소수 분기**면 충분(짧은 세션). [`world-map-architect`](../../../world-map-architect/SKILL.md)의 진행 위상과 직접 연동(맵 노드 = 게이트 그래프 노드), 난이도 곡선은 [`level-architect`](../../../level-architect/SKILL.md). 진행 상태는 localStorage bitmask로 영속.
- **흔한 실패:** 그래프 없이 즉흥 배치 → 도달 불가/조기 해금/순서 꼬임. 노드가 너무 많고 백트래킹이 길면(AAA식 거대 맵) 모바일 짧은 세션에 부적합. and-lock(여러 key 동시 요구) 남발 → 막다른 길투성이.
- **연관:** `UTIL-LOCK-KEY`, `UTIL-NO-SOFTLOCK`, `UTIL-SOFT-GATE`, `UTIL-VERB-NOT-STAT`

### `UTIL-SOFT-GATE` 단단한 게이트와 부드러운 게이트
- **정의:** lock에는 의도된 key가 *반드시* 있어야 풀리는 **hard requirement(단단한 게이트)** 와, 권장될 뿐 숙련자가 우회 가능한 **soft requirement(부드러운 게이트)** 가 있다. 둘을 의식적으로 섞으면 일반 플레이어에겐 안내를, 숙련자에겐 sequence-break의 자유(숙련 표현)를 동시에 준다.
- **출처:** BorisTheBrave "hard vs soft requirement"("강한 몬스터로 막는 건 soft requirement") https://www.boristhebrave.com/2021/02/27/lock-and-key-dungeons/ ; sequence breaking 통념(metroidvania, pcgamer 맵 설계) https://www.pcgamer.com/how-to-design-a-great-metroidvania-map/
- **우리 엔진 구현(작은 웹게임):** 진행 필수 경로는 hard gate(`requires` 능력 플래그 검사)로 확실히, *지름길/비밀*은 soft gate(어려운 점프·정밀 조작으로 능력 없이도 돌파 가능)로. soft gate 돌파에 보상을 숨겨 탐험/비밀 욕구를 자극 — [`level-architect`](../../../level-architect/SKILL.md) LD-RISK-PATH/LD-SECRET과 결합. soft gate는 **항상 옵션**이어야(진행 필수가 되면 일반 플레이어가 막힘).
- **흔한 실패:** 모든 게이트를 soft로 만들면 게이팅의 의미(능력의 가치) 소멸. 진행 필수 지점에 의도치 않은 soft 돌파(버그성 sequence break)가 있으면 softlock 위험(`UTIL-NO-SOFTLOCK`과 충돌). soft를 너무 어렵게 해 사실상 hard처럼 작동하면 기대 배신.
- **연관:** `UTIL-GATE-GRAPH`, `UTIL-NO-SOFTLOCK`, `UTIL-LOCK-KEY`, `UTIL-SHOW-LOCK-FIRST`

### `UTIL-NO-SOFTLOCK` 교착 불가능하게 (도메인 북극성)
- **정의:** 특수 아이템으로 진행을 게이팅할 때, 플레이어가 *기술적으론 플레이 가능하나 클리어 불가능한* unwinnable 상태에 빠지지 않게 한다. 소모성 key 오용·필수 아이템 영구 누락·되돌아갈 수 없는 일방통행을 구조적으로 차단. principles §2 도메인 북극성. 무서버 단일플레이라 서버 복구가 없어 *더* 치명적.
- **출처:** Super Mario Wiki "Unwinnable state"(정의·분류) https://www.mariowiki.com/Unwinnable_state ; Amini Allight "The Soft Lock Trap" https://amini-allight.org/post/the-soft-lock-trap ; TV Tropes "Unintentionally Unwinnable"(missable·save 교착) https://tvtropes.org/pmwiki/pmwiki.php/Main/UnintentionallyUnwinnable
- **우리 엔진 구현(작은 웹게임):** (1) **진행 필수 key는 소모 불가(영구 능력)**, 소모품은 옵션 보상에만(`UTIL-KEY-VS-CONSUMABLE`). (2) 일방통행 직전 "되돌아갈 수 없음" 텔레그래프 + 필요 key 보유 검사. (3) 절차생성 레벨은 *생성 후 도달가능성 검증*(`UTIL-GATE-GRAPH`를 위상 정렬해 클리어 가능 시드만 통과) → [`level-architect`](../../../level-architect/SKILL.md) LD-SOLVABLE. (4) 레벨 단위 체크포인트로 최악의 재시작 비용을 한 레벨로 한정. (5) missable 필수템 금지 — 필수는 경로 위에, 수집은 옵션으로.
- **흔한 실패:** 한정 수량 key를 잘못된 lock에 써서 영구 막힘(고전 어드벤처의 악명). 세이브 슬롯 1개를 교착 상태로 덮어쓰기. 절차생성에서 도달가능성 검증 없이 출고 → 가끔 클리어 불가 시드.
- **연관:** `UTIL-KEY-VS-CONSUMABLE`, `UTIL-GATE-GRAPH`, `UTIL-LOCK-KEY`, `UTIL-SOFT-GATE`

### `UTIL-ENV-DIEGETIC` 메뉴가 아니라 세계 안에서 (diegetic 상호작용)
- **정의:** 환경 상호작용 아이템(레버·스위치·밀 수 있는 상자·트리거)은 메뉴 선택이 아니라 *게임 세계 안의 물리적 조작*으로 작동해야 직관적이고 몰입적이다. "show, don't tell" — 환경 자체가 사용법을 가르친다(organic/dynamic key).
- **출처:** Critical-Gaming "Organic/Dynamic Keys"(LittleBigPlanet 무게 스위치) https://critical-gaming.com/blog/2009/11/7/locks-keys-obstacles-pt1.html ; Medium "Puzzle Design"(레버로 상호작용 단순화) https://medium.com/@brdelfino.work/puzzle-design-a-guide-for-game-designers-72251d60a56a ; wayline 환경 퍼즐("환경이 교사") https://www.wayline.io/blog/sci-fi-environmental-puzzle-design-for-indie-developers
- **우리 엔진 구현(작은 웹게임):** 스위치/레버는 Phaser Arcade overlap + 상태 토글로 — `switch.on = !switch.on` → 연결된 `target.solid` 변경. 밀기 상자는 Arcade immovable 토글. 모바일은 **근접 시 자동 프롬프트**(탭 1번)로 조작, 복잡한 드래그 지양. 어포던스를 시각적으로(레버는 당길 수 있게 생기기) — [`level-architect`](../../../level-architect/SKILL.md) LD-AFFORDANCE. 조작 가능 오브젝트는 색+형태로 구분, 발동 연출은 juice-fx, SFX는 chip-sound. (is-rule류 규칙조작 데모의 push/stop이 이 패턴의 코어 예.)
- **흔한 실패:** 환경 조작을 인벤토리 메뉴 "Use Lever"로 만들면 몰입·직관 붕괴. 어포던스 부재(상호작용 가능 여부가 시각 구분 안 됨)로 픽셀 헌팅. 모바일에서 정밀 드래그 요구 → 손가락 가림으로 좌절.
- **연관:** `UTIL-MORE-THAN-KEY`, `UTIL-LOCK-KEY`, `UTIL-PUZZLE-BOOSTER`, `UTIL-TELEGRAPH-EFFECT`

### `UTIL-PUZZLE-BOOSTER` 퍼즐 부스터는 막힘 해소용, 만능키 금지
- **정의:** 퍼즐형 게임의 부스터/도구(폭탄·셔플·줄제거·힌트)는 *막힘(stuck) 해소*와 표현의 폭을 위해 존재하되, 모든 퍼즐을 자동으로 푸는 만능키가 되어선 안 된다. 부스터는 퍼즐의 깊이를 더하는 추가 도구이지 사고를 대체하는 우회로가 아니다.
- **출처:** BorisTheBrave/howtomakeanrpg("extra uses allow for more interesting puzzles") https://www.boristhebrave.com/2021/02/27/lock-and-key-dungeons/ ; Medium "Puzzle Design" https://medium.com/@brdelfino.work/puzzle-design-a-guide-for-game-designers-72251d60a56a
- **우리 엔진 구현(작은 웹게임):** 부스터를 레벨 *보상/제한 자원*으로 선언(예: 레벨당 폭탄 1개), 리필 박자는 `UTIL-REFILL-CADENCE`(레벨당 N개). 효과는 보드 상태 변환 함수 `applyBooster(board, type)`로 결정론 유지(시드 기반). 단일플레이라 부스터는 *과금이 아닌 게임플레이 보상* — IAP 전제 배제(principles §0, `ECON-VARIABLE-RATIO`의 도박 차용 금지와 정합). 막힘 감지(N턴 무진전) 시 힌트 부스터를 부드럽게 제안. 사용 연출은 juice-fx, SFX는 chip-sound.
- **흔한 실패:** 부스터를 IAP로 팔려고 난이도를 인위적으로 올리는 F2P 안티패턴(우리 무서버 단일플레이와 정면 충돌). 부스터 하나로 어떤 레벨도 즉시 클리어되면 퍼즐 설계 무의미. 부스터를 호딩하게 만들면(`UTIL-HOARD-TRAP`) 결국 안 씀.
- **연관:** `UTIL-REFILL-CADENCE`, `UTIL-HOARD-TRAP`, `UTIL-MORE-THAN-KEY`, `UTIL-ENV-DIEGETIC`

### `UTIL-TELEGRAPH-EFFECT` 능력의 범위·결과를 미리 보여줘라
- **정의:** 액티브 능력/도구를 쓰기 직전, 그 *효과 범위와 결과*를 시각적으로 텔레그래프한다(폭탄 폭발 반경, 대시 궤적, 갈고리 도달점). 그래야 의도대로 결과를 통제할 수 있고 억울한 실패(self-damage·헛발질)를 피한다 — 공정성의 핵심.
- **출처:** howtomakeanrpg(Zelda 폭탄 지연 폭발=텔레그래프된 위험) https://howtomakeanrpg.com/r/a/zelda-lock-and-key.html ; cbr 갈고리 설계("flow 유지, stop-and-aim 불필요") https://www.cbr.com/video-games-best-grappling-hooks/
- **우리 엔진 구현(작은 웹게임):** 조준형 도구(갈고리·던지는 폭탄)는 조준 중 점선 궤적/착탄 마커 렌더. 범위형(폭발·시간정지)은 반투명 영역 프리뷰. 모바일은 손가락 가림을 고려해 **마커를 손가락 위로 오프셋**. juice-fx로 발동 전(차징)·후(임팩트) 단계 연출, chip-sound로 차징 톤 상승 → 발동 임팩트. 짧은 세션이므로 텔레그래프는 빠르게(액션 템포를 죽이지 않게).
- **흔한 실패:** 즉발·범위 불명 능력은 자기 피해·헛발질로 억울함. 모바일에서 조준 마커가 손가락에 가려 안 보임. 텔레그래프가 너무 느려 액션 템포 사망.
- **연관:** `UTIL-MORE-THAN-KEY`, `UTIL-COOLDOWN-GATE`, `UTIL-SHOW-LOCK-FIRST`, `UTIL-ENV-DIEGETIC`

### `UTIL-KEY-VS-CONSUMABLE` 열쇠와 소모품을 구분하라
- **정의:** 진행에 *필수*인 것(열쇠·능력)과 *옵션 강화*인 것(소모품)을 코드·데이터·UX에서 명확히 분리한다. 필수는 영구·비소모로 softlock을 막고, 옵션은 휘발·소모로 호딩을 막는다. 두 모델을 헷갈려 섞으면(필수를 휘발시키거나 옵션을 영구 보관) 양쪽 안티패턴을 동시에 부른다.
- **출처:** TV Tropes "Unintentionally Unwinnable"(missable 필수템 = softlock 원인) https://tvtropes.org/pmwiki/pmwiki.php/Main/UnintentionallyUnwinnable ; ResetEra 호딩 토론(소모품 미사용) https://www.resetera.com/threads/how-would-you-solve-the-consumable-item-hoarding-problem.1382920/
- **우리 엔진 구현(작은 웹게임):** 데이터 모델에서 분기 — 필수 key/능력: `kind:'key'|'ability', consumable:false, persist:'localStorage'`(bitmask 영속, `UTIL-NO-SOFTLOCK`). 옵션 소모품: `kind:'consumable', consumable:true, scope:'run'|'level', persist:'registry'`(휘발, `UTIL-USE-OR-LOSE`/`UTIL-REFILL-CADENCE`). 공통 캐논 `CAT-VERB-AXIS`(principles §2-3)의 `kind` enum이 곧 dispatch 키 — 같은 enum으로 갈라진다. UX도 분리: key/능력은 영구 슬롯(game-ui-hud), 소모품은 소진 게이지.
- **흔한 실패:** 진행 필수 key를 소모품처럼 휘발/소진(softlock). 옵션 소모품을 영구 99개 스택(호딩). 둘을 같은 인벤토리 칸에 섞어 플레이어가 "이거 써도 되나?"를 매번 고민.
- **연관:** `UTIL-NO-SOFTLOCK`, `UTIL-USE-OR-LOSE`, `UTIL-HOARD-TRAP`, `UTIL-LOCK-KEY`

---

## 소모품 모델 비교 (호딩 해소 치트 표)

호딩 함정(`UTIL-HOARD-TRAP`)은 **강력+희소+영구손실** 삼중 결합. 셋 중 하나를 깨는 4모델을 상황에 맞게 고른다. 액티브 능력의 디폴트는 거의 항상 쿨다운.

| 모델 | 깨는 축 | 데이터 형태 | 영속 | 적합 | 코드 |
|---|---|---|---|---|---|
| **쿨다운/재충전** | 영구손실(시간 후 복귀) | `cooldownMs` 타이머 | 해금만 localStorage | 액티브 능력(대시·폭발) — **기본값** | `UTIL-COOLDOWN-GATE` |
| **보충식 리필** | 영구손실(박자 리셋) | `refillTo / refillOn:'levelStart'` | 상한만 localStorage, 잔량 registry | 포션·퍼즐 부스터 | `UTIL-REFILL-CADENCE` |
| **런 한정 휘발** | 영구손실(런 끝 폐기) | `scope:'run', volatile:true` | registry만 | 로그라이트 런 자원 | `UTIL-USE-OR-LOSE` |
| **풍부저렴** | 희소성(흔하고 쌈) | `drop.weight` 상향, `instant:true` | 즉시 소비 | 코인·순간 픽업(자석·실드) | `UTIL-CHEAP-ABUNDANT` |

> 진행 필수 key/능력은 이 표의 대상이 아니다 — 영구·비소모(`UTIL-KEY-VS-CONSUMABLE`/`UTIL-NO-SOFTLOCK`).

## 게이트 그래프 검증 체크 (출고 전 4점)

`UTIL-GATE-GRAPH`의 nodes/edges를 레벨 배치 전·절차생성 출고 전에 기계 점검한다. [`level-architect`](../../../level-architect/SKILL.md) LD-SOLVABLE로 위임 가능.

1. **도달가능성:** 시작 노드에서 모든 진행 필수 노드가 위상 정렬로 도달 가능한가(클리어 불가 시드 차단, `UTIL-NO-SOFTLOCK`).
2. **자물쇠 선노출:** 각 key의 lock이 그 key 획득 *이전* 비트에 1회 이상 노출되는가(`UTIL-SHOW-LOCK-FIRST`).
3. **소모성 검사:** 진행 필수 경로 위의 lock이 *소모성 key*에만 의존하지 않는가(영구 능력/비소모 key가 보장되는가, `UTIL-KEY-VS-CONSUMABLE`).
4. **백트래킹 비용:** 노드 4~8개·백트래킹 동선이 모바일 짧은 세션 한도 내인가(과도하면 fast travel/단축, `SCOPE-PLATFORM-BUDGET`).

---

## 출처

**lock-and-key / 게이팅 이론**
- BorisTheBrave "Lock and Key Dungeons" — lock 분류·hard/soft requirement·mission graph: https://www.boristhebrave.com/2021/02/27/lock-and-key-dungeons/
- Critical-Gaming "Locks, Keys & Obstacles pt1" — lock 4종/key 6종 taxonomy(organic/versatile key): https://critical-gaming.com/blog/2009/11/7/locks-keys-obstacles-pt1.html
- howtomakeanrpg "How Zelda Gets Lock and Key Right" — show-lock-first·more-than-key·페이싱: https://howtomakeanrpg.com/r/a/zelda-lock-and-key.html

**메트로배니아 / 능력부여·traversal**
- pudgycat "What is a Metroidvania" — "맵=퍼즐, 능력=열쇠, 백트래킹=핵심": https://pudgycat.io/what-is-a-metroidvania-game-genre-explained/
- nintendolife "What Makes a Good Metroidvania" — Hollow Knight 능력 진행 설계담·지역 해금: https://www.nintendolife.com/news/2021/10/soapbox-what-makes-a-game-a-good-metroidvania-anyway
- pcgamer "How to design a great Metroidvania map" — 맵·게이팅·sequence break: https://www.pcgamer.com/how-to-design-a-great-metroidvania-map/
- ResetEra — double jump/dash traversal verb 만족감: https://www.resetera.com/threads/double-jump-and-dash-are-incredibly-satisfying-traversal-mechanics
- cbr "Best Grappling Hooks" — 갈고리 flow 유지·텔레그래프: https://www.cbr.com/video-games-best-grappling-hooks/

**쿨다운 vs 소모품 / 호딩**
- bitsnpixels "Cooldowns vs Consumables" — Too Good to Use·resource anxiety·사용 마찰: https://bitsnpixels.org/p/cooldowns-vs-consumables-game-design-innovation
- Game Developer "Avoiding the Hoarder Trap" — Diablo 3 쿨다운·Estus flask 재충전·공급 풍부화: https://www.gamedeveloper.com/design/avoiding-the-hoarder-trap-in-game-design
- SuperJump "How Hoarding Encourages Bad Game Design" — use-or-lose 논거: https://www.superjumpmagazine.com/how-hoarding-encourages-bad-game-design/
- ResetEra "Solve the consumable hoarding problem" — 호딩 해법 토론: https://www.resetera.com/threads/how-would-you-solve-the-consumable-item-hoarding-problem.1382920/

**가르치기 / Chekhov's gun / 환경 퍼즐**
- Game Developer "Introducing Mechanics" — 안전 공간·점진 도입(Portal): https://www.gamedeveloper.com/design/game-design-introducing-mechanics
- Chekhov's gun(Wikipedia) — 매설→회수 원리: https://en.wikipedia.org/wiki/Chekhov%27s_gun
- Tropedia "Chekhov's Gun" — "items need presence before use": https://tropedia.fandom.com/wiki/Chekhov%27s_Gun
- Medium "Puzzle Design: A Guide" — 레버·환경 상호작용·만능키 경계: https://medium.com/@brdelfino.work/puzzle-design-a-guide-for-game-designers-72251d60a56a
- wayline "Environmental Puzzle Design" — 환경=교사, show don't tell: https://www.wayline.io/blog/sci-fi-environmental-puzzle-design-for-indie-developers

**softlock / unwinnable**
- Super Mario Wiki "Unwinnable state" — 정의·분류: https://www.mariowiki.com/Unwinnable_state
- Amini Allight "The Soft Lock Trap" — softlock 함정·예방: https://amini-allight.org/post/the-soft-lock-trap
- TV Tropes "Unintentionally Unwinnable" — missable 필수템·save 교착: https://tvtropes.org/pmwiki/pmwiki.php/Main/UnintentionallyUnwinnable

> IP 안전: 위 원칙·기법은 저작권 보호 대상이 아닌 *게임디자인 통념*이다. 특정 상용 게임의 고유 레벨·아트·아이템 명칭을 복제하지 않고 기법만 추려 절차생성/오리지널로 재구성한다([`ip-license-guard`](../../../ip-license-guard/SKILL.md) 정합).
