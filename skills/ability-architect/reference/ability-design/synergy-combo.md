# 시너지·콤보 — 능력을 조합하는 재미 (`SYN-*` · `COMBO-*`)

> **사용자가 1순위로 강조한 영역.** 능력을 *조합*해 시너지를 만들고(빌드), 능력을 *이어*(콤보) 큰 결과를 내는 것이
> 능력 시스템 재미의 정점이다. 인터뷰 A7. T3+에서 본격. 밸런스는 [balance-counterplay.md](./balance-counterplay.md)와 짝.

---

## SYN — 시너지·빌드크래프팅

### `SYN-ENABLER-PAYOFF` — 시너지는 enabler + payoff 구조 (북극성)
빌드는 **payoff(빌드 정체성을 만드는 큰 보상 능력) 1~2개 + enabler(그 payoff를 키우거나 조건을 만족시키는 능력) 2~3개**로 짠다. enabler가 모일수록 payoff가 커져 *조합이 곱*이 된다 — "이걸 모으면 저게 터진다"가 "한 판 더"의 엔진.
- 예(메카닉): payoff *빙결 폭발*(얼린 적 처치 시 광역 파편) ← enabler *대시 시 냉기 장판* + *피격 시 빙갑* + *공격에 빙결 누적*. enabler 3개가 다 모이면 화면이 얼어붙는다.
- **smallWebGame:** payoff 1 + enabler 2~3이 짧은 세션의 황금비 — 한 판에 빌드가 *닫힌다*. `role` 필드로 enabler/payoff 표시(lint가 고립 검출).

### `SYN-TAG-COHESION` — 태그로 시너지를 묶는다
능력에 태그(`tags`: fire·frost·chain·mobility…)를 달아 *같은 태그끼리* 시너지 나게 한다. 태그가 빌드의 *언어*가 된다 — "불 빌드를 노리고 불 태그를 모은다". 태그가 빌드 정체성·드래프트 가중·세트 보너스의 기준.
- **smallWebGame:** 태그 2~4종이면 충분. 한 태그가 능력 절반 이상이면 그 빌드가 지배(lint `synergy` info: 과밀 허브).

### `SYN-ADD-VS-MULT` — 가산 기본, 곱산 격리 (북극성)
대부분 효과는 가산 스택(+10, +10 = +20). 곱연산 소스(×1.5)는 **1~2종만** 희소하게 격리하고 **반드시 캡**을 건다. 상한 없는 곱산 여럿이 곱해지면 수백 배 폭발 → 밸런스·성능 붕괴(lint `mult-explode` error/warn).
- **smallWebGame:** 곱산은 "빌드의 정점"으로 한 종만(예: 빙결 대상 피해 ×, 캡 2.0). 나머지는 다 가산. `scaling.mult`엔 `cap` 필수.

### `SYN-EMERGENT-COMBO` — 창발 콤보를 허용하되 통제
설계자가 의도 안 한 능력 조합이 강력한 결과를 내는 *창발*은 빌드 재미의 정수다(`FE-EMERGENCE`). 단 창발은 버그·폭발과 종이 한 장 — 곱산 캡·proc 캡으로 상한을 두고, sim-abilities로 극단 빌드를 미리 본다.
- **곱연산 폭발 카타르시스 ↔ 격리의 해소:** "빌드 완성 시 화면이 터지는" 쾌감은 *의도된 재미*다 — `SYN-ADD-VS-MULT`의 캡과 충돌하는 듯 보이지만, 둘 다 산다: 곱산 *종수*는 1~2로 묶되, 폭발 쾌감은 진화 게이트·단발 스파이크로 분리 제공하고 **"한 세션 안에 닫히게"** 튜닝한다(짧은 세션은 긴 런 게임보다 더 보수적으로). multCap은 절대 규칙이 아니라 `balanceConfig` 튜닝값.

### `SYN-EVOLVE-GATE` — 진화: 조건 충족 시 능력 변신
능력이 특정 조건(만렙 + 짝 능력 보유, 태그 N개)에서 *진화*해 질적으로 달라지면 빌드 목표가 생긴다(로그라이트 통념). 진화는 단순 수치 상승이 아니라 *새 동사/효과*로.
- **smallWebGame:** 진화 조건을 명확히(룩업), 진화체는 visual.* `evolve_from`으로 base 상속. 작은 킷이면 진화 1~2개만.

### `SYN-SET-SOFTCAP` — 세트 보너스는 소프트캡
"N개 모으면 발동"하는 세트(`sets`)는 수집 목표를 만든다. 단 임계는 도달 가능해야(threshold ≤ 보유 가능 멤버, lint `synergy` error) 하고, 한 세트만 정답이 되지 않게 여러 세트가 viable.

### `SYN-CROSS-VERB` — 코어 동사와 능력의 교차 시너지
능력이 *코어 동사*와 시너지 나면 가장 깊다 — 점프 게임에서 "공중에서 능력 쓰면 강화", 슈터에서 "이동 중 사격 시 관통". 별도 시스템이 아니라 *이미 하는 행동*에 능력이 얹힌다(`IDENT-LUDO-HARMONY`).

