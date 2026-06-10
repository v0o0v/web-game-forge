# 복잡도 · 범위 게이트 — SCOPE-* (원칙 8)

> [`item-architect`](../../SKILL.md)가 **인터뷰 최우선**으로 참조하는 도메인 파일 — "아이템이 필요한가, 얼마나 복잡할까"를 가를 때. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> [principles.md](./principles.md) §1(복잡도 5티어 사다리)·§4(장르 빠른 처방)를 *확장*하는 파일이다. 복잡도 그라데이션·장르 관습 리서치를 작은 웹게임용으로 코드화해, 디폴트 0에서 한 칸씩 정당화하며 올라가는 **게이트**와, 장르 스캐폴드별 핵심 모델·티어 정합·ITEMS.md 섹션 처방을 둔다. 인터뷰 질문 I1과 직결.

## 프레임워크 요약

이 도메인의 북극성은 **"복잡도는 빚이다 — 갚을 재미가 증명될 때만 빌린다"**이다. 디폴트는 아이템 0개(`SCOPE-DEFAULT-ZERO`)이고, [principles.md](./principles.md) §1의 5티어 사다리(T0 무아이템 → T4 인벤토리 경제)를 **한 번에 한 칸씩** 정당화하며 오른다(`SCOPE-LADDER`). 한 게임은 핵심 아이템 모델 하나만 풀로 돌리고(`SCOPE-ONE-CORE`, [principles.md](./principles.md) 캐논 2), 재미는 종류 수(폭)가 아니라 적은 요소의 상호작용(깊이)에서 온다(`SCOPE-DEPTH-NOT-BREADTH`). 카탈로그를 늘리지 않고 실력 스펙트럼을 커버하는 법은 같은 아이템을 초심자엔 단순·숙련자엔 깊게 만드는 lenticular 설계다(`SCOPE-LENTICULAR`). 무엇보다 **장르 스캐폴드가 핵심 모델과 시작 티어를 거의 정한다**(`SCOPE-GENRE-FIT`) — 모바일 웹뷰·1~3분 세션이 사다리 상한을 클램프하고(`SCOPE-PLATFORM-BUDGET`), 진행감은 아이템 없이 점수·해금만으로도 충분할 때가 많다(`SCOPE-PROGRESSION-MIN`).

| 무엇을 먼저 | 코드 | 한 줄 |
| --- | --- | --- |
| 필요성 | `SCOPE-DEFAULT-ZERO` | 디폴트는 0. 추가할 이유를 매번 정당화 |
| 핵심 | `SCOPE-ONE-CORE` | 한 게임 한 핵심 모델 + 표현/메타 0~2층 |
| 상승 | `SCOPE-LADDER` | 한 번에 한 칸, 각 칸 정당화 |
| 깊이 | `SCOPE-DEPTH-NOT-BREADTH` | 폭이 아니라 상호작용 |
| 스펙트럼 | `SCOPE-LENTICULAR` | 적은 아이템, 표면 단순·속은 깊게 |
| 장르 | `SCOPE-GENRE-FIT` | 스캐폴드가 모델·시작 티어를 정함 |
| 상한 | `SCOPE-PLATFORM-BUDGET` | 모바일·짧은 세션이 사다리를 클램프 |
| 대안 | `SCOPE-PROGRESSION-MIN` | 진행감은 아이템 없이도 가능 |

---

## 원칙 사전 (SCOPE-*)

