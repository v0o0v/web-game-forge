# 비주얼 묘사 · 아이콘 · 인벤토리 · 플랫폼 UX — UX (24)

> [`item-architect`](../../SKILL.md)가 아이템 **아이콘 묘사(이미지 생성용)·인벤토리·툴팁·모바일 UX·저장**을 설계할 때 참조하는 도메인 파일. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 이 도메인은 "각 아이템의 이미지를 잘 만들고(묘사) → 작은 화면에서 한눈에 담고·비교하고·장착하고(인벤토리·툴팁) → 모바일·서버없음 제약 안에서 저장·조작한다(플랫폼)"는 세 층을 다룬다. 아이콘/UI/픽셀 리서치(silhouette·squint test·등급 다채널·재질 램프, thumb zone·tap target·localStorage 5MiB·LRU eviction)를 **작은 2D 웹게임용**으로 코드화했다. ★이 파일의 핵심은 `UX-DESC-SLOTS`의 `visual.*` 슬롯 스키마 — 생성 도구가 결정론적으로 소비하는 구조화 묘사다.

## 프레임워크 요약

아이템 비주얼·UX는 한 덩어리가 아니라 세 질문의 답이다. **(1) 무엇인가** — 실루엣·단일 주제·친숙한 메타포로 32~48px에서 "검/물약/열쇠"가 즉시 읽히게(`UX-SILHOUETTE-FIRST`·`UX-ONE-SUBJECT`·`UX-FAMILIAR-METAPHOR`). **(2) 얼마나 좋은가** — 색만이 아니라 테두리·핍·글로우 다채널로 등급을(`UX-RARITY-MULTI-CHANNEL`). **(3) 무엇으로 만들어졌나** — 재질 명도 램프와 전역 마스터 팔레트로 톤을(`UX-MATERIAL-RAMP`·`UX-PALETTE-DISCIPLINE`). 이 세 답을 산문이 아니라 **고정 키 슬롯**(`visual.*`)으로 적어, sprite-forge(픽셀)·vector-graphics(벡터)·sprite-picker(CC0)가 같은 입력을 결정론적으로 소비하게 하는 것이 `UX-DESC-SLOTS`의 요지다(공통 캐논 10 근거).

그 다음, 플레이어가 그 아이템을 **만지는 표면**을 설계한다. 핵심 긴장은 "의미 있는 결정 vs 무의미한 정리노동", "편의(QoL) vs 주체성". 작은 2D 웹게임에서 AAA 인벤토리(그리드 테트리스·드래그&드롭·다단계 정렬·무게 관리)는 거의 항상 순수 비용이다 — 1~3분 세션·작은 화면·엄지 조작이 **하드 상한**이기 때문(`SCOPE-PLATFORM-BUDGET` 근거). 그래서 디폴트는 "가볍게, 결정은 굵게, 비교는 자동으로". 저장은 localStorage 단일 권위(서버 없음)이며 5MiB·LRU·Safari 7일 eviction을 가정해 방어하되, 단일플레이라 tamper 방어에는 시간을 쓰지 않는다.

## 원칙 사전 (UX)

