# 아이템 일관성 도구 + ITEMS.md/items.json 스펙 + 결정 매트릭스 (TOOL-*)

> [`item-architect`](../../SKILL.md)가 아이템 시스템을 **산출물로 굳히고 밸런스를 검수할 때** 참조하는 스펙 문서. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 작은 웹게임의 아이템을 모순 없이 유지하는 경량 자산(ITEMS.md 설계 바이블·items.json 데이터·밸런스 린트)과 도구 채택 결정 매트릭스. 밸런스 검증 리서치(`BAL-*`)와 툴 리서치(validator=strong·loot-sim=conditional·갤러리=conditional·스키마/그래프=흡수)를 작은 웹게임용으로 코드화했다.

이 도메인은 단일 작법이 아니라 '아이템 정합성을 떠받치는 산출 구조'다. story-design의 STORY.md 바이블·연속성 린트가 *서사*를 single source of truth로 묶듯, item-architect는 **ITEMS.md(사람용 설계 바이블) + items.json(기계용 데이터) + lint-items.mjs(검수 패스)** 로 *아이템*을 묶는다. **핵심 통찰: 검증의 가치는 '정량 데이터의 존재'에 비례한다.** 서사(story-architect)·난이도 곡선(level-architect)은 reference+인터뷰로 충분했지만, 아이템은 스탯·비용·등급·드랍률이라는 정량 데이터를 가져 기계 검증의 한계효용이 실재한다 — 그래서 validator(`lint-items.mjs`)를 strong으로 채택한다.

이 파일은 ITEMS.md 섹션 스펙 → 개별 레코드 필드 → items.json 스키마 → 밸런스 린트 체크리스트 → 툴 결정 매트릭스 → 출처 순으로 정식화한다.

---

## 프레임워크 요약

| 구분 | 출처(리서치) | 핵심 | 작은 웹게임 차용 |
| --- | --- | --- | --- |
| ITEMS.md 설계 바이블 | story-design STORY.md 모델 + Apothecary Press 'Power Budget' | 설계 의도·비주얼 가이드·서사 정합을 1곳에 압축한 사람용 진실 | 고정 섹션(§0~§9)을 **복잡도 티어에 비례해 켜고 끔**. T0~1은 §0·§3만. |
| items.json 데이터 | sprite-picker `analyze-pack.mjs` 무의존성 계약 | 게임 로드 + 린터 입력의 단일 평면 JSON | `balanceConfig`(임계값)·`items`·`sets`·`dropTables`·`gates`를 한 파일에. 효과는 데이터 객체. |
| 밸런스 린트 | Sirlin viable options · Schreiber dominated · Kidwell trap audit | viable 옵션 수 최대화 = 죽은아이템·지배전략 제거 | `lint-items.mjs`가 a~h 체크리스트를 자동화, 사람이 (h)만 보강. |
| 도구 적합도 | tooling 도시에(validator strong) | 도구 가치는 규모·정량성에 비례, 의존성·뷰어는 과잉 | validator=★기본, loot-sim/갤러리=조건부, ajv/그래프viz=비권장(흡수). |

---

## 0. 단일 진실 + 작성/검수 분리 (`ITEMS-SINGLE-SOURCE`)

