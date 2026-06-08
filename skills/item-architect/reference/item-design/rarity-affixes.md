# 희귀도 시각언어 · 접사 · 절차 롤 — AFX (8원칙)

> [`item-architect`](../../SKILL.md)가 등급 체계·접사(모디파이어)·절차 아이템 생성을 둘 때(주로 T3~T4) 참조하는 도메인 파일. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 이 도메인은 Diablo/PoE/Borderlands가 대중화한 색 등급·prefix/suffix 접사·item level 게이트·가중 롤·pity를 **작은 웹게임용으로 축소**해 코드화한다. 핵심 번역: 6~7색을 **3~4색**으로, 접사 수백 개를 **풀당 6~12개**로, 무한 드롭+루트 필터를 **세션당 수 개**로 줄이고, 상위 등급은 수치가 아니라 **접사 슬롯폭**으로 의미를 만든다(파워크립 차단).

## 프레임워크 요약

희귀도·접사 시스템은 4개 축의 상호작용이다. (1) **희귀도 사다리** = 색으로 코드화한 단조 증가 위계, (2) **접사** = prefix/suffix 두 풀에서 뽑아 이름·스탯을 동시 절차생성, (3) **item level(ilvl)** = 어떤 접사 티어가 풀에 들어올지 게이트하는 보이지 않는 진행 변수, (4) **절차 롤** = 가중 빈도로 *무엇*을 뽑고 범위 롤로 *얼마나*를 굴린다. 작은 게임의 무기는 이 루프의 **상한이 짧다**는 점이다 — 적은 티어, 작은 버짓, 읽기 쉬운 색. 핵심 긴장은 변동비율 강화(흥분)와 파워크립/빈손 좌절(불안정) 사이이며, 우리는 **등급=슬롯폭**(`AFX-RARITY-MEANS-MORE`)으로 인플레이션을 막고 **pity 바닥**(`AFX-PITY-FLOOR`)으로 짧은 세션의 빈손을 막는다. 가변비율 추진력만 취하고 가챠 결제는 차용하지 않는다(`ECON-VARIABLE-RATIO` 참조, [economy-loot.md](./economy-loot.md)).

## 원칙 사전 (AFX)

