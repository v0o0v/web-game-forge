# 아이템 정체성·플레이버·서사 통합 — IDENT (15 원칙)

> [`item-architect`](../../SKILL.md)가 아이템의 **이름·flavor·테마·서사 정합**을 설계할 때 참조하는 도메인 파일. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 아이템 하나하나를 "미니 캐릭터"(이름+실루엣+flavor+동사 4요소)로 보는 정체성 설계와, 그 정체성을 **STORY.md 서사·장르·플랫폼에 종속시키는** 서사 통합을 한데 코드화한다. Zelda/Metroidvania의 "동사 아이템", FromSoftware의 아이템 설명=lore 1차 매체, 환경 서사(배치=텍스트0 이야기), bouba/kiki 사운드 심볼리즘 같은 검증된 통념을 작은 2D 웹게임 제약(짧은 세션·작은 화면·절차생성·CC0)으로 농축했다.

## 프레임워크 요약

아이템 정체성은 **숫자(+5 ATK)가 아니라 의미**에서 온다. 강한 아이템 = 고유 **이름** + **실루엣/아이콘** + **flavor 한 줄** + **동사/이펙트**, 이 4요소가 한 판타지를 가리킬 때 "미니 캐릭터"가 된다(`IDENT-MICRO-CHARACTER`). 하나라도 빠지면 등급만 다른 색칠이다.

그런데 정체성은 **자율적이지 않다.** 사용자 강조 명제: *아이템 시스템은 게임의 서사·장르·타겟 플랫폼 전반을 보고 결정한다.* 그래서 이 도메인은 두 축이 직교한다 — (1) **정체성 축**(아이템을 기억에 남게: VERB·MICRO-CHARACTER·NAME·FLAVOR·THEME·POWER-FANTASY), (2) **서사 종속 축**(정체성을 STORY.md·장르·플랫폼에 묶기: LUDO-HARMONY·DUAL-PURPOSE·ICEBERG·PLACEMENT-AS-STORY·EARNED-FLAVOR·MIRROR-PROGRESS·CONSTRAINED-CATALOG·MEANINGFUL-COLLECT·CONSISTENT-VOICE·OPTIONAL-LAYER).

핵심 규율 3가지(모바일·짧은 세션 폼팩터):
- **flavor는 ≤1문장(≤60자)이고 effect와 분리한다**(`IDENT-FLAVOR-INTANGIBLE`). 효과는 정확·1순위, flavor는 환기·2순위. lore wall은 우리 폼팩터에서 죽은 텍스트.
- **톤·고유명사는 발명하지 않고 [`story-architect`](../../../wgf-story-architect/SKILL.md)의 STORY.md에서 상속한다**(`IDENT-CONSISTENT-VOICE`). 아이템 바이블이 서사를 재발명하지 않는다(principles.md 공통 캐논 §0).
- **수보다 농도** — 손으로 정체성 부여한 소수(signature) + 절차 양산(procedural)의 2층 구조(`IDENT-CONSTRAINED-CATALOG`). "수의 역설"(많을수록 안 기억).

| 정체성 4요소 | 우리 엔진 슬롯 | 자매 스킬 |
| --- | --- | --- |
| 이름(name) | `name`(STORY.md voice 파생) | story-architect |
| 실루엣/아이콘 | `visual.silhouette` 외 `visual.*` 슬롯 | sprite-forge / vector-graphics / sprite-picker |
| flavor 한 줄 | `flavor`(≤60자, effect와 분리) | story-architect(톤·Glossary) / game-ui-hud(2층 툴팁) |
| 동사/이펙트 | `grantsVerb` + 연출 | juice-fx / chip-sound |

---

## 원칙 사전 (IDENT)

### `IDENT-VERB-OVER-STAT` 스탯보다 동사
- **정의:** 가장 기억에 남는 아이템은 새 스탯이 아니라 새 **동사**(할 수 있는 행동)를 준다. "더 세게"가 아니라 "다르게 플레이하게" — 같은 방을 다시 보게 만드는 아이템이 정체성을 얻는다.
- **출처:** Zelda/Metroidvania 디자인 철학(갈고리·폭탄·더블점프가 모든 방을 재해석하게 함), Verbs in Game Design — https://www.offthebeatentrack.games/verbs-in-game-design/ . Binding of Isaac(아이템 조합이 run을 통째로 변형).
- **우리 엔진 구현(작은 웹게임):** 동사는 가벼운 것으로 충분 — 대시, 이중점프, 적 슬로우, 투사체 관통, 자원→공격 전환. 아이템 정의에 `grantsVerb: "dash"` 필드를 두고, 스탯 전용 아이템과 동사 아이템을 의도적으로 분리해 비율 관리(동사 아이템은 희소·기억 포인트). principles.md 캐논 4(`IDENT-LUDO-HARMONY`)의 "점프 게임 최고 아이템은 +5 방어가 아니라 더블점프" 근거. 재미요소 `FE-BUILD`와 직결([fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md)). 동사 발동 연출은 juice-fx, SFX는 chip-sound.
- **흔한 실패:** 모든 아이템이 +N 스탯 변종("+5 검 / +10 검")뿐인 카탈로그 — 숫자만 비교하고 아무것도 기억 못 함. 동사 0개 게임.
- **연관:** `IDENT-MICRO-CHARACTER`, `IDENT-LUDO-HARMONY`, `IDENT-DUAL-PURPOSE`