### `ITEMS-SINGLE-SOURCE` ITEMS.md/items.json 단일 진실 + 작성·검수 분리
- **정의:** 한 게임의 모든 아이템 효과·드랍·비주얼·서사 정합은 `games/<slug>/ITEMS.md`(사람용)와 `games/<slug>/items.json`(기계용) 두 산출물에서만 정의한다. 설계(작성 패스)와 밸런스 검수(`lint-items.mjs` + 수동 점검 = 검수 패스)는 **다른 패스**로 분리한다(자기검수 금지). principles.md 캐논 11 인용.
- **출처:** story-design `TL-CANON-SINGLE-SOURCE`/`TL-AUTHOR-VS-REVIEW`(작성 vs 검수 분리), CLAUDE.md writer/reviewer 분리.
- **우리 엔진 구현(작은 웹게임):** 두 파일의 **역할을 분리하되 동기화**한다. ITEMS.md = 설계 의도·비주얼 스타일가이드(§7)·서사 정합(STORY.md 상속)·왜 이 아이템인가; items.json = Phaser가 로드하고 `lint-items.mjs`가 읽는 평면 데이터. 효과·수치는 코드에 하드코딩하지 않고 items.json만 읽는다(`registry.set('items', json.items)`). 동기화 규칙: **items.json이 기계 진실, ITEMS.md가 의도 진실** — 둘이 갈리면 린트 (a)가 미스매치를 잡고 ITEMS.md를 기준으로 items.json을 고친다. 워크플로: ①티어 인터뷰→②ITEMS.md 작성→③items.json 생성→④`lint-items.mjs`(검수 패스)→⑤수동 점검→⑥§9 로그.
- **흔한 실패:** 효과 수치를 게임 코드 여러 곳에 중복 하드코딩 → 한쪽만 고쳐 모순. 작성과 검수를 한 호흡에 self-approve → 죽은아이템·지배전략을 놓침.
- **연관:** `SYN-MINIMAL-CATALOG`, `ECON-CURVE`, `UX-DESC-SLOTS`, `TOOL-LINT-FIRST`.

---

## (A) ITEMS.md 섹션 스펙

`games/<slug>/ITEMS.md`는 **게임당 단일 진실**이며, 거대 문서가 아니라 복잡도 티어(0~4)에 비례해 섹션을 켜고 끈다(`SCOPE-DEFAULT-ZERO`/`SCOPE-ONE-CORE`). 디폴트는 아이템 0개. 아래 섹션을 그 순서로 생성하되, 티어 게이트(우측)를 지킨다.

### ## 0. 메타 — *항상*
slug · 장르/스캐폴드 · 코어 동사 · **복잡도 티어(0~4)** · 핵심 아이템 모델 **1개** · 표현/메타층 옵션 **0~2개** · `STORY.md` 링크. 핵심 모델 두 개를 욱여넣지 않는다(`SCOPE-ONE-CORE`). 디폴트 0에서 한 칸 올릴 때마다 정당화(`SCOPE-DEFAULT-ZERO`).

### ## 1. 활성 범주 — *T≥2*
6범주(consumable·equipment·key·material·currency·cosmetic) 중 **켠 2~3개만** + 각 역할·상한(슬롯 수·통화 종류·등급 단계·재료 종 수). `misc` 같은 잡탕 범주 금지(`CAT-SIX-BUCKET`). 켠 범주가 게임 규모에 맞는가(`CAT-SCOPE-FIT`).

### ## 2. 이코노미 & 파워커브 — *T≥2 (T≤1 생략)*
faucet(획득)/sink(소모) 표 · `powerCurve(i)` 곡선식 · 비용곡선(지수) · 등급별 파워예산 밴드 · `balanceConfig`(린터 임계값)을 명시(`ECON-FAUCET-SINK`/`ECON-CURVE`/`SYN-POWER-BUDGET`). 예: `powerCurve(i)=base*(1.15^i)`, `cost(i)=c0*(1.6^i)`. 등급 밴드는 §3·items.json `balanceConfig.rarityBands`와 일치.

### ## 3. 아이템 카탈로그 — *T≥1*
레코드 표(아래 (B) 필드 스펙의 행). **작은 카탈로그 강제**: 세션 등장 풀 12~24, 전체 24~40 상한(`SYN-MINIMAL-CATALOG`). 외형이 아니라 행위(`kind`)로 분류(`CAT-VERB-AXIS`). 이 표의 한 행 = items.json `items[]`의 한 객체.

### ## 4. 시너지 & 세트 — *T≥3만*
enabler/payoff archetype 2~3개 · 진화 레시피 `{base,catalyst,when,into}` · 세트 문턱(2/4피스) · **곱산 소스 1~2개를 격리 표시**(`SYN-ENABLER-PAYOFF`/`SYN-EVOLVE-GATE`/`SYN-ADD-VS-MULT`). 가산 기본, 곱산은 희소 격리 + proc 캡.

