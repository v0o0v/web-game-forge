# 능력 바이블 스펙 · 린트 체크리스트 · 툴 매트릭스 (ABILITIES.md / abilities.json)

> [`ability-architect`](../../SKILL.md)가 능력 시스템을 **산출·검수**할 때의 단일 스펙. 설계 자료(다른 도메인 파일)가
> *무엇을 만들지*를 정한다면, 이 파일은 *어떤 형식으로 적고 어떻게 기계 검증하는지*를 정한다.
> 산출물은 **`games/<slug>/ABILITIES.md`(사람용 설계 바이블) + `games/<slug>/abilities.json`(기계용 데이터 =
> `engine/abilitykit.js` 런타임 로드 + `tools/lint-abilities.mjs` 린터 입력)**. 둘은 한 방향(바이블 → 코드)으로 동기화한다.

---

## 1. ABILITIES.md 섹션 스펙 (복잡도 티어에 비례해 켠다)

| 섹션 | 내용 | 언제(티어) |
|---|---|---|
| **§0 메타** | 복잡도 티어(0~4)·핵심 모델 1개·코어 동사·플랫폼/세션·버튼 예산·엔진(abilitykit 사용 여부) | 항상 |
| **§1 킷·역할** | 활성 kind(액티브/패시브/이동기/궁극기/리액션)·역할 분담(주력/생존/이동/CC/버프)·입력 타입 | 항상 |
| **§2 자원·이코노미** | 자원 종류(없음/쿨다운만/마나/스태미나/충전)·리젠·기회비용·파워커브 | T2+ |
| **§3 능력 카탈로그** | 능력 레코드 표(아래 필드) — **단일 진실** | 항상 |
| **§4 발동·게임필** | 선딜/발동/후딜·텔레그래프·버퍼·캔슬·히트스톱 규칙 | T2+ |
| **§5 진행·획득** | 스킬트리/드래프트/레벨업·해금 그래프·메타 vs 런내 | T3+ |
| **§6 시너지·콤보** | enabler/payoff archetype·태그·콤보 링크·세트·진화 | T3+ |
| **§7 능력 게이트** | 새 동사로 잠긴 곳 열기·게이트 그래프·softlock 방지 | 게이트 있을 때 |
| **§8 비주얼 스타일가이드** | 헤더 상수(master_palette·역할 색·궁극 강조·광원·display_px·kind 시각문법) | 아이콘 생성 시 |
| **§9 HUD·입력** | 스킬바·쿨다운 시각화·자원바·버튼 매핑·모바일 엄지영역 | T2+ |
| **§10 밸런스 점검 로그** | lint 결과·수동 점검·sim 결과·수정 이력 | 검수 시 |

> Tier 0(능력 없음)은 ABILITIES.md 불필요(코어 동사로 완결). Tier 1(능력 1개)은 §0·§1·§3만 몇 줄.

---

## 2. abilities.json 스키마 (engine/abilitykit.js · lint-abilities.mjs 공유 계약)

```jsonc
{
  "meta": { "slug": "...", "tier": 0,            // 0~4 복잡도 티어
            "coreModel": "movement-verbs|cooldown-actives|draft-build|skill-tree|...",
            "engine": "abilitykit" },            // 런타임 사용 시
  "resources": [                                 // 선택(T2+). 능력이 쓰는 자원 풀.
    { "id": "stamina", "name": "기력", "max": 100, "regen": 18,
      "startFull": true, "start": 100, "rechargeDelay": 0.4 }
  ],
  "abilities": [                                 // 핵심. 능력 레코드 배열(아래 §3 필드).
    { "id": "dash", "name": "섬광 대시", "kind": "movement", "input": "instant",
      "slot": "btnB", "resource": "stamina", "cost": 25, "cooldown": 1.2, "charges": 2,
      "cast": 0, "active": 0.12, "recovery": 0.18,
      "effect": { "dashDist": 120, "iframes": 0.12 },
      "scaling": { "stat": "level", "add": 0, "mult": 1.0, "cap": 2.0 },
      "maxStacks": 1, "cap": null, "tags": ["mobility"], "role": "mobility",
      "grantsVerb": "dash", "unlocks": "gate-dash", "requires": ["node-agility"],
      "combo": { "from": ["lightStrike"], "window": 0.45, "grants": { "stamina": 10 } },
      "cooldownReset": [], "budget": 10, "flavor": "...",
      "visual": { "silhouette": "...", "material": "...", "palette": "...",
                  "focal_motif": "...", "vfx_motif": "...", "rarity_visual": "...", "lighting": "NW" } }
  ],
  "tree": {                                      // 선택(T3+). 스킬트리/특성.
    "points": "level", "start": "root",
    "nodes": [ { "id": "node-agility", "grants": ["dash"], "cost": 1, "requires": ["root"] } ],
    "edges": [ { "from": "root", "to": "node-agility" } ] },
  "gates": {                                     // 선택. 능력 게이트(메트로배니아).
    "start": "entry",
    "nodes": [ { "id": "entry", "grants": [] }, { "id": "cavern" } ],
    "edges": [ { "from": "entry", "to": "cavern", "requires": ["dash"] } ] },
  "sets": [ { "id": "fire", "threshold": 3, "members": ["a","b","c"], "bonus": {} } ],  // 선택
  "balanceConfig": {                             // 린터 임계값(없으면 보수적 기본값)
    "kinds": ["active","passive","movement","utility","ultimate","reaction"],
    "roles": ["core","payoff","enabler","mobility","survival","control","burst","sustain","utility"],
    "inputs": ["instant","charge","toggle","hold","aim","target","passive"],
    "powerKinds": ["active","ultimate","reaction"],
    "inputBudgetMobile": 4, "multCap": 2, "deadSkillFactor": 0.5,
    "cooldownCostScale": 5, "spamCooldownMax": 1.5,
    "requiredVisualSlots": ["silhouette","material","palette","focal_motif"],
    "budgetBands": { "active": [4,16], "ultimate": [20,40] }   // 선택
  }
}
```