### `SCOPE-DEFAULT-ZERO` 디폴트는 아이템 0개
- **정의:** 아이템 시스템의 출발점은 "없음(T0)"이다. 코인·파워업·인벤토리는 *추가하는 기능*이지 기본값이 아니며, 모든 요소는 "이게 없으면 핵심 루프가 무너지는가?"를 통과해야 채택한다. MVP는 "100% 필수가 아닌 것(에너지·파워업·다중 레벨)을 전부 제거"한 상태에서 시작한다.
- **출처:** Flappy Bird·2048·Tetris는 아이템 0개로 완결(아이템 없이 점수·실력만으로 재미 성립). MVP 게임 디자인 원칙: design1online "The Game Plan: Minimum Viable Product" — http://design1online.com/the-game-plan-minimum-viable-product/ ("보통 에너지 부스터·파워업·다중 레벨을 제거"). vertical-slice 통념(core loop 먼저 검증 후 시스템 확장): tonogameconsultants — https://tonogameconsultants.com/prototyping/ .
- **우리 엔진 구현(작은 웹게임):** 인터뷰 **1번 질문**: "이 게임은 아이템 없이도 재미있나?(점수·실력·클리어만)". Yes면 T0 확정하고 아이템 설계 종료 — ITEMS.md는 최상단 `tier: 0` + "아이템 없음" 한 줄로 사실상 종결(이게 정상이다). `game.js`에 아이템 전역 블록을 아예 만들지 않는 것이 T0의 코드 형태. sprite-forge/vector-graphics는 캐릭터·장애물만 생성. 진행감이 필요하면 `SCOPE-PROGRESSION-MIN`으로.
- **흔한 실패:** "RPG/어드벤처니까 당연히 인벤토리"라는 장르 관성으로 시스템을 먼저 깔기. 재미없는 코어를 아이템 풍성함으로 가리기(아이템은 재미의 증폭기지 생성기가 아님). 캐주얼 게임에 깊은 인벤토리·스탯을 던지기.
- **연관:** `SCOPE-LADDER`, `SCOPE-ONE-CORE`, `SCOPE-PROGRESSION-MIN`, `SCOPE-PLATFORM-BUDGET`

### `SCOPE-ONE-CORE` 한 게임 한 핵심 모델
- **정의:** 작은 게임 하나는 핵심 아이템 모델을 **딱 하나**만 풀로 돌리고, 나머지는 표현층(등급 색·가변 보상)이나 메타층(런간 해금·아이들 곡선)으로만 **0~2개** 얇게 얹는다. 두세 핵심 모델을 한 미니게임에 동시에 욱여넣지 않는다.
- **출처:** 절제가 곧 깊이 — SLYNYRD Pixelblog 32(픽업 절제: 종류마다 뚜렷한 의미 + 함께 작동) — https://www.slynyrd.com/blog/2021/2/15/pixelblog-32-shmup-design-part-2 ; Slay the Spire 통념("작고 집중된 덱이 크고 산만한 덱을 이긴다") — https://infinite-bits.com/slay-the-spire-deckbuilding-strategies-card-synergy-and-game-modes/ . story-architect의 인물 1~4명 상한과 같은 절제 철학.
- **우리 엔진 구현(작은 웹게임):** 인터뷰가 "이 게임의 핵심 아이템 모델 1개는?"을 탑다운 1문1답으로 묻는다(장르가 디폴트를 제안 → `SCOPE-GENRE-FIT`). 선택 후 표현층(`AFX-RARITY-LADDER` [rarity-affixes.md](./rarity-affixes.md), `ECON-VARIABLE-RATIO` [economy-loot.md](./economy-loot.md))·메타층(런간 업그레이드) 중 0~2개만 추가. `game.js`에는 핵심 모델 선언 블록 1개 + 옵션 플래그.
- **흔한 실패:** "RPG 스탯 + 덱빌딩 + 크래프팅 + 아이들"을 한 미니게임에 다 → 학습 불가·UI 폭발·세션 붕괴. 표현층(등급 색)을 핵심 모델로 착각해 정작 아이템이 하는 일이 없음.
- **연관:** `SCOPE-DEFAULT-ZERO`, `SCOPE-GENRE-FIT`, `SCOPE-DEPTH-NOT-BREADTH`, `SCOPE-PLATFORM-BUDGET`

