# 능력 설계 공통 원칙 — 1차 사전 (엔진 제약 · 복잡도 게이트 · 캐논 · 안티패턴)

> [`ability-architect`](../../SKILL.md)가 능력 시스템을 설계하기 전에 **가장 먼저 Read** 하는 파일. 우리 엔진 제약을
> 선적용하고, 모든 도메인을 관통하는 공통 캐논과 '섞지 말 것'(안티패턴)을 둔다. 도메인별 깊은 원칙은 [INDEX.md](./INDEX.md)
> 라우팅으로. 코드화 원칙 전체 정의는 각 도메인 파일에 있다 — 여기선 *항상 지키는 북극성*만 요약한다.
> 바이블 스펙·린트 체크리스트·툴 매트릭스는 [consistency-tools.md](./consistency-tools.md).
>
> **용어:** 여기서 "스킬/능력"은 **게임 캐릭터가 쓰는 능력**이다(대시·파이어볼·궁극기). Claude Code 스킬과 무관.

---

## 0. 엔진 제약 · 범위 (모든 결정에 선적용)

우리 게임은 **작은 2D 웹/모바일웹 게임**이다(Phaser 4 + PixelForge/VectorForge + AbilityKit + MobileHarness). AAA ARPG·MMO가 아니다.

- **단일플레이 · 무서버.** 진행·해금·스킬포인트·자원은 전부 `localStorage`/Phaser `registry`로만 영속한다(`AbilityKit.serialize/restore`). PvP·서버 밸런스 없음 → 카운터플레이는 *적·환경*이 진다(`BAL-COUNTERPLAY`).
- **모바일 웹뷰 · 짧은 세션.** 한 판 1~3분이 흔하다. **동시 액티브 능력은 버튼 예산(보통 ≤4)** 이 하드 상한(`UX-BUTTON-BUDGET`·`SCOPE-PLATFORM-BUDGET`). 긴 캐스트·복잡한 자원 관리는 즉시성과 충돌.
- **무과금 · CC0/IP-safe.** 능력 해금에 **loot box·gacha·페이월·시간단축 결제는 차용 금지**. 가변비율의 *추진력*만 + 천장(pity)으로 좌절 흡수. 능력 아이콘 아트는 절차 생성(PixelForge/VectorForge) 또는 CC0(sprite-picker)만.
- **산출물 단일 진실:** `games/<slug>/ABILITIES.md`(사람용 바이블) + `games/<slug>/abilities.json`(기계 데이터 = `engine/abilitykit.js` 로드 + `lint-abilities.mjs` 입력). 모든 능력·자원·진행·비주얼은 여기서만 정의한다([consistency-tools.md](./consistency-tools.md)).
- **런타임 분리:** `AbilityKit`은 **쿨다운·자원·콤보·게이트·해금 타이밍**만 굴린다. 능력의 *효과*(대미지·발사체·이동·CC)는 game.js가 `onActivate(ability, ctx)`에서 `ability.effect`를 읽어 실행한다 — 효과를 코드에 중복 하드코딩하지 않는다(`ABILITIES-SINGLE-SOURCE`).
- **서사·아이템 형제 바이블.** 톤·고유명사·flavor는 `STORY.md`([`story-architect`](../../../wgf-story-architect/SKILL.md))를 상속하고, 능력을 *부여하는 아이템*은 `ITEMS.md`([`item-architect`](../../../wgf-item-architect/SKILL.md))가 `grantsAbility` id로 교차참조한다 — 능력 정의는 여기, 아이템은 그릇.
- **비주얼은 묘사가 아니라 슬롯으로.** 각 능력 아이콘을 잘 만들려면 산문 한 줄이 아니라 고정 키 묶음(`visual.*`)을 채워 sprite-forge(픽셀)/vector-graphics(벡터)/sprite-picker(CC0)가 **같은 입력을 결정론적으로 소비**하게 한다(`UX-DESC-SLOTS`).

---

## 1. 복잡도 게이트 — 5티어 사다리 (★ 인터뷰 최우선)

story-architect가 *톤*을 가장 먼저 못 박듯, ability-architect는 **복잡도 티어를 가장 먼저 못 박는다.** 디폴트는 **코어 동사 위 능력 0~1개**이며,
한 칸 올릴 때마다 *왜 이 게임에 필요한가*를 정당화한다(`SCOPE-DEFAULT-MINIMAL`). 많은 작은 게임은 Tier 0~1에서 완결된다.