### ## 5. 드랍 & 획득 — *T≥3 (랜덤 드랍 있을 때)*
드랍 테이블(가중치) · 천장(soft/hard pity) · 시드 정책 · `dropIlvl`↔스테이지 매핑 · 보상 페이싱(`ECON-VARIABLE-RATIO`/`ECON-PITY`/`AFX-LEVEL-GATES`). loot box/gacha 구조 차용 금지 — 가변비율 추진력 + 천장·시드·노출만.

### ## 6. 진행 게이트 — *key 범주 있을 때만*
키/능력 게이트 의존 그래프(nodes/edges) · `localStorage` 플래그 키 · hard/soft 구분 · softlock 방지 메모(`UTIL-LOCK-KEY`/`UTIL-GATE-GRAPH`/`UTIL-NO-SOFTLOCK`). 키는 영구·비소모, 도달가능성 검증(린트 g).

### ## 7. 비주얼 스타일가이드(헤더 상수) — *T≥2 (아이콘 있을 때)*
전역 1회 선언, 개별 레코드가 상속: `master_palette`(16~32색) · `rarity_colors`(등급→hex+테두리+핍) · `light_dir`(NW 고정) · `view_angle` · `display_px`(48) · 카테고리 시각문법 · 실루엣 변주축(`UX-PALETTE-DISCIPLINE`/`UX-RARITY-MULTI-CHANNEL`/`UX-CONSISTENT-LIGHT`, 정의는 [visual-inventory-ux.md](./visual-inventory-ux.md)). 개별 `visual.palette`는 이 표만 참조(자유 hex 금지).

### ## 8. 인벤토리 & UX — *T≥3*
인벤 모델(없음/슬롯/그리드) · 슬롯 수 · 핫바 배치(엄지영역) · 툴팁 2층(effect/flavor) · 자동관리(`UX-INV-MINIMAL`/`UX-TAP-TARGET`/`UX-AUTO-MANAGE`, 정의는 [visual-inventory-ux.md](./visual-inventory-ux.md)). 인벤토리가 코어가 아니면 최소화/제거, 픽업=즉시효과.

### ## 9. 밸런스 점검 로그 — *T≥2*
검수 패스(`ITEMS-SINGLE-SOURCE`)의 기록. `lint-items.mjs` 결과(죽은아이템·지배전략·곱산폭발·밴드이탈) · 픽률 카운터(`itemStats`) · 수동 점검("아무것도 안 써도 클리어 가능? 한 빌드만 항상 정답?") · 해소 기록. 각 항목: 위반 코드(아래 a~h) · 위치 · 조치 · 재린트 여부.

---

## (B) 개별 아이템 레코드 필드 스펙

§3 표의 한 행 = items.json `items[]`의 한 객체. **기능 필드**는 게임 로직·린터가, **★비주얼 슬롯**은 sprite-forge/vector-graphics/sprite-picker 어댑터가 소비한다.

**기능 필드**

| 필드 | 형 | 설명 |
| --- | --- | --- |
| `id` | string | 고유키(kebab). 세트·진화·게이트 참조의 앵커. |
| `name` | string | 표기. STORY.md Glossary 정합(`IDENT-CONSISTENT-VOICE`). |
| `kind` | enum | `consumable\|equipment\|key\|material\|currency\|cosmetic`. 코드 dispatch 키(`CAT-VERB-AXIS`). |
| `sub` | string | 세부(potion/sword/relic…). |
| `rarity` | enum | `common\|rare\|epic\|legendary`. 색 단독 금지(`UX-RARITY-MULTI-CHANNEL`). |
| `slot` | string | 장착 슬롯(weapon/charm…). consumable은 생략. |
| `effect` | object | 데이터 객체 — `{heal:30}` / `{buff:'speed',ms:5000}` / `{atk:+4,def:-2}`. **가산 우선**(`SYN-ADD-VS-MULT`). |
| `cost` / `dropWeight` | number | 비용 또는 드랍 가중치. 곡선식 산출(`ECON-CURVE`). |
| `tags[]` | string[] | 역할·상성 태그(viable 점검용). |
| `role` + `archetype` | enum+string | `payoff\|enabler\|both` + 빌드 정체성(`SYN-ENABLER-PAYOFF`). |
| `grantsVerb` | string | 새 동사 부여(dash/doubleJump…). 최고 아이템(`IDENT-VERB-OVER-STAT`). |
| `unlocks` / `requires` | id[] | 게이트 의존(`UTIL-GATE-GRAPH`). |
| `flavor` | string | ≤1문장. STORY.md 톤 상속. |