### `SCOPE-LADDER` 복잡도 사다리 한 칸씩 정당화
- **정의:** 복잡도는 한 번에 한 칸만 올린다([principles.md](./principles.md) §1: T0 무아이템 → T1 단일 픽업 → T2 소수 파워업 → T3 빌드 시너지 → T4 인벤토리 경제). 각 칸 상승은 "직전 칸으로는 안 되는 무엇을 핵심 루프에 더하는가"를 한 문장으로 답해야 하고, 답이 약하면 내려간다. level-architect의 LD-ONE-IDEA(레벨당 새 개념 1개)를 아이템 시스템 전체에 적용한 것.
- **출처:** complexity ≠ depth — Mark Rosewater elegance("높은 depth·낮은 complexity"), leolesetre 정리 — https://leolesetre.medium.com/what-makes-a-game-system-elegant-5c73b4e9b50e ; complexity creep("단순 baseline에서 더하는 게 줄이는 것보다 쉽고 즐겁다"): Delta Vector — http://deltavector.blogspot.com/2020/04/game-design-78-complexity-creep.html ; "무게값 못 하는 메카닉은 잘라라": TV Tropes Complexity Creep — https://tvtropes.org/pmwiki/pmwiki.php/Sandbox/ComplexityCreep .
- **우리 엔진 구현(작은 웹게임):** 인터뷰가 사다리를 위로 타며 각 칸에서 게이트 질문을 던진다. **T1→T2:** "코인 하나로 부족한 이유?"(예: 일시 상태 버프가 코어 긴장을 만드나). **T2→T3:** "즉시소비 픽업으로 부족, 런 단위 빌드 시너지가 코어 재미인가?"(로그라이트면 Yes → `SYN-ENABLER-PAYOFF` [synergy-balance.md](./synergy-balance.md)). **T3→T4:** "인벤토리 그리드·등급·상점이 모바일 짧은세션을 깨지 않고 재미를 더하나?"(거의 No). 각 상승 = `game.js`에 새 전역 블록 1개(코인 카운터 → 픽업 enum → 빌드 풀 → 인벤토리 모델 순). 티어가 켜는 ITEMS.md 섹션은 아래 §티어별 ITEMS.md 섹션 처방 표.
- **흔한 실패:** 두 칸 한꺼번에 점프(코인도 없던 게임에 갑자기 등급 장비). "있으면 좋잖아"로 칸 올리기. 복잡도를 depth로 착각(메뉴 많은 게임이 깊은 게임이 아니다).
- **연관:** `SCOPE-DEFAULT-ZERO`, `SCOPE-GENRE-FIT`, `SCOPE-DEPTH-NOT-BREADTH`, `SCOPE-PLATFORM-BUDGET`

### `SCOPE-DEPTH-NOT-BREADTH` 폭보다 깊이
- **정의:** 재미는 아이템 **종류 수(폭)**가 아니라 적은 요소가 만드는 **상호작용·창발(깊이)**에서 온다. 규칙·요소를 늘리기보다 기존 요소 간 연결(시너지)을 늘려 elegance를 높인다. "규칙이 적고 메카닉 간 연결이 많을수록 더 좋은 창발 게임."
- **출처:** Go(극소 규칙·무한 깊이)·Tetris(블록 7종, 무한 상황)·Portal(단일 메카닉의 풍부함). 창발 정의: medium doandaniel — https://medium.com/@doandaniel/gamedev-protips-how-to-design-games-with-emergent-depth-and-complexity-f51fe1f52fc2 ; "규칙 적고 메카닉 링크 많을수록 elegant": leolesetre — https://leolesetre.medium.com/what-makes-a-game-system-elegant-5c73b4e9b50e .
- **우리 엔진 구현(작은 웹게임):** T3 빌드 시스템은 아이템 30종 나열보다 **아이템 8종 × 시너지 조합**으로 깊이를 낸다(`SYN-ENABLER-PAYOFF` [synergy-balance.md](./synergy-balance.md), 재미요소 `FE-BUILD` [fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md)). CC0 제약과 강력 정합: 8종 시너지 = 에셋 8개, 30종 나열 = 에셋 30개(sprite-forge/vector-graphics 호출 수 직결). 적은 아이템에 lenticular depth(`SCOPE-LENTICULAR`)를 심는다.
- **흔한 실패:** "콘텐츠 많아 보이게" 아이템 수만 부풀리기(폭만, 깊이 0 → 곧 reskin). 상호작용 없는 독립 아이템 나열(조합의 재미 상실). 깊이를 '복잡한 스탯 공식'으로 오해(깊이는 플레이어가 발견하는 상호작용이지 숨은 수식이 아님).
- **연관:** `SCOPE-LENTICULAR`, `SCOPE-ONE-CORE`, `SYN-ENABLER-PAYOFF`(→[synergy-balance.md](./synergy-balance.md)), `SCOPE-LADDER`

