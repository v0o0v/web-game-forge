# 밸런스·카운터플레이 — 모든 능력이 살아있게 (`BAL-*`)

> 능력 시스템의 건강은 *모든 능력에 빛나는 순간이 있고, 어느 하나가 정답이 아닌* 상태다. 정량 데이터(파워·비용·쿨다운)라
> `lint-abilities.mjs`(정적)·`sim-abilities.mjs`(동적)로 기계 검증한다. 인터뷰 A10. [synergy-combo.md](./synergy-combo.md)와 짝.

---

## `BAL-POWER-BUDGET` — 파워예산 (북극성)
능력의 강함을 *예산*으로 다룬다: 강한 효과는 그만큼 큰 비용(쿨다운/자원/선딜)을 진다. 같은 budget의 능력들은 "강하지만 비싸다 / 약하지만 싸다"로 트레이드오프가 갈려야 한다. budget이 비용과 안 맞으면 지배(저비용 고파워) 또는 죽음(고비용 저파워).
- **smallWebGame:** `abilities.json`의 `budget`(설계자 명시) 또는 effect 벡터로 파워를 환산, `balanceConfig.budgetBands`로 kind별 밴드 검사(lint `cooldown`).

## `BAL-NO-DOMINANT` — 지배 전략 없음 (북극성)
무지성 정답 하나가 다른 모든 선택을 무의미하게 만들면 안 된다. 모든 빌드/능력이 *어떤 상황에서 최선*일 niche가 있어야. "이거만 찍으면 됨"이면 선택이 죽는다.
- **검증:** sim-abilities.mjs로 빌드별 DPS 비교 — 한 능력이 데미지의 70%+면 지배(`dominantAbility`). 수동: "한 빌드만 항상 정답인가?".

## `BAL-NO-DEAD-SKILL` — 죽은 능력 없음 (북극성)
아무도 안 쓰는 능력은 풀을 오염시키고 드래프트를 망친다. 모든 능력에 *빛나는 한 순간*(niche 1줄)을 부여한다 — 약하면 강화, 안 쓰이면 용도 재설계.
- **검증:** lint `dead-skill`(같은 kind 효율 최저권 outlier). 런타임 사용률 카운터(`BAL-METRICS`)로 사후 탐지.

## `BAL-NICHE` — 각 능력에 niche 한 줄
설계 시 각 능력에 "이 능력이 최선인 상황"을 한 줄로 쓴다 — 다수 적엔 광역, 단일 보스엔 단일딜, 위기엔 생존기. niche가 안 써지면 그 능력은 dead 후보.

## `BAL-COUNTERPLAY` — 카운터플레이는 적·환경이 진다
단일플레이라 PvP 카운터는 없다 — 대신 *적·환경*이 능력에 대응한다. 광역기엔 흩어지는 적, 빙결엔 면역 적, 돌진엔 가시. 능력마다 "안 통하는 상황"이 있어야 다양성이 산다. 적도 능력을 쓰면(`BAL-FAIR-ENEMY-ABILITY`) 플레이어가 대응(리액션기·회피).

## `BAL-FAIR-ENEMY-ABILITY` — 공정한 적 능력
적의 능력은 텔레그래프(`FEEL-TELEGRAPH`)로 예고되고 회피 가능해야 한다. 예고 없는 즉사·화면 밖 기습은 불공정(`FE-FAIRNESS`). 적 능력의 telegraph 윈도가 플레이어 리액션·회피의 기회.

## `BAL-SCALING-CAP` — 스케일링 캡
능력이 진행/스택으로 강해질 때 상한을 둔다(`scaling.cap`·`maxStacks`·`cap`). 무한 스케일은 후반 폭발·성능 붕괴(곱산이면 특히, `SYN-ADD-VS-MULT`). 캡까지의 곡선이 파워커브.

## `BAL-ANTI-CREEP` — 파워크립 억제
새 능력을 추가할 때 *기존보다 무조건 강하게* 하지 않는다(strictly-better 금지). 새 능력은 기존과 *다른 축*으로 강하거나, 같은 예산 내 트레이드오프. 크립이 쌓이면 구 능력이 다 죽는다.
- **검증:** lint `dominant`(파레토 지배 — 모든 축 ≥ + 저비용).

## `BAL-EV-COMPARE` — 기대값 비교 (단, 통계가 아니라 휴리스틱)
같은 kind/등급 능력은 기대값(EV: 평균 효과/시간 또는 /비용)이 비슷한 밴드 안에 있어야(역할 차이로 설명 안 되면). 출시 전 EV/DPS를 표로 비교.
- **단일플레이 단서:** PvP 공정성 압박도, 라이브 텔레메트리도 없다 — EV ±밴드(예: ±20%)는 *통계 임계*가 아니라 **설계 점검 휴리스틱**으로 격하한다. 게임의 코어 목표가 *파워판타지/broken build 재미*라면 의도적 비대칭이 오히려 옳을 수 있다(공정한 도전 vs 파워판타지에 종속). 밴드 이탈은 "왜 이탈했나"를 답할 수 있으면 통과.
- **검증:** lint `dead-skill`/`dominant`, sim-abilities.mjs의 perAbility 점유율.

## `BAL-METRICS` — 사용률 계측
런타임에 능력별 사용/선택 횟수를 localStorage에 기록해 *사후* 죽은 능력·지배 능력을 탐지한다. 픽률 하한(예: 5%) 미달 = 약함/안 보임/이해 안 됨 중 하나.

## `BAL-SUSTAIN-VS-BURST-PARITY` — 지속/폭발 동등
지속딜 빌드와 폭발딜 빌드가 둘 다 viable이게(한쪽이 항상 우월하지 않게). sim으로 두 로테이션의 시간당 데미지·자원 지속성을 비교.

---

## 검수 워크플로 (작성과 분리 — 필수)
1. **정적(필수):** `node skills/ability-architect/tools/lint-abilities.mjs games/<slug>/abilities.json` — schema·dead-skill·dominant·mult-explode·resource·cooldown·synergy·tree·gate-softlock·combo-loop·input-budget.
2. **동적(복잡 킷):** `node skills/ability-architect/tools/sim-abilities.mjs <file> --build a,b,c --duration 60` — DPS·자원 고갈률·능력 점유율·지배 능력.
3. **수동:** "아무 능력 안 써도 클리어 가능?(능력이 장식?) 한 빌드만 항상 정답?(지배) 콤보가 실제로 터지나? 손맛이 있나?".
4. **런타임 계측:** 사용률 카운터로 사후 dead/dominant 탐지(`BAL-METRICS`).
위반은 사람이 보게 리포트하고 재생성. 작성 패스(설계)와 검수 패스(이 단계)는 반드시 분리(`ABILITIES-SINGLE-SOURCE`).

## 기계 검증 훅 (lint-abilities.mjs)
- `dead-skill`(효율 outlier) · `dominant`(파레토 지배) · `cooldown`(파워예산 밴드·무비용 스팸) · `mult-explode`(스케일링 캡).

## 출처
- 파워예산·지배전략/죽은능력 제거·카운터플레이·파워크립·EV 비교·스케일링 캡(경쟁/협동 게임 밸런스 통념)을 단일플레이 작은 2D 웹게임용으로 정리(PvP 카운터 → 적·환경 카운터). 상세: `.omc/research/ability-system-research-dossier.md`. item-architect `synergy-balance.md`의 밸런스 검증을 능력 도메인으로 적응.