### §3 능력 레코드 필드

| 필드 | 타입 | 의미 |
|---|---|---|
| `id` | string | 고유 키(코드 dispatch·참조). 중복 금지. |
| `name` | string | 표시 이름(오리지널, STORY.md Glossary 정합). |
| `kind` | enum | `active`·`passive`·`movement`·`ultimate`·`reaction`·`utility`. 코드 dispatch 축. |
| `input` | enum | `instant`·`charge`·`toggle`·`hold`·`aim`·`target`·`passive`. 발동 방식. |
| `slot` | string? | 입력 바인딩 슬롯(버튼). 모바일 버튼 예산 검사 대상. |
| `resource`·`cost` | string?·num? | 쓰는 자원 id + 1회 비용. cost 있으면 resource 필수. |
| `cooldown` | num? | 초. 0/없음 = 쿨다운 없음. |
| `charges` | num? | N충전(각 cooldown 으로 개별 회복). |
| `cast`·`active`·`recovery` | num? | 선딜·발동·후딜(초). 게임필. |
| `telegraph` | num? | 적/위험 능력의 예고 윈도(초). 공정성. |
| `effect` | object | 수치 효과 벡터(damage·dashDist·heal·dot{dps,dur}·targets…). 린터 파워 + 게임이 읽음. |
| `scaling` | object? | `{stat,add,mult,cap}`. mult>1 이면 cap 필수(곱연산 폭발 방지). |
| `maxStacks`·`cap` | num? | 스택/proc 캡. |
| `tags` | string[] | 시너지 태그(fire·blade·mobility…). |
| `role` | enum | `core`·`payoff`·`enabler`·`mobility`·`survival`·`control`·`burst`·`sustain`·`utility`. |
| `grantsVerb`·`unlocks` | string? | 새 동사·게이트 키(능력 게이트). |
| `requires` | string[]? | 선행 노드/능력(스킬트리). |
| `combo` | object? | `{from[],window,grants{}}`. 콤보 윈도 + 적중 시 자원 환급/보상. |
| `cooldownReset` | string[]? | 이 능력 사용이 리셋하는 다른 능력 쿨다운(콤보 루프 — 캡 필요). |
| `budget` | num? | 설계자 파워예산(밴드 검사). |
| `flavor` | string? | 플레이버 한 줄. |
| `visual` | object | 아이콘 생성 슬롯(아래). |

### visual.* 슬롯 (아이콘 핸드오프 — `UX-DESC-SLOTS`)

`silhouette`(실루엣 한 단어) · `material`(불·얼음·강철·전기·그림자…) · `palette`(§8 master_palette 참조) ·
`focal_motif`(이 아이콘이 말하는 단 하나) · `vfx_motif`(발동 화면 이펙트의 결) · `telegraph_read`(적이 보고 피하는 단서) ·
`rarity_visual`(궁극/등급 테두리·핍·글로우, 색 단독 금지) · `lighting`(기본 NW 상속).

---

## 3. lint-abilities.mjs 밸런스 린트 체크리스트

```bash
node skills/ability-architect/tools/lint-abilities.mjs games/<slug>/abilities.json
node skills/ability-architect/tools/lint-abilities.mjs <file> --json     # 마지막 줄 단일 JSON
node skills/ability-architect/tools/lint-abilities.mjs <file> --strict   # warn 도 실패
```

| 룰 | severity | 무엇 | 원칙 |
|---|---|---|---|
| `schema` | error/warn | 필수 필드·enum·중복 id·visual 슬롯·참조 무결성(combo.from·requires·resource) | `UX-DESC-SLOTS` |
| `dead-skill` | warn | 같은 kind 효율(파워/비용) 최저권 outlier | `BAL-NO-DEAD-SKILL` |
| `dominant` | warn | 파레토 지배(모든 축 우월 + 저비용/저쿨) | `BAL-NO-DOMINANT` |
| `mult-explode` | error/warn | 동시 곱산 소스 > multCap · 캡 없는 곱산 | `SYN-ADD-VS-MULT` |
| `resource` | error/info | 비용>자원최대(영구 사용불가) · 짧은쿨 무비용(기회비용 0) | `RES-OPPORTUNITY-COST` |
| `cooldown` | warn | 고파워+무쿨+무비용(스팸) · budget 밴드 이탈 | `BAL-POWER-BUDGET` |
| `synergy` | error/warn/info | 고립 enabler/payoff · 과밀 태그 허브 · 도달불가 세트 | `SYN-ENABLER-PAYOFF` |
| `tree` | warn | 스킬트리 도달성·고아 노드·grants/requires 참조 무결성 | `PROG-REACHABLE` |
| `gate-softlock` | error | 능력 게이트 도달가능성·필수 능력 획득가능 | `GATE-NO-SOFTLOCK` |
| `combo-loop` | error/info | cooldownReset 순환 + 순자원비용 ≤ 0 → 무한 콤보 | `COMBO-NO-INFINITE` |
| `input-budget` | warn | 동시 바인딩 액티브 슬롯 > 모바일 버튼 예산 | `UX-BUTTON-BUDGET` |

