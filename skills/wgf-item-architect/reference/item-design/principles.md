# 아이템 설계 공통 원칙 — 1차 사전 (엔진 제약 · 복잡도 게이트 · 캐논 · 안티패턴)

> [`item-architect`](../../SKILL.md)가 아이템 시스템을 설계하기 전에 **가장 먼저 Read** 하는 파일. 우리 엔진 제약을
> 선적용하고, 모든 도메인을 관통하는 공통 캐논과 '섞지 말 것'(안티패턴)을 둔다. 도메인별 깊은 원칙은 [INDEX.md](./INDEX.md)
> 라우팅으로. 코드화 원칙 전체 정의는 각 도메인 파일에 있다 — 여기선 *항상 지키는 북극성*만 요약한다.
> ITEMS.md 바이블 스펙·밸런스 린트 체크리스트·툴 결정 매트릭스는 [consistency-tools.md](./consistency-tools.md).

---

## 0. 엔진 제약 · 범위 (모든 결정에 선적용)

우리 게임은 **작은 2D 웹/모바일웹 게임**이다(Phaser 4 + PixelForge/VectorForge + ChipAudio + MobileHarness). AAA RPG·MMO가 아니다.

- **단일플레이 · 무서버.** 진행·인벤토리·통화·해금은 전부 `localStorage`/Phaser `registry`로만 영속한다. 서버 경제·실시간 거래·글로벌 마켓은 없다(`UX-LOCAL-SAVE`).
- **무과금 · CC0/IP-safe.** 이 플러그인의 아이템은 상거래 대상이 아니다 — **loot box·gacha·듀얼 통화·페이월·시간단축 결제는 차용 금지**. 가변비율의 *추진력*만 취하고 천장(pity)·시드·투명성으로 좌절을 흡수한다(`ECON-VARIABLE-RATIO`). 아이템 아트는 절차 생성(PixelForge/VectorForge) 또는 CC0(sprite-picker)만.
- **모바일 웹뷰 · 짧은 세션.** 한 판 1~3분이 흔하다. 작은 화면·엄지 조작·세션 길이가 아이템 분량·복잡도·인벤토리 UX의 **하드 상한**이다(`SCOPE-PLATFORM-BUDGET`·`UX-THUMB-ZONE`).
- **산출물 단일 진실:** `games/<slug>/ITEMS.md`(사람용 설계 바이블) + `games/<slug>/items.json`(기계용 데이터 = 게임 로드 + 린터 입력). 모든 효과·드랍·비주얼은 여기서만 정의한다([consistency-tools.md](./consistency-tools.md)).
- **서사 형제 바이블.** 톤·고유명사·flavor는 `games/<slug>/STORY.md`([`story-architect`](../../../wgf-story-architect/SKILL.md))를 참조해 상속한다 — 아이템 바이블이 서사를 재발명하지 않는다(`IDENT-CONSISTENT-VOICE`).
- **비주얼은 묘사가 아니라 슬롯으로.** 각 아이템의 이미지를 잘 만들려면 산문 한 줄이 아니라 고정 키 묶음(`visual.*`)을 채워, sprite-forge(픽셀)/vector-graphics(벡터)/sprite-picker(CC0)가 **같은 입력을 결정론적으로 소비**하게 한다(`UX-DESC-SLOTS`).

---

## 1. 복잡도 게이트 — 5티어 사다리 (★ 인터뷰 최우선)

story-architect가 *톤*을 가장 먼저 못 박듯, item-architect는 **복잡도 티어를 가장 먼저 못 박는다.** 디폴트는 **아이템 0개**이며,
한 칸 올릴 때마다 *왜 이 게임에 필요한가*를 정당화한다(`SCOPE-DEFAULT-ZERO`). 많은 작은 게임은 Tier 0~1에서 완결된다.

| 티어 | 이름 | 무엇 | 대표 | 산출 규모 |
|---|---|---|---|---|
| **T0** | 무아이템 | 아이템 없음. 진행감은 점수·해금·속도로(`SCOPE-PROGRESSION-MIN`) | Flappy Bird, 2048, Tetris | ITEMS.md 불필요 |
| **T1** | 단일 픽업 | 한 종류 수집물 1개(코인·점수칩) | Canabalt 코인, Snake 먹이 | §0·§3만 (몇 줄) |
| **T2** | 소수 파워업 | 상태/일시 버프 2~5개(밟기 무적·자석·실드) | super-runner 버섯, Pac-Man 파워펠릿 | §0·§1·§3 |
| **T3** | 빌드 시너지 | 여러 아이템이 조합돼 빌드를 만든다(드래프트·렐릭) | Vampire Survivors, Slay the Spire, Isaac | §0~§5·§7·§9 |
| **T4** | 인벤토리 경제 | 슬롯 장비·통화·등급·제작·상점 | 미니 RPG, 로그라이트 인벤토리 | 전 섹션 |