### `SCOPE-LENTICULAR` 표면은 단순, 속은 깊게
- **정의:** 적은 수의 아이템을 **초심자에겐 단순하게, 숙련자에겐 깊게** 동작하도록 설계한다. 표면 가치는 누구나 즉시 이해하되, 전략적 깊이는 숙련자만 발견하게 숨긴다 — "경험자를 위한 복잡도를 더하되 초심자의 난이도는 올리지 않는다." 적은 카탈로그로 넓은 실력 스펙트럼을 커버하는 핵심 기법.
- **출처:** Mark Rosewater "Lenticular Design"(Magic: The Gathering, 2014) — https://magic.wizards.com/en/news/making-magic/lenticular-design-2014-03-31 ("전략적 복잡도는 초심자에게 보이지 않게 숨겨라", 목표 = "경험자를 위해 복잡도를 더하되 초심자 난이도는 안 올린다"). 복잡도 3종(comprehension/board/strategic): coolstuffinc — https://www.coolstuffinc.com/a/natasha-lewis-harrington-editorial-psychology-03282013-understanding-complexity . Pac-Man 파워펠릿(초심자: 유령 먹기 / 숙련자: 타이밍·루트 최적화)도 lenticular.
- **우리 엔진 구현(작은 웹게임):** 코인 1종도 lenticular로 — 초심자=점수, 숙련자=올코인 루트(level-architect의 마스터리 천장). 파워업은 초심자=안전마진/숙련자=위험경로 보상. 아이템 설명은 **표면 효과만 노출**, 깊은 상호작용은 플레이로 발견(텍스트 예산 절약, 모바일 정합 — 설명 카피는 game-ui-hud 툴팁 한 줄). 적은 아이템 × lenticular = 폭 없이 실력 스펙트럼 확보.
- **흔한 실패:** 깊이를 텍스트로 다 설명해 초심자를 겁주기(comprehension 복잡도 폭증). 숙련자 깊이가 사실은 운/RNG(실력 무의미). 초심자가 lenticular 아이템을 '잘못' 써서 손해보게 만들기.
- **연관:** `SCOPE-DEPTH-NOT-BREADTH`, `SCOPE-ONE-CORE`, `AFX-RARITY-LADDER`(→[rarity-affixes.md](./rarity-affixes.md)), `SCOPE-PROGRESSION-MIN`

### `SCOPE-GENRE-FIT` 장르 스캐폴드가 핵심 모델·시작 티어를 정한다
- **정의:** 장르 스캐폴드가 핵심 아이템 모델과 검증된 디폴트 시작 티어를 거의 정한다. 그 디폴트에서 시작해 필요할 때만 올린다(내릴 때는 자유). 장르가 요구하지 않는 시스템은 기본 배제하고, 장르에 안 맞는 모델(예: 러너에 깊은 장비 트리)을 이식하면 마찰만 생긴다.
- **출처:** 장르마다 아이템이 푸는 문제가 다르다(폭넓은 통념): Wikipedia Roguelike — https://en.wikipedia.org/wiki/Roguelike ; "플랫포머는 필요한 것만 — 전부 넣을 필욘 없다": gamedesignskills — https://gamedesignskills.com/game-design/platformer/ ; "아케이드/퍼즐은 난이도 램프만으로 충분": gamedesignskills game-progression — https://gamedesignskills.com/game-design/game-progression/ .
- **우리 엔진 구현(작은 웹게임):** item-architect가 장르를 받으면 아래 §장르 스캐폴드별 핵심 모델·티어 정합 표로 **디폴트 모델 + 시작 티어를 제안**한 뒤 인터뷰로 미세조정. 스캐폴드별 `game.js` 선언 블록 1개: platformer→`POWERUPS`, topdown-shooter→`PICKUPS`, arcade→`LOOT_POOL`+`EVOLVE`, puzzle→`SPECIALS`, runner→`PICKUPS`+런간 `UPGRADES`. 각 장르 내부의 깊은 처방은 [taxonomy.md](./taxonomy.md)·[utility-consumables.md](./utility-consumables.md)·[synergy-balance.md](./synergy-balance.md)가 담당, 여기선 '어느 모델로 어느 티어에서 시작'만.
- **흔한 실패:** 장르 디폴트를 무시하고 모든 게임에 같은 풀 시스템(템플릿 과설계). 반대로 장르가 명백히 요구하는 코어 아이템을 빼기(로그라이트인데 빌드 없음 → `FE-BUILD` 코어 상실). 장르 라벨에 갇혀 'RPG=무조건 인벤토리' 관성(`SCOPE-DEFAULT-ZERO`로 재검).
- **연관:** `SCOPE-ONE-CORE`, `SCOPE-LADDER`, `SCOPE-PLATFORM-BUDGET`, `CAT-VERB-AXIS`(→[taxonomy.md](./taxonomy.md))

