# 아이템 택소노미·분류 — CAT (11 원칙)

> [`item-architect`](../../SKILL.md)가 "플레이어가 습득·사용하는 모든 것"을 행위축으로 분류할 때 참조하는 도메인 파일. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 이 도메인은 모든 아이템의 **최상위 분류 트리**다 — 외형(검·물약·열쇠)이 아니라 *플레이어가 그것으로 하는 동사*를 분류축으로 삼아, "습득·사용하는 모든 것"을 6대 행위축으로 MECE하게 덮는다. Wikipedia·Qichin·TV Tropes·draftbrowns가 거의 같은 6분류로 수렴한 업계 합의를, 단일플레이·무서버·CC0·모바일 짧은세션 제약에 맞게 코드화했다.

## 프레임워크 요약

분류축은 **이름표가 아니라 행위(verb/affordance)**다(`CAT-VERB-AXIS`). "체력 물약"이라는 외형은 표면이고, 실제로 코드·UI·밸런싱을 가르는 건 *입는다·쓴다·가진다·만든다·교환한다·꾸민다*라는 동사다. 이 6대 행위축이 아이템의 `kind` enum이 되고, `kind`가 곧 `use(item)`의 dispatch 키가 된다. 패시브/렐릭은 "슬롯 없는 영구 장비"로, traversal 능력은 "영구 권한 키"로 흡수해 7번째 애매한 범주("misc")를 만들지 않는 것이 핵심이다. 그리고 모바일 1~3분 세션은 인지 예산이 작으므로 6범주를 다 켜는 게 아니라 **장르가 요구하는 2~3범주만** 활성화한다(`CAT-SCOPE-FIT`) — "덜 넣기"가 곧 모바일 분류 설계다.

| 6대 행위축 | 동사 | `kind` 값 | 한 줄 |
|---|---|---|---|
| 소모품 | 쓴다(consume) | `consumable` | 1회 소비, 즉시/지속 효과 |
| 장비 | 입는다(equip) | `equipment` | 착용 슬롯 + 영구 스탯 채널 |
| 키/게이트 | 가진다(hold) | `key` | 자원 아님, 이진 권한 플래그 |
| 통화 | 교환한다(spend) | `currency` | 무게 없는 카운터 |
| 재료 | 만든다(craft) | `material` | 레시피 입력 = 경제 싱크 |
| 코스메틱 | 꾸민다(wear) | `cosmetic` | 스탯 0, 자기표현 |

---

## 원칙 사전 (CAT)

### `CAT-VERB-AXIS` 외형이 아니라 '행위'로 분류
- **정의:** 최상위 분류축은 아이템 이름(weapon/herb)이 아니라 **플레이어가 그것으로 하는 동사**다: equip / consume / hold(게이트) / craft / spend / wear. 한 아이템의 `kind`는 곧 그것이 노출하는 상호작용(어떤 버튼·UI·코드 경로를 타는가)을 결정한다.
- **출처:** Machinations "Affordances in game systems design"(아이템 affordance = 가능한 행위) https://machinations.io/articles/affordances-in-game-systems-design ; Wikipedia *Item (game terminology)* 의 사용 메커니즘 분류(자동/수동/보관) https://en.wikipedia.org/wiki/Item_(game_terminology) ; Qichin "What's in the Bag?" (행위 기반 5범주) https://medium.com/@qichinvt/whats-in-the-bag-bbe7c609cfac .
- **우리 엔진 구현(작은 웹게임):** 아이템 스키마에 `kind` 필드를 6대 행위축 enum으로 고정(`consumable|equipment|key|material|currency|cosmetic`). `kind`가 곧 dispatch 키 — `use(item)`이 `switch(item.kind)`로 분기하고, 신규 아이템은 데이터(items.json)만 추가하면 코드 변경 없이 동작한다. 공통 캐논 `CAT-VERB-AXIS`(principles.md §2-3)의 정식 정의가 여기다 — "kind enum이 곧 코드 dispatch 키"가 한 줄 근거. 동작은 kind/sub만 보고 분기하므로 아이템 id별 하드코딩 금지.
- **흔한 실패:** "검/물약/열쇠/돈"을 평면 string 태그로만 두고 동작은 아이템 id마다 하드코딩 → 신규 아이템마다 분기 폭증. 외형(스프라이트)으로 분류해 같은 행위인데 다른 코드 경로를 타게 만드는 것.
- **연관:** `CAT-SIX-BUCKET`, `CAT-CONSUMABLE-SUBTYPE`, `CAT-EQUIP-SLOT`, `CAT-SCOPE-FIT`