- **한 게임 = 한 핵심 아이템 모델**(`SCOPE-ONE-CORE`). 핵심 모델 위에 표현층(등급 색)·메타층(런간 해금)을 **0~2개만** 얇게 얹는다. 모델 두 개를 한 게임에 욱여넣지 않는다.
- **폭보다 깊이**(`SCOPE-DEPTH-NOT-BREADTH`). 적은 요소가 서로 곱해져 창발하는 편이, 안 쓰이는 아이템 30개보다 낫다.
- **장르가 핵심 모델을 거의 정한다** — §4 빠른 처방 참고(`SCOPE-GENRE-FIT`).

> **티어 → 읽을 파일:** T0~T1은 이 파일 §4 + [scope-complexity.md](./scope-complexity.md)면 충분. T2는 + [taxonomy.md](./taxonomy.md)·[utility-consumables.md](./utility-consumables.md). T3은 + [synergy-balance.md](./synergy-balance.md)·[economy-loot.md](./economy-loot.md). T4는 + [rarity-affixes.md](./rarity-affixes.md)·[visual-inventory-ux.md](./visual-inventory-ux.md) 전부.

---

## 2. 공통 캐논 (모든 도메인을 관통하는 북극성 11)

설계 결정마다 아래 코드 근거를 한 줄로 단다. 깊은 정의는 괄호의 도메인 파일에.

1. **`SCOPE-DEFAULT-ZERO` — 디폴트는 아이템 0개.** 아이템을 *추가할 이유*를 매번 정당화한다. "RPG니까 다 넣자"가 아니라 "이 코어 루프가 이 아이템을 *요구*하나?". ([scope-complexity.md](./scope-complexity.md))
2. **`SCOPE-ONE-CORE` — 한 게임 한 핵심 모델.** 핵심 아이템 모델 하나 + 표현/메타층 0~2개. 모델 중복 금지. ([scope-complexity.md](./scope-complexity.md))
3. **`CAT-VERB-AXIS` — 외형이 아니라 행위로 분류.** `kind` enum(consumable·equipment·key·material·currency·cosmetic)이 곧 코드 dispatch 키. 6대 행위축이 "습득·사용하는 모든 것"을 MECE하게 덮는다. ([taxonomy.md](./taxonomy.md))
4. **`IDENT-LUDO-HARMONY` — 효과가 코어 동사·주제와 같은 말.** 아이템이 주는 것은 숫자가 아니라 *플레이의 의미*다. 점프 게임의 최고 아이템은 +5 방어가 아니라 더블점프다(`IDENT-VERB-OVER-STAT`). STORY.md 톤과 어긋나는 아이템은 몰입을 깬다. ([identity-narrative.md](./identity-narrative.md))
5. **`ECON-CURVE` — 예측가능한 우상향 파워커브.** 아이템 파워·비용은 같은 진행 인덱스 i를 공유하는 곡선식으로 정의한다(감으로 흩뿌리지 않는다). "다음 한 단계"가 항상 의미 있게(`ECON-COST-CURVE`). ([economy-loot.md](./economy-loot.md))
6. **`ECON-VARIABLE-RATIO` — 가변비율 추진력만, 도박 구조는 금지.** 랜덤 드랍의 기대감은 강력한 몰입원이지만(사용자 강조: "획득 동기=몰입"), loot box/gacha/페이월은 차용하지 않는다. 천장(`ECON-PITY`)·시드·노출로 불운 좌절을 흡수한다. ([economy-loot.md](./economy-loot.md))
7. **`SYN-ENABLER-PAYOFF` — 시너지는 enabler + payoff.** 빌드 정체성을 만드는 payoff 1~2개 + 그것을 키우는 enabler 2~3개. 조합이 곱으로 작동할 때 "한 판 더"가 발생한다(사용자 강조: "조합 시너지=재미"). ([synergy-balance.md](./synergy-balance.md))
8. **`SYN-ADD-VS-MULT` — 가산 기본, 곱산 격리.** 대부분의 효과는 가산 스택, 곱연산 소스는 1~2종만 희소하게 격리한다. 상한 없는 곱산은 빌드 폭발·밸런스 붕괴의 1순위 원인. ([synergy-balance.md](./synergy-balance.md))
9. **`SYN-NO-DOMINANT` / `SYN-NO-TRAP` — 지배 전략도 함정템도 없다.** 모든 아이템에 *빛나는 한 순간(niche)*이 있어야 하고, 무지성 정답 하나가 다른 선택을 무의미하게 만들면 안 된다. ([synergy-balance.md](./synergy-balance.md))
10. **`UX-DESC-SLOTS` / `UX-SILHOUETTE-FIRST` — 비주얼은 슬롯으로, 실루엣 먼저.** 이미지를 잘 만들려면 `visual.*` 고정 슬롯(실루엣·재질·팔레트·focal_motif·등급 시각언어)을 채워 생성 도구에 결정론적으로 넘긴다. 작은 크기(32~48px)에서 실루엣만으로 무엇인지 읽혀야 한다. ([visual-inventory-ux.md](./visual-inventory-ux.md))
11. **`ITEMS-SINGLE-SOURCE` — 단일 진실 + 작성/검수 분리.** ITEMS.md/items.json이 유일한 출처. 효과·수치를 코드에 중복 하드코딩하지 않는다. 설계(작성 패스)와 밸런스 검수(`lint-items.mjs` + 수동 점검 = 검수 패스)는 **다른 패스**로 분리한다(자기검수 금지). ([consistency-tools.md](./consistency-tools.md))