### `SCOPE-PLATFORM-BUDGET` 플랫폼·세션이 사다리를 클램프
- **정의:** 아이템 시스템 복잡도 상한은 **대상 플레이어·세션 길이·플랫폼**에 종속된다. 모바일 웹뷰·짧은 세션(1~3분)·작은 화면·엄지 조작이 아이템 분량·티어·인벤토리 UX의 **하드 상한**이다. 학습곡선이 대상을 넘으면 복잡도는 진입장벽이 된다.
- **출처:** "casual games shouldn't feature complex inventory systems": gamingdebugged — https://www.gamingdebugged.com/2013/01/12/the-over-scoping-game-designer-the-attack-of-the-feature-creep/ ; 하이퍼캐주얼("수초 내 시작, 미니멀, 30초~3분 세션, 튜토리얼 불요"): adjust — https://www.adjust.com/blog/how-to-make-a-hyper-casual-game-successful/ ; 인벤토리=마찰: Game Developer "Does Inventory Management Ruin RPGs?" — https://www.gamedeveloper.com/design/does-inventory-management-ruin-rpgs- .
- **우리 엔진 구현(작은 웹게임):** 우리 플랫폼이 **이미 캐주얼 끝단**이므로 디폴트가 T0~T2여야 정합. 인터뷰가 "대상이 누구? 한 세션 몇 분? 데스크탑/모바일?"을 물어 사다리 상한을 클램프 — **모바일 + 1분이면 T3 상한, T4 금지**(예외만, 이땐 인벤토리 UX를 [visual-inventory-ux.md](./visual-inventory-ux.md)의 `UX-THUMB-ZONE`·`UX-INV-MINIMAL` 제약으로 강하게 묶음). 인벤토리 화면 대신 픽업=즉시효과, T3 빌드 선택은 풀스크린 인벤토리 대신 레벨업 3택 카드(game-ui-hud). 카운터는 1~2개가 모바일 HUD 상한.
- **흔한 실패:** 데스크탑 코어게이머용 시스템을 모바일 캐주얼에 이식. 짧은 세션에 긴 인벤토리 관리를 끼워 세션당 실플레이 시간을 깎기. "하드코어도 즐기게" 복잡도를 올려 캐주얼 대상 이탈(이건 `SCOPE-LENTICULAR`로 풀어야지 복잡도로 풀면 실패).
- **연관:** `SCOPE-LADDER`, `SCOPE-GENRE-FIT`, `SCOPE-PROGRESSION-MIN`, `UX-INV-MINIMAL`(→[visual-inventory-ux.md](./visual-inventory-ux.md))