### `UX-SILHOUETTE-FIRST` 실루엣 우선
- **정의:** 아이콘 식별의 1차 채널은 색이 아니라 외곽 실루엣이다. 단색으로 칠해도 무엇인지 구분돼야 하고, 한 세트 안에서 실루엣이 서로 충분히 달라야 한다. 형태를 먼저 잠그면 색·등급·재질 변주가 형태를 안 깬다.
- **출처:** ArtStation "Importance of Silhouette in Game Props" (https://www.artstation.com/blogs/francescos010/G9DqY/instantly-recognizable-the-importance-of-silhouette-in-game-props), 픽셀아트 가이드 Alain Galvan "단색 실루엣으로 안 읽히면 색을 더해도 못 고친다"(https://alain.xyz/blog/pixel-art-design-for-game-dev), UX Design Institute 7 principles(Visual Clarity).
- **우리 엔진 구현(작은 웹게임):** `visual.silhouette`에 외곽을 한 단어 형태로 기록(예: "긴 삼각 날 + 십자 가드", "둥근 플라스크 + 좁은 목"). sprite-forge에는 1px 외곽선 + 단색 fill로 먼저 squint test → 통과 후 내부 디테일. 같은 카테고리(검 5종)면 `visual.variant_axis`(날 길이/곡률/가드)로 실루엣 변주축을 명시해 카테고리 내에서도 구별. 실루엣 구별성은 생성 도구 다양성 제약으로 백프레셔(sprite-forge/vector-graphics 산출 게이트).
- **흔한 실패:** 색만 다르고 실루엣이 같은 세트(글자 없이는 구분 불가). 단, 물약은 색=효과가 관습이라 예외적 허용. 외곽이 배경과 비슷한 명도라 셀 안에서 뭉개지는 것.
- **연관:** `UX-ONE-SUBJECT`, `UX-SMALL-SIZE-TRUTH`, `UX-CATEGORY-GRAMMAR`, `UX-DESC-SLOTS`

### `UX-SMALL-SIZE-TRUTH` 최종 표시 크기로 판정 (squint test)
- **정의:** 아이콘은 디자인 캔버스가 아니라 실제 인게임 표시 크기(모바일 32~48px 셀)에서 읽혀야 한다. 작게 줄여 "흐린 덩어리"가 되면 디테일 과잉이다. squint test(눈을 가늘게 떠 흐릿하게 봐도 주제가 읽히는가)로 검증.
- **출처:** NN/g "Squint Test"(https://www.nngroup.com/videos/squint-test/), Polypane "Debug your visual hierarchy with the squint test"(https://polypane.app/blog/debug-your-visual-hierarchy-with-the-squint-test/), UX Planet "과한 디테일=blurry blob"(https://uxplanet.org/practical-guide-to-icon-design-794baf5624c8), Microsoft app icon 가이드(작은 크기 가독성).
- **우리 엔진 구현(작은 웹게임):** `visual.display_px`(목표 셀 px, 기본 48) 기록. 절차생성은 그 배수(48의 2x=96)로 작업하되 다운스케일 미리보기를 함께 검수. Phaser에서 `pixelArt: true`(nearest)로 픽셀 보존. 작은 셀에서 안 보일 미세 디테일은 획득 연출(확대 팝업)에서만 노출 — juice-fx 위임([juice-fx](../../../wgf-juice-fx/SKILL.md)).
- **흔한 실패:** 256px 일러스트 퀄리티로 디테일을 넣고 48px로 줄여 다 사라지는 것. 1px 그라디언트 남발로 다운스케일 시 muddy해지는 것.
- **연관:** `UX-SILHOUETTE-FIRST`, `UX-MATERIAL-RAMP`, `UX-PALETTE-DISCIPLINE`, `UX-DESC-SLOTS`

### `UX-ONE-SUBJECT` 단일 주제 + 음영 공간
- **정의:** 한 아이콘은 하나의 아이디어/주제만 담는다. 강한 포컬 포인트 1개 + 주변 음영 공간(negative space). 경쟁하는 시각 요소가 둘 이상이면 클러터로 읽힘이 무너진다.
- **출처:** Game Developer "Understanding Focal Points in UI Design"(https://www.gamedeveloper.com/design/understanding-focal-points-in-ui-design), Material Design 3 Icons(https://m3.material.io/styles/icons/designing-icons), UX Design Institute(Simplicity).
- **우리 엔진 구현(작은 웹게임):** `visual.focal_motif`(이 아이콘이 말하는 단 하나, 예: "독병=초록 액체", "지도조각=찢긴 모서리") + `visual.negative_space`(여백 의도). 셀의 ~15% 패딩을 비워 그리드에서 숨 쉬게. 합성 아이템("불붙은 검")은 베이스(검)+수식자(불) **1개까지만**.
- **흔한 실패:** 한 칸에 무기+배경+이펙트+텍스트 다 욱여넣기. 풀블리드로 가장자리까지 채워 옆 칸과 붙어 보이는 것.
- **연관:** `UX-SILHOUETTE-FIRST`, `UX-CATEGORY-GRAMMAR`, `UX-MIN-CLUTTER`, `UX-DESC-SLOTS`

### `UX-FAMILIAR-METAPHOR` 친숙한 메타포 사용
- **정의:** 새 시각 언어를 발명하지 말고 플레이어가 이미 아는 관습을 쓴다(하트=체력, 깃털=속도, 방패=방어, 코인=화폐, 돋보기=검색). 메타포가 카테고리를 즉시 전달한다.
- **출처:** Morphic "convey item category through visual metaphor"(https://morphic.com/resources/how-to/make-game-icons-for-inventory-ui), Material Design(established metaphors), UX Design Institute(Familiarity).
- **우리 엔진 구현(작은 웹게임):** `visual.category_metaphor`(무기/방어/소비/재료/열쇠/화폐 표준 메타포에 매핑). story-architect STORY.md 톤과 충돌 안 하게: 같은 "회복"도 판타지=물약병, SF=주사기, 코지=빵. 메타포 선택은 STORY.md가 제약([story-architect](../../../wgf-story-architect/SKILL.md), `IDENT-LUDO-HARMONY` 정합).
- **흔한 실패:** 독창성 위해 관습 무시(체력을 보라색 사각형으로). 같은 메타포를 두 다른 기능에 재사용해 혼동.
- **연관:** `UX-CATEGORY-GRAMMAR`, `UX-SILHOUETTE-FIRST`, `UX-DESC-SLOTS`

### `UX-RARITY-MULTI-CHANNEL` 등급은 색 단독 금지 (다채널)
- **정의:** 희귀도를 색만으로 전달하지 않는다. 색 사다리(white/grey→green→blue→purple→orange/gold, Diablo·WoW 관습)를 쓰되, 색 + (테두리 스타일, 코너 핍/별 개수, 글로우, 애니메이션) 중 최소 1개를 **중복 부여**한다. 적록 색약 약 5%·모바일 OLED 색 왜곡·흑백 스크린샷 공유까지 견디는 redundancy.
- **출처:** Chris Fairfield "Unlocking Colorblind Friendly Game Design"(redundancy·5% 통계, https://chrisfairfield.com/unlocking-colorblind-friendly-game-design/), Game Informer "Surprising Origins of Loot Rarity Colors"(EverQuest→Dark Age of Camelot purple→WoW 표준화, https://gameinformer.com/2019/05/18/the-surprising-origins-of-loot-rarity-colors), TV Tropes "Color-Coded Item Tiers"(https://tvtropes.org/pmwiki/pmwiki.php/Main/ColorCodedItemTiers), Splendor(보석 고유 shape) 교차검증.
- **우리 엔진 구현(작은 웹게임):** `visual.rarity_visual`이 (a) 색(전역 `rarity_colors` 상수 참조), (b) 테두리 스타일 토큰, (c) 코너 핍/별 개수(common 0→legendary 4), (d) legendary만 정적 글로우 텍스처를 결정. 색은 **본체가 아니라 game-ui-hud 프레임/테두리에 위임** — 본체 색은 재질이 정해 등급만 바뀌어도 재질감 보존·재생성 불필요([game-ui-hud](../../../wgf-game-ui-hud/SKILL.md)). 글로우는 모바일 GPU 부담 줄이려 정적 합성, sparkle 애니메이션은 획득 순간만(juice-fx). 등급 색 정식 사다리·접사 시각 규칙은 [rarity-affixes.md](./rarity-affixes.md) 소유(여기선 UX 부호화만).
- **흔한 실패:** "테두리 색만" 표시. 모든 등급에 글로우를 줘 변별력 0. 애니메이션 글로우를 저사양 모바일에 60fps로 돌려 발열. 비표준 순서(녹색=전설).
- **연관:** `UX-MATERIAL-RAMP`, `UX-PALETTE-DISCIPLINE`, `UX-INV-MINIMAL`, [rarity-affixes.md](./rarity-affixes.md)의 `AFX-VISUAL-DIFF`

### `UX-MATERIAL-RAMP` 재질 명시 + 명도 램프
- **정의:** 재질(금속/나무/가죽/보석/천/돌/유리)은 좁은 3~4단 명도 램프(dark→mid→light)와 하이라이트 위치로 표현한다. 재질이 톤·무게·가치감을 전달하고, 타이트한 램프가 muddy transition을 막고 세트 일관성을 지킨다.
- **출처:** media.io "Pixel Art Color Palette Ideas"(tight ramp dark→mid→light, https://www.media.io/color-palette/pixel-art-color-palette.html), Clip Studio "How to Render Metallic Surfaces"(https://www.clipstudio.net/how-to-draw/archives/159970), Pixel Art App "Best Canvas Resolution"(32x32에서 재질당 3~4색, https://pixelartapp.com/resolutions-guide).
- **우리 엔진 구현(작은 웹게임):** `visual.material: { primary, secondary }` + `visual.palette`(램프 hex 또는 named ramp 키). sprite-forge에 재질별 표준 램프 프리셋(metal=차가운 회청 하이라이트, wood=갈색 결, gem=고채도 코어+흰 스펙큘러). vector-graphics는 같은 재질을 그라디언트 스톱으로([vector-graphics](../../../wgf-vector-graphics/SKILL.md)). sprite-picker는 `material` 키로 CC0 후보 필터([sprite-picker](../../../wgf-sprite-picker/SKILL.md)).
- **흔한 실패:** 재질당 색 8개+로 작은 크기에서 노이즈. 모든 재질에 같은 회색 램프(금속/돌 구분 안 됨). 등급마다 본체 색을 통째로 바꿔 같은 검의 재질감을 깨는 것.
- **연관:** `UX-PALETTE-DISCIPLINE`, `UX-CONSISTENT-LIGHT`, `UX-RARITY-MULTI-CHANNEL`, `UX-DESC-SLOTS`

### `UX-CONSISTENT-LIGHT` 라이팅·앵글·스케일 일관성
- **정의:** 한 세트의 모든 아이콘은 동일한 가상 광원 방향(관습: 좌상단 NW), 동일한 시점 앵글, 동일한 상대 스케일 규칙을 공유한다. 그래야 "같은 가족"으로 보이고 그리드가 정돈된다.
- **출처:** Morphic "same artistic direction and proportions"(https://morphic.com/resources/how-to/make-game-icons-for-inventory-ui), 컨셉 브리프 가이드 Neil Blevins(라이팅 셋업 명시, http://www.neilblevins.com/art_lessons/concept_brief/concept_brief.htm), UX Design Institute(Consistency Across the Board).
- **우리 엔진 구현(작은 웹게임):** 아이템별이 아니라 **스타일가이드 헤더에 1회 정의하고 모든 아이템이 상속**: `light_dir: NW`, `view_angle: front|3q`, `relative_scale` 규칙(단검 < 양손검, 단 셀을 벗어나지 않게 캡). `visual.lighting` 슬롯은 기본 상속, 예외만 오버라이드. 절차생성 파라미터에 광원 방향 고정.
- **흔한 실패:** 아이템마다 광원 방향이 달라 셀마다 그림자가 따로 노는 것. 실제 물리 크기를 그대로 반영해 반지 1px, 망토가 셀을 꽉 채움(가독성 위해 정규화 필요).
- **연관:** `UX-MATERIAL-RAMP`, `UX-PALETTE-DISCIPLINE`, `UX-CATEGORY-GRAMMAR`, `UX-DESC-SLOTS`

### `UX-PALETTE-DISCIPLINE` 제한 팔레트 · 전역 마스터
- **정의:** 작은 캔버스는 색 수가 적을수록 명료하다. 게임 전역 마스터 팔레트(16~32색)를 정하고 아이템은 그 안에서만 고른다. 적은 색이 실루엣과 1px 외곽선이 일하게 만든다.
- **출처:** media.io "fewer colors → shapes/silhouettes do communication"(https://www.media.io/color-palette/pixel-art-color-palette.html), Pixel Art App 32x32 해상도 가이드(색 절제, https://pixelartapp.com/resolutions-guide), Microsoft app icon 가이드.
- **우리 엔진 구현(작은 웹게임):** `assets/palette.master.json` 전역 팔레트를 sprite-forge·vector-graphics·sprite-picker가 공유. `visual.palette`는 자유 hex가 아니라 마스터의 인덱스/키 참조(통일성 강제). 희귀도 색은 별도 reserved 슬롯(`rarity_colors` 상수). 모바일 OLED 절전 위해 과채도 자제.
- **상류 권위(D6):** `assets/palette.master.json`은 상류 디렉터 [`style-architect`](../../../wgf-style-architect/SKILL.md)(`style.json`의 `master_palette`)가 정한다 — `style.json`이 있으면 아이템은 그 마스터를 **상속**(게임 전 비주얼 응집), 없으면 아이템 §7이 **인라인으로 마스터를 정의**(하위호환).
- **흔한 실패:** 아이템마다 임의 hex로 팔레트가 100색+ 되어 화면 불협. 마스터 팔레트 없이 도구별 색이 달라 세트가 어긋남.
- **연관:** `UX-MATERIAL-RAMP`, `UX-CONSISTENT-LIGHT`, `UX-RARITY-MULTI-CHANNEL`, `UX-DESC-SLOTS`

### `UX-CATEGORY-GRAMMAR` 카테고리별 시각 문법
- **정의:** 같은 카테고리(무기/방어/소비/재료/열쇠) 아이템은 공유 시각 규칙(공통 베이스 형태·배치·프레임)을 갖고, 개별 차이는 정해진 변주축에서만 준다. 카테고리가 형태로 먼저 읽히고 개체가 디테일로 읽힌다.
- **출처:** Jovial Graphics "Iconography: Your Game's Alphabet"(일관된 기호 체계, https://www.jovialgraphics.com/blog/iconography-your-games-alphabet), Morphic(thematic coherence), thewingless 인벤토리 가이드(uniform patterns reduce learning curve, https://thewingless.com/index.php/2021/07/26/10-simple-ways-you-can-improve-your-videogame-inventory-screen-game-ui-ux-design-course/).
- **우리 엔진 구현(작은 웹게임):** reference에 카테고리→시각 문법 표(예: 소비=용기 실루엣·중앙 정렬, 재료=원물 덩어리·하단 무게중심). `visual.category`가 베이스 템플릿을 호출하고 아이템은 `visual.variant_axis` 값만 다르게. 카테고리 enum은 `CAT-VERB-AXIS`([taxonomy.md](./taxonomy.md))의 `kind`와 1:1, game-ui-hud 인벤토리 필터 탭과도 1:1.
- **흔한 실패:** 같은 카테고리인데 어떤 건 프레임 있고 어떤 건 없고 정렬도 제각각. 카테고리 신호 없이 전부 자유 형태라 분류 단서 0.
- **연관:** `UX-SILHOUETTE-FIRST`, `UX-FAMILIAR-METAPHOR`, `UX-INV-MINIMAL`, [taxonomy.md](./taxonomy.md)의 `CAT-VERB-AXIS`

### `UX-DESC-SLOTS` 묘사는 산문이 아니라 `visual.*` 슬롯 ★
- **정의:** 아이템 비주얼 묘사는 한 문단 산문이 아니라 **구조화된 고정 키 슬롯**(`visual.*`)으로 적는다. 각 슬롯은 sprite-forge/vector-graphics/sprite-picker가 결정론적으로 소비하는 토큰이다. "멋진 전설 검" 같은 평가어는 도구가 매번 다르게 그린다 — 형태/재질/팔레트를 토큰화해야 같은 입력→같은 결과.
- **출처:** Neil Blevins "Concept Brief"(짧게·필요한 것만·레퍼런스에 용도 주석, http://www.neilblevins.com/art_lessons/concept_brief/concept_brief.htm), 80.lv "Concept Art from Brief to Delivery"(재질·형태·라이팅·앵글 명시, https://80.lv/articles/concept-art-for-clients-from-brief-to-delivery), Game Developer "Crafting the Perfect Game Art Brief"(https://www.gamedeveloper.com/design/crafting-the-perfect-game-art-brief).
- **우리 엔진 구현(작은 웹게임):** items.json의 각 아이템에 `visual:` 블록을 고정 스키마로(아래 §`visual.*` 슬롯 스키마). 산문은 `concept` 한 줄에만. 이 블록을 그대로 3도구로 어댑터 변환(아래 §도구 어댑터 표). 공통 캐논 10(`UX-DESC-SLOTS`/`UX-SILHOUETTE-FIRST`) 근거 — "비주얼은 묘사가 아니라 슬롯으로". 레퍼런스 첨부 시 `ref_note`로 용도 명시("녹 텍스처만 참조: <url>").
- **흔한 실패:** 평가어만 적고 형태/재질/팔레트 비명시 → 도구가 추측 → 매번 다른 결과. 레퍼런스만 던지고 무엇을 차용할지(전체 형태 vs 질감) 안 적어 엉뚱한 부분 복제.
- **연관:** `UX-SILHOUETTE-FIRST`, `UX-MATERIAL-RAMP`, `UX-RARITY-MULTI-CHANNEL`, `UX-CATEGORY-GRAMMAR` (이 도메인의 모든 visual 코드가 슬롯의 한 키로 결집)

### `UX-TAP-TARGET` 손가락 크기 타겟 (44~48px)
- **정의:** 모든 탭 가능한 슬롯·사용·버리기·정렬 버튼은 최소 44×44 CSS px(Apple HIG) / 48×48dp(Material, 물리 ~9mm)를 보장한다. 아이콘이 24px여도 패딩 포함 히트영역은 하한을 채운다. 인접 타겟 중심 간격 최소 24px(WCAG 2.5.8 AA).
- **출처:** LogRocket "accessible touch target sizes"(Apple/Material/WCAG 수렴, https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/), Google Material 접근성(48dp, https://support.google.com/accessibility/android/answer/7101858), Smashing Magazine "rage taps"(https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/).
- **우리 엔진 구현(작은 웹게임):** Phaser 4에서 셀 hit area를 시각 크기와 분리: `setInteractive({ hitArea: new Phaser.Geom.Rectangle(...) })`로 최소 변을 DPR 기준 44~48px. 절차생성 아이콘(16/32px)은 패딩과 함께 업스케일 배치. 모바일 하니스/game-ui-hud 슬롯 컴포넌트에 `MIN_TAP=48` 상수 강제.
- **흔한 실패:** 데스크톱 디아블로식 1셀=32px 촘촘 그리드를 모바일에 그대로 이식 → 오탭(rage tap). 아이콘만 키우고 히트영역은 아이콘 경계로 두는 것.
- **연관:** `UX-THUMB-ZONE`, `UX-SMALL-GRID`, `UX-TAP-NOT-DRAG`, `UX-SAFE-AREA`

### `UX-THUMB-ZONE` 엄지 영역 배치
- **정의:** 가장 자주 쓰는 액션(사용·장착·합치기·닫기)은 화면 하단 중앙(green zone)에, 부차 액션은 mid-side(yellow)에, 상단 코너(red)에는 파괴적·드문 액션만. 인벤토리 패널 자체를 하단 시트(bottom sheet)로 슬라이드업.
- **출처:** Steven Hoober thumb zone 3구역 모델(Parachute Design 정리, https://parachutedesign.ca/blog/thumb-zone-ux/), MockFlow "Thumb-reachability"(https://mockflow.com/glossary/Thumb-reachability), thewingless(닫기 버튼 누락 지적, https://thewingless.com/index.php/2021/07/26/10-simple-ways-you-can-improve-your-videogame-inventory-screen-game-ui-ux-design-course/).
- **우리 엔진 구현(작은 웹게임):** 인벤토리/아이템 메뉴를 상단 모달이 아니라 하단 시트로. 닫기·사용·확인을 화면 하단 ~60% 영역에. 핵심 버튼은 하단 중앙(좌우 손잡이 비대칭 회피). super-runner류 액션 게임에서도 아이템 사용 버튼은 하단. 실제 레이아웃 렌더는 game-ui-hud 위임.
- **흔한 실패:** 상단 코너에 "아이템 사용" 같은 빈번 버튼 배치(그립 변경 강요). 인벤토리를 정중앙 모달로 띄워 하단 손가락 동선을 가림.
- **연관:** `UX-TAP-TARGET`, `UX-SAFE-AREA`, `UX-SMALL-GRID`, `UX-MIN-CLUTTER`

### `UX-SMALL-GRID` 작은 그리드 예산 (리스트 > 테트리스)
- **정의:** 한 화면 슬롯 수에 명시적 상한(세로 모바일 8~20). 초과분은 무한 스크롤이 아니라 카테고리 탭 + 페이지네이션으로 분할. 디폴트는 공간 배치형 그리드("인벤토리 테트리스")가 아니라 **고정 슬롯 리스트 또는 단순 격자(아이템=1칸)**. 그리드는 공간 배치 자체가 핵심 재미일 때만.
- **출처:** GameDev.net "Inventory management: grid vs list"(리스트는 size/capacity 변수로 테트리스 없이 처리, https://www.gamedev.net/forums/topic/669150-inventory-management-grid-vs-list/5234777/), RPGHQ "왜 테트리스 인벤토리는 흔하지 않은가"(https://rpghq.org/forums/viewtopic.php?t=2221), thewingless(이중 스크롤바 회피·그리드는 페이지네이션과 페어링).
- **우리 엔진 구현(작은 웹게임):** `inventory: Item[]` + 고정 슬롯 N개, `PAGE_SIZE`(예: 세로 4×4=16) + 카테고리 enum. 직렬화는 flat 배열, 렌더는 슬라이스. 아이템 종 수를 먼저 정하지 말고 **화면 슬롯 예산에서 역산**(설계 진입점). runeburst식 match3는 부스터 3~5종 하단 바 = 모범.
- **흔한 실패:** "확장성" 위해 무한 스크롤 그리드. 세로 화면에 가로 스크롤 그리드(thumb 정밀 스크롤 어려움). 빈 슬롯 100개 미리 깔기. 손가락보다 작은 멀티셀 그리드에 드래그 회전 패킹.
- **연관:** `UX-TAP-TARGET`, `UX-AUTO-MANAGE`, `UX-INV-MINIMAL`, `UX-SESSION-FIT`

### `UX-COMPARE` 장착 비교는 펼치기 전 한눈에 (델타)
- **정의:** 새 아이템이 현재 장착 대비 업그레이드인지 다운그레이드인지 **+/− 델타와 색**으로 즉시 보인다. 플레이어가 산수를 하게 만들지 않는다. 장착 결과(스탯 변화)는 사전/즉시 노출하고 쉽게 되돌릴 수 있게.
- **출처:** TheGamer/GameRant "Diablo 4 Advanced Tooltip Compare"(교체 시 잃는 스탯 즉시 표시, https://www.thegamer.com/diablo-4-how-advanced-tooltips-work/ , https://gamerant.com/diablo-4-max-god-perfect-roll-legendaries-weapons-armor-identify-advanced-tooltips-d4/), Cliffordius "Equipment Explained"(툴팁이 총합 변화 나열, https://cliffordius.itch.io/equipment-explained).
- **우리 엔진 구현(작은 웹게임):** 아이템에 `stats: {atk, def, ...}`. 비교 시 `delta = candidate.stat - equipped.stat` → `+3 ▲(green)` / `−1 ▼(red)` 칩 렌더. 색맹 대비 **색 + 화살표/부호 이중부호화**(엔진 제약: 색만 신호 금지). 모바일은 hover 없으니 아이템 **탭 시 비교 패널** 등장. 장착 시 스탯 패널 즉시 갱신 + juice-fx 짧은 펄스, 슬롯 탭으로 1탭 복귀(되돌리기).
- **흔한 실패:** 절대 스탯만 나열하고 비교를 암산에 맡김. 색(녹/적)만 표시해 색각이상·작은 화면에서 판독 불가. 장착 효과를 별도 화면 가야 확인(피드백 지연). 장착 확정에 모달 확인을 걸어 짧은 루프를 끊음.
- **연관:** `UX-TOOLTIP-PROGRESSIVE`, `UX-TAP-NOT-DRAG`, `UX-RARITY-MULTI-CHANNEL`, `UX-SESSION-FIT`

### `UX-TAP-NOT-DRAG` 모바일은 드래그&드롭 대신 탭/롱프레스
- **정의:** 장착·이동·사용의 1차 입력은 탭(또는 탭→타깃 탭). 드래그&드롭은 사용자가 명확히 기대하고 더 낮은 비용의 대안이 없을 때만. 롱프레스=상세 툴팁/컨텍스트.
- **출처:** NN/g "Drag-and-Drop: How to Design for Ease of Use"(모바일에선 메뉴가 덜 오류남·발견성 난제, https://www.nngroup.com/articles/drag-drop/), icons8 "Drag and Drop vs. Click usability studies"(https://blog.icons8.com/articles/drag-and-drop-vs-click-are-they-rivals-usability-studies-revealed/).
- **우리 엔진 구현(작은 웹게임):** 탭=선택/장착, 롱프레스=상세/컨텍스트(버리기·사용). Phaser `pointerdown/up`으로 탭 판정(이동 임계값 < 10px). 드래그가 불가피하면 끌리는 아이템을 손가락 위로 수직 오프셋 + 드래그 중 페이지 스크롤 비활성화. 드래그 재배치가 정말 필요하면 롱프레스 후 큰 스냅 그리드(정밀도 요구↓).
- **흔한 실패:** 데스크톱 D&D 인벤토리를 그대로 터치 포팅. 작은 셀 사이 정밀 드래그 강요로 오드롭/취소 빈발. 손가락이 대상을 가리고 네이티브 스크롤과 충돌.
- **연관:** `UX-TAP-TARGET`, `UX-COMPARE`, `UX-AUTO-MANAGE`, `UX-TOOLTIP-PROGRESSIVE`

### `UX-TOOLTIP-PROGRESSIVE` 툴팁은 짧게, 상세는 점진 공개
- **정의:** 기본 툴팁은 이름 + 핵심 1~2줄. 깊은 정보(전체 affix·범위·플레이버)는 opt-in(롱프레스·"상세" 토글)으로 점진 공개. 모바일에선 행동에 필요한 중요 정보(쿨다운·소지수)를 툴팁에만 두지 않는다.
- **출처:** UX Design World "Tooltip Guidelines"(간결·트리거 근처·가장자리 잘림 방지·중요 정보는 툴팁에만 두지 말 것, https://uxdworld.com/tooltip-guidelines/), GameRant "Diablo 4 advanced tooltip 토글"(https://gamerant.com/diablo-4-max-god-perfect-roll-legendaries-weapons-armor-identify-advanced-tooltips-d4/), Paradox 포럼(중첩 툴팁=나쁜 UX, https://forum.paradoxplaza.com/forum/threads/reminder-to-the-devs-that-nested-tooltips-is-bad-ux-design.1702017/).
- **우리 엔진 구현(작은 웹게임):** 툴팁 = 9-slice 패널, `name` + `summary` 기본. `[상세]` 탭 시 `stats`/플레이버 확장. story-architect의 아이템 플레이버는 **상세 단에만** 배치(짧은 세션 흐름 방해 금지). 모바일은 hover 없음 → 탭으로 표시, 화면 밖 잘림 시 위치 보정.
- **흔한 실패:** 첫 탭에 affix 12줄·범위·세트보너스를 다 쏟아 작은 화면을 덮음. 핵심 수치를 툴팁 안에만 숨겨 상시 화면에서 안 보임. 중첩 툴팁.
- **연관:** `UX-COMPARE`, `UX-DESC-SLOTS`, `UX-MIN-CLUTTER`, `UX-TAP-NOT-DRAG`

### `UX-AUTO-MANAGE` 자동 관리 우선 (정리는 마찰이 재미일 때만 수동)
- **정의:** 자동 스택(동일 아이템 합산)·자동 정렬/필터·자동 수거(픽업 즉시 인벤토리행)를 기본 제공한다. 수동 드래그 재배치는 선택적·최소. 단, 그 마찰 자체가 게임의 핵심 긴장(정리 퍼즐)이면 자동화로 죽이지 않는다 — 디폴트는 자동화, 예외는 "정리가 메인 루프".
- **출처:** TheGamer "RE4 Remake Loses The Joy Of Attache Case Management"(auto-sort가 의도된 마찰·주체성 제거, https://www.thegamer.com/resident-evil-4-remake-attache-case-auto-sort/), Grid Sage Games(Cogmind, 재활용 봇이 정리노동 자체를 차단, https://www.gridsagegames.com/blog/2014/12/inventory-management/), thewingless/appnality(filter·auto-sort·1~2탭 접근).
- **우리 엔진 구현(작은 웹게임):** 데이터 모델을 슬롯 배열이 아니라 `{itemId: count}` 맵으로 두면 스택·정렬이 자연스러움(`UX-LOCAL-SAVE`와 시너지). 렌더는 카테고리→희귀도/이름 정렬 기본 + "NEW" 배지. 정렬 버튼은 1개(순환) 또는 생략, 필터는 카테고리 탭으로 대체. 픽업은 즉시 카운트 증가 + juice-fx 팝. FE-COLLECT·FE-BUILD가 강한 게임은 "노동만 자동화, 조합·전시는 보존"([fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md)).
- **흔한 실패:** 모든 걸 자동화해 빌드 결정·수집 쾌감까지 증발(아이들화). 마찰이 무가치한데 "하드코어 감성" 위해 수동 줍기·수동 정렬 강요. 같은 아이템이 스택 안 돼 슬롯 폭발.
- **연관:** `UX-SMALL-GRID`, `UX-LOCAL-SAVE`, `UX-INV-MINIMAL`, `UX-SESSION-FIT`

### `UX-LOCAL-SAVE` 로컬 저장 권위 (서버 없는 progression)
- **정의:** 아이템 소유·수량·해금 상태는 전부 클라이언트 localStorage(또는 큰 데이터는 IndexedDB)에 단일 권위로 저장한다. 서버 동기화·거래·경매장은 없는 것으로 설계한다. 저장은 버전 필드 + 마이그레이션을 포함한 단일 직렬화 객체.
- **출처:** MDN Web Storage(origin당 ~5MiB, https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), Dynetis Games "save/load player progress with localStorage"(setItem/getItem + 버전 필드, https://www.dynetisgames.com/2018/10/28/how-save-load-player-progress-localstorage/), bugnet "game save best practices"(https://bugnet.io/blog/game-save-best-practices-web).
- **우리 엔진 구현(작은 웹게임):** 단일 save 객체 `{ v: 3, items: {...}, unlocked: [...], stats: {...} }`를 `JSON.stringify`로 한 키에. 아이템 수량은 `{ itemId: count }` 맵으로 압축(슬롯 배열보다 작음). 버전 v 비교 후 `migrate(old)` 사다리. Phaser `this.registry`를 런타임 캐시, localStorage를 영속 계층으로 2층 분리. 아이콘은 절차생성이라 저장 불필요(런타임 생성) = 용량 큰 이점. 이 스키마는 game-ui-hud·juice-fx·chip-sound 공통 규약. 공통 캐논 0(`UX-LOCAL-SAVE`) 근거.
- **흔한 실패:** 서버 동기화 가정 ID 스키마(GUID·timestamp)를 로컬에 끌고와 직렬화 비대. 매 프레임 localStorage 쓰기(동기 블로킹 → 프레임 드랍). 버전 필드 없이 저장해 포맷 바뀌면 진행 깨짐.
- **연관:** `UX-QUOTA-GUARD`, `UX-NO-TAMPER`, `UX-AUTO-MANAGE`, `UX-SESSION-FIT`

### `UX-QUOTA-GUARD` 저장 용량·소멸 방어 (5MiB · LRU · Safari 7일)
- **정의:** 저장 쓰기는 항상 try/catch로 `QuotaExceededError`를 처리하고, 중요한 진행은 `navigator.storage.persist()`로 영속 요청한다. 아이템 데이터는 용량을 절약(맵·정수 ID)하고, Safari 7일 eviction을 가정해 "한 번 잃어도 치명적이지 않은" 설계를 병행한다.
- **출처:** MDN "Storage quotas and eviction criteria"(best-effort는 storage pressure 시 LRU로 origin 통째 삭제, Safari 추적방지 시 7일 무상호작용 eviction, https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), web.dev "Storage for the web"(persist·estimate·try-catch, https://web.dev/articles/storage-for-the-web).
- **우리 엔진 구현(작은 웹게임):** 첫 진행 저장 시 1회 `navigator.storage.persist()`. 저장 헬퍼를 try-catch로 감싸 quota 초과 시 비핵심 데이터(리플레이·통계 로그) 먼저 정리. 아이템 ID는 짧은 정수, 아이콘은 절차생성이라 저장 안 함(용량 이점). 진행이 소멸돼도 1~3분 재진입으로 회복 가능한 짧은 곡선이면 리스크 낮음.
- **흔한 실패:** 저장 실패를 silent 무시해 사용자가 진행 손실을 모름. base64 이미지·대형 로그를 localStorage에 쌓아 5MiB를 빠르게 소진. persist 요청 없이 장기 메타 progression을 best-effort에만 의존.
- **연관:** `UX-LOCAL-SAVE`, `UX-NO-TAMPER`, `UX-SESSION-FIT`, `UX-AUTO-MANAGE`

### `UX-NO-TAMPER` 클라 신뢰 · 무방어 (단일플레이 tamper 비대응)
- **정의:** 단일플레이·서버 없음·랭킹 없음 환경에서는 저장 위변조 방어(암호화·서명·anti-cheat)에 노력을 쓰지 않고 그 시간을 재미에 투자한다. 단, 저장 깨짐(손상 JSON)에 대한 graceful 복구는 한다.
- **출처:** GameDev.net "how to stop users from manipulating game save data"(오프라인이면 치팅이 남에게 피해 없음·개발자 관심사 아님, https://www.gamedev.net/forums/topic/655576-how-to-stop-users-from-manipulating-game-save-data/5147248/), TigerDroppings "save editing in single-player"(랭킹 없으면 개인 선택, https://www.tigerdroppings.com/rant/gaming/psa-save-editing-and-cheating-in-single-player-games/82721456/).
- **우리 엔진 구현(작은 웹게임):** 저장에 HMAC/난독화 없음(개발 단순화). 대신 `JSON.parse` 실패 시 기본 save로 폴백, 알 수 없는 itemId는 무시하는 방어적 역직렬화. 치트 시트/디버그 아이템 부여를 오히려 기능으로 노출해도 무방. 향후 서버 멀티 추가 시에만 권위 이전 고려(현재 스코프 밖). 도박 구조 비차용은 [economy-loot.md](./economy-loot.md)의 `ECON-VARIABLE-RATIO` 소유(여기선 저장 신뢰 모델만).
- **흔한 실패:** 단일플레이에 정교한 anti-tamper 암호화를 넣어 개발 시간 낭비·디버깅 난이도↑. 반대로 손상 데이터에 무방비해 한 글자 깨짐으로 전체 진행 크래시.
- **연관:** `UX-LOCAL-SAVE`, `UX-QUOTA-GUARD`, `UX-SESSION-FIT`

### `UX-SESSION-FIT` 짧은 세션 적합 (1~3분에 닫히는 아이템 루프)
- **정의:** 아이템 획득→사용→보상의 마이크로 루프가 한 세션(1~3분, 때로 30초) 안에서 시작·결정·payoff로 닫혀야 한다. 세션을 가로지르는 복잡한 인벤토리 관리(분해·재조합·정렬 노가다)를 진입/이탈 마찰로 만들지 않는다.
- **출처:** mobilefreetoplay "player commitment"(30초~수분 bite-sized·명확한 완결감, https://mobilefreetoplay.com/mobile-free-to-play-player-commitment/), Arogya Yoga School "short play sessions beat long grinds"(짧은 세션은 복잡한 인벤토리를 요구하지 않음·깊은 전략은 세션 밖, https://www.arogyayogaschool.com/blog/why-short-play-sessions-beat-long-grinds-in-modern-game-design).
- **우리 엔진 구현(작은 웹게임):** 아이템 효과를 "즉시 체감"형으로(획득 즉시 능력↑, 다음 판 부스터). 세션 종료 시 자동 저장(quick resume). 깊은 빌드 결정은 게임 밖 메타 화면(짧게)으로 분리해 인게임 1~3분 루프 방해 금지. level-architect 1레벨 1~3분 곡선과 정렬([level-architect](../../../wgf-level-architect/SKILL.md)). FE-COLLECT·FE-BUILD는 세션 밖 메타, FE-SURPRISE(드랍)는 세션 안.
- **흔한 실패:** 매 세션 시작에 인벤토리 정리 강제(진입 마찰→이탈). 한 판에 못 끝나는 장기 제작 큐를 인게임 핵심 루프로. 짧은 세션에 디아블로식 아이템 분류 메타게임을 욱여넣음.
- **연관:** `UX-MIN-CLUTTER`, `UX-AUTO-MANAGE`, `UX-INV-MINIMAL`, `UX-LOCAL-SAVE`

### `UX-MIN-CLUTTER` 최소 잡동사니 HUD
- **정의:** 인게임 중 항상 보이는 아이템 정보는 절대 최소(현재 보유 핵심 1~3개, 수량)만. 나머지는 컨텍스트 등장(필요할 때만)하거나 전용 인벤토리 화면에 레이어링. 작은 화면에서 게임플레이 가시성을 아이템 UI가 잡아먹지 않게.
- **출처:** Wayline "minimize cognitive load game UI"(단순 인터페이스가 결정 가속, https://www.wayline.io/blog/minimize-cognitive-load-game-ui), Sunstrike Studios "HUD design"(contextual HUD가 필요할 때만 등장·clarity지 mystery 아님, https://sunstrikestudios.com/en/blog/HUD_design_in_games/).
- **우리 엔진 구현(작은 웹게임):** 인게임 HUD에는 활성 아이템/부스터 슬롯 1~3개 + 수량 배지만. 전체 인벤토리는 일시정지/하단 시트로 분리. 색+형태 이중부호화(작은 화면 명도 대비 크게). juice-fx 획득 연출은 화면을 안 가리는 짧은 팝(0.2~0.4s). 실제 HUD 렌더는 game-ui-hud 위임.
- **흔한 실패:** 작은 화면 상단을 stat·버프 아이콘 20개로 도배. 미니멀리즘 핑계로 수량·쿨다운 같은 행동 필요 정보까지 숨김(minimal HUD paradox).
- **연관:** `UX-ONE-SUBJECT`, `UX-TOOLTIP-PROGRESSIVE`, `UX-SESSION-FIT`, `UX-INV-MINIMAL`

### `UX-SAFE-AREA` 안전 영역 레이아웃 (노치 · 세로 우선)
- **정의:** 인벤토리·HUD UI는 노치·라운드 코너·하단 바를 피하는 safe-area-inset 안에 배치한다. 세로(portrait) 한 손 조작을 기본 레이아웃으로, 가로는 보조. 게임 카메라는 풀블리드, UI만 인셋 적용도 허용.
- **출처:** Polypane "Using safe-area-inset to build mobile-safe layouts"(`viewport-fit=cover` 없으면 inset 0, HUD만 오프셋·카메라는 풀, https://polypane.app/blog/using-safe-area-inset-to-build-mobile-safe-layouts/), MDN `env()`(https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env).
- **우리 엔진 구현(작은 웹게임):** index의 viewport 메타에 `viewport-fit=cover`. Phaser Scale Manager로 캔버스는 풀, game-ui-hud의 인벤토리 시트/HUD는 `env(safe-area-inset-*)` 패딩(또는 JS로 읽어 layout). 세로 기준 슬롯 그리드(4열 등), 가로는 재배치. 모바일 하니스에서 safe-area를 표준 레이아웃 토큰으로.
- **흔한 실패:** 닫기·사용 버튼을 노치/홈 인디케이터 아래에 배치해 가려짐/오탭. 가로 전용 레이아웃을 세로 모바일에 강제. safe-area를 게임 카메라에까지 적용해 불필요한 레터박스.
- **연관:** `UX-THUMB-ZONE`, `UX-TAP-TARGET`, `UX-SMALL-GRID`, `UX-MIN-CLUTTER`

### `UX-INV-MINIMAL` 인벤토리가 핵심이 아니면 최소화/제거
- **정의:** 인벤토리/장착이 게임의 핵심 루프가 아니면 화면·메뉴·결정을 과감히 줄이거나 "장비=즉시 효과"로 인벤토리를 아예 없앤다. 짧은 세션 게임의 디폴트 권장. 인벤토리 제약(용량 제한)은 "무엇을 챙기고 버릴까"라는 의미 있는 결정을 만들 때만 둔다.
- **출처:** Grid Sage Games(Cogmind 4슬롯 + 매 턴 트레이드오프, https://www.gridsagegames.com/blog/2014/12/inventory-management/), Elder Scrolls Online 포럼(인벤토리 미세관리=게임 최악, https://forums.elderscrollsonline.com/en/discussion/691048/inventory-is-excessive-micro-management), 모바일 UI 가이드(인벤토리는 시간민감도 낮은 2차).
- **우리 엔진 구현(작은 웹게임):** 러너/아케이드/퍼즐 데모는 인벤토리 없이 "픽업=즉시 버프/통화". 장비가 필요해도 장착 슬롯 3~4개로 끝. 인벤토리 화면은 1탭 진입/이탈, 게임을 멈추지 않는 오버레이. progression은 localStorage 단순 카운터. 공통 캐논의 안티패턴 "인벤토리 노가다"(principles.md §3) 해소 수단 — 잡템은 즉시 통화로 변환, 별도 정크 슬롯 없음. is-rule 데모처럼 "규칙 블록이 곧 아이템"이면 인벤토리 0.
- **흔한 실패:** 1~3분 아케이드에 풀 RPG 인벤토리(가방·정렬·무게·거래) 이식해 세션 대비 메뉴 비중 과다. "있으니까 넣는" 인벤토리. 결정을 안 만드는 장식적 무게/슬롯 한도.
- **연관:** `UX-SMALL-GRID`, `UX-AUTO-MANAGE`, `UX-SESSION-FIT`, [scope-complexity.md](./scope-complexity.md)의 `SCOPE-DEFAULT-ZERO`

## `visual.*` 슬롯 스키마 (★ items.json 각 아이템)

`UX-DESC-SLOTS`의 정식 스키마. 산문 한 줄은 `concept`에만, 나머지는 토큰. 생성 도구는 이 블록만 보고 결정론적으로 그린다.

```yaml
visual:
  concept: "녹슨 단검, 손잡이에 닳은 가죽 감김"        # 한 줄 산문 (UX-DESC-SLOTS)
  category: weapon                                   # 시각 문법 템플릿 (UX-CATEGORY-GRAMMAR) = taxonomy kind
  category_metaphor: blade                            # 친숙 메타포 (UX-FAMILIAR-METAPHOR)
  silhouette: "짧은 곧은 날 + 좁은 가드 + 둥근 폼멜"     # 1차 식별 (UX-SILHOUETTE-FIRST)
  primary_shape: triangle_blade                       # 형태 시드
  variant_axis: { blade_len: short, curve: straight } # 같은 카테고리 내 변주 (실루엣 다양성)
  focal_motif: "녹 얼룩이 번진 날"                      # 단 하나의 주제 (UX-ONE-SUBJECT)
  negative_space: "셀 15% 패딩, 우상단 비움"            # 음영 공간 (UX-ONE-SUBJECT)
  material: { primary: iron, secondary: leather }     # 재질 (UX-MATERIAL-RAMP)
  palette: [master.metal_cold, master.leather_brown]  # 마스터 팔레트 참조 (UX-PALETTE-DISCIPLINE)
  lighting: inherit                                    # 상속 or 오버라이드 (UX-CONSISTENT-LIGHT)
  rarity_visual: common                               # 등급 다채널 (UX-RARITY-MULTI-CHANNEL)
  display_px: 48                                       # 최종 표시 크기 (UX-SMALL-SIZE-TRUTH)
  evolve_from: null                                    # 진화 전 베이스 아이템 id (있으면 실루엣 계승)
  ref_note: null                                       # 레퍼런스 용도 주석("녹 텍스처만 참조: <url>")
```

**스타일가이드 헤더(프로젝트 1회 정의, 모든 아이템 상속, `UX-CONSISTENT-LIGHT`·`UX-PALETTE-DISCIPLINE`):**
`light_dir: NW` · `view_angle: front|3q` · `master_palette: assets/palette.master.json` · `cell_padding: 15%` · `rarity_colors: { common:#9d9d9d, uncommon:#1eff00, rare:#0070dd, epic:#a335ee, legendary:#ff8000 }`(WoW 관습 hex) · `MIN_TAP: 48`.

## 슬롯 → 도구 어댑터 표

이 `visual:` 블록을 세 생성 도구로 변환하는 결정론 규칙. 어느 도구를 쓸지는 [consistency-tools.md](./consistency-tools.md)의 툴 결정 매트릭스를 따르고, 입력 변환은 아래 그대로.

| `visual` 슬롯 | sprite-forge (픽셀) | vector-graphics (벡터 베지어) | sprite-picker (CC0 검색) |
| --- | --- | --- | --- |
| `silhouette` / `primary_shape` | 형태 시드(외곽 마스크) | 베지어 베이스 곡선 | 검색쿼리 핵심 키워드 |
| `variant_axis` | 형태 파라미터 변주 | 컨트롤 포인트 변형 | 보조 필터(검 길이/곡률) |
| `focal_motif` | 중앙 픽셀 강조 영역 | 포컬 path 그룹 | 검색쿼리 보강어 |
| `negative_space` | 패딩 마스크(15%) | viewBox 여백 | (무시) |
| `material` | 램프 프리셋(metal/wood/gem) | 그라디언트 스톱 | `material` 키 필터 |
| `palette` | 마스터 인덱스 → 픽셀 색 | 마스터 인덱스 → fill/stroke | 팔레트 톤 필터 |
| `lighting` | 광원 방향 고정(NW) | 그라디언트 각도 | (무시, 카탈로그 광원 수용) |
| `display_px` | 캔버스(48의 2x=96 작업 후 다운스케일 미리보기) | viewBox px | 썸네일 사이즈 |
| `rarity_visual` | 본체엔 미적용 → game-ui-hud 프레임 위임 | 동일(프레임 분리) | 동일(프레임 분리) |
| `ref_note` | 참조 용도 주석 소비 | 동일 | (무시, 자체 카탈로그) |

핵심: **본체 아이콘**(silhouette~material~palette)은 3도구가 소비하고, **등급 프레임/테두리/핍/글로우**는 game-ui-hud가 `rarity_colors` 상수로 분리 합성한다(본체에 색을 굽지 않아 재질감 보존·등급만 바뀌어도 재생성 불필요). **획득 글로우/sparkle/팝업 확대**는 juice-fx(`UX-SMALL-SIZE-TRUTH` 보완: 정적 셀에 안 보이던 디테일을 이때 노출), 등급별 SFX는 chip-sound([chip-sound](../../../wgf-chip-sound/SKILL.md)).

## 재질 명도 램프 치트 (`UX-MATERIAL-RAMP`)

| 재질 | 램프(dark→mid→light) 특징 | 하이라이트 | 픽셀 색 수 |
| --- | --- | --- | --- |
| metal | 차가운 회청, 명도 대비 큼 | 좁은 흰 스펙큘러(좌상단) | 3~4 |
| wood | 따뜻한 갈색, 결 텍스처 | 약한 확산 하이라이트 | 3 |
| leather | 무광 갈색/적갈, 대비 낮음 | 거의 없음(무광) | 2~3 |
| gem | 고채도 코어 + 흰 스펙큘러 | 강한 점 하이라이트 + 내부 글로우 | 3~4 |
| stone | 무채 회색, 거친 노이즈 | 거의 없음 | 2~3 |
| glass/유리 | 반투명, 가장자리 림라이트 | 가장자리 + 한 점 | 3 |
| cloth/천 | 부드러운 그라디언트, 주름 | 넓고 약함 | 2~3 |

작은 캔버스 규칙: 재질당 3~4색을 넘기지 말 것(32x32 노이즈 방지), 모든 재질이 같은 회색 램프면 구분 실패.

## 등급 다채널 부호화 치트 (`UX-RARITY-MULTI-CHANNEL`)

| 등급 | 색(hex) | 테두리 | 코너 핍/별 | 글로우 |
| --- | --- | --- | --- | --- |
| common | #9d9d9d | 얇은 단색 | 0 | 없음 |
| uncommon | #1eff00 | 얇은 단색 | 1 | 없음 |
| rare | #0070dd | 중간 | 2 | 없음 |
| epic | #a335ee | 굵은 | 3 | 미세(정적) |
| legendary | #ff8000 | 굵은 + 이중선 | 4 | 정적 글로우 + 획득 시 sparkle(juice-fx) |

색 단독 금지 — 흑백/색약/저대비에서도 핍 개수·테두리 두께로 등급이 읽혀야 한다(색약 약 5% 대응). 색 순서는 WoW/Diablo 관습 유지(비표준 역전은 학습비용).

## 출처

- ArtStation — Importance of Silhouette in Game Props: https://www.artstation.com/blogs/francescos010/G9DqY/instantly-recognizable-the-importance-of-silhouette-in-game-props (실루엣이 색보다 상위 식별 채널)
- Alain Galvan — Pixel Art Design for Game Dev: https://alain.xyz/blog/pixel-art-design-for-game-dev (단색 실루엣 안 읽히면 색으로 못 고침)
- NN/g — Squint Test: https://www.nngroup.com/videos/squint-test/ (작은 크기 가독성 검증법)
- Polypane — Debug your visual hierarchy with the squint test: https://polypane.app/blog/debug-your-visual-hierarchy-with-the-squint-test/
- UX Planet — Practical Guide to Icon Design: https://uxplanet.org/practical-guide-to-icon-design-794baf5624c8 (과한 디테일=blurry blob)
- Game Developer — Understanding Focal Points in UI Design: https://www.gamedeveloper.com/design/understanding-focal-points-in-ui-design (단일 포컬 + negative space)
- Material Design 3 — Designing icons: https://m3.material.io/styles/icons/designing-icons
- Morphic — How to make game icons for inventory UI: https://morphic.com/resources/how-to/make-game-icons-for-inventory-ui (메타포·일관성·proportions)
- Jovial Graphics — Iconography: Your Game's Alphabet: https://www.jovialgraphics.com/blog/iconography-your-games-alphabet (카테고리=일관 기호 체계)
- Chris Fairfield — Unlocking Colorblind Friendly Game Design: https://chrisfairfield.com/unlocking-colorblind-friendly-game-design/ (redundancy·색약 5%)
- Game Informer — The Surprising Origins Of Loot Rarity Colors: https://gameinformer.com/2019/05/18/the-surprising-origins-of-loot-rarity-colors (EverQuest→DAoC→WoW 색 사다리 계보)
- TV Tropes — Color-Coded Item Tiers: https://tvtropes.org/pmwiki/pmwiki.php/Main/ColorCodedItemTiers
- media.io — Pixel Art Color Palette Ideas: https://www.media.io/color-palette/pixel-art-color-palette.html (tight ramp·적은 색)
- Clip Studio — How to Render Metallic Surfaces: https://www.clipstudio.net/how-to-draw/archives/159970
- Pixel Art App — Best Canvas Resolution: https://pixelartapp.com/resolutions-guide (32x32 재질당 3~4색)
- Microsoft Learn — Design guidelines for Windows app icons: https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-design
- Neil Blevins — Concept Brief: http://www.neilblevins.com/art_lessons/concept_brief/concept_brief.htm (짧게·토큰화·레퍼런스 용도 주석)
- 80.lv — Concept Art from Brief to Delivery: https://80.lv/articles/concept-art-for-clients-from-brief-to-delivery
- Game Developer — Crafting the Perfect Game Art Brief: https://www.gamedeveloper.com/design/crafting-the-perfect-game-art-brief
- LogRocket — Accessible touch target sizes: https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/ (44~48px 수렴)
- Google — Material/Android touch target: https://support.google.com/accessibility/android/answer/7101858 (48dp)
- Smashing Magazine — Accessible tap target sizes, rage taps: https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/
- Parachute Design — Thumb Zone UX: https://parachutedesign.ca/blog/thumb-zone-ux/ (Hoober 3구역 모델)
- MockFlow — Thumb reachability: https://mockflow.com/glossary/Thumb-reachability
- thewingless — 10 ways to improve your game inventory screen: https://thewingless.com/index.php/2021/07/26/10-simple-ways-you-can-improve-your-videogame-inventory-screen-game-ui-ux-design-course/ (그리드 페이지네이션·색코드·닫기 버튼)
- GameDev.net — Inventory management: grid vs list: https://www.gamedev.net/forums/topic/669150-inventory-management-grid-vs-list/5234777/
- RPGHQ — Why aren't tetris grid inventories more common?: https://rpghq.org/forums/viewtopic.php?t=2221
- TheGamer — How To Enable Advanced Tooltips In Diablo 4: https://www.thegamer.com/diablo-4-how-advanced-tooltips-work/ (델타 비교)
- GameRant — Diablo 4 Advanced Tooltips: https://gamerant.com/diablo-4-max-god-perfect-roll-legendaries-weapons-armor-identify-advanced-tooltips-d4/ (advanced tooltip 토글)
- Cliffordius — Equipment Explained: https://cliffordius.itch.io/equipment-explained (툴팁 총합 변화)
- NN/g — Drag-and-Drop: How to Design for Ease of Use: https://www.nngroup.com/articles/drag-drop/ (모바일 탭 우선)
- icons8 — Drag and Drop vs. Click usability studies: https://blog.icons8.com/articles/drag-and-drop-vs-click-are-they-rivals-usability-studies-revealed/
- UX Design World — Tooltip Guidelines: https://uxdworld.com/tooltip-guidelines/ (간결·중요정보는 툴팁에만 두지 말 것)
- Paradox 포럼 — Nested tooltips is bad UX: https://forum.paradoxplaza.com/forum/threads/reminder-to-the-devs-that-nested-tooltips-is-bad-ux-design.1702017/
- TheGamer — RE4 Remake Loses The Joy Of Attache Case Management: https://www.thegamer.com/resident-evil-4-remake-attache-case-auto-sort/ (자동화가 의도된 마찰 제거)
- Grid Sage Games (Cogmind) — Inventory Management: https://www.gridsagegames.com/blog/2014/12/inventory-management/ (용량 제한=결정·정리노동 차단)
- Elder Scrolls Online 포럼 — Inventory is Excessive Micro-Management: https://forums.elderscrollsonline.com/en/discussion/691048/inventory-is-excessive-micro-management
- appnality — A Technical Guide to Mobile Game UI/UX Design: https://www.appnality.com/blog/guide-to-mobile-game-ui-ux-design/ (1~2탭 접근·페이지네이션)
- MDN — Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria (5MiB·LRU·Safari 7일)
- web.dev — Storage for the web: https://web.dev/articles/storage-for-the-web (persist·estimate·try-catch)
- Dynetis Games — How to save/load player progress with localStorage: https://www.dynetisgames.com/2018/10/28/how-save-load-player-progress-localstorage/ (버전 필드 패턴)
- bugnet — Game save best practices (web): https://bugnet.io/blog/game-save-best-practices-web
- GameDev.net — How to stop users from manipulating game save data: https://www.gamedev.net/forums/topic/655576-how-to-stop-users-from-manipulating-game-save-data/5147248/ (단일플레이 tamper 비대응)
- TigerDroppings — Save editing in single-player games: https://www.tigerdroppings.com/rant/gaming/psa-save-editing-and-cheating-in-single-player-games/82721456/
- mobilefreetoplay — Player commitment / session design: https://mobilefreetoplay.com/mobile-free-to-play-player-commitment/ (bite-sized 세션)
- Arogya Yoga School — Why short play sessions beat long grinds: https://www.arogyayogaschool.com/blog/why-short-play-sessions-beat-long-grinds-in-modern-game-design (깊은 전략은 세션 밖)
- Wayline — Minimize cognitive load in game UI: https://www.wayline.io/blog/minimize-cognitive-load-game-ui (미니멀 HUD)
- Sunstrike Studios — HUD design in games: https://sunstrikestudios.com/en/blog/HUD_design_in_games/ (contextual HUD·clarity not mystery)
- Polypane — Using safe-area-inset to build mobile-safe layouts: https://polypane.app/blog/using-safe-area-inset-to-build-mobile-safe-layouts/
- MDN — env() (safe-area-inset): https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env