### `IDENT-MICRO-CHARACTER` 아이템은 미니 캐릭터
- **정의:** 강한 정체성 아이템은 고유한 **이름·실루엣·flavor·동사** 4요소를 가져 작은 캐릭터처럼 느껴진다. distinctiveness(다른 것과 안 헷갈림)와 silhouette test를 캐릭터 디자인에서 그대로 차용한다.
- **출처:** Out of Character: how to design good game characters — https://www.gamedeveloper.com/design/out-of-character-how-to-design-good-game-characters . Hades boons(신마다 부메·색·SFX·대사가 성격을 반영: Zeus 노란 번개, Poseidon 파란 파도), Diablo unique items("fixed, powerful identity"). How Hades Creates Compelling Characters — https://www.cbr.com/hades-character-design-compelling-supergiant/
- **우리 엔진 구현(작은 웹게임):** "히어로 아이템" 소수(5~15개)에 4요소 풀세트를 부여 — 고유 `name` + 한 줄 `flavor` + 전용 아이콘(`visual.silhouette`을 sprite-forge/vector-graphics에 핸드오프) + 고유 `grantsVerb`/이펙트(juice-fx). 신/세력 테마면 부메 색·SFX(chip-sound)도 정체성 신호로. 나머지는 절차 양산(`IDENT-CONSTRAINED-CATALOG`).
- **흔한 실패:** "legendary"인데 시각·이름·이펙트가 common과 색만 다르고 똑같음. 정체성 없는 등급 인플레이션.
- **연관:** `IDENT-CONSTRAINED-CATALOG`, `IDENT-NAME-EVOCATIVE`, `IDENT-VERB-OVER-STAT`, `IDENT-THEME-FAMILY`

### `IDENT-NAME-EVOCATIVE` 이름 = 환기형 수식어 + 타입
- **정의:** 검증된 네이밍 패턴은 "최소 한 개의 인지 가능하고 환기적인 수식어 + 아이템 타입"(Vorpal Blade, Frostmourne 식). 이름이 식별을 넘어 이야기·감정·기억을 만든다.
- **출처:** Writing Flavour Text — https://www.edmcrae.com/article/writing-flavour-text-for-items-in-your-game , Naming All The Stuff — https://greatgamedesign.blog/2017/01/03/naming-all-the-stuff/ . 사운드 심볼리즘: bouba/kiki는 문화·문자 체계를 넘는 보편 효과(/b m l u o/=둥글·부드러움, /k t i e/=날카로움) — The bouba/kiki effect is robust across cultures — https://royalsocietypublishing.org/doi/10.1098/rstb.2020.0390 ; Resolving the bouba-kiki effect — https://www.nature.com/articles/s41598-022-23623-w
- **우리 엔진 구현(작은 웹게임):** 절차 네이밍 풀의 단어를 음향·의미 태그로 분류해 아이템 성격과 매칭 — 날카로운 무기엔 kiki계 음, 둔기/방어엔 bouba계. 데이터 형태: `{ prefixes: {sharp: [...], heavy: [...]}, types: [...] }`로 분기 조합. 한국어 게임이면 환기적 한자어/순우리말 조합. 이름은 반드시 STORY.md voice에서 파생(`IDENT-CONSISTENT-VOICE`). CC0/IP-safe: Frostmourne·Vorpal은 패턴 예시일 뿐, 직접 차용 금지 — 패턴만 빌려 고유 풀 생성.
- **흔한 실패:** 순수 무작위 음절 garble("Xq'thlurn Gaxx") 또는 무미건조한 "Sword Lv.3". 환기력 0.
- **연관:** `IDENT-MICRO-CHARACTER`, `IDENT-THEME-FAMILY`, `IDENT-CONSISTENT-VOICE`

### `IDENT-DUAL-PURPOSE` 한 아이템 텍스트가 기능과 서사를 동시에
- **정의:** 아이템 설명문은 "무엇을 하는가"(스탯)와 "어디서 왔는가"(유래/lore)를 *한 덩어리*로 전달한다. 플레이어가 어차피 보는 화면(인벤토리·획득 팝업·툴팁)에 서사를 실어 별도 노출 레이어를 만들지 않는다.
- **출처:** Dark Souls — "타락한 기사가 한때 휘둘렀던 은빛 방패" 한 줄이 마법 방어 스탯과 같은 텍스트에 담긴다. Narrative Design in Dark Souls — https://www.gamedeveloper.com/design/narrative-design-in-dark-souls . 학술: 아이템은 NPC보다 informative하며 그 역사가 정황 단서 — Narration of Things — https://www.firstpersonscholar.com/narration-of-things/
- **우리 엔진 구현(작은 웹게임):** 데이터 스키마에 `effect`(기능, 정확·간결)와 `flavor`(서사, ≤1문장 환기)를 **분리 필드**로 둔다. game-ui-hud 툴팁이 둘을 한 카드로 렌더하되 효과 먼저·flavor 아래(이탤릭/연한 색). `flavor`는 STORY.md voice/톤에서 파생. 모바일 폭 고려 `flavor` ≤1문장(≤60자).
- **흔한 실패:** 기능 텍스트와 서사 텍스트를 분리된 별도 화면(코덱스·로어북)으로 떼어놓아 플레이어가 일부러 찾아가게 만드는 것 — 짧은 세션엔 아무도 안 간다. 또는 효과를 flavor에 숨겨 뭘 하는지 모름.
- **연관:** `IDENT-FLAVOR-INTANGIBLE`, `IDENT-OPTIONAL-LAYER`, `IDENT-ICEBERG`