| 티어 | 이름 | 무엇 | 대표(메카닉만) |
|---|---|---|---|
| **T0** | 능력 없음 | 코어 동사만. 진행감은 점수·속도·난이도로(`SCOPE-PROGRESSION-MIN`) | 순수 아케이드·Flappy 류 |
| **T1** | 단일 능력 | 코어 동사 + 능력 1개(대시·더블점프·차지샷) | 정밀 점퍼의 대시 |
| **T2** | 소수 액티브 | 능력 2~5개 + 쿨다운/자원 한 종 | 트윈스틱 슈터 킷 |
| **T3** | 빌드·콤보 | 능력 조합이 빌드/콤보를 만든다(드래프트·시너지·연계) | 로그라이트 능력 드래프트, 콤보 액션 |
| **T4** | 스킬트리·진행 | 스킬트리/특성·다자원·능력게이트·리스펙 | 미니 ARPG, 메트로배니아 능력망 |

자세한 사다리·장르 정합·읽을 파일 처방은 [scope-complexity.md](./scope-complexity.md). **한 게임 = 한 핵심 능력 모델**(`SCOPE-ONE-CORE`), **폭보다 깊이**(`SCOPE-DEPTH-NOT-BREADTH`).

---

## 2. 공통 캐논 (모든 도메인을 관통하는 북극성)

설계 결정마다 아래 코드 근거를 한 줄로 단다. 깊은 정의는 괄호의 도메인 파일에.

1. **`SCOPE-DEFAULT-MINIMAL` — 디폴트 능력 0~1개.** 능력을 *추가할 이유*를 매번 정당화한다. "이 코어 루프가 이 능력을 *요구*하나?". ([scope-complexity.md](./scope-complexity.md))
2. **`SCOPE-ONE-CORE` — 한 게임 한 핵심 모델.** 핵심 능력 모델 하나 + 표현/메타층 0~2개. 모델 중복 금지. ([scope-complexity.md](./scope-complexity.md))
3. **`IDENT-LUDO-HARMONY` — 능력이 코어 동사·주제와 같은 말.** 능력이 주는 것은 숫자가 아니라 *플레이의 의미*다. 점프 게임의 최고 능력은 +5 방어가 아니라 더블점프다(`IDENT-VERB-OVER-STAT`). STORY.md 톤과 어긋나는 능력은 몰입을 깬다. ([identity-fantasy.md](./identity-fantasy.md))
4. **`FEEL-ANTICIPATION` — 능력은 손맛으로 산다.** 선딜(anticipation)·발동(active)·후딜(recovery)의 리듬과 텔레그래프·입력 버퍼가 능력을 시원하고 공정하게 만든다. 능력의 1차 가치는 *쓸 때의 감각*이다. ([activation-feel.md](./activation-feel.md))
5. **`RES-OPPORTUNITY-COST` — 비용이 선택을 의미있게.** 쿨다운·자원은 "지금 쓸까 아낄까"를 만든다. 비용 없는 능력은 그냥 스팸 버튼이다. 자원은 한 종으로(`RES-RESOURCE-PICK-ONE`), 고갈/무비용 양극단을 피한다. ([resource-cost.md](./resource-cost.md))
6. **`SYN-ENABLER-PAYOFF` — 시너지는 enabler + payoff.** 빌드 정체성을 만드는 payoff 1~2개 + 그것을 키우는 enabler 2~3개. 조합이 곱으로 작동할 때 "한 판 더"가 발생한다(사용자 강조: "조합 시너지=재미"). ([synergy-combo.md](./synergy-combo.md))
7. **`COMBO-CHAIN` — 능력이 능력을 부른다.** 능력 A의 출력이 능력 B의 입력이 되는 연계(캔슬·체인·콤보 윈도)가 "능력을 *사용*하는 재미"의 천장을 높인다 — 단 초보 접근성을 해치지 않게(`COMBO-ACCESSIBLE-DEPTH`), 무한 루프는 금지(`COMBO-NO-INFINITE`). ([synergy-combo.md](./synergy-combo.md))
8. **`SYN-ADD-VS-MULT` — 가산 기본, 곱산 격리.** 대부분의 능력 효과는 가산 스택, 곱연산 소스는 1~2종만 희소하게 격리(캡 필수). 상한 없는 곱산은 빌드 폭발·밸런스 붕괴의 1순위. ([synergy-combo.md](./synergy-combo.md))
9. **`BAL-NO-DOMINANT` / `BAL-NO-DEAD-SKILL` — 지배 능력도 죽은 능력도 없다.** 모든 능력에 *빛나는 한 순간(niche)*이 있어야 하고, 무지성 정답 하나가 다른 선택을 무의미하게 만들면 안 된다. ([balance-counterplay.md](./balance-counterplay.md))
10. **`PROG-MEANINGFUL-CHOICE` — 획득은 의미있는 분기.** 스킬트리·드래프트의 선택은 *진짜 다른 플레이*로 갈라져야 한다. 가짜 선택(어차피 다 찍음)·필러 노드(+1% 채우기)는 몰입을 죽인다. 획득의 기대감(가변비율·천장)이 몰입을 만든다. ([progression-acquisition.md](./progression-acquisition.md))
11. **`GATE-NO-SOFTLOCK` — 능력 게이트는 교착 불가.** 진행을 여는 능력(새 동사)은 영구·비소모이며 도달 가능해야 한다. 자물쇠를 열쇠보다 먼저 보여준다(`GATE-SHOW-LOCK-FIRST`). ([progression-acquisition.md](./progression-acquisition.md))
12. **`UX-BUTTON-BUDGET` — 모바일 버튼 예산.** 동시 굴리는 액티브 능력은 엄지 예산(보통 ≤4) 안에서. 쿨다운·자원은 한눈에 읽히게(`UX-COOLDOWN-VIZ`). ([presentation-ux.md](./presentation-ux.md))
13. **`UX-DESC-SLOTS` / `UX-SILHOUETTE-FIRST` — 비주얼은 슬롯으로.** 좋은 아이콘은 `visual.*` 고정 슬롯(실루엣·재질·팔레트·focal_motif)을 채워 생성 도구에 결정론적으로 넘긴다. 작은 크기에서 실루엣만으로 무엇인지 읽혀야 한다. ([presentation-ux.md](./presentation-ux.md))
14. **`ABILITIES-SINGLE-SOURCE` — 단일 진실 + 작성/검수 분리.** ABILITIES.md/abilities.json이 유일한 출처. 효과·수치를 코드에 중복 하드코딩하지 않는다. 설계(작성 패스)와 밸런스 검수(`lint-abilities.mjs` + 수동 = 검수 패스)는 **다른 패스**로 분리한다(자기검수 금지). ([consistency-tools.md](./consistency-tools.md))