### `SYN-MINIMAL-KIT` — 작은 킷으로 깊은 시너지
시너지의 적은 능력 *수*가 아니라 *상호작용 밀도*다. 능력 6개가 서로 곱해지는 게 능력 20개가 독립인 것보다 깊다(`SCOPE-DEPTH-NOT-BREADTH`). 카탈로그를 작게 유지하고 상호작용을 늘린다.

---

## COMBO — 콤보·연계 (사용의 천장)

### `COMBO-CHAIN` — 능력이 능력을 부른다 (북극성)
한 능력의 출력이 다음 능력의 입력/조건이 되는 연계. 예: *대시*로 적을 모으고(enabler) → *발화*로 점화 → *폭심*으로 연쇄 폭발. 콤보는 "능력을 *순서대로 잘 쓰는*" 숙련을 보상한다(`FE-COMBO`·`FE-MASTERY`).
- **smallWebGame:** `combo.from`으로 "이 능력 직전에 무엇이 와야 하나"를 명시. `AbilityKit.inComboWindow()`가 판정.

### `COMBO-CANCEL` — 캔슬로 잇는다
한 능력의 후딜을 다른 행동으로 끊어 빠르게 잇기(`FEEL-COYOTE-CANCEL`). 캔슬 가능 지점·대상을 *의도적으로* 열어 깊이를 만든다. 무분별 캔슬은 무한콤보(`COMBO-NO-INFINITE`).

### `COMBO-WINDOW` — 콤보 윈도가 타이밍을 만든다
연계는 일정 시간 창(window) 안에 이어야 성립한다(`combo.window`, 0.3~0.6s). 창이 좁으면 숙련 천장↑·접근성↓, 넓으면 반대. 모바일은 0.4~0.6s가 공정.

### `COMBO-AS-BUILD` — 콤보가 곧 빌드
어떤 능력이 어떤 능력으로 잘 이어지는가가 *빌드 선택*이 된다 — 콤보 친화 능력을 모으는 빌드 vs 독립 능력 빌드. 콤보 경로 자체가 시너지 그래프.

### `COMBO-REWARD-LOOP` — 콤보가 자원·보상을 생성
콤보 적중이 자원을 환급(`combo.grants`)하거나 쿨다운을 줄이면 "잘 잇는 만큼 더 쓴다"의 숙련 루프(`RES-COMBO-AS-RESOURCE`). 단 순(純)소모가 0 이하면 무한콤보.

### `COMBO-NO-INFINITE` — 무한 콤보·스턴락 금지 (북극성)
콤보 루프(cooldownReset 순환 + 자원 환급)의 순(純)자원수지가 음수여야 자연 종료한다. 순수지 ≥ 0이면 영원히 반복 가능 → 게임 붕괴(lint `combo-loop` error). 또 적을 영구 행동불능에 빠뜨리는 스턴락 금지(CC에 면역/감소 두기).

### `COMBO-ACCESSIBLE-DEPTH` — 초보 접근성 + 숙련 천장
콤보는 *몰라도 즐길 수 있고, 알면 더 잘하는* 렌티큘러여야 한다(`SCOPE-DEPTH-NOT-BREADTH`). 능력을 따로 써도 충분히 작동하되(접근성), 이으면 보너스(천장). 콤보를 강제하지 않는다.
- **smallWebGame:** 짧은 세션·캐주얼 유저면 콤보는 *선택적 깊이*로 — 기본 사용만으로도 클리어 가능(`BAL-NO-DOMINANT`의 역: 콤보 없이도 viable).

---

## 기계 검증 훅 (lint-abilities.mjs)
- 고립 enabler/payoff(공유 태그 동료 없음) → `synergy` warn(`SYN-ENABLER-PAYOFF`).
- 과밀 태그 허브 → `synergy` info. 도달불가 세트 → `synergy` error(`SYN-SET-SOFTCAP`).
- 캡 없는 곱산 / 동시 곱산 > multCap → `mult-explode` warn/error(`SYN-ADD-VS-MULT`).
- cooldownReset 순환 + 순자원수지 ≥ 0 → `combo-loop` error(`COMBO-NO-INFINITE`).
- combo.from이 실재 능력인지 → `schema` warn.
- (복잡 킷) sim-abilities.mjs로 빌드별 DPS·지배 능력 검증(`BAL-NO-DOMINANT`).

## 출처
- enabler/payoff·태그 응집·가산vs곱산·진화·세트(로그라이트 ARPG 통념) + 콤보 체인·캔슬·윈도·무한콤보 방지(격투/캐릭터액션)를 작은 2D 웹게임용으로 정리. 상세: `.omc/research/ability-system-research-dossier.md`. item-architect `synergy-balance.md`의 enabler/payoff·가산vs곱산을 능력 도메인으로 적응 + 콤보 연계 추가.