### `IDENT-FLAVOR-INTANGIBLE` 플레이버는 못 보는 것을 말한다(≤1문장·effect와 분리)
- **정의:** flavor 텍스트는 아이콘/스탯이 못 전하는 것 — 감각(온도·냄새·무게감)·감정·분위기 — 을 담당한다. 기술 설명(`effect`, 정확)과 flavor(환기)는 역할이 다르므로 섞지 않되 층으로 쌓는다. 모바일 폭에서 **딱 한 줄(≤60자)**.
- **출처:** Lore and Flavor — https://medium.com/@shushpo_22090/lore-and-flavor-how-i-write-descriptions-for-items-4b9378c0fa0b (Technical/Lore/Flavor 3계층, flavor=sensory·intangible). PC Gamer — The art of flavour text — https://www.pcgamer.com/the-art-of-flavour-text/
- **우리 엔진 구현(작은 웹게임):** 아이템 데이터에 `effectText`(정확·간결)와 `flavorText`(1문장 환기) 분리. 툴팁은 효과 먼저, flavor는 아래 이탤릭/연한 색(game-ui-hud). 길이 가드: `flavorText.length <= 60`을 린트로 점검(consistency-tools.md `lint-items.mjs`). 한국어 조사 주의 — flavor 문자열은 문장 단위로 보존하고 `'{name}를'` 식 변수 조립은 피한다.
- **흔한 실패:** 모든 아이템에 장황한 3~4문장 lore wall(모바일·짧은 세션에서 안 읽힘). 또는 effect를 flavor 안에 숨김.
- **연관:** `IDENT-DUAL-PURPOSE`, `IDENT-ICEBERG`, `IDENT-OPTIONAL-LAYER`, `IDENT-CONSISTENT-VOICE`

### `IDENT-ICEBERG` 빙산의 일각만 노출, 깊이는 암시
- **정의:** 세계의 lore 중 *극히 일부*만 아이템에 노출하고 나머지는 암시한다. 작은 디테일을 정확히 맞춰 "나머지도 다 있겠구나"라는 신뢰를 만들고, 답하지 않는 질문을 남긴다(고고학적 서사). 같은 세력/지역 아이템들의 flavor에 공유 고유명사·사건을 반복 심으면 조각들이 모여 큰 세계를 암시한다.
- **출처:** Hemingway 빙산 이론의 worldbuilding 적용 — Tip of the Iceberg — https://pandaqi.com/tutorials/writing/creative-writing/worldbuilding/tip-of-the-iceberg/ ; Worldbuilding with the Iceberg Method — https://andreacerasoni.com/blog/iceberg-method . Elden Ring/FromSoftware(아이템 설명이 lore의 1차 매체, 파편→큰 진실) — How Elden Ring Masters Environmental Storytelling — https://www.cbr.com/elden-ring-environmental-storytelling-fromsoftware/
- **우리 엔진 구현(작은 웹게임):** STORY.md에 "수면 아래" 세계관 메모를 두되(story-architect §8 Glossary), 아이템 `flavor`에는 그 일각만 흘린다(인명·지명·사건 단편). 같은 `family`/`faction` 아이템들이 3~5개 공유 키워드를 반복해 세계를 쌓는다(예: "벨라크의 함락 때 녹았다", "벨라크 수도사들의 마지막 유물"). 짧은 세션이므로 키워드 3~5개면 충분.
- **흔한 실패:** lore dump — 아이템 설명에 세계사를 통째로 쏟기. 또는 각 flavor가 서로 무관한 일회성 농담만이라 세계가 안 쌓임.
- **연관:** `IDENT-FLAVOR-INTANGIBLE`, `IDENT-CONSISTENT-VOICE`, `IDENT-THEME-FAMILY`, `IDENT-EARNED-FLAVOR`