### `AFX-RARITY-LADDER` 희귀도 색 사다리 (짧고 단조 증가)
- **정의:** 희귀도는 색으로 코드화된 단조 증가 사다리다. 표준 색 순서(grey<white<green<blue<purple<orange/gold)는 문화적·지각적 상징(흰=빈 서판, 보라=왕족 Tyrian 염료, 금=태양·신성)에 기대 학습 없이 직관적으로 읽힌다. 작은 게임은 **3~4칸**이면 충분하다 — 표준 색을 *상속*하면 학습비용이 0이다.
- **출처:** Loot (video games) — Wikipedia (https://en.wikipedia.org/wiki/Loot_(video_games)); Origins of Color-Coded Loot — Tales of the Aggronaut (https://aggronaut.com/2020/09/03/origins-of-color-coded-loot/); Color-Coded Item Tiers — TV Tropes (https://tvtropes.org/pmwiki/pmwiki.php/Main/ColorCodedItemTiers).
- **우리 엔진 구현(작은 웹게임):** `rarity` enum을 4단계로 — `common / rare / epic / legendary`. 권장 색은 **흰 → 파랑 → 보라 → 금**(초록은 모바일 변별 여유 위해 생략 가능). 글로벌 상수 하나로 모든 자매 스킬이 공유: `RARITY_STYLE = { common:{tint:0xcccccc,...}, rare:{tint:0x4a90e2,...}, epic:{tint:0x9b59b6,...}, legendary:{tint:0xf5a623,...} }`. 색 자체는 sprite-forge/vector-graphics(틴트·팔레트 스왑)·game-ui-hud(배지·툴팁)가 같은 키를 소비한다. 표준 색 표는 아래 §등급 표준 색 표 참조.
- **흔한 실패:** 7단계 이상으로 늘려 인접 색(파랑 vs 청록 vs 남색)이 32~48px·모바일에서 구분 안 됨. 색 순서를 표준과 다르게(예: 빨강=최하) 뒤집어 학습된 직관 파괴.
- **연관:** `AFX-RARITY-MEANS-MORE`, `AFX-VISUAL-DIFF`, `AFX-LEGENDARY`, [visual-inventory-ux.md](./visual-inventory-ux.md)의 `UX-RARITY-MULTI-CHANNEL`.

### `AFX-RARITY-MEANS-MORE` 상위 등급 = 수치 아닌 접사 슬롯폭
- **정의:** 등급이 오르면 단순히 숫자만 커지는 게 아니라 **붙을 수 있는 접사 슬롯 수**가 늘어난다. PoE의 핵심 교훈: Normal 0개 → Magic 최대 2개(prefix1+suffix1) → Rare 최대 6개(prefix3+suffix3). 이것이 "등급 = 잠재력의 폭"이라는 의미를 만들고, "보라 = 파랑 + 10%"식 루트 인플레이션을 막는다.
- **출처:** Modifiers — Path of Exile Wiki (https://pathofexile.fandom.com/wiki/Modifiers); Item rarity and affixes explained — Sportskeeda PoE2 (https://www.sportskeeda.com/mmo/path-exile-2-item-rarity-affixes-poe2); Information about Affix Generation — PlanetDiablo D2 (https://planetdiablo.eu/diablo2/itemdb/affix_info_en.php).
- **우리 엔진 구현(작은 웹게임):** 등급을 슬롯폭에 매핑 — `common`=0접사(베이스만), `rare`=1접사, `epic`=2접사, `legendary`=2접사 + 고정 유니크 효과 1개(`AFX-LEGENDARY`). `RARITY_STYLE`에 `affixSlots` 필드로 둔다. 슬롯 수 차이가 game-ui-hud 툴팁에서 **줄 수로 즉시** 보여 "왜 더 좋은지"가 한눈에 읽힌다. 같은 ilvl이라도 epic은 슬롯이 2개라 빌드 잠재력이 다르다 — 숫자가 아니라 *여지*가 위계를 만든다.
- **흔한 실패:** 모든 등급이 접사 1개씩만 갖고 숫자만 다르면 등급의 정체성이 사라지고, 후반에 수치가 무한 팽창(파워크립). 슬롯폭 차이 없이 배수만 키우는 것이 루트 인플레이션의 씨앗.
- **연관:** `AFX-PREFIX-SUFFIX`, `AFX-LEGENDARY`, [synergy-balance.md](./synergy-balance.md)의 `SYN-POWER-BUDGET`, [economy-loot.md](./economy-loot.md)의 `ECON-MEANINGFUL-UPGRADE`.

### `AFX-PREFIX-SUFFIX` prefix/suffix 두 풀 + 그룹 배타 + 이름 자동조립
- **정의:** 모디파이어를 prefix(이름 앞, 주로 공격·수치)와 suffix(이름 뒤 "of the ~", 주로 방어·유틸)로 분리하고 풀을 상호배타로 둔다. 각 접사는 **그룹(group) 태그**를 가져 같은 그룹 중복을 막는다(`+화염저항`×3 방지). 이름은 `prefix + base + suffix`로 자동 조립("Vorpal Sword of the Bear").
- **출처:** Modifiers — Path of Exile Wiki (https://pathofexile.fandom.com/wiki/Modifiers); Item Affixes — Project Diablo 2 Wiki (https://projectdiablo2.miraheze.org/wiki/Item_Affixes); A Guide to the Basic Terms of Item Generation — diablo2.io (https://diablo2.io/forums/a-guide-to-the-basic-terms-of-item-generation-t8350.html).
- **우리 엔진 구현(작은 웹게임):** 데이터 형태 — `affixPool = { prefixes:[...], suffixes:[...] }`, 각 항목 `{ id, group, statMods, weight, tierMin, nameFrag }`. 롤 시 prefix 풀·suffix 풀에서 **독립 추첨**, 뽑힌 그룹을 `Set`에 기록해 재추첨 시 제외. 이름은 `name = pre.nameFrag + " " + base.name + (suf ? " of the " + suf.nameFrag : "")`. 풀당 **6~12개**면 충분. `nameFrag` 단어 풀은 story-architect의 STORY.md 톤 프로파일을 주입해 명명(공포톤이면 "Cursed ... of Rot"). 접사 슬롯 수는 `AFX-RARITY-MEANS-MORE`가 결정.
- **흔한 실패:** 단일 평면 풀에서 무작위 N개를 뽑아 같은 스탯이 중복으로 붙음. prefix/suffix 구분이 없어 이름 자동조립이 안 돼 절차생성 명명의 재미(놀람)를 잃음.
- **연관:** `AFX-RARITY-MEANS-MORE`, `AFX-LEVEL-GATES`, `AFX-ROLL-WEIGHTED`, [identity-narrative.md](./identity-narrative.md)의 `IDENT-THEME-FAMILY`.

### `AFX-LEVEL-GATES` item level이 접사 티어를 게이트한다
- **정의:** 아이템에 보이지 않는 item level(ilvl)이 있고, 각 접사는 최소 ilvl 임계(`tierMin`)를 가져 그 이상에서만 후보가 된다. 높은 ilvl일수록 더 좋은 티어(T1=최고 롤)가 풀에 추가된다. 이것이 "진행 = 더 강한 롤 해금"이라는 보상 곡선을 만든다.
- **출처:** Understanding Item Tiers in PoE2 — iLvl Breakpoints — MMOJUGG (https://www.mmojugg.com/news/understanding-item-tiers-in-poe2.html); Information about Affix Generation — PlanetDiablo D2 (https://planetdiablo.eu/diablo2/itemdb/affix_info_en.php); Item Affixes — Project Diablo 2 Wiki (https://projectdiablo2.miraheze.org/wiki/Item_Affixes).
- **우리 엔진 구현(작은 웹게임):** 적/스테이지/월드맵 노드마다 `dropIlvl` 부여(level-architect 난이도 곡선 + world-map-architect 노드 깊이와 정렬). 접사에 `tierMin`을 두고 롤 후보 = `pool.filter(a => ilvl >= a.tierMin)`. 짧은 게임이므로 ilvl 단계는 **3~5개**면 충분(예: ilvl 1/2/3에서 보통/좋음/완벽 티어 순차 해금). 접사 티어 수치는 [economy-loot.md](./economy-loot.md)의 버짓 곡선(`ECON-CURVE`)과 같은 진행 인덱스 i를 공유한다.
- **흔한 실패:** 1스테이지에서 최고 티어가 떠 후반 보상이 무의미(파워 곡선 붕괴). 반대로 게이트가 너무 빡빡해 초반 드롭이 전부 쓰레기 → 첫인상 보상감 상실.
- **연관:** `AFX-ROLL-WEIGHTED`, `AFX-PREFIX-SUFFIX`, [economy-loot.md](./economy-loot.md)의 `ECON-CURVE`·`ECON-REWARD-PACING`, [level-architect](../../../level-architect/SKILL.md).

### `AFX-ROLL-WEIGHTED` 무엇은 가중 빈도로, 얼마나는 범위 롤로
- **정의:** 어떤 접사/등급이 나올지는 가중치(weight)로 정규화한 확률로, 뽑힌 접사의 수치는 `[min,max]` 범위 내 롤로 결정한다. *선택*과 *강도*를 분리하면 "희귀 접사를 뽑았는데 약하게 굴려"같은 추가 분산을 의도적으로 넣을 수 있어 수집 욕구가 살아난다.
- **출처:** Weight-based loot tables — Practical Game Design, O'Reilly (https://www.oreilly.com/library/view/practical-game-design/9781787121799/5e681823-ac5b-4b58-8ab2-216369a41986.xhtml); Loot Drop Rates Calculation Guide — PulseGeek (https://pulsegeek.com/articles/loot-drop-rates-calculation-guide-numbers-to-feel/); Information about Affix Generation — PlanetDiablo D2 (https://planetdiablo.eu/diablo2/itemdb/affix_info_en.php).
- **우리 엔진 구현(작은 웹게임):** 시드 RNG로 누적가중 추첨 — `pick(pool)`은 `Σweight` 대비 누적 비교, 이어서 `value = Phaser.Math.Linear(mod.min, mod.max, rng.frac())`로 수치(또는 끝값 편향). 시드(`Phaser.Math.RND.sow([seed])`)를 저장하면 런 재현·디버깅 용이(단일플레이라 서버검증 불필요). story/테마별 weight 프로파일을 교체해 같은 풀로 다른 무드 연출 가능.
- **흔한 실패:** 모든 접사를 등확률로 둬 "희귀하게 강한" 접사가 안 생겨 흥분 곡선이 평탄. 범위 롤을 안 해 같은 접사가 항상 같은 수치 → 동일 아이템 중복으로 수집 욕구 약화.
- **연관:** `AFX-LEVEL-GATES`, `AFX-PITY-FLOOR`, [economy-loot.md](./economy-loot.md)의 `ECON-VARIABLE-RATIO`·`ECON-REWARD-PACING`.

### `AFX-LEGENDARY` 최상위는 절차 롤이 아니라 손으로 짠 정체성
- **정의:** 최고 등급(legendary/unique)은 무작위 접사가 아니라 **고정된 유니크 효과 + 고유 이름·플레이버**로 만든다. 이것이 "빌드를 바꾸는 한 방"이라 절차생성 바다 위의 등대 역할을 한다(PoE Unique, Borderlands Legendary).
- **출처:** Rarity — Borderlands Wiki (https://borderlands.fandom.com/wiki/Rarity); Modifiers — Path of Exile Wiki (https://pathofexile.fandom.com/wiki/Modifiers); Loot (video games) — Wikipedia (https://en.wikipedia.org/wiki/Loot_(video_games)).
- **우리 엔진 구현(작은 웹게임):** legendary는 절차 롤 대신 **수작업 정의 테이블** — `LEGENDARIES = [{ id, name, art, fixedMods, gameplayTwist, storyRef }]`. `gameplayTwist`는 수치가 아니라 *행위*를 바꾸는 것이 이상적(`IDENT-VERB-OVER-STAT`, [identity-narrative.md](./identity-narrative.md)). story-architect STORY.md와 연결해 서사적 의미 부여(보스 드랍 명검 = 스토리 보상, `storyRef`). 개수는 작은 게임이므로 **5~15개**면 충분. 획득 연출은 juice-fx(슬로모·글로우)·chip-sound(상승 아르페지오)로 증폭.
- **흔한 실패:** legendary를 그냥 "접사 더 많은 epic"으로 두면 변혁감 없음. 반대로 수십 개로 풀어 변동비율 희소성·서사적 무게가 희석.
- **연관:** `AFX-RARITY-MEANS-MORE`, `AFX-VISUAL-DIFF`, [identity-narrative.md](./identity-narrative.md)의 `IDENT-LUDO-HARMONY`, [story-architect](../../../story-architect/SKILL.md).

### `AFX-VISUAL-DIFF` 등급 차이는 색만이 아니라 다채널로
- **정의:** 희귀도는 색 하나에만 기대지 말고 외곽선·글로우·파티클·아이콘 배지·획득 SFX 등 **다채널**로 중복 인코딩해 색각이상·작은 화면·저대비 배경에서도 읽히게 한다. 라벨 외곽선/그림자는 배경에 묻히는 걸 막는다. (이 코드는 여기서 정식 정의하되, UI 다채널 인코딩 규약은 [visual-inventory-ux.md](./visual-inventory-ux.md)의 `UX-RARITY-MULTI-CHANNEL`과 교차 — 색 단독 부호화 금지는 그쪽이 소유.)
- **출처:** How Color Theory Codifies Item Quality in Video Games — Claire Fishman, Medium (https://medium.com/@ClaireFish/how-color-theory-codifies-item-quality-in-video-games-104d8118044); Color-Coded Item Tiers — thfdev, Medium (https://medium.com/@thfdev/color-coded-item-tiers-df4f2821385c); Color-Coded Item Tiers — TV Tropes (https://tvtropes.org/pmwiki/pmwiki.php/Main/ColorCodedItemTiers).
- **우리 엔진 구현(작은 웹게임):** rarity → `{ tint, outlineWidth, glowAlpha, particleCount, sfxId }` 매핑 테이블 **하나**(=`RARITY_STYLE`)로 sprite-forge/vector-graphics(틴트·외곽선), juice-fx(파티클·글로우), chip-sound(SFX), game-ui-hud(배지·툴팁 색)를 동시 구동. 모바일 대비 위해 외곽선 **1~2px 필수**. 색만으로 구분하면 적록색각이상(남성 약 8%)에게 초록/주황 혼동 → 최소 색+외곽선+1채널 이상을 항상 함께. 실제 인벤토리/툴팁 배치·접근성 체크리스트는 [visual-inventory-ux.md](./visual-inventory-ux.md).
- **흔한 실패:** 색만으로 등급을 표시. 강렬한 배경 위 글로우 없는 아이콘이 묻힘. 등급별 SFX가 같아 "주웠을 때 귀로 등급을 모름".
- **연관:** `AFX-RARITY-LADDER`, `AFX-LEGENDARY`, [visual-inventory-ux.md](./visual-inventory-ux.md)의 `UX-RARITY-MULTI-CHANNEL`, [juice-fx](../../../juice-fx/SKILL.md)·[chip-sound](../../../chip-sound/SKILL.md).

### `AFX-PITY-FLOOR` 짧은 세션엔 불운 바닥(pity/비복원)을 깐다
- **정의:** 순수 RNG는 긴 불운 연속(dry streak)을 낳는다. 비복원추출(뽑은 건 버킷에서 제거)이나 pity(N회 실패 후 보장)로 하한을 보장하면, 특히 세션이 짧은 게임에서 "빈손 종료"를 막아 잔존율을 지킨다. soft pity는 실패할수록 확률을 곡선으로 올린다. 변동비율(흥분)과 pity(좌절 방지)는 **짝**이다.
- **출처:** Loot drop best practices — Daniel Cook, Game Developer (https://www.gamedeveloper.com/design/loot-drop-best-practices); Rare Loot Box Rewards Trigger Larger Arousal and Reward Responses — PMC (https://pmc.ncbi.nlm.nih.gov/articles/PMC7882574/); The Slot Machine Psyche — PlayStation Universe (https://www.psu.com/news/the-slot-machine-psyche-how-variable-ratio-reinforcement-drives-modern-gaming-engagement/).
- **우리 엔진 구현(작은 웹게임):** 런/세션 단위 카운터를 localStorage에 저장(`pityCounter`). K회 연속 common이면 다음 드롭을 rare 이상으로 승급, 또는 "이번 스테이지 보장 드롭" 풀을 비복원으로 운영. 짧은 세션이라 pity 임계를 **작게**(예: 5~8회). 가챠 pity의 *구조*만 빌려오고 결제는 절대 차용 금지 — 이건 `ECON-VARIABLE-RATIO`/`ECON-PITY`([economy-loot.md](./economy-loot.md))의 무과금 라인과 정합한다.
- **흔한 실패:** pity 없이 신규 유저 첫 세션이 전부 흰템 → 이탈. 반대로 pity가 너무 후해 항상 보장되면 변동비율의 흥분이 죽음.
- **연관:** `AFX-ROLL-WEIGHTED`, `AFX-LEVEL-GATES`, [economy-loot.md](./economy-loot.md)의 `ECON-VARIABLE-RATIO`·`ECON-PITY`.

## 등급 표준 색 표 (4단계 — 상속하면 학습비용 0)

표준 색을 그대로 상속한다(`AFX-RARITY-LADDER`). 색은 **단독 부호화 금지** — 반드시 외곽선·글로우 등 1채널 이상과 함께(`AFX-VISUAL-DIFF`, UI 규약은 [visual-inventory-ux.md](./visual-inventory-ux.md)의 `UX-RARITY-MULTI-CHANNEL`).

| rarity | 색(권장 hex) | affixSlots | outline | glow | particles | 의미/상징 |
|---|---|---|---|---|---|---|
| `common` | 회색~흰 `0xcccccc` | 0 (베이스만) | 1px 어두움 | 없음 | 0 | 평범·빈 서판 |
| `rare` | 파랑 `0x4a90e2` | 1 | 1px 파랑 | 약 | 적음 | 주목할 가치 |
| `epic` | 보라 `0x9b59b6` | 2 | 2px 보라 | 중 | 보통 | 왕족(Tyrian) |
| `legendary` | 금/주황 `0xf5a623` | 2 + 고정 유니크 1 | 2px 금 + 깜빡임 | 강 | 많음 | 태양·신성·전설 |

- 초록(green) 단계는 **모바일 변별 여유**를 위해 생략 가능(흰→파랑→보라→금 4색 권장). 5단계가 꼭 필요하면 파랑 앞에 초록을 넣되, 인접 색 대비를 위 hex보다 더 벌린다.
- 색 순서는 **표준을 절대 뒤집지 않는다**(학습된 직관 보존). 빨강은 등급이 아니라 "저주/디버프"같은 별도 의미축에만 쓴다.

## 절차 롤 의사코드 (시드 RNG · 버짓 정합)

```js
// rng = Phaser.Math.RND (시드 저장 시 런 재현). budget()·STAT_COST는 economy-loot.md 소유.
function rollItem(base, ilvl, rarity) {
  const slots = RARITY_STYLE[rarity].affixSlots;          // AFX-RARITY-MEANS-MORE
  if (rarity === 'legendary') return pickLegendary(rng);  // AFX-LEGENDARY (절차 롤 아님)
  const used = new Set();
  const mods = [];
  for (let i = 0; i < slots; i++) {
    const pool = (i % 2 === 0 ? affixPool.prefixes : affixPool.suffixes)
      .filter(a => ilvl >= a.tierMin && !used.has(a.group)); // AFX-LEVEL-GATES + 그룹 배타
    if (!pool.length) break;
    const a = pickWeighted(pool, rng);                    // AFX-ROLL-WEIGHTED (무엇)
    used.add(a.group);
    mods.push({ ...a, value: rollValue(a, rng) });        // AFX-ROLL-WEIGHTED (얼마나)
  }
  return { name: assembleName(base, mods), rarity, ilvl, mods }; // AFX-PREFIX-SUFFIX
}
```

- `pickWeighted` = 누적가중, `rollValue` = `Phaser.Math.Linear(min,max,rng.frac())`. 버짓 상한(`SYN-POWER-BUDGET`/`ECON-CURVE`)을 넘으면 다음 슬롯을 끊어 파워크립 차단.
- 드롭 직전 pity 카운터 체크로 rarity를 승급(`AFX-PITY-FLOOR`).

## 출처

- Loot (video games) — Wikipedia: https://en.wikipedia.org/wiki/Loot_(video_games) — 색 등급 표준 순서·legendary=orange의 대중적 기준.
- Origins of Color-Coded Loot — Tales of the Aggronaut: https://aggronaut.com/2020/09/03/origins-of-color-coded-loot/ — Diablo→WoW로 색 코드가 정착한 역사.
- Color-Coded Item Tiers — TV Tropes: https://tvtropes.org/pmwiki/pmwiki.php/Main/ColorCodedItemTiers — 색이 즉시 위계를 전달한다는 트로프.
- Color-Coded Item Tiers — thfdev, Medium: https://medium.com/@thfdev/color-coded-item-tiers-df4f2821385c — 라벨 그림자/외곽선 가독성.
- How Color Theory Codifies Item Quality in Video Games — Claire Fishman, Medium: https://medium.com/@ClaireFish/how-color-theory-codifies-item-quality-in-video-games-104d8118044 — 색의 지각·문화 상징 + 다채널 변별.
- Modifiers — Path of Exile Wiki: https://pathofexile.fandom.com/wiki/Modifiers — prefix/suffix 풀·그룹·티어·Unique 규칙의 원전.
- Item rarity and affixes explained — Sportskeeda PoE2: https://www.sportskeeda.com/mmo/path-exile-2-item-rarity-affixes-poe2 — 등급별 접사 슬롯 수(Normal/Magic/Rare).
- Understanding Item Tiers in PoE2 — iLvl Breakpoints — MMOJUGG: https://www.mmojugg.com/news/understanding-item-tiers-in-poe2.html — ilvl이 접사 티어를 게이트.
- Information about Affix Generation — PlanetDiablo (D2): https://planetdiablo.eu/diablo2/itemdb/affix_info_en.php — frequency 기반 확률·affixlevel·그룹 배타.
- Item Affixes — Project Diablo 2 Wiki: https://projectdiablo2.miraheze.org/wiki/Item_Affixes — ilvl·qlvl·alvl 산출, prefix/suffix 분리.
- A Guide to the Basic Terms of Item Generation — diablo2.io: https://diablo2.io/forums/a-guide-to-the-basic-terms-of-item-generation-t8350.html — 접사 생성 용어 정리.
- Rarity — Borderlands Wiki: https://borderlands.fandom.com/wiki/Rarity — orange=고유 명명+특수효과(legendary 정체성).
- Weight-based loot tables — Practical Game Design, O'Reilly: https://www.oreilly.com/library/view/practical-game-design/9781787121799/5e681823-ac5b-4b58-8ab2-216369a41986.xhtml — 가중 루트테이블 패턴.
- Loot Drop Rates Calculation Guide — PulseGeek: https://pulsegeek.com/articles/loot-drop-rates-calculation-guide-numbers-to-feel/ — 드롭률을 체감으로 변환.
- Loot drop best practices — Daniel Cook, Game Developer: https://www.gamedeveloper.com/design/loot-drop-best-practices — 비복원추출·보장 드롭(pity 바닥)의 원전.
- Rare Loot Box Rewards Trigger Larger Arousal and Reward Responses — PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC7882574/ — 희귀 보상의 각성·보상 반응(다채널 연출 근거).
- The Slot Machine Psyche — PlayStation Universe: https://www.psu.com/news/the-slot-machine-psyche-how-variable-ratio-reinforcement-drives-modern-gaming-engagement/ — 변동비율 강화 심리(흥분-pity 짝).