> 도메인별 북극성도 함께 본다: `KIT-ROLE-SPREAD`(킷 역할 분담), `FEEL-TELEGRAPH`(공정한 예고), `BAL-COUNTERPLAY`(적·환경이 대응), `IDENT-FANTASY-FIRST`(능력 환상 먼저).

---

## 3. 섞지 말 것 (안티패턴 가드 — 인터뷰·설계의 내부 가드레일)

아래 충돌·실패가 감지되면 그대로 만들지 말고 **절충 되묻기**(범위 축소·우선순위 확정·구간 분리)로 해소한다.

- **과설계(디폴트 풍부).** 작은 게임에 스킬트리·다자원·콤보를 통째로. → 디폴트 최소에서 한 칸씩(`SCOPE-DEFAULT-MINIMAL`·`SCOPE-LADDER`), 한 게임 한 핵심 모델(`SCOPE-ONE-CORE`).
- **상한 없는 곱연산 스택.** 곱산 소스 여럿이 곱해져 수백 배 폭발 → 밸런스·성능 붕괴. → 곱산 1~2종 격리 + 캡(`SYN-ADD-VS-MULT`).
- **무한 콤보 / 스턴락.** cooldownReset 순환·자원 환급 루프가 순(純)소모 0이면 영원히 반복 → 게임 붕괴. → 루프에 순소모 자원·진입 캡(`COMBO-NO-INFINITE`, `lint-abilities.mjs` combo-loop 검출).
- **지배 능력 / 죽은 능력.** 무지성 정답 하나가 킷을 닫거나, 아무도 안 쓰는 능력이 풀을 오염. → viable 다수·각 능력 niche 1줄(`BAL-NO-DOMINANT`·`BAL-NO-DEAD-SKILL`), 출시 전 EV/시뮬 비교(`BAL-EV-COMPARE`).
- **무비용 스팸 능력.** 쿨다운·자원이 없는 강한 능력은 그냥 연타 버튼 → 선택이 사라짐. → 기회비용 부여(`RES-OPPORTUNITY-COST`).
- **자원 고갈 교착 / 사실상 무비용.** 비용 > 자원최대(영구 사용불가)거나, 짧은 쿨다운인데 리젠이 비용을 전액 회복(기회비용 0). → 자원 이코노미 균형(`RES-REGEN-BALANCE`·`RES-NO-STARVE`).
- **선딜·후딜 없는 즉발 만능.** 모든 능력이 무딜 즉발이면 리스크·리듬·카운터플레이가 사라진다. → 선딜/후딜·텔레그래프로 리듬과 공정성(`FEEL-ANTICIPATION`·`FEEL-TELEGRAPH`).
- **불공정한 적 능력.** 적의 능력이 예고 없이 즉사·화면 밖 기습. → 텔레그래프·회피 가능 창(`BAL-FAIR-ENEMY-ABILITY`·`FEEL-TELEGRAPH`).
- **버튼 폭발.** 액티브 능력이 모바일 버튼 예산을 넘침 → 엄지로 못 굴림. → 슬롯 통합·라디얼·컨텍스트 입력·자동발동(`UX-BUTTON-BUDGET`).
- **softlock 게이트.** 진행 필수 능력을 영구 소모하거나 도달 불가에 배치 → 진행 막힘. → 능력 게이트는 영구·도달가능성 검증(`GATE-NO-SOFTLOCK`).
- **가짜 선택 / 필러 노드.** 스킬트리가 +1% 채우기뿐이라 어차피 다 찍음 → 선택의 의미 0. → 진짜 분기·트레이드오프(`PROG-MEANINGFUL-CHOICE`·`PROG-NO-FILLER-NODE`).
- **ludonarrative 불협.** 평화로운 게임에 살상 궁극기, STORY.md 톤과 어긋나는 능력 결. → 능력 효과·이름·외형을 코어 동사·주제에 맞춘다(`IDENT-LUDO-HARMONY`).
- **비주얼 산문 묘사.** "멋진 스킬"처럼 모호한 한 줄은 생성 도구가 매번 다르게 그린다. → `visual.*` 슬롯 결정론 입력(`UX-DESC-SLOTS`).
- **도박형 능력 해금.** 가챠·페이월로 능력을 판다. → 무과금 단일플레이엔 부적합·금지. 가변비율 추진력 + 천장만.

