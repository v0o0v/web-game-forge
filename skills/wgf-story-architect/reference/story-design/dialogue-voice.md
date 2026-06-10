# 대사·캐릭터 보이스 (DL-*)

> 작은 웹게임에서 한 줄의 밀도와 캐릭터 식별성을 만드는 대사 작법 — 모든 대사가 두 가지 일을 하고, voice bible로 일관성을 강제한다. 색인: [INDEX.md](./INDEX.md) · 자매 SKILL: [../../SKILL.md](../../SKILL.md)

게임 대사는 소설·영화 대사의 원칙(서브텍스트, show-don't-tell, on-the-nose 회피)을 물려받되, 상호작용 매체 특유의 제약 — 짧아야 하고, 반복 재생되며, 플레이어 행동에 반응하고, 분기하며, 현지화돼야 한다 — 을 추가로 진다. 핵심은 두 가지다. (1) **경제성**: 모든 대사가 성격 드러냄 + 정보/서사 전진을 동시에 한다. (2) **보이스 일관성**: 캐릭터마다 어휘·리듬·말버릇이 일관되게 유지된다. 작은 웹게임에서는 컷신 대신 인트로 카드 한두 줄·환경 단서·짧은 bark가 서사 전부를 짊어지므로, 한 줄의 밀도와 캐릭터 식별성이 큰 게임보다 오히려 더 중요하다.

우리 엔진 기준 서사 전달은 **4채널 + bark**로 값싸게 한다: (1) 인트로/타이틀 카드(≤2문장), (2) 레벨 사이 막간(≤1문장), (3) 승리/패배/엔딩 카드(각 ≤2문장), (4) 환경 단서(스프라이트·배치·색), (+bark: 이벤트당 floating text 변형 3~6개). 모든 텍스트는 `games/<slug>/STORY.md`(스토리 바이블 = single source of truth)에 고정하고, 게임 안에서는 `this.add.text()`로 Scene 전환 카드·overlay·tween에 1:1 매핑한다. 인물은 **1~4명 상한**, lore dump 금지.

---

## 프레임워크 요약

| 프레임워크 | 출처 | 핵심 | 작은 웹게임 적용 |
| --- | --- | --- | --- |
| **Voice Bible / Voice Chart** | 게임 내러티브 디자인 / TV 작가실(writers' room) | 캐릭터 말하기 방식을 5축으로 코드화한 참조표(어휘·자신감·말버릇·내면외면·비유출처) + catchphrase·문장 길이 패턴 | 캐릭터당 5~7줄짜리 미니 voice chart를 STORY.md에 고정 → 어떤 상황에서 대사를 생성해도 일관성 유지 |
| **Stimulus-Response Bark System** | Patrick Redding, Far Cry 2 GDC 2009 / thenarrativedept | bark = 플레이어 행동(자극)에 대한 게임의 응답. 한 줄로 행동+인지상태+감정 동시 전달 | 피격·발각·도주·승리 등 이벤트별 짧은 반응 텍스트. 변주(트리거당 3~6개)로 반복 피로 차단 |
| **Branching Dialogue 구조** | Adam Mirkowski, gamedeveloper.com | Hub-and-Spoke / Waterfall / Critical Path. 분기는 reconverge, 무한 분기는 지속 불가(3×3=27경로) | 분기처럼 보이되 합류하는 1~2지점 + 플래그로 톤만 변경. 진짜 분기는 엔딩 2~3개만 |
| **Show, Don't Tell / Environmental Storytelling** | 고전 작법 + Dark Souls·Gone Home·Fallout | 배치·마모·조명·사운드로 보여주기. 플레이어가 직접 추론 → 더 개인적·몰입적 | 컷신 없는 미니게임의 주력 서사. 환경 채널(VectorForge/PixelForge·ChipAudio·sprite)로 대사 예산 절약 |
| **Dual-Function Dialogue (Sorkin 원칙)** | Aaron Sorkin (The West Wing, The Social Network) | 좋은 대사는 장식이 아니라 구조. 성격 드러냄 + 플롯 전진을 subtext로 동시 달성 | 대사 예산 30~80줄짜리 웹게임의 절대 원칙. 한 기능만 하는 줄은 컷 대상 |

---

## 원칙 사전

### DL-DUAL 모든 대사는 최소 두 가지 일을 한다
- **정의:** 한 줄의 대사는 캐릭터를 드러내는 **동시에** 정보를 주거나 서사를 전진시켜야 한다. 한 가지만 하는 대사는 잘라낸다.
- **출처:** Aaron Sorkin 이중기능 원칙(Dual-Function Dialogue).
- **우리 엔진 구현(작은 웹게임):** STORY.md에 대사 한 줄을 적을 때마다 두 질문을 통과시킨다 — (1) 이 줄이 화자에 대해 뭘 말하나? (2) 이 줄이 상황/목표/긴장을 어떻게 움직이나? 인트로 카드 예: '문 고쳐야 하는데'(정보만) 대신 '또 이 망할 문이야. 매번 나만 고쳐.'(정보 + 성격: 화자가 잘 쓰이고 불만 많은 사람). 이 줄은 `this.add.text()` 타이틀 카드에 그대로 매핑된다. 4채널 모두에 이 게이트를 강제 — 인트로/막간/승패 카드 어느 것도 한 기능만 하면 컷.
- **흔한 실패:** 순수 정보 줄('레버를 당기세요')이나 순수 성격 과시용 농담이 따로 존재. 둘 다 30~80줄 예산의 낭비.
- **연관:** DL-SUBTEXT, DL-CONCISE, DL-BARKDUTY, ST-TEXT-BUDGET

### DL-SUBTEXT 진심은 말 밑에 흐르게(서브텍스트)
- **정의:** 캐릭터가 자기 감정·동기를 직접 명명하지 않고, 다른 것을 말하거나 행동·침묵으로 암시하게 한다. 표면 텍스트와 진짜 의미를 분리한다.
- **출처:** 서브텍스트 작법(ScreenCraft on-the-nose 분석, Sorkin 분석).
- **우리 엔진 구현(작은 웹게임):** '나는 무섭다/외롭다/화났다'를 금지어로 두고, 그 감정이 새어나오는 사소한 행동·딴소리로 대체한다. 레벨 사이 막간 카드(≤1문장)에 특히 잘 맞는다: '괜찮아. 난 늘 괜찮았어.'(반복되는 '괜찮아'가 안 괜찮음을 드러냄). 환경 채널과 결합하면 더 강하다 — ChipAudio 무드 BGM이 가라앉고 PixelForge 색이 식는 막간에 이 한 줄을 얹으면 텍스트가 직접 말하지 않아도 전달된다.
- **흔한 실패:** 플레이어가 못 알아들을까 봐 서브텍스트를 쓰고 다음 줄에서 곧장 해설해버려 효과를 죽임.
- **연관:** DL-NOTNOSE, DL-SHOWENV, DL-DUAL, WT-MOOD-THROUGHLINE

### DL-NOTNOSE On-the-nose 대사를 피하라
- **정의:** 캐릭터가 자기 생각·감정·주제를 너무 직설적·명시적으로 말하는 것(on-the-nose)을 피한다. 관객을 믿고 절반은 침묵·몸짓·행간에 맡긴다.
- **출처:** ScreenCraft 'How to Avoid Writing On-The-Nose Dialogue'.
- **우리 엔진 구현(작은 웹게임):** 정보를 한 번에 쏟지 말고 조각내 흘린다(piecemeal). 노출이 꼭 필요하면 두 캐릭터가 그 정보에 다르게 반응해 '갈등'으로 감싼다. 특히 승리/패배/엔딩 카드(채널 3)에서 '당신이 이겼습니다'/'GAME OVER'보다 결과를 암시하는 한 줄이 낫다 — 승리 카드를 juice-fx 연출·ChipAudio 팡파르와 묶고 텍스트는 결과의 의미만 암시한다. game-ui-hud의 결과 카드 레이아웃에 이 한 줄을 얹는다.
- **흔한 실패:** 짧은 게임이라 '명확해야 한다'는 강박으로 모든 걸 설명. 플레이어 지능을 과소평가하면 대사가 유치해진다.
- **연관:** DL-SUBTEXT, GN-FRAME-WINLOSE, ST-MIRROR-FRAME, DL-DUAL

### DL-CONCISE 경제성: 불필요한 단어를 모두 제거
- **정의:** 필요한 것이 말하도록 불필요한 것을 없앤다. 게임 대사는 짧아야 한다 — 62단어 설명을 20단어로 줄여도 정보를 다 담을 수 있다.
- **출처:** 'Concision' (gamedeveloper.com, 게임 대사 8원칙).
- **우리 엔진 구현(작은 웹게임):** 초안을 쓴 뒤 단어 수를 의도적으로 30~50% 깎는 패스를 항상 거친다. 우리 채널 예산을 그대로 적용 — 인트로 카드 ≤2문장, 막간 ≤1문장, 승패/엔딩 카드 각 ≤2문장, bark는 한 호흡 분량. `this.add.text()`는 모바일 화면 폭에서 자동 줄바꿈/잘림이 나므로, 한 줄이 카드 한 화면을 넘지 않게 깎는다. 소리 내어 읽어(DL-READALOUD) 군더더기·어색함을 잡는다.
- **흔한 실패:** 분위기를 살린답시고 형용사·부사·수식절을 쌓아 한 줄이 읽기 전에 끝나는 모바일 화면에서 잘림.
- **연관:** DL-DUAL, ST-TEXT-BUDGET, DL-READALOUD, DL-L10N

### DL-VOICEBIBLE 캐릭터별 voice bible로 일관성을 강제
- **정의:** 각 캐릭터의 어휘·문장 길이·말버릇·비유 출처·자신감 수준을 사전에 고정한 참조표를 만들고, 모든 생성 대사가 그 표를 따르게 한다.
- **출처:** Voice Bible / Voice Chart(게임 내러티브 디자인 + TV 작가실 관행), The Kill Zone '5 Key Ways to Create a Character's Distinct Voice'.
- **우리 엔진 구현(작은 웹게임):** 캐릭터당 5~7항목 미니 차트를 STORY.md에 고정한다: 즐겨 쓰는 단어 3개 · 금지 단어 · 문장 리듬(짧고 끊음 / 길고 더듬음) · catchphrase 1개 · 욕/격식 수준. 인물은 1~4명 상한이므로 차트도 최대 4개. 스킬이 대사를 생성·재생성할 때마다 해당 캐릭터 카드를 컨텍스트로 주입해 '같은 입에서 나온 듯' 들리게 한다. 일관성은 '잘 쓰려는 노력'이 아니라 '같은 명세를 매번 참조'로 달성된다. (아래 [voice bible 5축](#voice-bible-5축) 절 참조.)
- **흔한 실패:** voice bible 없이 장면마다 즉흥 생성 → 같은 캐릭터가 어느 장면은 격식체, 어느 장면은 반말·슬랭으로 흔들려 일관성 붕괴.
- **연관:** DL-IDIOLECT, TL-CHAR-VOICE, WT-TONE-VOICE, DL-READALOUD

### DL-IDIOLECT 어휘·리듬·말버릇으로 캐릭터를 구별
- **정의:** 두 캐릭터의 대사를 화자 이름표 없이 보여줘도 누가 말했는지 알 수 있어야 한다. 어휘(교육·지역·직업), 문장 길이/리듬, 반복구, 비유의 출처를 캐릭터마다 다르게 한다.
- **출처:** The Kill Zone 5축(어휘선택·자신감·quirk·내면외면·비유출처).
- **우리 엔진 구현(작은 웹게임):** 5축을 캐릭터마다 다르게 설정한다 — 단어선택·자신감·quirk·내면/외면·비유출처. 예: 한 캐릭터는 짧고 단정적('가자.'), 다른 캐릭터는 머뭇대고 filler가 많음('어… 그게, 그러니까…'). 직업 은어를 비유에 심는다(선원은 항해 용어). 인물이 1~4명뿐이라 각자 충분히 달라야 식별된다 — STORY.md의 voice chart들을 나란히 놓고 한 줄씩 비교해 겹치는 축이 없게 한다. table read(DL-READALOUD)로 검증.
- **흔한 실패:** 모든 캐릭터가 작가 본인의 목소리로 똑같이 말함. 이름만 다르고 voice는 하나.
- **연관:** DL-VOICEBIBLE, CH-FOIL, CH-3DIM, DL-READALOUD

### DL-BARKDUTY bark 한 줄에 여러 정보를 욱여넣어라
- **정의:** 배경 외침(bark)도 정상 대사의 모든 제약을 지면서 세계 상태·진영·성격·감정을 동시에 전달해야 한다. 최고의 bark는 한 줄로 행동+인지상태+감정을 함께 알린다(Far Cry 2).
- **출처:** Patrick Redding, Far Cry 2 GDC 2009 / The Narrative Dept. 'Barks'.
- **우리 엔진 구현(작은 웹게임):** 적/NPC 반응 텍스트를 설계할 때 '플레이어가 지금 속으로 뭘 궁금해하나'에 답하게 한다(적이 날 봤나? 위험한가?). 발각 bark 예: '저기다! …아니, 어디 갔어?'(인지 + 상실 + 불안 동시). 우리 엔진에서 bark는 floating text로 구현 — juice-fx의 tween(위로 뜨며 페이드)으로 적/NPC 스프라이트 위에 띄우고, ChipAudio SFX와 동기화한다. 이게 플레이어가 가장 많이 읽는 텍스트이므로 DL-DUAL 게이트를 가장 엄격히 적용한다.
- **흔한 실패:** bark를 버리는 대사로 취급. 실제로는 플레이어가 가장 많이 듣는 텍스트라 조잡하면 게임 전체가 싸구려로 느껴짐.
- **연관:** DL-BARKVARY, GN-BARK, DL-DUAL, DL-CONCISE

### DL-BARKVARY 반복 텍스트는 변주로 피로를 막아라
- **정의:** 같은 트리거에서 재생되는 bark/피드백은 여러 변형을 두고 무작위로 뽑아 같은 줄이 반복되는 피로를 막는다. 많이 써서 가장 강한 5~10개를 고른다.
- **출처:** 게임 대사 8원칙(gamedeveloper.com) — barks 다수 변형 후 선별.
- **우리 엔진 구현(작은 웹게임):** 웹게임에서 자주 발생하는 이벤트(피격·콤보·실패·아이템 획득)마다 변형 3~6개를 배열로 준비하고 `Phaser.Math.RND.pick()`으로 랜덤 출력한다. 한 게임 세션 동안 같은 줄이 두 번 안 나올 만큼만 있으면 충분 — 미니 웹게임은 5~10개까지 갈 필요 없이 3~6개가 현실적이다. STORY.md에 이벤트별 배열로 보관한다. (아래 [bark 워크플로](#bark-워크플로) 절 참조.)
- **흔한 실패:** 변형이 1개라 5분 플레이에 같은 줄을 20번 듣게 됨 → 몰입 파괴. 반대로 과욕으로 100개 쓰다 본 작업이 마비.
- **연관:** DL-BARKDUTY, GN-BARK, DL-CONCISE, DL-READALOUD

### DL-SHOWENV 대사 대신 환경·UI로 보여줘 예산을 아껴라
- **정의:** Show-don't-tell: 말로 설명하기 전에 배치·마모·조명·사운드·아이템 설명으로 보여준다. 환경 자체가 화자가 되게 한다.
- **출처:** Environmental Storytelling(Dark Souls·Gone Home·Fallout류), 고전 'Show, Don't Tell'.
- **우리 엔진 구현(작은 웹게임):** 컷신 없는 웹게임의 주력 서사 채널(채널 4). 배경 오브젝트 배치('아이 장난감 + 핏자국'식 대비)는 sprite-picker/sprite-forge로 고른 스프라이트와 그 좌표 배치로, 색=감정은 VectorForge/PixelForge 팔레트로, 무드는 ChipAudio BGM/앰비언트로, 아이템 한 줄 설명은 game-ui-hud 툴팁으로 전달한다. 스테이지 진행에 따라 색/BGM이 변하면 그 자체가 서사다. 대사는 환경이 못 하는 것만 맡긴다 — 이게 30~80줄 예산을 지키는 핵심 레버.
- **흔한 실패:** 모든 서사를 대사 텍스트로만 전달하려다 화면이 대화창으로 도배됨. 시각·청각 채널을 놀림.
- **연관:** ST-ENV-CLUE, GN-EMBED, WT-COLOR-EMOTION, WT-AUDIO-PLACE

### DL-RECONVERGE 분기는 핵심 줄기로 다시 모이게 하라
- **정의:** 선택지는 무한히 뻗지 말고 Critical Path(핵심 줄기)로 reconverge시킨다. 진짜 분기는 결말 2~3개로 제한하고, 나머지는 플래그로 '반응'만 바꾼다.
- **출처:** Adam Mirkowski 'Branching Conversation Systems' — Hub-and-Spoke / Waterfall / Critical Path.
- **우리 엔진 구현(작은 웹게임):** 선택 3개×3회=27경로임을 기억한다. 우리 엔진은 진짜 분기 트리를 감당 못 하므로, 분기처럼 보이되 합류하는 1~2지점 + 플래그(예: `spared_enemy=true`)로 후속 카드 톤만 바꾼다. 플래그는 Phaser registry/씬 데이터에 저장하고, 막간/엔딩 카드 텍스트를 그 값으로 분기시킨다. 엔딩만 진짜로 갈라(승리 카드 채널을 2~3 변형으로) 결정의 무게를 남긴다. STORY.md에 '진짜 분기 = 엔딩만, 나머지 = 플래그 톤'을 명시.
- **흔한 실패:** 초반 흥에 겨워 진짜 분기를 만들었다가 콘텐츠 양이 기하급수로 폭발해 완성 못 함.
- **연관:** DL-CHOICEVOICE, DL-FEEDBACK, GN-FOLDBACK, ST-MIRROR-FRAME

### DL-CHOICEVOICE 선택지는 플레이어의 캐릭터를 표현하게 하라
- **정의:** 분기 선택지는 사건을 바꾸지 않더라도 플레이어가 '어떤 사람으로 행동하는가'를 표현하게 한다. 4~5개 아키타입(외교가/사기꾼/전사)을 일관되게 지원한다.
- **출처:** Adam Mirkowski — 플래그 변수·아키타입으로 가짜 반응 만들기.
- **우리 엔진 구현(작은 웹게임):** 같은 결과로 수렴하더라도(DL-RECONVERGE) 선택지 어조를 아키타입별로 제공한다('정중히 부탁한다' / '협박한다' / '농담으로 넘긴다'). 우리 엔진에선 game-ui-hud의 버튼/메뉴 UI로 선택지를 띄우고, 고른 어조에 따라 플래그만 세팅 → 후속 카드 톤이 바뀐다. 미니게임은 선택 지점을 1~2개로 제한하되, 그 선택이 플레이어가 '나'를 연기하는 느낌을 주게 한다. 가장 중요한 이야기는 플레이어 머릿속에서 일어난다.
- **흔한 실패:** 선택지가 정보량만 다르고 성격 표현이 없음 → 플레이어가 '나'를 연기하는 느낌을 못 받음.
- **연관:** DL-RECONVERGE, DL-FEEDBACK, CH-AGENCY, GN-AGENCY-FOCUS

### DL-FEEDBACK 선택에 '기억된다'는 피드백을 줘라
- **정의:** 선택이 의미 있게 느껴지려면 게임이 그 선택을 기억·반영한다는 신호를 줘야 한다(Telltale의 'will remember that' 패턴).
- **출처:** Telltale 'will remember that' 관행, Adam Mirkowski 플래그 반응.
- **우리 엔진 구현(작은 웹게임):** 중요한 선택 직후 짧은 확인 신호를 넣는다 — juice-fx tween으로 띄우는 토스트 텍스트, NPC의 다음 bark에서 그 선택을 언급, 또는 PixelForge 색/ChipAudio 무드의 미묘한 변화. 작은 게임은 엔딩 카드에서 플레이어 선택을 한 줄로 회상시키는 것만으로 충분('당신은 그를 살려뒀다.'). 플래그(DL-RECONVERGE) 값을 엔딩 카드 텍스트에 끌어와 '기억된다' 신호를 값싸게 만든다.
- **흔한 실패:** 선택해도 세계가 무반응 → 플레이어가 '선택이 가짜였다'를 즉시 눈치채고 다음 선택을 진지하게 안 함.
- **연관:** DL-RECONVERGE, DL-CHOICEVOICE, GN-FRAME-WINLOSE, DL-BARKDUTY

### DL-L10N 현지화·번역 친화적으로 써라
- **정의:** 관용구·말장난·문화 한정 농담·텍스트 이미지를 피하고, 다른 언어의 길이 팽창(영어는 일본어보다 평균 1.5배, 독일어는 2배 이상)을 고려해 UI에 여유를 둔다.
- **출처:** Andovar 'Games Localization Guide, Part 3: Translation'.
- **우리 엔진 구현(작은 웹게임):** 대사 자산을 코드에서 분리해 STORY.md(외부 문자열)에 두고, `this.add.text()`가 그리는 카드 박스에 30~50% 길이 여유를 둔다. **변수 삽입은 회피한다** — '{name}가 {item}를 얻었다' 같은 연결은 언어별 어순·조사로 문법이 깨진다(아래 [한국어 현지화 경고](#한국어-현지화-경고) 절 참조). 문장 단위로 보존하고, STORY.md 주석에 화자·청자·성별·상황을 명기한다. 한국어 전용 게임이라도 길이·조사 원칙은 모바일 화면 깨짐 방지에 그대로 유효하다.
- **흔한 실패:** 말장난·관용구에 의존한 핵심 농담이 번역 불가. 변수 연결 문자열이 한국어/일본어 조사에서 비문 생성.
- **연관:** DL-CONCISE, TL-CANON-SINGLE-SOURCE, TL-CHANNEL-MAP, DL-READALOUD

### DL-READALOUD 소리 내어 읽어 검증하라
- **정의:** 모든 대사는 소리 내어 읽어 자연스러움·리듬·어색함·오타를 잡는다. 묵독은 흐름을 타며 부자연스러움을 놓친다.
- **출처:** 작법 관행 — table read.
- **우리 엔진 구현(작은 웹게임):** 대사 세트(STORY.md의 모든 줄)를 확정하기 전 한 번은 입으로 읽는다(또는 TTS 재생). 캐릭터별로 읽어 voice가 구별되는지(DL-IDIOLECT), 한 호흡에 끝나는지(DL-CONCISE), 카드 한 화면에 들어가는지 확인한다. table read처럼 여러 캐릭터를 번갈아 읽으면 일관성 결함이 드러난다. 빌드 전 마지막 게이트로 둔다 — 인트로/막간/승패/bark 전체를 한 번 통독.
- **흔한 실패:** 화면으로만 검수해 입에 안 붙는 줄, 캐릭터 간 voice 혼선이 출시 후 발견됨.
- **연관:** DL-CONCISE, DL-IDIOLECT, DL-VOICEBIBLE, TL-AUTHOR-VS-REVIEW

---

## voice bible 5축

캐릭터당 STORY.md에 아래 미니 차트를 고정한다(인물 1~4명 상한 → 최대 4개). 모든 대사 생성/재생성 호출에 해당 캐릭터 카드를 컨텍스트로 주입한다(DL-VOICEBIBLE). 막연한 답은 보기를 제시해 강제로 구체화한다.

1. **어휘·교육수준·지역색(word choice):** 즐겨 쓰는 단어 3개. 교육·직업·지역이 단어에 묻어나게(교수는 문어체, 거리의 아이는 짧은 구어).
2. **자신감/공격성(forceful vs. filler):** 단정적으로 명령하나, 아니면 'um' 같은 filler를 남발하며 머뭇대나.
3. **버릇·말투 quirk:** 직업 은어, 유머 결, 반복 습관. 이름표 없이도 식별되는 표식.
4. **내면 보이스 vs. 외면 보이스:** 경계를 풀었을 때(혼잣말·신뢰하는 상대 앞) 말투가 어떻게 바뀌나.
5. **비유의 출처:** 어디서 비유를 끌어오나(선원→항해, 요리사→주방, 군인→전장).

추가로 차트에 고정:
- **catchphrase 1개:** 캐릭터를 식별시키는 반복구. bark 변형(DL-BARKVARY)에 변주로 흩뿌린다.
- **금지 단어:** 이 캐릭터가 절대 안 쓰는 단어(격식 캐릭터의 슬랭, 무뚝뚝한 캐릭터의 감탄사). 자동 검증 게이트의 voice 금지단어로 직결.
- **문장 리듬:** 짧고 끊는다 vs. 길고 더듬는다. `this.add.text()` 카드 폭 안에서 이 리듬이 보이게.

---

## 대사 자동 생성 게이트

모든 생성 대사는 출력 전 아래 게이트를 통과해야 한다. 하나라도 위반 시 재생성한다.

1. **DL-DUAL — 두 기능 동시:** 이 줄이 (a) 화자에 대해 뭘 말하나 **그리고** (b) 상황/목표/긴장을 어떻게 움직이나? 한 기능만 하면 컷.
2. **on-the-nose 금지어:** '나는 슬프다 / 무섭다 / 외롭다 / 화났다' 같은 감정 직접 명명이 있나? 있으면 서브텍스트·행동으로 대체(DL-SUBTEXT, DL-NOTNOSE).
3. **voice 금지단어:** 해당 캐릭터 voice chart의 금지 단어를 위반하나? 위반 시 어휘 교체(DL-VOICEBIBLE).
4. **모바일 폭/길이:** 채널 예산(인트로 ≤2문장, 막간 ≤1문장, 승패/엔딩 각 ≤2문장, bark 한 호흡)을 넘나? `this.add.text()` 카드 한 화면을 넘으면 30~50% 깎기(DL-CONCISE). 번역 길이 팽창 여유까지 감안(DL-L10N).

게이트 통과 후 빌드 전 DL-READALOUD 통독을 마지막 검수로 둔다.

---

## bark 워크플로

1. **이벤트 목록 수집:** 게임에서 자주 발생하는 트리거를 나열한다(피격·발각·도주·콤보·실패·아이템 획득·승리 등).
2. **이벤트당 변형 3~6개 생성:** 각 변형이 한 줄로 행동+인지상태+감정을 전달하게(DL-BARKDUTY). 캐릭터/진영 voice가 묻어나게(DL-VOICEBIBLE), catchphrase 변주를 섞는다.
3. **게이트 통과:** 변형 각각을 대사 자동 생성 게이트로 검증. 다기능·voice 금지단어·길이 확인.
4. **STORY.md에 배열로 보관:** 이벤트별 문자열 배열로 저장. 게임에선 `Phaser.Math.RND.pick(barks[event])`로 무작위 출력하고, juice-fx tween(위로 뜨며 페이드) + ChipAudio SFX로 띄운다.
5. **반복 피로 검증:** 한 세션 동안 같은 줄이 두 번 안 나올 만큼이면 충분(미니게임은 3~6개가 현실적). 과욕으로 수십 개 쓰다 본 작업을 마비시키지 않는다(DL-BARKVARY).

---

## 한국어 현지화 경고

변수 연결 문자열은 한국어 조사에서 비문을 만든다. 대표 사례:

- '**{name}가 {item}를 얻었다**' → name이 받침으로 끝나면 '가'가 아니라 '이', item이 받침 없으면 '를'이 아니라 '을'이어야 함. 변수 값에 따라 조사가 달라져 비문 발생.

원칙(DL-L10N):
- **문장 단위 보존:** 조사를 변수 경계에 두지 말고 문장 전체를 하나의 문자열로 작성한다. 예: '검을 손에 넣었다.' / '방패를 손에 넣었다.'를 각각 통째로 둔다.
- **조사 변수 회피:** 부득이 변수를 써야 하면 조사가 변수에 붙지 않는 구조로 우회('획득: {item}', '{item} — 획득'처럼 조사 없는 라벨 형태).
- **이름 호명은 별도 처리:** 캐릭터 이름을 문장에 끼울 때도 같은 위험. 가능하면 이름 없이 지칭하거나, 이름 + 조사 없는 형태로.

이 경고는 한국어 전용 게임에도 적용된다. 산출 문서(STORY.md 포함)는 한글 본문 규칙을 따르되, 게임 내 표시 문자열은 위 조사 안전 규칙을 지킨다.

---

## 출처

- [8 Key Principles of Writing Effective Game Dialogue — Game Developer](https://www.gamedeveloper.com/disciplines/8-key-principles-of-writing-effective-game-dialogue) — Concision, Character Above All, 강제 lore 회피, barks(다수 변형 후 선별·한 줄 다기능). 경제성·이중기능의 직접 근거.
- [How to write for video games, Level One: Barks — The Narrative Dept.](https://www.thenarrativedept.com/blog/barks) — bark를 자극-반응 체계로 재정의. 플레이어의 무언의 질문에 답하기.
- [Five Key Ways to Create a Character's Distinct Voice — The Kill Zone](https://killzoneblog.com/2014/05/five-key-ways-to-create-characters.html) — 어휘선택·자신감·quirk·내면외면·비유출처 5축. voice bible / idiolect 설계의 골격.
- [How to write a branching narrative and won't lose your mind — Adam Mirkowski](https://adammirkowski.substack.com/p/how-to-write-a-branching-narrative) — Hub-and-Spoke / Waterfall, Critical Path로 reconverge, 27경로 폭발, 플래그·아키타입.
- [How to Avoid Writing On-The-Nose Dialogue — ScreenCraft](https://screencraft.org/blog/how-to-avoid-writing-on-the-nose-dialogue/) — 서브텍스트·갈등으로 노출 감싸기, 관객 신뢰, 정보 piecemeal.
- [Environmental Storytelling / Show Don't Tell in Games — Game Design Skills](https://gamedesignskills.com/game-design/environmental-storytelling/) — 오브젝트 배치·마모·조명·사운드로 서사 전달, 플레이어 추론 유도.
- [Part 3: Translation (Games Localization Guide) — Andovar](https://blog.andovar.com/games-localization-guide-part-3) — 관용구 회피, 텍스트 길이 팽창 대비, 그래픽 내 텍스트 회피, 번역 컨텍스트 주석.
- [Subtext in Dialogue: Lessons from 'The West Wing' (Sorkin 이중기능 분석)](https://aiinscreentrade.com/2023/11/03/subtext-in-dialogue-lessons-from-the-west-wing/) — 대사가 성격 드러냄 + 플롯 전진을 subtext로 동시 달성. DL-DUAL의 영화 작법 근거.
