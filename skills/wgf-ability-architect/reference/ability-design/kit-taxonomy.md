# 킷·분류 — 능력을 무엇으로 나누고 어떻게 한 캐릭터를 만드는가 (`KIT-*`)

> 능력을 *외형*이 아니라 **행위·역할**로 분류하고, 그 능력들이 모여 **하나의 캐릭터 정체성(킷, kit)**을 이루게 한다.
> 인터뷰 A3에서 쓴다. 항상 [scope-complexity.md](./scope-complexity.md)로 복잡도를 먼저 정한 뒤 여기로 온다.

---

## `KIT-VERB-AXIS` — 행위축으로 분류(코드 dispatch 키)
능력의 `kind`는 외형(불·얼음)이 아니라 *플레이어가 그것으로 무엇을 하는가*로 가른다. `kind` enum이 곧 `AbilityKit`의 처리 분기·입력 바인딩 축이다. 6종이 "캐릭터가 할 수 있는 행동"을 MECE하게 덮는다.

## `KIT-FIVE-KIND` — 6대 kind (active·passive·movement·ultimate·reaction·utility)
| kind | 무엇 | 예(메카닉) | 비고 |
|---|---|---|---|
| **active** | 버튼으로 발동하는 주력 능력 | 발사·장판·소환 | 쿨다운/자원이 붙는 핵심 |
| **passive** | 상시 적용(버튼 없음) | 이동속도·치명타·자동방어 | 동시 곱산은 격리(`SYN-ADD-VS-MULT`) |
| **movement** | 이동/회피 동사 | 대시·더블점프·벽점프·갈고리 | 작은 게임의 1순위(`KIT-MOBILITY-FIRST`) |
| **ultimate** | 길게 충전되는 절정기 | 화면 정리·변신·시간정지 | 드물게·크게(`KIT-ULTIMATE-CLIMAX`) |
| **reaction** | 입력 타이밍에 반응 | 패링·반격·완전회피 | 카운터플레이 보상(`KIT-REACTION-COUNTERPLAY`) |
| **utility** | 비전투 도구 | 시야·열쇠·환경조작·버프 | 능력 게이트와 연결(`GATE-*`) |

> 한 게임이 6종을 다 켜지 않는다 — 복잡도 티어에 맞춰 2~3종만(`KIT-SCOPE-FIT`). T1은 보통 movement 1개, T2는 active 2~3 + movement 1.

## `KIT-ROLE-SPREAD` — 역할 분담이 캐릭터를 만든다
킷은 단순 능력 묶음이 아니라 *서로 다른 문제를 푸는 도구함*이다. 한 킷이 최소 몇 개 역할을 덮게 한다: **주력(딜)·생존(방어/회피)·이동(접근/이탈)·통제(CC)·증폭(버프/시너지)**. 모든 능력이 "더 큰 딜"이면 선택이 사라진다.
- 작은 킷(T2)의 황금비: *주력 1 + 이동 1 + (생존 또는 통제) 1*. 이 셋이면 "어떻게 싸울지"의 결정이 생긴다.
- **smallWebGame:** 모바일 버튼 예산(≤4)이 역할 수의 상한. 역할을 능력에 겹쳐 싣는다(대시 = 이동 + 무적 i-frame으로 생존 겸).

## `KIT-INPUT-TYPE` — 입력 타입이 능력의 결을 정한다
같은 효과도 입력 방식이 손맛·깊이를 바꾼다. `input` enum: `instant`(즉발 탭) · `charge`(누를수록 강함) · `toggle`(켜고 끔, 자원 지속소모) · `hold`(누르는 동안 유지) · `aim`(방향 조준) · `target`(대상 지정) · `passive`.
- **모바일 정합:** `instant`·`hold`는 엄지 친화. `aim`은 [`virtual-joystick`](../../../wgf-virtual-joystick/SKILL.md) 조준 스틱과, `charge`는 길게 누르기와 자연스럽다. `target`(대상 클릭)은 작은 화면에서 어려우니 자동표적/근접 우선으로 대체.
- **깊이:** `charge`·`aim`은 숙련 표현(`IDENT-MASTERY-EXPRESSION`)을 만든다 — 차지량·각도가 실력이 된다.

## `KIT-MOBILITY-FIRST` — 작은 게임은 이동 능력이 1순위
2D 액션·플랫포머·슈터에서 가장 가성비 높은 첫 능력은 **이동기(대시/더블점프)**다. 회피·접근·이탈·콤보 시작·게이트 해제를 한 능력이 다 한다. 능력을 딱 하나만 줄 거면 이동기를 준다.
- **smallWebGame:** 대시에 짧은 i-frame(0.1~0.15s)을 얹으면 "회피 + 이동"이 한 버튼에. Celeste·소울류의 핵심이 대시/롤 하나인 이유.

## `KIT-PASSIVE-INVISIBLE` — 패시브는 보이지 않게 일한다
패시브는 버튼을 안 먹어 버튼 예산을 아끼고, 빌드 시너지의 *접착제*가 된다(enabler 역할에 적합). 단 "+5% 스탯"식 무미건조 패시브는 가짜 선택이 되기 쉽다(`PROG-NO-FILLER-NODE`) — 패시브도 *플레이를 바꾸는* 것으로(예: "대시가 적을 관통한다").
- **smallWebGame:** 패시브는 HUD를 어지럽히지 않으니 T2~T3 킷의 깊이를 버튼 없이 늘리는 좋은 수단. 단 동시 곱산 패시브는 1~2개로 격리(`SYN-ADD-VS-MULT`, lint `mult-explode`).