### `CAT-SIX-BUCKET` 6대 최상위 범주로 MECE하게 덮기
- **정의:** "습득·사용하는 모든 것"을 6개 상호배타·전체포괄(MECE) 버킷으로 덮는다: ① 소모품(consumable) ② 장비(equipment) ③ 키/게이트(key) ④ 통화(currency) ⑤ 재료(material) ⑥ 코스메틱(cosmetic). 패시브/렐릭/유물은 ②장비의 하위(슬롯 없는 영구 장착, `CAT-RELIC`)로, 능력부여/traversal 아이템은 ③키의 하위(영구 권한 해금)로 흡수한다.
- **출처:** Qichin 5범주(Equipment/Consumables/Treasure/Instruments/Harm) https://medium.com/@qichinvt/whats-in-the-bag-bbe7c609cfac ; Wikipedia(consumables·equipment·cosmetics·tokens·raw materials) https://en.wikipedia.org/wiki/Item_(game_terminology) ; TV Tropes *Standard RPG Items* https://tvtropes.org/pmwiki/pmwiki.php/Main/StandardRPGItems . 4+ 출처가 거의 동일 6분류로 수렴(교차검증 강).
- **우리 엔진 구현(작은 웹게임):** `kind` enum을 정확히 이 6값으로. 새 아이템 설계 시 "이건 6버킷 중 어디?"를 강제 질문(인터뷰 게이트). 1~3분 세션이므로 한 게임에서 6범주를 다 쓰지 말고 장르당 2~3범주만 활성(`CAT-SCOPE-FIT`). 아래 [분류 트리 표](#6대-행위축-분류-트리-mece)가 각 범주의 하위·dispatch 키·모바일 상한을 한눈에 준다.
- **흔한 실패:** 7번째 애매한 범주("기타·misc")를 만들어 분류를 회피하는 것 — misc는 분류 실패의 신호. 패시브 렐릭을 위해 별도 최상위 범주를 또 파서 트리가 비대해지는 것(→ `CAT-RELIC`로 흡수).
- **연관:** `CAT-VERB-AXIS`, `CAT-RELIC`, `CAT-SCOPE-FIT`, `SCOPE-ONE-CORE`([scope-complexity.md](./scope-complexity.md))

### `CAT-CONSUMABLE-SUBTYPE` 소모품을 4하위로 쪼개기 (Recovery·Ability·Ammo·Necessity)
- **정의:** 소모품은 단일 덩어리가 아니다. **Recovery**(HP/MP 회복) · **Ability**(1회용 특수효과: 스크롤·폭탄·부스트) · **Ammunition**(원거리 무기 연료) · **Necessity**(없으면 대체 데미지: 식량·연료·산소)로 나뉜다. 각 하위는 보충 압력·UI·밸런싱이 다르다.
- **출처:** Qichin "What's in the Bag?" (Recovery/Ability/Ammunition/Necessities 명시) https://medium.com/@qichinvt/whats-in-the-bag-bbe7c609cfac ; Wikipedia(consumables → recovery, ability, ammunition, necessities) https://en.wikipedia.org/wiki/Item_(game_terminology) .
- **우리 엔진 구현(작은 웹게임):** `kind:"consumable"` + `sub:"recovery|ability|ammo|necessity"`. 작은 웹게임에선 Recovery·Ability가 주력. Necessity(서바이벌 식량/산소)는 짧은 세션과 충돌하니 신중히. 효과는 데이터로(`effect:{heal:30}` / `effect:{buff:"speed",ms:5000}`) — 소모품 효과의 깊은 모델·리필 케이던스·호딩 함정은 [utility-consumables.md](./utility-consumables.md)(`UTIL-*`) 소유. `sub`별 획득·사용 연출은 [juice-fx](../../../wgf-juice-fx/SKILL.md), SFX는 [chip-sound](../../../wgf-chip-sound/SKILL.md)에 위임.
- **흔한 실패:** 모든 소모품을 "포션" 한 종류로 뭉뚱그려 전술적 선택을 없애는 것. ammo를 소모품과 별개 시스템으로 또 만들어 중복.
- **연관:** `CAT-VERB-AXIS`, `CAT-SIX-BUCKET`, `UTIL-REFILL-CADENCE`/`UTIL-HOARD-TRAP`([utility-consumables.md](./utility-consumables.md))

### `CAT-EQUIP-SLOT` 장비는 '슬롯'으로 정의하고 슬롯 수를 적게
- **정의:** 장비는 **착용 슬롯**(weapon/armor/accessory…)으로 구조화된다. 슬롯은 *동시에 받을 수 있는 스탯 채널의 수*를 정의하며, 슬롯 수가 빌드 다양성과 UI 복잡도를 동시에 결정한다. 슬롯별로 교체 주기가 다르다(무기=잦음, 액세서리=드묾).
- **출처:** GameDeveloper.com *Equippable Items on RPGs* (primary/secondary/tertiary 교체 주기) https://www.gamedeveloper.com/design/equippable-items-on-role-playing-games ; ORK Framework *Ability & Item Types*(equipment = weapon/protective/accessory) https://orkframework.com/guide/tutorials/status-system-setup/06-ability-item-types/ ; TV Tropes(weapon·armor·accessory 슬롯).
- **우리 엔진 구현(작은 웹게임):** 모바일 화면·짧은 세션 → 슬롯 **2~3개로 제한**(예: 무기 1 + 액세서리 1~2). `equip(slot, item)`이 이전 장비를 자동 해제하고 스탯을 재계산. 슬롯/스탯 상태는 registry 또는 localStorage에 직렬화(`UX-LOCAL-SAVE` 정합, principles.md §0). 슬롯 그리드·툴팁 UI는 [game-ui-hud](../../../wgf-game-ui-hud/SKILL.md)가 그림. 장비 등급·접사 부착은 [rarity-affixes.md](./rarity-affixes.md) 소유.
- **흔한 실패:** MMO식 10+ 슬롯(머리·어깨·손목·반지2·트링켓2…)을 모바일에 이식 → 화면·인지 과부하. 슬롯 없이 "장착 가능한 아이템 무한 누적"으로 스탯 인플레.
- **연관:** `CAT-RELIC`, `CAT-SIX-BUCKET`, `UX-INV-MINIMAL`([visual-inventory-ux.md](./visual-inventory-ux.md)), `AFX-*`([rarity-affixes.md](./rarity-affixes.md))

### `CAT-RELIC` 패시브/렐릭은 '슬롯 없는 영구 장비'로 모델링
- **정의:** 렐릭·유물·패시브 아이템(한 번 얻으면 영구히 효과가 붙고 능동 사용이 없음)은 장비의 특수 케이스 — **슬롯이 없고 해제 불가, 누적**되는 장비다. 별도 최상위 범주가 아니라 `kind:"equipment"`의 하위로 흡수해 트리를 깔끔히 유지한다. 빌드의 정체성을 만든다.
- **출처:** 빌드 중심 로그라이트의 렐릭/패시브 시너지 통념(게임명은 IP-safe하게 기법만 차용, [ip-license-guard](../../../wgf-ip-license-guard/SKILL.md)); GameDeveloper.com *Equippable Items on RPGs*(영구 효과형 장비) https://www.gamedeveloper.com/design/equippable-items-on-role-playing-games .
- **우리 엔진 구현(작은 웹게임):** `kind:"equipment", sub:"relic", slot:null, stackEffect:true`. 획득 시 `modifiers[]`에 push하고 스탯/룰을 재합성. 한 런에서 누적되는 효과는 재미요소 **FE-BUILD**([fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md))와 직결 — 렐릭 2~3개 조합이 새 플레이를 만들도록 설계. 시너지 곱산 격리·지배전략 방지는 [synergy-balance.md](./synergy-balance.md)(`SYN-*`) 소유. localStorage 메타진행이면 영구 해금 패시브로도 활용.
- **흔한 실패:** 렐릭을 능동 소모품처럼 "사용" 버튼으로 노출(혼동). 시너지 고려 없이 +스탯 패시브만 양산 → FE-BUILD 죽음. 너무 강한 영구 패시브로 이후 난이도 곡선([level-architect](../../../wgf-level-architect/SKILL.md)) 붕괴.
- **연관:** `CAT-EQUIP-SLOT`, `CAT-KEY-GATE`, `SYN-ENABLER-PAYOFF`/`SYN-ADD-VS-MULT`([synergy-balance.md](./synergy-balance.md))

### `CAT-KEY-GATE` 키/퀘스트/능력부여는 '진행 게이트'다(자원이 아님)
- **정의:** 열쇠·플롯 아이템·traversal 능력(더블점프·갈고리·잠수)은 소모되는 자원이 아니라 **이진 권한 플래그**다: 가졌나/못 가졌나로 월드의 문을 연다. 메트로배니아는 진행을 *능력 획득*으로 게이트한다(열쇠가 아니라 능력으로). 게이트는 능력 획득 *전에 보여야* 한다("여긴 나중에").
- **출처:** Pudgycat "What Is A Metroidvania" https://pudgycat.io/what-is-a-metroidvania-game-genre-explained/ ; TV Tropes *Make a Metroidvania*(진행=업그레이드 게이팅, 게이트는 능력 전에 가시화) https://tvtropes.org/pmwiki/pmwiki.php/SoYouWantTo/MakeAMetroidvania ; thegamer.com(더블점프 게이팅 기법) https://www.thegamer.com/prince-of-persia-nails-the-metroidvania-art-of-burying-the-double-jump/ .
- **우리 엔진 구현(작은 웹게임):** `kind:"key"`는 인벤토리 카운트가 아니라 **boolean 플래그**(`flags.hasGrapple=true`)로 저장. 스택/판매 불가. 게이트는 잠긴 시각 단서를 미리 배치([level-architect](../../../wgf-level-architect/SKILL.md) 위상·전조와 연동). 능력형 키는 `CAT-RELIC`와 유사하나 *월드 접근*을 연다는 점이 다름. 키↔자물쇠 순서·교착(softlock) 방지의 깊은 원칙은 [utility-consumables.md](./utility-consumables.md)(`UTIL-NO-SOFTLOCK`·`UTIL-LOCK-KEY`) 소유.
- **흔한 실패:** 키를 일반 소모품·스택 아이템과 같은 슬롯에 섞어 실수로 버리거나 팔게 만드는 것. 게이트를 능력 직전에 갑툭튀로 배치(아하 모먼트 상실). 짧은 웹게임에 키 백트래킹을 과하게 넣어 세션 길이 폭증.
- **연관:** `CAT-RELIC`, `CAT-SIX-BUCKET`, `UTIL-NO-SOFTLOCK`/`UTIL-LOCK-KEY`([utility-consumables.md](./utility-consumables.md))

### `CAT-CURRENCY-MINIMAL` 통화는 최소로 (소프트 1개, 메타 통화는 신중)
- **정의:** 통화는 교환 매개 아이템이다. F2P는 soft(플레이로 획득)/hard(과금)의 듀얼 통화로 paying↔non-paying을 가른다. 그러나 통화 종류가 늘수록 인지 부담·경제 밸런싱 난이도가 급증한다. 단일플레이엔 이 분리가 불필요.
- **출처:** Unity/ironSource "11 in-game currencies" https://medium.com/ironsource-levelup/11-in-game-currencies-you-need-to-know-about-8775c6724bcb ; GameDeveloper.com *Types of game currencies in mobile F2P*(soft/hard 듀얼) https://www.gamedeveloper.com/business/types-of-game-currencies-in-mobile-free-to-play ; Machinations(hard 통화 과잉 = 희소성 붕괴) https://machinations.io/articles/game-economy-design-free-to-play-games .
- **우리 엔진 구현(작은 웹게임):** 기본 **소프트 통화 1종**(coin)만. `currency`는 무게 없는 별도 카운터로(인벤토리 슬롯 차지 X — Qichin "money는 인벤토리 밖"). 메타진행이 필요하면 *런-내 통화 + 영구 통화* 2종까지(과금 hard 통화 아님 — 우리는 서버·결제 없음, `ECON-VARIABLE-RATIO` 도박 구조 금지 정합, principles.md §0). 공급/소비 곡선·상점 가격은 [economy-loot.md](./economy-loot.md)(`ECON-*`) 소유.
- **흔한 실패:** 모바일 F2P를 흉내내 통화 4~5종(coin·gem·token·shard·dust)을 단일플레이에 이식 → 환전표가 게임보다 복잡. hard 통화·loot box·gacha를 서버 없는 게임에 억지 이식.
- **연관:** `CAT-MATERIAL-SINK`, `CAT-SCOPE-FIT`, `ECON-CURVE`/`ECON-COST-CURVE`([economy-loot.md](./economy-loot.md))

### `CAT-MATERIAL-SINK` 제작재료는 '경제 싱크 + 진행 게이트'로 설계
- **정의:** 제작재료(광석·약초·부품)는 그 자체로 안 쓰이고 **레시피의 입력**으로 소비된다. 재료는 (a)자원 싱크로 인플레를 흡수하고 (b)업그레이드를 게이트한다. "소비되는 재료(consumed)"와 "있어야만 하는 도구(present, 비소비)"는 구분된다.
- **출처:** GameDeveloper.com *7 crafting systems game designers should study*(재료=레시피 입력) https://www.gamedeveloper.com/design/7-crafting-systems-game-designers-should-study ; Envato Tuts+ *5 Approaches to Crafting Systems* https://code.tutsplus.com/5-approaches-to-crafting-systems-in-games-and-where-to-use-them--cms-22628a ; numberanalytics *Crafting Systems in Game Design*(consumed vs present resource) https://www.numberanalytics.com/blog/ultimate-guide-crafting-systems-game-design .
- **우리 엔진 구현(작은 웹게임):** `kind:"material", sub:"consumed|tool"`. 레시피는 데이터(`{in:{ore:3,herb:1}, out:"potion"}`). 짧은 세션이므로 재료 **2~4종**으로 제한, 깊은 제작 트리(채광→제련→합금→…) 금지. 재료가 통화 싱크 역할도 하면 통화를 더 줄일 수 있음(`CAT-CURRENCY-MINIMAL` 보강). 재료 드롭 가중·싱크 밸런싱은 [economy-loot.md](./economy-loot.md) 소유.
- **흔한 실패:** 수십 종 재료 + 다단계 제작 트리를 1~3분 게임에 넣는 것. 재료를 장비/소모품과 같은 인벤토리에 섞어 "쓸 수 없는 잡템"이 가방을 채우는 것(Qichin "Loot=vendor junk" 문제).
- **연관:** `CAT-CURRENCY-MINIMAL`, `CAT-SCOPE-FIT`, `ECON-CURVE`([economy-loot.md](./economy-loot.md))

### `CAT-COSMETIC-FREE` 코스메틱은 '무료 자기표현·실력 증표'로 (과금 아님)
- **정의:** 코스메틱(스킨·색·트레일·칭호)은 게임 밸런스에 영향 없는 **자기표현/사회적 신호** 아이템이다. F2P에선 핵심 과금원이지만, 그 매력의 본질은 *공정성을 안 해치는 자랑거리*다. 단일플레이에선 이를 실력·진행의 무료 보상으로 전환한다.
- **출처:** udonis *The Cosmetic Monetization Trend*(코스메틱=비기능·자기표현·사회신호) https://www.blog.udonis.co/mobile-marketing/mobile-games/cosmetic-monetization ; 1d3 *Player-positive monetization: vanity items* https://www.1d3.com/blog/player-positive-monetization-vanity-items .
- **우리 엔진 구현(작은 웹게임):** `kind:"cosmetic"`, 스탯 modifier 없음(순수 시각). 도전 과제·기록 갱신·수집 완성의 보상으로 무료 지급 → 재미요소 **FE-COLLECT**([fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md))와 직결. 스킨은 [sprite-forge](../../../wgf-sprite-forge/SKILL.md)(픽셀)/[vector-graphics](../../../wgf-vector-graphics/SKILL.md)(벡터)의 팔레트 스왑·변형으로 절차생성하면 에셋 비용 거의 0(또는 CC0는 [sprite-picker](../../../wgf-sprite-picker/SKILL.md)). localStorage에 `unlockedSkins[]` 저장.
- **흔한 실패:** 서버·결제 없는 게임에 가짜 "프리미엄 코스메틱 상점"을 흉내내는 것. 코스메틱에 몰래 스탯을 붙여 grind-to-win으로 만드는 것 — 코스메틱의 신뢰가 깨짐.
- **연관:** `CAT-NARRATIVE-PLACE`, `CAT-SCOPE-FIT`, `IDENT-MEANINGFUL-COLLECT`([identity-narrative.md](./identity-narrative.md))

### `CAT-SCOPE-FIT` 장르·세션 길이에 맞춰 범주 수를 의도적으로 줄여라
- **정의:** 6대 범주를 다 쓰는 건 AAA/RPG의 사치다. 1~3분 모바일 세션은 인지 예산이 작아, **장르가 요구하는 2~3범주만** 활성화해야 한다. 인벤토리 클러터 방지는 명시적 best practice다.
- **출처:** numberanalytics(자원 관리로 clutter 방지·밸런스 유지) https://www.numberanalytics.com/blog/ultimate-guide-crafting-systems-game-design ; draftbrowns *Loot Generator*("balance between rarity, distribution, engagement") https://draftbrowns.com/loot-generator-treasure-types-rarity-item-distribution ; (엔진 제약 = 짧은 세션·모바일, principles.md §0).
- **우리 엔진 구현(작은 웹게임):** 인터뷰에서 "이 게임이 쓸 범주는?"을 먼저 잠근다(복잡도 티어 결정 직후, principles.md §1). 장르별 처방은 아래 [장르별 범주 처방 표](#장르별-범주-처방). 공통 캐논 `SCOPE-ONE-CORE`(한 게임 한 핵심 모델, principles.md §2-2)·`SCOPE-GENRE-FIT`의 택소노미 측 적용이 이 코드다 — 깊은 티어 사다리·장르 정합은 [scope-complexity.md](./scope-complexity.md) 소유.
- **흔한 실패:** "RPG처럼 6범주 다 넣자"로 시작해 모바일 화면·짧은 세션에 인벤토리 관리 부담을 떠넘기는 것. 범주를 늘려놓고 각 범주에 아이템 1~2개만 둬서 시스템이 헛도는 것.
- **연관:** `CAT-SIX-BUCKET`, `CAT-CURRENCY-MINIMAL`, `CAT-EQUIP-SLOT`, `SCOPE-ONE-CORE`([scope-complexity.md](./scope-complexity.md))

### `CAT-NARRATIVE-PLACE` 아이템은 '획득 맥락'으로 이야기한다
- **정의:** 아이템은 스탯 덩어리가 아니라 **세계·이야기를 전달하는 매개**다. 트롤에게서 트롤 테마 전리품이, 전장에서 군용 장비가 나오면 서사 정합성이 생긴다. *어디서 어떻게 얻었나*가 그냥 마을 상점에서 산 것보다 강하게 각인된다(환경 서사). 이 코드는 여기서 분류 측면(획득처↔테마 매핑)만 정식 정의하고, 효과·이름·톤이 코어 동사·주제와 같은 말이어야 한다는 정체성 원칙은 [identity-narrative.md](./identity-narrative.md)(`IDENT-*`)가 소유한다.
- **출처:** GameDeveloper.com *Equippable Items on RPGs*("items can tell a story… NPC in village ≠ found in middle of nowhere") https://www.gamedeveloper.com/design/equippable-items-on-role-playing-games ; draftbrowns(thematic alignment for immersion) https://draftbrowns.com/loot-generator-treasure-types-rarity-item-distribution .
- **우리 엔진 구현(작은 웹게임):** 아이템 데이터에 `flavor` 1줄 + `theme` 태그를 두고, 드롭처(적·지역)와 테마를 맞춤([level-architect](../../../wgf-level-architect/SKILL.md) 위상·바이옴). 고유명사·flavor 톤은 [story-architect](../../../wgf-story-architect/SKILL.md)의 STORY.md Glossary(`TL-CANON-SINGLE-SOURCE`)를 상속해 오리지널로 정의(`IDENT-CONSISTENT-VOICE` 정합, principles.md §0). 툴팁 flavor 표시는 [game-ui-hud](../../../wgf-game-ui-hud/SKILL.md). IP-safe: 상용 게임 고유명사 차용 금지([ip-license-guard](../../../wgf-ip-license-guard/SKILL.md)).
- **흔한 실패:** 모든 아이템을 출처·테마 무관하게 균일 상점 풀에서 뽑아 서사를 죽이는 것. flavor 텍스트에 상용 게임 고유명사를 그대로 차용(IP 위반).
- **연관:** `CAT-COSMETIC-FREE`, `IDENT-LUDO-HARMONY`/`IDENT-MEANINGFUL-COLLECT`([identity-narrative.md](./identity-narrative.md))

---

## 6대 행위축 분류 트리 (MECE)

"습득·사용하는 모든 것"을 빠짐없이 덮는 분류 트리. 각 범주의 하위·코드 dispatch 키·모바일 상한을 함께 명시한다(`CAT-SIX-BUCKET`·`CAT-SCOPE-FIT`).

| 범주(`kind`) | 동사 | 하위(`sub`) | dispatch 동작 | 영속 위치 | 모바일 상한 |
|---|---|---|---|---|---|
| **consumable** | 쓴다 | `recovery` / `ability` / `ammo` / `necessity` | `use()` → effect 적용 후 count-- | registry(런-내) | Recovery·Ability 위주, 종류 ≤4 |
| **equipment** | 입는다 | `weapon` / `armor` / `accessory` / `relic`(slot:null) | `equip(slot,item)` → 스탯 재계산 | localStorage | 슬롯 2~3개 |
| **key** | 가진다 | `keyitem` / `ability`(traversal) | flag set, `flags.hasX=true` | localStorage | 게이트당 1, 백트래킹 최소 |
| **currency** | 교환한다 | `soft`(coin) / `meta`(영구) | `spend()` / `earn()` 카운터 | localStorage | 통화 1종(메타 포함 ≤2) |
| **material** | 만든다 | `consumed` / `tool`(present) | `craft(recipe)` → in 소비, out 생성 | registry/localStorage | 재료 2~4종, 1단 레시피 |
| **cosmetic** | 꾸민다 | `skin` / `trail` / `title` | `applyCosmetic()`, 스탯 0 | localStorage(`unlockedSkins[]`) | 절차생성 팔레트 스왑 |

- **흡수 규칙(7번째 범주 금지):** 패시브/렐릭 = `equipment.relic`(`CAT-RELIC`), traversal 능력 = `key.ability`(`CAT-KEY-GATE`). "misc"는 분류 실패 신호.
- **공통 스키마:** `{id, kind, sub?, slot?, rarity?, effect?, modifiers?, stack?, flavor?, theme?, visual{…}}`. 동작은 `kind`/`sub`만 보고 분기(아이템 id 하드코딩 금지, `CAT-VERB-AXIS`). `rarity`/접사는 [rarity-affixes.md](./rarity-affixes.md), `visual.*` 슬롯은 [visual-inventory-ux.md](./visual-inventory-ux.md) 소유.

## 장르별 범주 처방

장르가 활성 범주를 거의 정한다(`CAT-SCOPE-FIT`). 디폴트는 아래 — 인터뷰에서 비틀 수 있다. 더 깊은 핵심 모델·티어 처방은 [scope-complexity.md](./scope-complexity.md), principles.md §4 빠른 처방 참조.

| 장르 스캐폴드 | 활성 범주(2~3) | 보통 끄는 범주 | 기본 티어 |
|---|---|---|---|
| **endless-runner** | consumable(부스트) + currency(coin) + cosmetic | equipment·key·material | T2~T3 |
| **arcade-classic** | consumable(파워업) + (선택)cosmetic | 나머지 전부 | T1~T2 |
| **topdown-shooter** | equipment(relic) + consumable + currency | key·cosmetic(선택) | T3 |
| **platformer-game**(메트로배니아) | key(능력) + equipment + consumable | currency(선택)·material | T2~T3 |
| **puzzle-game** | currency + cosmetic (또는 0) | equipment·key·material | T2 |

- 갈등·전투가 약한 게임이면 표현(코스메틱·수집 로어)이 주가 될 수 있다(`CAT-COSMETIC-FREE`·`CAT-NARRATIVE-PLACE`).
- 진행감만 필요하면 아이템 0 + 점수/해금으로도 충분(`SCOPE-PROGRESSION-MIN`, [scope-complexity.md](./scope-complexity.md)) — Tier 0을 부끄러워하지 않는다.

---

## 출처

- Wikipedia — Item (game terminology): https://en.wikipedia.org/wiki/Item_(game_terminology) — 장르별 정리 + 사용 메커니즘(자동/수동/보관) 횡단 기준.
- Qichin, "What's in the Bag?" (Medium): https://medium.com/@qichinvt/whats-in-the-bag-bbe7c609cfac — 행위 기반 5범주(Equipment/Consumables/Treasure/Instruments/Harm), 소모품 4하위, money는 인벤토리 밖.
- TV Tropes — Standard RPG Items: https://tvtropes.org/pmwiki/pmwiki.php/Main/StandardRPGItems — RPG 관습 범주(healing·status·weapon·armor·accessory·key·currency·crafting) 확인.
- GameDeveloper.com — Equippable Items on Role Playing Games: https://www.gamedeveloper.com/design/equippable-items-on-role-playing-games — 슬롯 교체 주기(primary/secondary/tertiary), "items can tell a story".
- GameDeveloper.com — Types of game currencies in mobile free-to-play: https://www.gamedeveloper.com/business/types-of-game-currencies-in-mobile-free-to-play — soft/hard 듀얼 통화 통념(단일플레이엔 불필요).
- GameDeveloper.com — 7 crafting systems game designers should study: https://www.gamedeveloper.com/design/7-crafting-systems-game-designers-should-study — 재료 = 레시피 입력 + 자원 싱크.
- ORK Framework — Ability & Item Types: https://orkframework.com/guide/tutorials/status-system-setup/06-ability-item-types/ — equipment = weapon/protective/accessory 슬롯 분류.
- draftbrowns — Loot Generator (Types/Rarity/Distribution): https://draftbrowns.com/loot-generator-treasure-types-rarity-item-distribution — 6분류 수렴(Weapons/Armor/Consumables/Materials/Special), thematic alignment.
- Machinations — Affordances in game systems design: https://machinations.io/articles/affordances-in-game-systems-design — 아이템 affordance = 가능한 행위(verb 분류축 근거).
- Machinations — Game economy design in Free-to-Play games: https://machinations.io/articles/game-economy-design-free-to-play-games — hard 통화 과잉 = 희소성 붕괴.
- Unity/ironSource LevelUp — 11 in-game currencies: https://medium.com/ironsource-levelup/11-in-game-currencies-you-need-to-know-about-8775c6724bcb — 통화 종류 과잉 시 인지 부담.
- Pudgycat — What Is A Metroidvania: https://pudgycat.io/what-is-a-metroidvania-game-genre-explained/ — 진행 = 능력 게이팅.
- TV Tropes — Make a Metroidvania: https://tvtropes.org/pmwiki/pmwiki.php/SoYouWantTo/MakeAMetroidvania — 게이트는 능력 획득 전에 가시화.
- thegamer.com — burying the double jump: https://www.thegamer.com/prince-of-persia-nails-the-metroidvania-art-of-burying-the-double-jump/ — traversal 능력형 키 게이팅 기법.
- Envato Tuts+ — 5 Approaches to Crafting Systems: https://code.tutsplus.com/5-approaches-to-crafting-systems-in-games-and-where-to-use-them--cms-22628a — 제작 레시피 접근법.
- numberanalytics — Crafting Systems in Game Design: https://www.numberanalytics.com/blog/ultimate-guide-crafting-systems-game-design — consumed vs present resource, clutter 방지.
- udonis — The Cosmetic Monetization Trend: https://www.blog.udonis.co/mobile-marketing/mobile-games/cosmetic-monetization — 코스메틱 = 비기능·자기표현·사회신호.
- 1d3 — Player-positive monetization: vanity items: https://www.1d3.com/blog/player-positive-monetization-vanity-items — vanity = player-positive 보상.