### `SCOPE-PROGRESSION-MIN` 최소 진행감 (아이템 없이도)
- **정의:** "진행감"과 "아이템 시스템"을 분리한다. 많은 게임은 아이템 없이 **점수·실력·해금·별점**만으로 충분한 progression을 준다. 아이템은 progression의 여러 수단 중 하나일 뿐, 필수가 아니다. 가장 단순한 진행(실력/점수)으로 충분한지 먼저 본다.
- **출처:** progression 분류(skill-based·XP·item-based·narrative·economic·unlock 등 다수, item-based는 그중 하나): University XP — https://www.universityxp.com/blog/2024/1/16/what-are-progression-systems-in-games ; "퍼즐·플랫포머·아케이드에선 새 도전·난이도 램프만으로 충분, 구현도 더 단순": gamedesignskills game-progression — https://gamedesignskills.com/game-design/game-progression/ ; Stack=실력 진행만(아이템 0): Game Developer hyper-casual — https://www.gamedeveloper.com/design/admiring-the-game-design-in-hyper-casual-games .
- **우리 엔진 구현(작은 웹게임):** T0~T1 게임도 localStorage에 `best`(최고점)·`stars`·`unlockedLevels`만으로 진행감 완성(`UX-LOCAL-SAVE` [principles.md](./principles.md) §0). item-architect는 "원하는 progression이 아이템 없이 점수/해금으로 되는가?"를 물어 티어를 낮춘다 — 되면 `SCOPE-DEFAULT-ZERO`로 종결. 진행 위상·난이도 곡선(level-architect)이 아이템 없는 progression의 본체. 진행 가시화(별·기록 갱신)는 juice-fx·chip-sound가 피드백.
- **흔한 실패:** progression=아이템이라 단정해 불필요한 경제를 깔기. 점수/실력만으로 충분한 게임에 XP·레벨·장비를 억지로 붙이기(과설계). 진행 가시화(별·기록)를 빼먹고 아이템만 넣어 '성장 인지'를 놓치기.
- **연관:** `SCOPE-DEFAULT-ZERO`, `SCOPE-PLATFORM-BUDGET`, `SCOPE-LENTICULAR`, `ECON-CURVE`(→[economy-loot.md](./economy-loot.md))

---

## 장르 스캐폴드별 핵심 모델 · 티어 정합 표

WebGameForge 5개 스캐폴드(**platformer · topdown-shooter · arcade · puzzle · runner**)별 디폴트 핵심 모델·시작 티어·켜는 ITEMS.md 섹션. RPG·로그라이트·메트로배니아·크래프팅·덱빌더·아이들은 "순수 장르"가 아니라 이 5개 스캐폴드 위에 얹는 **모델 레이어**로 본다(`SCOPE-GENRE-FIT`). 인터뷰 I1에서 이 표로 디폴트를 제안한다.

| 스캐폴드 | 지배 질문 | 핵심 모델 | 기본 티어 | 표현/메타층 | 켜는 ITEMS.md 섹션 |
| --- | --- | --- | --- | --- | --- |
| **platformer** | "이 상태를 얼마나 유지할까" | **상태 파워업**(크기·무적·새 동사, 피격 시 한 단계 강등) | **T2**(능력 게이트 있으면 T3) | 코인 통화 + 능력 키(미니 메트로배니아) | §파워업/상태, +게이트 시 §능력 키 |
| **topdown-shooter** | "지금 줍느냐 피하느냐 + 빌드" | **누적 픽업 + 빌드**(무기 레벨·패시브, 피격 시 1단 강등) | **T3** | 등급·진화·세트 | §픽업, §빌드 시너지, §등급 |
| **arcade** | "이 순간을 어떻게 넘길까 / 빌드 완성?" | **순간 부스트/파워업**(일시 능력), 불릿헤븐류면 **빌드 시너지** | **T1~T2**(불릿헤븐은 T3) | 점수 배율 | §파워업/상태 (T3면 +§빌드 시너지) |
| **puzzle** | "어디서·언제 터뜨릴까" | **보드 부스터**(매치 생성 특수조각 + 제한 사용 부스터, 만능키 금지) | **T2** | 별·통화로 부스터 해금(메타) | §소모품/부스터 |
| **runner** | "지금 줍느냐 / 메타로 키우나" | **순간 픽업**(자석·실드·점프부스트) + 코인 | **T2~T3** | 런간 업그레이드 상점(메타) | §픽업, +메타 시 §통화·런간 업그레이드 |