### `IDENT-THEME-FAMILY` 테마 패밀리 일관성
- **정의:** 아이템은 문화/세력/속성 패밀리로 묶이고, 이름·flavor·아이콘·색·효과·희소도가 한 무드를 향해 정렬된다. 어긋나는 아이템 하나가 세계의 일관성을 깬다. 일관성은 몰입과 동시에 학습성을 준다(추측 가능 → 예측 가능).
- **출처:** Thematic Consistency 패턴 — https://mahtgiciangames.com/blogs/the-creative-workshop-game-design-blueprints/creating-thematic-consistency-in-game-elements (매끈한 학습 곡선). Why theme driven design — https://www.gamedeveloper.com/design/why-you-and-your-game-will-benefit-from-theme-driven-design . Bloodborne 톱칼이 고딕 무드 강화 — https://www.champlain.edu/blog/stories/common-game-art-styles/
- **우리 엔진 구현(작은 웹게임):** 아이템 정의에 `family`/`faction` 태그. 절차생성 시 패밀리별 단어 풀·`visual.palette`·아이콘 모티프(sprite-forge 픽셀/vector-graphics 벡터)를 분기. 예: "서리 일족"은 청백 팔레트 + 각진 결정 모티프 + 차가운 음향 단어(`IDENT-NAME-EVOCATIVE`) + chip-sound 맑은 톤. 색 팔레트는 STORY.md의 색=감정 매핑을 공유. principles.md 안티패턴 "ludonarrative 불협"의 가드.
- **흔한 실패:** 한 게임에 SF 레이저총·중세 검·이모지 아이템이 톤 없이 뒤섞임. 패밀리 식별 불가. 명명 컨벤션이 아이템마다 제각각.
- **연관:** `IDENT-LUDO-HARMONY`, `IDENT-NAME-EVOCATIVE`, `IDENT-ICEBERG`, `IDENT-CONSISTENT-VOICE`

### `IDENT-LUDO-HARMONY` 효과가 코어 동사·주제와 같은 말을
- **정의:** 아이템의 *기계적 효과·이름·외형·희소성*이 게임의 코어 동사·주제와 같은 메시지를 내야 한다. 효과가 주제를 배신하면 ludonarrative dissonance — 몰입이 깨진다. principles.md 공통 캐논 4의 정식 정의처다.
- **출처:** Clint Hocking이 BioShock에서 명명(메커닉은 이기적 행동 보상, 서사는 비난 → 충돌). Ludonarrative dissonance — https://en.wikipedia.org/wiki/Ludonarrative_dissonance . 조화 사례: Papers, Please의 시간압박 서류검사가 주제(관료적 억압)를 그대로 재현(동 출처).
- **우리 엔진 구현(작은 웹게임):** 인터뷰 0단계에서 STORY.md 코어 동사를 읽고, 아이템 효과를 그 동사를 *증폭*하는 방향으로 설계. 예: '연결'이 주제면 아이템은 체인/콤보를 강화하고 파괴 보상은 안 준다. 점프 게임 최고 아이템은 +5 방어가 아니라 더블점프(`IDENT-VERB-OVER-STAT`). 효과 풀을 테마 검수 없이 밸런스만 보고 채우지 않는다.
- **흔한 실패:** 평화 주제 게임에 학살 보너스 아이템, 또는 STORY.md 톤과 어긋나는 아이템 결. principles.md 안티패턴 "ludonarrative 불협" 직격.
- **연관:** `IDENT-VERB-OVER-STAT`, `IDENT-THEME-FAMILY`, `IDENT-DUAL-PURPOSE`