> 도메인별 북극성도 함께 본다: `UX-RARITY-MULTI-CHANNEL`(등급은 색 단독 금지·다채널), `UTIL-SHOW-LOCK-FIRST`(열쇠보다 자물쇠 먼저), `UTIL-NO-SOFTLOCK`(교착 불가), `ECON-MEANINGFUL-UPGRADE`(가짜 선택 금지).

---

## 3. 섞지 말 것 (안티패턴 가드 — 인터뷰·설계의 내부 가드레일)

아래 충돌·실패가 감지되면 그대로 만들지 말고 **절충 되묻기**(범위 축소·우선순위 확정·구간 분리)로 해소한다. 인터뷰 가드와 연동.

- **과설계(디폴트 풍부).** 작은 게임에 RPG급 인벤토리·등급·접사·제작을 통째로. → 디폴트 0에서 한 칸씩(`SCOPE-DEFAULT-ZERO`·`SCOPE-LADDER`), 한 게임 한 핵심 모델(`SCOPE-ONE-CORE`).
- **상한 없는 곱연산 스택.** 곱산 소스 여러 개가 곱해져 수백 배 폭발 → 밸런스·성능 붕괴. → 곱산 1~2종 격리 + proc 캡(`SYN-ADD-VS-MULT`·`SYN-EMERGENT-COMBO`).
- **지배 전략 / 함정템.** 무지성 정답 하나가 빌드를 닫거나, 아무도 안 쓰는 죽은 아이템이 풀을 오염. → viable 다수·각 아이템 niche 1줄(`SYN-NO-DOMINANT`·`SYN-NO-TRAP`), 출시 전 EV 비교(`SYN-EV-COMPARE`).
- **strictly-better 아이템.** B가 A의 모든 면에서 우월하면 A는 존재 이유가 없다. → 공통 파워예산 코스팅·트레이드오프 강제(`SYN-POWER-BUDGET`·`ECON-MEANINGFUL-UPGRADE`).
- **호딩 함정(아까워서 안 씀).** 강력 + 희소 + 영구손실 삼중 결합은 소모품을 박물관에 박제한다. → 보충식 리필·런한정 휘발·풍부저렴 중 하나로 사용을 유도(`UTIL-HOARD-TRAP`·`UTIL-REFILL-CADENCE`·`UTIL-USE-OR-LOSE`).
- **도박 구조 차용.** loot box·gacha·듀얼통화·페이투윈. → 무과금 단일플레이엔 부적합·금지. 가변비율 추진력 + 천장·시드만(`ECON-VARIABLE-RATIO`·`ECON-PITY`).
- **softlock(교착).** 필수 키/능력을 영구 소모하거나 도달 불가에 배치 → 진행 막힘. → 키는 영구·비소모, 도달가능성 검증(`UTIL-NO-SOFTLOCK`·`UTIL-LOCK-KEY`).
- **등급=색 단독 부호화.** 색만으로 등급을 표시하면 색각·작은 화면에서 안 읽힌다. → 색 + 테두리 + 코너 핍 + 글로우 다채널(`UX-RARITY-MULTI-CHANNEL`).
- **ludonarrative 불협(서사·메카닉 따로).** 평화로운 게임에 살상 무기 등급표, 또는 STORY.md 톤과 어긋나는 아이템 결. → 효과·이름·외형을 코어 동사·주제에 맞춘다(`IDENT-LUDO-HARMONY`·`IDENT-THEME-FAMILY`).
- **비주얼 산문 묘사.** "멋진 검"처럼 모호한 한 줄은 생성 도구가 매번 다르게 그린다. → `visual.*` 슬롯을 채워 결정론 입력(`UX-DESC-SLOTS`).
- **수집 패딩.** 콘텐츠 없이 수만 늘린 수집(시간 낭비). → 수집은 *보상이나 로어*로 시간을 존중(`IDENT-MEANINGFUL-COLLECT`), 작은 카탈로그(`SYN-MINIMAL-CATALOG`).
- **인벤토리 노가다.** 정리·무게 관리가 핵심 재미를 잡아먹음. → 인벤토리가 코어가 아니면 최소화/제거, 픽업=즉시효과(`UX-INV-MINIMAL`·`UX-AUTO-MANAGE`).