세부 모델 근거: platformer 상태 파워업 = Super Mario(Super Mushroom=추가 1히트, Fire Flower=공격 모드, 외형 색으로 우위 신호) — https://www.mariowiki.com/Fire_Flower . topdown-shooter 누적 픽업 = SLYNYRD 표준 6종(무기 파워업 최대 5레벨·속도 3티어·봄 최대 3·1UP·체력·실드, 피격 시 1단 강등 관습) — https://www.slynyrd.com/blog/2021/2/15/pixelblog-32-shmup-design-part-2 . arcade/불릿헤븐 빌드 = Vampire Survivors(레벨업 3택 + Lv8 무기 + passive 보유 시 진화) — https://vampire.survivors.wiki/w/Evolution . puzzle 부스터 = Candy Crush(4+ 매치로 특수 캔디, 특수끼리 조합 시 효과 결합 — 단 **무과금 전제라 페이월 차용 금지**, 부스터는 실력 보상/메타 해금으로) — https://www.bluestacks.com/blog/game-guides/candy-crush/ccs-booster-guide-en.html . runner 픽업+메타 = 순간 픽업 + 런간 영구 업그레이드(지수 비용 곡선) — https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i .

> 갈등·전투가 약한 게임이면 아이템도 가볍게 — 표현(코스메틱·수집 로어)이 주가 될 수 있다(`CAT-COSMETIC-FREE` [taxonomy.md](./taxonomy.md)). 진행감만 필요하면 T0 + 점수/해금으로 충분(`SCOPE-PROGRESSION-MIN`) — T0을 부끄러워하지 않는다.

---

## 티어별 ITEMS.md 섹션 처방 (사다리 → 무엇을 켜나)

`SCOPE-LADDER`로 확정된 티어가 곧 ITEMS.md/items.json에서 켜는 섹션과 다른 스킬 핸드오프 규모를 정한다([principles.md](./principles.md) §1의 "티어→읽을 파일"을 실행 처방으로 구체화).

| 티어 | ITEMS.md 켜는 섹션 | items.json 형태 | game-ui-hud 요구 | 에셋(이미지 스킬) | 추가로 읽을 도메인 파일 |
| --- | --- | --- | --- | --- | --- |
| **T0** | (없음) `tier: 0` + 한 줄 | 없음 | 점수 HUD만 | 0개(캐릭터·장애물만) | 이 파일만 |
| **T1** | §0 메타 + §픽업(1종) | `coins:int` 또는 단일 픽업 enum 1 | 카운터 1개 | 1개 | + [taxonomy.md](./taxonomy.md) |
| **T2** | §0·§픽업/파워업·§비주얼 슬롯 | 픽업 enum 2~5 + 타이머 | 카운터 + 아이콘 슬롯 | 2~5개 | + [utility-consumables.md](./utility-consumables.md)·[visual-inventory-ux.md](./visual-inventory-ux.md) |
| **T3** | §0~빌드·시너지·등급·드랍 | `LOOT_POOL`+`EVOLVE`+`DROP_TABLE` | 레벨업 3택 카드(인벤토리 아님) | 6~12개 | + [synergy-balance.md](./synergy-balance.md)·[economy-loot.md](./economy-loot.md) |
| **T4**(예외) | 전 섹션(장비·통화·등급·접사·제작·상점) | 인벤토리 모델 + 접사 풀 | 그리드(THUMB-ZONE 강제) | 12+개 | + [rarity-affixes.md](./rarity-affixes.md) 전부 |

핸드오프 요약: 결정된 티어·카탈로그 크기 = sprite-forge/vector-graphics/sprite-picker **에셋 생성 수의 상한**(아이템 1종 컷 = 이미지 스킬 호출 1회 절감). diegetic 즉시픽업이 디폴트이므로(인벤토리 회피) 피드백은 juice-fx(획득 연출)·chip-sound(획득 SFX)가 담당 — 인벤토리를 안 만든 만큼 연출에 투자. 톤·flavor는 [`story-architect`](../../../wgf-story-architect/SKILL.md) STORY.md를 상속.

---

## 출처