- 출력 계약: 사람용 라인 + **stdout 마지막 줄 단일 JSON** `{ok,counts,findings,file}`. 종료코드: error 0건이면 0, 있으면 1(--strict 면 warn 도 1).
- 임계값은 전부 `balanceConfig` 에서 읽는다(데이터로 조정). 파워는 `budget` 우선, 없으면 effect 벡터로 환산.

### 수동 보강(린터가 못 잡는 것)
- **"아무 능력 안 써도 클리어 가능?"**(능력이 장식이면 niche 재설계) · **"한 빌드만 항상 정답?"**(`BAL-NO-DOMINANT`).
- **"콤보가 실제로 터지나? 손맛이 있나?"**(`FEEL-*` — 선딜/후딜·텔레그래프·버퍼를 직접 플레이로 점검).
- 런타임 사용률 카운터(localStorage)로 사후 죽은스킬 탐지(`BAL-METRICS`).

---

## 4. sim-abilities.mjs (온디맨드 · 복잡한 킷 전용)

빌드 시너지·자원 로테이션이 핵심인 **T3~T4 킷**에서 빌드별 **DPS·자원 고갈률·능력 가동률·지배 능력**을 결정론 시뮬한다. 작은 킷(T0~T2)엔 과하다 — 채팅 표 한 줄로 충분.
```bash
node skills/ability-architect/tools/sim-abilities.mjs games/<slug>/abilities.json --build a,b,c --duration 60 --dt 0.05
```
- 모델: 매 dt 틱 쿨다운·자원 리젠 → 사용 가능한 데미지 능력 중 최대 데미지 1개 사용(글로벌쿨다운 존중)·DoT 누적. `effect.damage`·`effect.dot{dps,dur}`·`effect.targets` 를 읽는다.
- 출력: DPS·총데미지·자원 고갈 틱%·능력별 사용횟수/데미지/점유율·지배 능력(점유율 ≥ 70%). 마지막 줄 단일 JSON.

---

## 5. 툴 결정 매트릭스

| 상황 | 툴 |
|---|---|
| 모든 능력 설계 후(필수, 작성과 분리) | `lint-abilities.mjs` |
| 런타임에 쿨다운·자원·콤보·게이트를 굴려야 함(T2+) | `engine/abilitykit.js`(`AbilityKit.attach`) |
| 빌드 시너지·자원 로테이션 핵심(T3~T4) | `sim-abilities.mjs` |
| 능력 1~2개 단순(T0~T1) | 툴 불필요 — game.js 에 직접, 채팅 표로 검수 |
| 능력 아이콘 큰 셋(15+) | 갤러리 뷰어(sprite-picker `picker/` 포크) 온디맨드 |

---

## 6. abilitykit 배선 요약 (engine/abilitykit.js)

```js
// index.html: phaser 다음·game 이전  <script src="../../engine/abilitykit.js"></script>
// game.js (Game 씬 create):
var KIT = AbilityKit.attach(this, ABILITIES_SPEC, {
  unlockedAtStart: ['dash'],                       // 시작 보유 능력
  onActivate: function (ab, ctx) { applyEffect(ab, ctx); },  // 효과는 게임이 실행(ab.effect 읽기)
  onReject:   function (id, reason) { /* 쿨다운/자원/잠김 피드백 */ }
});
window.GAME_ABILITIES = KIT;
// 입력에서:  if (justPressed) KIT.use('dash', { dir: facing });
// tick 은 attach 가 씬 update 에 자동(KIT.tick(dt) 수동도 가능). 진행 저장: KIT.serialize()/restore().
```
- abilitykit 은 **타이밍·자원·해금**만 — 효과 내용은 game.js. 효과를 코드에 중복하지 않는다(`ABILITIES-SINGLE-SOURCE`).
- 헤드리스 검증: Node 에서 `require('engine/abilitykit.js')` 로 `use/tick/learn` 결정적 테스트 가능([`game-qa`](../../../game-qa/SKILL.md) step 하니스 호환).

## 출처
- 본 스펙은 [`item-architect`](../../../item-architect/SKILL.md)의 `consistency-tools.md`(items.json·lint-items.mjs) 컨벤션을 능력 도메인으로 적응시킨 것이다(출력 계약·balanceConfig 임계값·단일 진실·작성/검수 분리 동일).