---

## 4. 빠른 처방 (장르·코어 루프 → 핵심 아이템 모델 디폴트)

장르 스캐폴드가 핵심 아이템 모델을 거의 정한다(`SCOPE-GENRE-FIT`). 디폴트는 아래 — 인터뷰에서 사용자가 비틀 수 있다.

| 장르 스캐폴드 | 디폴트 핵심 모델 | 흔한 표현/메타층 | 기본 티어 |
|---|---|---|---|
| **platformer-game** | **상태 파워업**(크기·무적·새 동사) | 코인 통화 + 능력 키(메트로배니아) | T2 (게이트 있으면 T3) |
| **topdown-shooter** | **누적 픽업 + 빌드**(레벨업 3택·무기/패시브) | 등급·진화·세트 | T3 |
| **arcade-classic** | **순간 부스트/파워업**(일시 능력) | 점수 배율 | T1~T2 |
| **puzzle-game** | **보드 부스터**(제한 사용·만능키 금지) | 별·통화로 부스터 구매 | T2 |
| **endless-runner** | **순간 픽업**(자석·실드·점프부스트) + 코인 | 런간 업그레이드 상점(메타) | T2~T3 |

- 갈등·전투가 약한 게임이면 아이템도 가볍게 — 표현(코스메틱·수집 로어)이 주가 될 수 있다(`CAT-COSMETIC-FREE`·`IDENT-MEANINGFUL-COLLECT`).
- 진행감만 필요하면 아이템 0 + 점수/해금으로도 충분하다(`SCOPE-PROGRESSION-MIN`) — Tier 0을 부끄러워하지 않는다.

> 자세한 장르별 핵심 모델·티어 처방은 [scope-complexity.md](./scope-complexity.md)의 §장르 정합 표. 재미요소(`FE-BUILD`·`FE-COLLECT`·`FE-RISK-REWARD`) 조합은 [fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md).

---

## 출처

- 본 원칙은 [scope-complexity.md](./scope-complexity.md)·[taxonomy.md](./taxonomy.md)·[economy-loot.md](./economy-loot.md)·[rarity-affixes.md](./rarity-affixes.md)·[synergy-balance.md](./synergy-balance.md)·[utility-consumables.md](./utility-consumables.md)·[identity-narrative.md](./identity-narrative.md)·[visual-inventory-ux.md](./visual-inventory-ux.md)·[consistency-tools.md](./consistency-tools.md)의 코드화 원칙(각 파일 ## 출처)을 공통 캐논으로 추린 것이다.
- 단일플레이·무서버·CC0·모바일 짧은세션 제약에 맞춘 적응은 우리 엔진(Phaser 4 · 작은 2D 웹게임) 정합을 위한 것이다. 도박성 F2P 통념은 윤리·제약상 의도적으로 차용에서 제외했다.