**★비주얼 슬롯** (이미지 생성 어댑터 입력 — `UX-DESC-SLOTS`)

`visual.silhouette` · `visual.primary_shape` · `visual.material`(metal/wood/leather/gem/cloth/stone/glass) · `visual.palette`(§7 `master_palette` 참조, **자유 hex 금지**) · `visual.focal_motif` · `visual.negative_space` · `visual.rarity_visual`(테두리+핍+글로우) · `visual.lighting`(§7 상속 NW) · `visual.evolve_from`(진화 시) · `visual.ref_note`(선택).

> `visual.*` 블록 하나가 **sprite-forge 파라미터 / vector-graphics 명세 / sprite-picker 검색쿼리**로 어댑터 변환된다 — 같은 입력을 세 도구가 결정론적으로 소비. 등급 다채널 시각언어 정의는 [rarity-affixes.md](./rarity-affixes.md)의 `AFX-VISUAL-DIFF` 참조(여기서 재정의 안 함).

---

## (C) items.json 스키마 (게임 로드 + 린터 입력)

평면 JSON 한 파일. 아래는 T3 토다운 슈터(아이템 5개) **실제 예시**다.

```json
{
  "version": 1,
  "meta": { "slug": "ember-run", "tier": 3, "coreModel": "accumulating-pickup-build" },
  "balanceConfig": {
    "powerCurve": "base*pow(1.15,i)",
    "costGrowth": 1.6,
    "rarityBands": { "common": [8,12], "rare": [16,22], "epic": [26,34], "legendary": [40,52] },
    "multCap": 2.0,
    "deadItemBudgetPct": 0.7
  },
  "rarities": ["common", "rare", "epic", "legendary"],
  "items": [
    { "id": "ember-shot", "name": "잿불 탄", "kind": "equipment", "sub": "weapon",
      "rarity": "common", "slot": "weapon", "effect": { "atk": 3, "fireRate": 1 },
      "cost": 10, "tags": ["ranged","fire"], "role": "payoff", "archetype": "ember-stacker",
      "budget": 10, "flavor": "식지 않는 불씨.",
      "visual": { "silhouette": "short-barrel", "primary_shape": "wedge", "material": "metal",
        "palette": ["#c0392b","#e67e22"], "focal_motif": "ember-tip", "negative_space": "muzzle-gap",
        "rarity_visual": { "border": "#9aa0a6", "pips": 1, "glow": "none" }, "lighting": "NW" } },
    { "id": "stoke-coal", "name": "부싯돌", "kind": "material", "sub": "catalyst",
      "rarity": "rare", "effect": { "atk": 4 }, "cost": 18, "tags": ["fire"],
      "role": "enabler", "archetype": "ember-stacker", "budget": 18,
      "evolveInto": "wildfire-shot", "flavor": "불씨를 키운다.",
      "visual": { "silhouette": "small-shard", "primary_shape": "triangle", "material": "stone",
        "palette": ["#7f8c8d","#e67e22"], "focal_motif": "spark", "negative_space": "edge-chip",
        "rarity_visual": { "border": "#3498db", "pips": 2, "glow": "soft" }, "lighting": "NW" } },
    { "id": "wildfire-shot", "name": "들불 탄", "kind": "equipment", "sub": "weapon",
      "rarity": "epic", "slot": "weapon", "effect": { "atk": 9, "fireRate": 2, "burnDot": 4 },
      "cost": 30, "tags": ["ranged","fire"], "role": "payoff", "archetype": "ember-stacker",
      "budget": 30, "evolveFrom": ["ember-shot","stoke-coal"], "flavor": "한 발이 들판을 태운다.",
      "visual": { "silhouette": "long-barrel", "primary_shape": "wedge", "material": "metal",
        "palette": ["#c0392b","#e67e22","#f1c40f"], "focal_motif": "flame-crown",
        "negative_space": "muzzle-gap", "rarity_visual": { "border": "#9b59b6", "pips": 3, "glow": "strong" },
        "lighting": "NW", "evolve_from": "ember-shot" } },
    { "id": "frost-charm", "name": "서리 부적", "kind": "equipment", "sub": "charm",
      "rarity": "rare", "slot": "charm", "effect": { "def": 3, "slowAura": 1 },
      "cost": 17, "tags": ["defense","ice"], "role": "both", "archetype": "control",
      "budget": 17, "downsides": { "fireRate": -1 }, "flavor": "차가운 손이 적을 늦춘다.",
      "visual": { "silhouette": "pendant", "primary_shape": "circle", "material": "gem",
        "palette": ["#2980b9","#ecf0f1"], "focal_motif": "snowflake", "negative_space": "center-hole",
        "rarity_visual": { "border": "#3498db", "pips": 2, "glow": "soft" }, "lighting": "NW" } },
    { "id": "med-kit", "name": "구급 키트", "kind": "consumable", "sub": "potion",
      "rarity": "common", "effect": { "heal": 30 }, "cost": 8, "tags": ["sustain"],
      "role": "both", "archetype": "sustain", "budget": 9, "flavor": "한 숨 돌릴 틈.",
      "visual": { "silhouette": "box", "primary_shape": "square", "material": "cloth",
        "palette": ["#ecf0f1","#27ae60"], "focal_motif": "cross", "negative_space": "lid-seam",
        "rarity_visual": { "border": "#9aa0a6", "pips": 1, "glow": "none" }, "lighting": "NW" } }
  ],
  "sets": [ { "id": "ember-set", "pieces": ["ember-shot","wildfire-shot"], "thresholds": { "2": { "burnDot": 2 } } } ],
  "dropTables": [ { "id": "stage-1", "dropIlvl": 1, "entries": [
    { "item": "med-kit", "weight": 50 }, { "item": "ember-shot", "weight": 30 },
    { "item": "frost-charm", "weight": 12 }, { "item": "stoke-coal", "weight": 8 } ],
    "pity": { "rare": 10 } } ],
  "gates": { "nodes": [], "edges": [] }
}
```