---

## 4. 빠른 처방 (장르·코어 루프 → 핵심 능력 모델 디폴트)

장르 스캐폴드가 핵심 능력 모델을 거의 정한다(`SCOPE-GENRE-FIT`). 디폴트는 아래 — 인터뷰에서 사용자가 비틀 수 있다.

| 장르 스캐폴드 | 디폴트 핵심 모델 | 흔한 표현/메타층 | 기본 티어 |
|---|---|---|---|
| **platformer-game** | **이동 능력**(대시·더블점프·벽점프) | 능력 게이트(메트로배니아)·차지 변형 | T1 (게이트 시 T3~T4) |
| **topdown-shooter** | **쿨다운 액티브 2~4개** + 자원/충전 | 레벨업 드래프트·궁극기 | T2 (빌드 시 T3) |
| **arcade-classic** | **순간 능력 1개**(봄·일시 무적·차지) | 점수 배율 | T0~T1 |
| **puzzle-game** | **보드 능력**(제한 사용·undo·교환, 만능 금지) | 별·통화로 능력 충전 | T1~T2 |
| **endless-runner** | **순간 이동 능력**(대시·이단점프·슬라이드) | 런간 능력 해금 상점 | T1~T2 |
| **로그라이트/서바이버** | **드래프트 빌드**(레벨업 3택·패시브) + 시너지 | 등급·진화·세트·런간 해금 | T3 (T4까지) |
| **액션/콤보** | **콤보 킷**(기본기→파생 캔슬 연계) + 자원(기) | 궁극기·스킬트리 | T3 |

- 갈등·전투가 약한 게임이면 능력도 가볍게 — 이동·표현 능력 중심.
- 진행감만 필요하면 능력 0 + 점수/속도로도 충분하다(`SCOPE-PROGRESSION-MIN`) — Tier 0을 부끄러워하지 않는다.

> 자세한 장르별 핵심 모델·티어는 [scope-complexity.md](./scope-complexity.md). 재미요소(`FE-MASTERY`·`FE-BUILD`·`FE-COMBO`·`FE-POWER-FANTASY`) 연계는 [fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md).

---

## 출처
- 본 원칙은 각 도메인 파일([scope-complexity](./scope-complexity.md)·[kit-taxonomy](./kit-taxonomy.md)·[resource-cost](./resource-cost.md)·[activation-feel](./activation-feel.md)·[progression-acquisition](./progression-acquisition.md)·[synergy-combo](./synergy-combo.md)·[balance-counterplay](./balance-counterplay.md)·[identity-fantasy](./identity-fantasy.md)·[presentation-ux](./presentation-ux.md)·[consistency-tools](./consistency-tools.md))의 코드화 원칙을 공통 캐논으로 추린 것이다. 상세 리서치 도시에: `.omc/research/ability-system-research-dossier.md`.
- 단일플레이·무서버·CC0·모바일 짧은세션 제약 적응은 우리 엔진(Phaser 4 · 작은 2D 웹게임) 정합을 위한 것이다. 도박성 F2P 능력해금 통념은 윤리·제약상 의도적으로 차용에서 제외했다.