복잡도 그라데이션:
- design1online "The Game Plan: Minimum Viable Product" — http://design1online.com/the-game-plan-minimum-viable-product/ (MVP=핵심만, 파워업/다중레벨 제거 → `SCOPE-DEFAULT-ZERO`)
- ppmgames "Minimum Viable Product Game Design" — https://www.ppmgames.co.uk/2020/05/01/minimum-viable-product-game-design/
- leolesetre "What makes a game system elegant?" — https://leolesetre.medium.com/what-makes-a-game-system-elegant-5c73b4e9b50e (elegance=depth÷complexity, Koster·Moon → `SCOPE-LADDER`·`SCOPE-DEPTH-NOT-BREADTH`)
- Mark Rosewater "Lenticular Design" — https://magic.wizards.com/en/news/making-magic/lenticular-design-2014-03-31 (lenticular 6규칙 → `SCOPE-LENTICULAR`)
- coolstuffinc "Understanding Complexity" — https://www.coolstuffinc.com/a/natasha-lewis-harrington-editorial-psychology-03282013-understanding-complexity (comprehension/board/strategic 복잡도)
- Delta Vector "Complexity Creep, Reference vs Baseline Games" — http://deltavector.blogspot.com/2020/04/game-design-78-complexity-creep.html (단순 baseline에서 더하기)
- TV Tropes "Complexity Creep" — https://tvtropes.org/pmwiki/pmwiki.php/Sandbox/ComplexityCreep (제 무게값 못 하는 메카닉 컷)
- medium doandaniel "Emergent Depth And Complexity" — https://medium.com/@doandaniel/gamedev-protips-how-to-design-games-with-emergent-depth-and-complexity-f51fe1f52fc2 (창발=적은 요소 상호작용)
- Game Developer "Feature Fatigue" — https://www.gamedeveloper.com/design/feature-fatigue-control-it-embrace-it (무게값·kill your darlings·casual=no복잡인벤)
- gamingdebugged "The Over-scoping Game Designer" — https://www.gamingdebugged.com/2013/01/12/the-over-scoping-game-designer-the-attack-of-the-feature-creep/ (캐주얼=깊은 인벤토리 금지 → `SCOPE-PLATFORM-BUDGET`)
- Game Developer "Admiring the Game Design in Hyper-Casual Games" — https://www.gamedeveloper.com/design/admiring-the-game-design-in-hyper-casual-games (단일 메카닉, Stack=업그레이드 없는 진행)
- Game Developer "Does Inventory Management Ruin RPGs?" — https://www.gamedeveloper.com/design/does-inventory-management-ruin-rpgs- (인벤토리=마찰, 슈터식 제한 처방)
- gamedesignskills "Platformer Game Design" — https://gamedesignskills.com/game-design/platformer/ (필요한 것만)
- gamedesignskills "Game Progression and Progression Systems" — https://gamedesignskills.com/game-design/game-progression/ (아케이드/퍼즐=난이도 램프만으로 충분 → `SCOPE-PROGRESSION-MIN`)
- University XP "What are Progression Systems in Games?" — https://www.universityxp.com/blog/2024/1/16/what-are-progression-systems-in-games (progression 타입 분류, item-based는 그중 하나)
- adjust "The ultimate guide to hyper casual games" — https://www.adjust.com/blog/how-to-make-a-hyper-casual-game-successful/ (미니멀·짧은 세션 → `SCOPE-PLATFORM-BUDGET`)
- tonogameconsultants "What Is a Game Prototype?" — https://tonogameconsultants.com/prototyping/ (core loop 먼저 검증)

장르 관습(장르 정합 표 근거):
- Wikipedia "Roguelike" — https://en.wikipedia.org/wiki/Roguelike (장르마다 아이템 모델 다름)
- Super Mario Wiki "Fire Flower" — https://www.mariowiki.com/Fire_Flower (platformer 상태 파워업)
- SLYNYRD "Pixelblog 32 Shmup Design Part 2" — https://www.slynyrd.com/blog/2021/2/15/pixelblog-32-shmup-design-part-2 (shooter 누적 픽업 표준 6종)
- Vampire Survivors Wiki "Evolution" — https://vampire.survivors.wiki/w/Evolution (arcade/불릿헤븐 빌드 시너지·진화)
- BlueStacks "Candy Crush Boosters and Special Candies" — https://www.bluestacks.com/blog/game-guides/candy-crush/ccs-booster-guide-en.html (puzzle 보드 부스터)
- Game Developer "The Math of Idle Games, Part I" — https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i (runner 메타 지수 비용 곡선)