대응하는 **ITEMS.md §3 카탈로그 표 예시** (같은 5개, 사람용 의도 진실):

| id | name | kind | rarity | effect | role/archetype | budget | flavor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ember-shot` | 잿불 탄 | equipment | common | atk+3, fireRate+1 | payoff/ember-stacker | 10 | 식지 않는 불씨. |
| `stoke-coal` | 부싯돌 | material | rare | atk+4 | enabler/ember-stacker | 18 | 불씨를 키운다.(→들불) |
| `wildfire-shot` | 들불 탄 | equipment | epic | atk+9, fireRate+2, burn4 | payoff/ember-stacker | 30 | 한 발이 들판을 태운다. |
| `frost-charm` | 서리 부적 | equipment | rare | def+3, slow / fireRate-1 | both/control | 17 | 차가운 손. |
| `med-kit` | 구급 키트 | consumable | common | heal30 | both/sustain | 9 | 한 숨 돌릴 틈. |

`frost-charm`의 `fireRate-1` 다운사이드와 `control` archetype이 `ember-stacker`와 다른 축을 만들어 함정템·지배템을 동시에 회피한다(`SYN-NO-DOMINANT`/`SYN-NO-TRAP`). budget이 등급 밴드(common 8~12, rare 16~22, epic 26~34) 안에 들어 strictly-better가 구조적으로 막힌다(`SYN-POWER-BUDGET`).

---

## (D) 밸런스 린트 체크리스트 (a~h)

작성과 **분리된 검수 패스**다(`ITEMS-SINGLE-SOURCE`). `lint-items.mjs`가 items.json을 읽어 (a)~(g)를 자동 검사하고, (h)는 사람이 보강한다. 위반은 §9 점검 로그에 적고 **재린트**한다. self-approve 금지.

| 코드 | 점검 항목 | 무엇을 대조하나 | 자동/수동 | 근거 원칙 |
| --- | --- | --- | --- | --- |
| (a) 스키마/필수필드/비주얼슬롯 | id·kind·rarity·effect 필수, `visual.*` 채움, `palette`가 §7 참조인가 | items.json ↔ 스키마·§7 | **자동** | `UX-DESC-SLOTS`, `ITEMS-SINGLE-SOURCE` |
| (b) 죽은 아이템 | 등급·비용 대비 budget이 동급 최저권 outlier(`deadItemBudgetPct` 밑) | item.budget ↔ 동급 분포 | **자동** | `SYN-NO-TRAP` |
| (c) 지배 전략 | 파레토 지배 = 모든 축에서 ≥, 비용은 ≤(strictly-better 쌍) | item 쌍 O(n²) 비교 | **자동** | `SYN-NO-DOMINANT` |
| (d) 곱연산 폭발 | 상한 없는 `mult`/`%` 스택, `multCap` 초과 조합 | effect mult 소스 ↔ `multCap` | **자동** | `SYN-ADD-VS-MULT` |
| (e) 등급별 파워예산 밴드 이탈 | budget이 `rarityBands[rarity]` 밖 outlier | item.budget ↔ `balanceConfig` | **자동** | `SYN-POWER-BUDGET`, `ECON-CURVE` |
| (f) 시너지 정합 | 고립 노드(시너지 0)·과밀 허브·도달불가 세트 | sets/archetype 인접 그래프 메트릭 | **자동** | `SYN-ENABLER-PAYOFF` |
| (g) softlock | 게이트 그래프 도달가능성(필수 키 도달 불가/소모) | `gates.nodes/edges` BFS | **자동** | `UTIL-NO-SOFTLOCK` |
| (h) 수동 플레이 점검 | "아무것도 안 써도 클리어 가능? 한 빌드만 항상 정답?" + 픽률(`itemStats` seen 대비 picked) | 자가/소수 플레이 + 로컬 카운터 | **수동** | `SYN-METRICS`, `BAL-USAGE-TELEMETRY-LITE` |

> (a)~(g)는 정량이라 결정론 스크립트로 옮길 수 있지만(스프레드시트가 하던 일), (h)는 "시뮬은 재미·전략을 못 본다"는 명시적 한계 때문에 사람 패스로 남는다. T≤1 게임은 (a)만 의미 있고 나머지는 적용 대상이 적다.
>
> **opt-in 자동 룰(데이터 제공 시):** items.json에 아이템별 `ev`(공통 단위 기대값)가 있으면 `lint-items.mjs`가 같은 kind+rarity의 **EV ±밴드 이탈**을 자동 검출하고(`SYN-EV-COMPARE`, 룰 `ev-band`), 최상위에 `itemStats: {id:{seen,picked}}`가 있으면 **저픽률**을 자동 검출한다(`SYN-METRICS`, 룰 `pick-rate`). 데이터가 없으면 이 둘은 (h) 수동으로 보강한다 — 즉 (h)의 "픽률" 항목은 `itemStats` 제공 시 자동화된다. 임계값은 `balanceConfig.evBandPct`(기본 0.25)·`pickRateFloor`(0.05)·`minSeen`(20)로 조정. `SYN-MONTE-CARLO`는 분포 시뮬이라 별도 `tools/loot-sim.mjs`(조건부 온디맨드) 소관이며 `lint-items.mjs`의 정적 룰에는 포함하지 않는다.

---

## (E) 도구 채택 결정 매트릭스

스킬은 큰 도구·의존성을 권하려는 유혹을 **명시적으로 억제**하고 '규모·정량성 적합도'를 결정 기준으로 제시한다. 무의존성 `.mjs` + (필요시) sprite-picker 컴패니언 서버 패턴 재사용이 컨벤션이다.

| 도구 | 무엇 | 비용 | 이득 | 권고 |
| --- | --- | --- | --- | --- |
| **`lint-items.mjs`** (밸런스/시너지 validator) | items.json 읽어 a~g 자동 린트, stdout 마지막 줄 단일 JSON(`{ok,errors,warnings}`) 계약 | 낮음(무의존성 단일 `.mjs` ~200~300줄) | 죽은아이템·지배전략·곱산폭발·밴드이탈·softlock 자동 포착. 스키마·시너지 룰 흡수 | **★강추(기본·온디맨드)** |
| `loot-sim.mjs` (드랍 몬테카를로) | 게임과 공유하는 드랍 함수로 10k 런, 미발견율·상위1% 폭주배수·등장률 출력 | 낮음(코어 20줄) | 천장·불운꼬리·코너케이스 분포 | **조건부**(랜덤드랍/수집/가챠 루프 있을 때만) |
| 갤러리 뷰어 (sprite-picker `serve.mjs`/picker 포크) | 아이콘+스탯 브라우저 시각 일람, 컴패니언 서버 + 파일 회수 | 중(뷰어 마운트 1개, serve.mjs 재사용) | 아이콘 붙은 큰 셋 시각 검토 | **조건부**(아이콘 배정 + 30+ 셋일 때만) |
| 독립 스키마 validator (ajv) | JSON Schema 검증 | 높음(**npm 의존성** = 컨벤션 위반) | — | **비권장**(linter (a) 룰로 흡수) |
| 시너지 그래프 시각화 (d3-force 등) | 노드-엣지 force-directed 렌더 | 높음(레이아웃 라이브러리 = 의존성) | — | **비권장**(linter (f) 메트릭으로 흡수) |

기본 결정: **`lint-items.mjs` = 강추**(1단계로 이것만), loot-sim/갤러리 = 조건부 온디맨드, ajv/그래프viz = 비권장(흡수). 임계값(`rarityBands`·`multCap` 등)은 게임마다 다르므로 items.json `balanceConfig`에 두고 린터가 읽는다 — **하드코딩 금지**. `lint-items.mjs`의 룰 그룹은 reference 원칙 코드(`SYN-*`·`ECON-*`·`UTIL-*`)와 1:1 매핑한다.

---

## 출처

- Balancing Multiplayer Games Part 2: Viable Options — Sirlin: https://www.sirlin.net/articles/balancing-multiplayer-games-part-2-viable-options
- Level 16: Game Balance — Ian Schreiber: https://gamedesignconcepts.wordpress.com/2009/08/20/level-16-game-balance/
- Avoiding Design Traps in Game Mechanics — Brandon Kidwell: https://www.gamedeveloper.com/design/kgd---avoiding-design-traps-in-game-mechanics
- Balance in Single-Player CRPGs — Josh Sawyer: https://www.tumblr.com/jesawyer/161302725596/balance-in-single-player-crpgs
- Design Insights: Power Budget — Apothecary Press: https://apothecary.press/2021/12/20/design-insights-power-budget/
- Video Game Balance: A Definitive Guide — gamedesignskills: https://gamedesignskills.com/game-design/game-balance/
- Monte Carlo Simulations for Game Design — Boards and Barley: https://boardsandbarley.com/2013/09/17/monte-carlo-simulations-for-game-design/
- Algorithms for calculating gacha probabilities — Kyle Chen: https://kylechen.net/writing/gacha-probability/
- Ajv JSON schema validator(의존성 — 비권장 근거): https://ajv.js.org/
- Avoid the cell and table swamp — MY.GAMES/War Robots: https://medium.com/my-games-company/avoid-the-cell-and-table-swamp-maintaining-game-balance-with-ease-9f3e90bf45ac
- Roguelike Itemization: Balancing Randomness and Player Agency — Wayline: https://www.wayline.io/blog/roguelike-itemization-balancing-randomness-player-agency