## `KIT-ULTIMATE-CLIMAX` — 궁극기는 드물고 크게
궁극기(ultimate)는 긴 충전(쿨다운/자원/콤보 게이지) 끝의 절정이다. 자주 쓰면 절정감이 사라진다. 한 판에 1~수회, 화면을 바꾸는 스펙터클로.
- **smallWebGame:** 짧은 세션이면 궁극은 "게이지 가득 → 한 방"의 푸시유어럭(`FE-RISK-REWARD`)으로. 충전은 **시간이 아니라 행동**(처치·콤보·피격)으로 채워 *세션당 최소 1회 발동을 보장*한다 — 순수 시간 패시브 충전은 1~3분 세션에서 "한 번도 못 쓰고 끝남" 리스크(짧은 쿨 ↔ 희소성 충돌의 해소: 흔한 능력은 짧은 쿨로, 희소 강력기는 행동충전 궁극으로 *분리*).

## `KIT-REACTION-COUNTERPLAY` — 리액션기는 타이밍 보상
패링·반격·완전회피는 *적의 공격에 반응*하는 능력이다. 성공 시 큰 보상(반사·무적·자원 환급)으로 숙련을 보상하되, 실패 리스크(후딜)로 남발을 막는다. 카운터플레이의 핵(`BAL-COUNTERPLAY`).
- **smallWebGame:** 적 공격에 명확한 텔레그래프(`FEEL-TELEGRAPH`)가 전제 — 예고 없는 공격엔 리액션기가 불공정해진다. 판정 창 0.1~0.2s.

## `KIT-SIGNATURE-CORE` — 킷의 정체성은 한 능력에 응축
플레이어가 "이 캐릭터 = 이 능력"으로 기억하는 시그니처 능력 1개를 둔다(`IDENT-SIGNATURE-ABILITY`와 연결). 나머지 능력은 그 시그니처를 *받쳐주게* 설계한다(시그니처가 payoff면 나머지는 enabler).

## `KIT-MINIMAL-KIT` — 작은 킷을 강제
능력 수의 상한을 둔다: T2 동시 액티브 ≤ 버튼 예산(보통 4), 전체 카탈로그 T2 ≤ 6 / T3 ≤ 12 / T4 ≤ 20. 많은 능력보다 *적은 능력의 깊은 상호작용*(`SCOPE-DEPTH-NOT-BREADTH`).

## `KIT-STANCE-SWAP` — 스탠스/폼 전환: 능력 세트를 통째로 바꾼다
무기 전환·변신·자세(stance) 전환은 *능력 하나*가 아니라 *킷 한 묶음*을 토글한다 — 근접 폼 ↔ 원거리 폼, 늑대 ↔ 인간. 버튼 1개로 여러 능력의 *맥락*을 바꿔 버튼 예산을 아끼며 깊이를 번다(`SCOPE-DEPTH-NOT-BREADTH`). 각 폼이 *못 하는 것*이 전환 동기.
- **smallWebGame:** 폼을 `input:"toggle"` 능력으로 모델링하고, 폼별 능력은 `tags`(예: `form-wolf`)로 묶어 활성 폼만 사용 가능하게 게임이 게이팅. 2폼이 상한(3폼+는 짧은 세션 인지 과부하). 전환에 짧은 쿨/후딜로 난사 방지.

## `KIT-SUMMON-ENTITY` — 소환물·터렛·설치물: 능력이 엔티티를 낳는다
소환수·터렛·지뢰·장판은 발동 후 *독립 엔티티*로 살아 지속 효과를 낸다(active의 한 갈래). "능력인가 엔티티인가"를 가른다: abilities.json엔 *소환하는 능력*을 두고(쿨다운·자원·동시 상한), 엔티티의 수명·AI·행동은 game.js가 관리.
- **smallWebGame:** 동시 소환 캡(`maxStacks` 또는 effect.maxEntities)을 반드시 둔다 — 무한 소환은 성능·밸런스 붕괴(오브젝트 풀 + 캡). 소환물 AI는 단순(moveTo·최근접 공격)하게(`perf-60fps`). 수명·재소환 쿨다운으로 화면 정리.

## `KIT-SCOPE-FIT` — 복잡도 티어에 kind를 맞춘다
- T1: movement 1 (또는 active 1).
- T2: active 2~3 + movement 1 (+ passive 0~1).
- T3: active 3~4 + movement 1 + passive 2~3 + ultimate 0~1, 시너지 태그 부여.
- T4: 위 + reaction + utility + 스킬트리로 해금.

---

## 기계 검증 훅 (lint-abilities.mjs)
- `kind`/`input`/`role` enum 위반 → `schema` error/warn.
- 동시 바인딩 액티브 슬롯 > 버튼 예산 → `input-budget` warn(`UX-BUTTON-BUDGET`).
- 동시 곱산 패시브 > multCap → `mult-explode` error.

## 출처
- 능력 분류(active/passive/movement/ultimate)·킷 역할 분담(MOBA·ARPG 통념)·이동기 우선·궁극기 페이싱·리액션 카운터플레이를 작은 2D 웹게임용으로 정리. 상세: `.omc/research/ability-system-research-dossier.md`. item-architect `taxonomy.md`(행위축 분류)의 방법론을 능력 도메인으로 적응.