### `IDENT-PLACEMENT-AS-STORY` 아이템 배치가 텍스트0의 환경 서사
- **정의:** 어떤 아이템을 *어디에·무엇과 함께* 두는가가 이야기다. 사건의 결과(tableau)를 배치로 보여주고 원인은 플레이어가 추리하게 한다. 단어 없이도 서사 채널을 채운다.
- **출처:** Harvey Smith·Matthias Worch, GDC "What Happened Here? Environmental Storytelling" — https://gdcvault.com/play/1012647/What-Happened-Here-Environmental ; Environmental Storytelling — https://www.gamedeveloper.com/design/environmental-storytelling (시체 위의 마법 활 = 비극적 정황).
- **우리 엔진 구현(작은 웹게임):** 절차생성 레벨에서 아이템 스폰을 *의미 배치 규칙*으로 제어. 예: 부서진 소품 옆 회복템(누군가 여기서 버텼다), 같은 아이템 군집(집착의 흔적). 스폰 규칙 훅을 [level-architect](../../../wgf-level-architect/SKILL.md)(난이도 곡선)와 좌표 공유. 소품 스프라이트는 sprite-forge/vector-graphics 생성 또는 sprite-picker CC0 선택.
- **흔한 실패:** 아이템을 순수 랜덤·균일 스폰으로 흩뿌려 배치 의미가 0이 되는 것("doodad를 흩뿌리는 것만으론 의미 없다" — Game Wisdom https://game-wisdom.com/critical/collectible-design-videogames ).
- **연관:** `IDENT-EARNED-FLAVOR`, `IDENT-ICEBERG`, `IDENT-MEANINGFUL-COLLECT`

### `IDENT-EARNED-FLAVOR` 발견 노력에 비례한 서사 보상
- **정의:** 위치·조합·희소성으로 얻기 어려운 아이템일수록 더 묵직한 서사 조각을 준다. 발견 행위 자체가 서사적 사건이 되게(NPC 언급 → 숲 속 시체의 활 = 달콤한 루트이자 비극). 희소도 사다리와 flavor 깊이를 연동한다.
- **출처:** Dark Souls — 아이템이 *어디서* 발견되는가가 lore이며 NPC 단서와 결합해 정황 서사 생성 — https://www.gamedeveloper.com/design/narrative-design-in-dark-souls . 창발 서사 = 시스템과 플레이어 상호작용에서 발생 — The Roguelike Renaissance — https://gamedesigning.org/gaming/roguelike/
- **우리 엔진 구현(작은 웹게임):** 희소도(`rarity`)와 `flavor` 무게를 연동 — 흔함=무명, 희귀=고유 인물/사건 단편. 배치 규칙(`IDENT-PLACEMENT-AS-STORY`)과 결합해 "왜 여기 있나"가 읽히게. 희소 획득은 juice-fx로 연출 차등. 희소도 시각 다채널은 [rarity-affixes.md](./rarity-affixes.md)의 `AFX-VISUAL-DIFF`·`UX-RARITY-MULTI-CHANNEL`(visual-inventory-ux.md 소유)을 참조한다.
- **흔한 실패:** 희소도와 서사 가치의 역전(쓰레기 흔한템에 장대한 lore, 전설템에 빈 설명). 발견 맥락 없는 단순 드롭표.
- **연관:** `IDENT-PLACEMENT-AS-STORY`, `IDENT-MEANINGFUL-COLLECT`, `IDENT-ICEBERG`

### `IDENT-MIRROR-PROGRESS` 아이템으로 변화·진행을 증명
- **정의:** 시작 아이템 ↔ 종반 아이템을 거울쌍으로 두어 플레이어 여정의 *변화*를 물건으로 증명한다(낡은 단검 → 그 단검의 각성형). 진행과 서사를 같은 오브젝트에 묶는다.
- **출처:** Progression and Reward in Story Driven Games — https://perspectivesingamedesign.com/progression-and-reward-in-story-driven-games-57b2d0d44ce5 . story-architect의 `ST-MIRROR-FRAME`(시작↔끝 거울쌍)을 아이템 축으로 확장.
- **우리 엔진 구현(작은 웹게임):** 핵심 signature 아이템 1개를 진행에 따라 외형·flavor가 진화하게(절차생성 파라미터 또는 `visual.*` 슬롯을 단계별로). localStorage/registry에 진화 단계 플래그 저장(서버 없는 단일플레이). 엔딩 카드(story-architect §7 Text Surfaces)에서 그 아이템을 회수해 변화를 한 컷으로.
- **흔한 실패:** 아이템 인플레로 시작템이 즉시 폐기돼 여정의 연속성·감정 투자가 끊기는 것. 모든 아이템이 일회용이라 거울쌍이 성립 안 함.
- **연관:** `IDENT-CONSTRAINED-CATALOG`, `IDENT-MICRO-CHARACTER`, `IDENT-CONSISTENT-VOICE`

### `IDENT-CONSTRAINED-CATALOG` 소수 정예 + 절차 양산(2층)
- **정의:** 작은 게임에서 "기억성"은 수가 아니라 농도에서 온다. 손으로 정체성 부여한 소수(signature) + 절차생성 다수(procedural)의 2층 구조가 우리 제약에 맞다. "수의 역설" — 많을수록 식별이 붕괴한다.
- **출처:** Binding of Isaac 회고(Flash 100개일 땐 "모르고 줍는 불확실성"이 매력이었으나 수백 개·유사 외형이 되며 식별 붕괴) — Item Synergies(tboi) https://www.tboi.com/synergies . 절차 네이밍은 양산용 — Random Item Names — https://www.cheveedodd.com/2020/05/15/random-item-names/ . Diablo unique vs 랜덤 rare 분리.
- **우리 엔진 구현(작은 웹게임):** 데이터 스키마를 두 층으로 — `tier: "signature"`(수작업: 이름·flavor·`visual.*`·`grantsVerb` 4요소 풀세트, 한 자릿수~십몇 개) vs `tier: "procedural"`(풀 조합: 이름·스탯·tint). 모바일 인벤토리·짧은 세션 고려해 signature는 적게. localStorage progression은 signature 보유/발견 위주로 기록. principles.md 캐논 `SCOPE-ONE-CORE`·`SCOPE-DEPTH-NOT-BREADTH`와 정합.
- **흔한 실패:** 절차생성으로 수천 개를 찍어 다 비슷하게 보이고 다 잊힘. 또는 전부 수작업이라 콘텐츠 양 부족.
- **연관:** `IDENT-MICRO-CHARACTER`, `IDENT-MEANINGFUL-COLLECT`, `IDENT-MIRROR-PROGRESS`

### `IDENT-MEANINGFUL-COLLECT` 수집템은 보상·맥락으로 시간을 존중
- **정의:** 수집형 아이템은 패딩이 아니라 *의미*(작은 기계 보상 또는 lore 조각)를 줘야 한다. 시간 투자에 값하는 외적/내적 동기를 함께 건다. lore 보상은 lore-heavy 장르에서 가장 효과적.
- **출처:** "doodad를 흩뿌리는 것만으론 의미 없다 … 패딩용이면 안 된다" — The Craft of Collectible Design — https://game-wisdom.com/critical/collectible-design-videogames . 시간 투자가 감정적 소유 강화 — Collectibles in Mobile Games — https://www.gameanalytics.com/blog/design-mobile-game-collectibles
- **우리 엔진 구현(작은 웹게임):** 수집 아이템마다 (a) 작은 기계 보상 또는 (b) STORY.md lore 한 조각 중 **최소 1개를 보장**. 재미요소 `FE-COLLECT`와 직결([fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md)) — 컬렉션 진행 UI(game-ui-hud)와 획득 연출(juice-fx)로 시간 존중을 가시화. principles.md 안티패턴 "수집 패딩"의 가드.
- **흔한 실패:** 길이/리플레이 부풀리기용 무의미 수집(보상도 lore도 없는 동전 100개). 짧은 세션에서 특히 독.
- **연관:** `IDENT-EARNED-FLAVOR`, `IDENT-CONSTRAINED-CATALOG`, `IDENT-PLACEMENT-AS-STORY`

### `IDENT-CONSISTENT-VOICE` STORY.md 톤·Glossary를 상속하는 일관 화자
- **정의:** flavor·이름·UI 텍스트가 한 화자/톤을 유지해야 세계가 한 작가가 쓴 듯 느껴진다. 아이템 바이블은 톤·고유명사를 **발명하지 않고 [`story-architect`](../../../wgf-story-architect/SKILL.md)의 STORY.md에서 상속**한다 — 기술 설명조차 게임의 전반 보이스에 맞춘다. principles.md 공통 캐논 11(`ITEMS-SINGLE-SOURCE`)의 서사 형제다.
- **출처:** Lore and Flavor(기술 설명도 게임의 writing style 유지) — https://medium.com/@shushpo_22090/lore-and-flavor-how-i-write-descriptions-for-items-4b9378c0fa0b . story-architect의 `TL-CANON-SINGLE-SOURCE`(이름 철자·고유명사는 STORY.md 한 곳에만)·`TL-CHAR-VOICE`(보이스 do/don't)를 아이템 텍스트로 확장.
- **우리 엔진 구현(작은 웹게임):** STORY.md §1 Tone 키워드와 §8 Glossary 표를 아이템 텍스트 생성 규칙으로 상속(예: "건조한 학자체", "냉소적 1인칭"). 절차 네이밍·flavor 템플릿도 그 보이스 단어 풀에서 추출. 아이템 `name`·`flavor`의 고유명사는 §8 Glossary 표기를 그대로 쓴다 — consistency-tools.md `lint-items.mjs`가 미등록/오타 표기를 검출(story-architect 연속성 린트와 같은 원리). 작성/검수 분리(자기검수 금지).
- **흔한 실패:** 어떤 아이템은 진지한 lore, 옆 아이템은 밈/이모지 농담으로 톤이 깨짐(의도된 코믹 게임이 아닌 한). 아이템 바이블이 STORY.md를 안 보고 톤·고유명사를 독자 발명.
- **연관:** `IDENT-NAME-EVOCATIVE`, `IDENT-FLAVOR-INTANGIBLE`, `IDENT-ICEBERG`, `IDENT-THEME-FAMILY`

### `IDENT-OPTIONAL-LAYER` 서사는 강제하지 말고 얹는다
- **정의:** 서사는 게임 흐름을 멈추지 않는 *옵션 레이어*로 존재한다. 읽고 싶은 만큼만 읽게 하고, 안 읽어도 플레이가 막히지 않는다. "안 읽겠다"는 플레이어조차 *맥락·의미*는 원하므로 — 강제 X, 접근성 O.
- **출처:** Dark Souls("게임의 흐름을 깨서 서사를 강요하지 않는다") — https://www.gamedeveloper.com/design/narrative-design-in-dark-souls . 모바일 연구: 많은 플레이어가 "안 읽겠다"면서도 맥락·동기를 원함 — Storytelling in Small Spaces — https://medium.com/@Tracey_Watson/storytelling-in-small-spaces-practical-narrative-design-for-mobile-games-1a080d0d3732 ; Storifying a Serious Mobile Game — https://dl.acm.org/doi/fullHtml/10.1145/3569219.3569343
- **우리 엔진 구현(작은 웹게임):** 획득 팝업은 짧은 1줄(`effect` 위주) + 길게 누르거나 인벤토리에서 열면 `flavor` 노출(tap-to-expand, game-ui-hud). lore가 진행을 게이트하지 않게 한다(서버 없는 단일플레이라 더 쉽다). story-architect의 `IN`/`TL-CHANNEL-MAP` 채널 라우팅과 정합.
- **흔한 실패:** 아이템 획득 시 전체 화면 모달 lore dump로 흐름 차단. 긴박한 톤인데 lore 읽기가 페이싱을 죽이는 경우.
- **연관:** `IDENT-DUAL-PURPOSE`, `IDENT-FLAVOR-INTANGIBLE`, `IDENT-ICEBERG`

---

## 정체성 4요소 체크 표 (signature 아이템 설계 치트)

signature 아이템(`tier: "signature"`)은 아래 4칸을 **모두** 채워야 "미니 캐릭터"가 된다(`IDENT-MICRO-CHARACTER`). 한 칸이라도 비면 등급만 다른 색칠 — procedural로 강등.

| 요소 | 필드 | 원칙 | 자매 스킬 핸드오프 |
| --- | --- | --- | --- |
| **이름** | `name` | `IDENT-NAME-EVOCATIVE` + `IDENT-CONSISTENT-VOICE` | story-architect(voice·Glossary) |
| **실루엣/아이콘** | `visual.silhouette`·`visual.palette`·`visual.focal_motif` | `IDENT-MICRO-CHARACTER` + `IDENT-THEME-FAMILY` | sprite-forge / vector-graphics / sprite-picker(CC0) |
| **flavor 한 줄** | `flavor`(≤60자, effect 분리) | `IDENT-FLAVOR-INTANGIBLE` + `IDENT-DUAL-PURPOSE` + `IDENT-ICEBERG` | story-architect(톤) / game-ui-hud(2층 툴팁) |
| **동사/이펙트** | `grantsVerb` + 연출 | `IDENT-VERB-OVER-STAT` + `IDENT-LUDO-HARMONY` | juice-fx(연출) / chip-sound(SFX) |
| (설계 메모) | `fantasyStatement` | 4요소가 한 판타지를 가리키는지 자기점검("벽을 무시하는 자") | — |

## 서사 통합 체크리스트 (장르·플랫폼 게이트 → 정체성)

사용자 강조: *아이템 시스템은 서사·장르·플랫폼을 보고 결정한다.* 정체성 설계 **전에** 아래를 먼저 통과시킨다.

1. **장르 게이트** — 로그라이크/아케이드 결이면 무작위 풀 + 창발 서사(배치·조합), 스토리형이면 결정적 signature 소수(`IDENT-CONSTRAINED-CATALOG`). 장르별 핵심 모델은 [scope-complexity.md](./scope-complexity.md).
2. **플랫폼 게이트** — 모바일·1~3분 세션이면 `flavor` ≤1문장, 인벤토리 슬롯 소수, 툴팁 탭 1회 닫힘(`IDENT-FLAVOR-INTANGIBLE`·`IDENT-OPTIONAL-LAYER`). UX 상한은 [visual-inventory-ux.md](./visual-inventory-ux.md).
3. **톤 상속** — STORY.md §1 Tone·§8 Glossary를 `name`·`flavor`에 상속(`IDENT-CONSISTENT-VOICE`). 발명 금지.
4. **효과=주제 검수** — 모든 아이템 효과가 코어 동사·주제와 같은 말을 하는가(`IDENT-LUDO-HARMONY`). 작성/검수는 분리 패스(consistency-tools.md).

---

## 출처

### 동사·미니 캐릭터·판타지 (정체성 축)
- Verbs in Game Design (Off The Beaten Track) — https://www.offthebeatentrack.games/verbs-in-game-design/ — 아이템=새 동사 잠금(점프·수영·동결).
- Out of Character: how to design good game characters (Game Developer) — https://www.gamedeveloper.com/design/out-of-character-how-to-design-good-game-characters — 독특한 trait·실루엣으로 구별, 미니 캐릭터 원리.
- How Hades Creates Compelling Characters (CBR) — https://www.cbr.com/hades-character-design-compelling-supergiant/ — 신별 boon 정체성(색·SFX·대사).

### 이름·사운드 심볼리즘
- Writing Flavour Text (edmcrae) — https://www.edmcrae.com/article/writing-flavour-text-for-items-in-your-game — evocative prefix + item type.
- Naming All The Stuff (Great Game Design) — https://greatgamedesign.blog/2017/01/03/naming-all-the-stuff/ — 최소 한 개의 환기적 단어.
- The bouba/kiki effect is robust across cultures (Royal Society B) — https://royalsocietypublishing.org/doi/10.1098/rstb.2020.0390 — 소리가 형태·성격 인상을 보편 환기.
- Resolving the bouba-kiki effect (Scientific Reports / Nature) — https://www.nature.com/articles/s41598-022-23623-w — 교차검증.
- Random Item Names – Roguelike Design (Chevee Dodd) — https://www.cheveedodd.com/2020/05/15/random-item-names/ — 절차 네이밍은 양산용.

### flavor·서사 통합 (Dark Souls 등)
- Narrative Design in Dark Souls (Game Developer) — https://www.gamedeveloper.com/design/narrative-design-in-dark-souls — 아이템 설명=lore 1차 매체, 흐름 안 끊는 옵션 레이어, 발견 위치=lore.
- Narration of Things (First Person Scholar, 학술) — https://www.firstpersonscholar.com/narration-of-things/ — 아이템이 NPC보다 informative.
- Lore and Flavor (Dmitrii Mamaev, Medium) — https://medium.com/@shushpo_22090/lore-and-flavor-how-i-write-descriptions-for-items-4b9378c0fa0b — Technical/Lore/Flavor 3계층, 보이스 일관.
- The art of flavour text (PC Gamer) — https://www.pcgamer.com/the-art-of-flavour-text/ — flavor의 환기 역할.

### 환경 서사 (배치)
- Environmental Storytelling (Game Developer) — https://www.gamedeveloper.com/design/environmental-storytelling — 배치=이야기.
- What Happened Here? Environmental Storytelling (GDC, Smith·Worch) — https://gdcvault.com/play/1012647/What-Happened-Here-Environmental — tableau 추리.
- The Craft of Collectible Design (Game Wisdom) — https://game-wisdom.com/critical/collectible-design-videogames — "doodad 흩뿌리기"는 무의미.

### 빙산·테마·ludonarrative
- Tip of the Iceberg (Pandaqi) — https://pandaqi.com/tutorials/writing/creative-writing/worldbuilding/tip-of-the-iceberg/ — 일각만 노출.
- Worldbuilding with the Iceberg Method (Andrea Cerasoni) — https://andreacerasoni.com/blog/iceberg-method — 교차검증.
- How Elden Ring Masters Environmental Storytelling (CBR) — https://www.cbr.com/elden-ring-environmental-storytelling-fromsoftware/ — 파편→큰 진실.
- Creating Thematic Consistency (Mahtgician Games) — https://mahtgiciangames.com/blogs/the-creative-workshop-game-design-blueprints/creating-thematic-consistency-in-game-elements — 테마 정렬·매끈한 학습.
- Why theme driven design (Game Developer) — https://www.gamedeveloper.com/design/why-you-and-your-game-will-benefit-from-theme-driven-design — 모든 요소 테마 정렬.
- Ludonarrative dissonance (Wikipedia) — https://en.wikipedia.org/wiki/Ludonarrative_dissonance — Hocking/BioShock, Papers Please 조화.
- Game Art Styles (Champlain, Bloodborne 무기) — https://www.champlain.edu/blog/stories/common-game-art-styles/ — 무기가 무드를 강화.

### 장르·플랫폼·수집·진행
- The Roguelike Renaissance (gamedesigning.org) — https://gamedesigning.org/gaming/roguelike/ — 창발 서사.
- Storytelling in Small Spaces (Tracey Watson, Medium) — https://medium.com/@Tracey_Watson/storytelling-in-small-spaces-practical-narrative-design-for-mobile-games-1a080d0d3732 — 강제 X, 접근성 O.
- Storifying a Serious Mobile Game (ACM) — https://dl.acm.org/doi/fullHtml/10.1145/3569219.3569343 — 더 적은 단어로 더 많은 몰입.
- Collectibles in Mobile Games (GameAnalytics) — https://www.gameanalytics.com/blog/design-mobile-game-collectibles — 시간 투자=감정적 소유.
- Progression and Reward in Story Driven Games (Perspectives) — https://perspectivesingamedesign.com/progression-and-reward-in-story-driven-games-57b2d0d44ce5 — 거울쌍 진행.

### 자매 스킬·교차 참조
- 정체성 시각 구현: [`sprite-forge`](../../../wgf-sprite-forge/SKILL.md) / [`vector-graphics`](../../../wgf-vector-graphics/SKILL.md) / [`sprite-picker`](../../../wgf-sprite-picker/SKILL.md)(CC0) — `visual.*` 슬롯 핸드오프.
- 톤·고유명사 소스: [`story-architect`](../../../wgf-story-architect/SKILL.md) STORY.md(`TL-CANON-SINGLE-SOURCE`·`TL-CHAR-VOICE`·`ST-MIRROR-FRAME`).
- UI/연출/SFX: [`game-ui-hud`](../../../wgf-game-ui-hud/SKILL.md)(2층 툴팁·tap-to-expand) / [`juice-fx`](../../../wgf-juice-fx/SKILL.md)(획득·희소 연출) / [`chip-sound`](../../../wgf-chip-sound/SKILL.md)(청각 정체성).
- 배치 좌표: [`level-architect`](../../../wgf-level-architect/SKILL.md)(스폰 규칙·난이도 곡선).
- 라이선스: [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md)(이름·flavor IP 차용 금지 검증).
- 재미요소: [fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md)(`FE-BUILD`·`FE-COLLECT`·`FE-SURPRISE`·`FE-RISK-REWARD`).
- 같은 라이브러리 형제: [principles.md](./principles.md)·[scope-complexity.md](./scope-complexity.md)·[taxonomy.md](./taxonomy.md)·[rarity-affixes.md](./rarity-affixes.md)·[synergy-balance.md](./synergy-balance.md)·[utility-consumables.md](./utility-consumables.md)·[economy-loot.md](./economy-loot.md)·[visual-inventory-ux.md](./visual-inventory-ux.md)·[consistency-tools.md](./consistency-tools.md).
