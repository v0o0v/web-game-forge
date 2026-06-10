# 반전·복선·드러내기 (Twist, Foreshadowing, Reveal)

> 반전은 충격이 아니라 "되읽으면 다 보이도록 미리 심어둔 단서를 한 번에 회수하는 것"이다. 작은 웹게임의 4채널로 단 하나의 깨끗한 반전을 값싸게 짓는 법. — 색인은 [INDEX.md](./INDEX.md), 자매 스킬은 [SKILL.md](../../SKILL.md).

미니 브라우저 게임은 컷신이 없다. 반전을 실어 나르는 표면은 딱 4개뿐이다: (1) 인트로/타이틀 카드, (2) 본 플레이 중의 환경 단서·짧은 대사·bark, (3) 레벨 사이 막간 한두 줄, (4) 승리/패배/엔딩 카드. 이 4면 전체를 **단 하나의 반전**을 위한 setup-payoff 라인으로 쓴다. AAA RPG의 다층 미스터리가 아니라, 한 번 깨끗하게 뒤집고 끝내는 게 목표다. 모든 텍스트는 `games/<slug>/STORY.md`(스토리 바이블)에 single source of truth로 적고, Scene 전환 카드·overlay·tween에 `this.add.text()`로 1:1 매핑된다.

---

## 프레임워크 요약

| 프레임워크 | 출처 | 핵심 | 미니 게임 적용 |
|---|---|---|---|
| **Peripeteia + Anagnorisis** | Aristotle 『Poetics』 | 운명의 급반전(peripeteia)과 진실 인지(anagnorisis)가 한 번에 터질 때 비극이 최강. Oedipus가 표본. | 엔딩 한 화면·한 클릭에서 '세계가 뒤집힘'과 '내 행동의 진짜 의미 깨달음'을 동시 발화. 단 앞 레벨에서 필연적으로 따라 나와야 함. |
| **Chekhov's Gun / Setup & Payoff** | Anton Chekhov (작법 격언) | 1막에 걸린 총은 3막에 발사돼야. setup-payoff 거리가 클수록 정당. 모든 Chekhov's gun은 복선이나 역은 아니다. | '총'은 무기가 아니어도 됨 — 인트로 카드 한 줄, 1레벨 배경 균열, 반복 대사. 좁은 표면이라 회수 없는 setup은 즉시 들킴. |
| **Fair-Play (Knox / Van Dine)** | 황금기 추리 작법(1928~) | 플레이어=탐정 동일 정보. 정보를 숨기지 말고 시선만 돌려라(misdirection). 빼돌린 정보로 만든 반전은 cheat. | 1회차에 본 정보만으로 진실에 닿을 수 있어야 '아 그래서!'가 나옴. 되읽기 만족 단서 1~2개를 의도적으로 심음. |
| **Environmental Storytelling** | Gone Home, BioShock, Half-Life 2 | 컷신·대사 없이 공간이 이야기한다. 플레이어의 탐색 행위가 곧 서사. embedded(심은 단서) vs emergent(생긴 이야기). | 배경 타일·클릭 메모·시간에 따라 변하는 디테일에 단서를 박음. 미니 게임은 탐색 표면이 좁으니 1~3개로 압축. |
| **Kishōtenketsu (起承転結)** | 동아시아 고전 4막 구조 | 갈등 없이 '대조'로 의미 생성. 転이 앞 起承을 재맥락화하고 結이 정리. 転은 복잡화가 아니라 관점 전환. | 미니 게임 4면(인트로=起 / 본 플레이=承 / 막간 반전=転 / 엔딩=結)에 그대로 매핑. 폭력적 클라이맥스 없이도 한 방. |
| **Plot Twist Taxonomy** | 서사학 일반 | anagnorisis, peripeteia, false protagonist, unreliable narrator, red herring, reverse chronology. 내부 논리 지킬 때만 싸구려가 아님. | 사용자에게 '어떤 반전을 원하나'를 고르게 하는 메뉴. 미니 게임엔 ①anagnorisis형 ②숨은 빌런/배신 ③unreliable framing이 잘 맞음. |

작업 골격은 항상 **역산**이다: 엔딩 반전 한 줄 확정 → 단서 1~2개를 인트로·환경에 거꾸로 심기. Kishōtenketsu 4막이 미니 게임 4면에 자연 매핑되므로, 반전 종류를 하나 고른 뒤 4면 전부를 그 반전의 setup-payoff에 할당한다.

---

## 원칙 사전

### TW-PLANT-PAY 심고 회수하라 (Setup & Payoff 계약)
- **정의:** 반전에 쓸 모든 요소는 회수(payoff) 전에 먼저 심어야(setup) 하고, 심은 것은 반드시 회수해야 한다. 무대에 걸린 총은 발사돼야 한다(Chekhov's gun).
- **출처:** Anton Chekhov / setup & payoff 트롭.
- **우리 엔진 구현(작은 웹게임):** 4면 중 가장 먼저 엔딩 반전 한 문장을 `STORY.md`에 못 박는다(예: "당신이 지킨 문은 당신이 가둔 것이었다"). 그 반전을 정당화할 단서 1~2개를 역산해 인트로 카드(`this.add.text()` 타이틀 overlay)와 초반 레벨에 심는다. 예컨대 엔딩이 '안내자 NPC가 빌런'이면 인트로 카드에 그가 무심코 흘리는 어울리지 않는 한 마디를 박아둔다. 환경 단서는 sprite-picker/sprite-forge로 배치하고, 회수 순간엔 juice-fx의 flash·shake와 ChipAudio의 stinger SFX로 payoff를 청각·시각적으로 도장 찍는다.
- **흔한 실패:** 심기만 하고 안 쓰는 '발사 안 되는 총'(플레이어가 떡밥으로 알고 기다리다 배신감) / 심지도 않고 엔딩에서 갑자기 회수하는 '갑툭튀 반전'.
- **연관:** [TW-FAIR-PLAY](#tw-fair-play-공정하게--숨기지-말고-시선만-돌려라), [TW-ENV-CLUE](#tw-env-clue-환경에-단서를-박아라-environmental-clue), ST-MIRROR-FRAME, GN-EMBED.

### TW-FAIR-PLAY 공정하게 — 숨기지 말고 시선만 돌려라
- **정의:** 플레이어는 진실에 닿는 데 필요한 정보를 1회차에 모두 접할 수 있어야 한다. 반전은 정보를 '빼돌려서'가 아니라 주의를 '딴 데로 돌려서(misdirection)' 성립해야 한다.
- **출처:** Ronald Knox '10계명'(1928), S. S. Van Dine 추리소설 규칙.
- **우리 엔진 구현(작은 웹게임):** 반전의 근거를 전부 플레이 중 보이는 텍스트·대사·환경에 노출한다 — 인트로 카드 문장, bark의 floating text, 환경 스프라이트. 단 플레이어의 시선을 더 시끄러운 목표(점수·타이머·전면 위협)로 끌어 진짜 단서를 못 보게 한다. game-ui-hud의 HUD가 '시끄러운 목표'를 강조하는 동안 환경 단서는 조용히 깔린다. 엔딩 카드에서는 '새 정보'가 아니라 '이미 본 정보의 새 의미'만 꺼낸다.
- **흔한 실패:** 엔딩에서 한 번도 안 보여준 사실을 꺼내 반전을 만드는 'cheat'. 플레이어는 속았다가 아니라 사기당했다고 느낀다.
- **연관:** [TW-PLANT-PAY](#tw-plant-pay-심고-회수하라-setup--payoff-계약), [TW-HIDE-PLAIN](#tw-hide-plain-눈에-띄되-주목-안-되게-hide-in-plain-sight), [TW-RED-HERRING](#tw-red-herring-정직한-미끼-red-herring), AR-TWIST-INEVITABLE.

### TW-REREAD 되읽기 보상 — 리플레이하면 다르게 보이게
- **정의:** 좋은 반전은 다시 봤을 때 '단서가 다 있었네'라는 만족(reread experience)을 준다. 같은 텍스트가 반전 전후로 정반대 의미를 갖도록 설계한다.
- **출처:** Fair-Play 추리 작법의 'reread experience' 개념.
- **우리 엔진 구현(작은 웹게임):** 인트로/초반 대사 한 줄을 '진실을 알면 정반대로 읽히는' 이중 의미로 쓴다. 미니 게임은 리플레이 비용이 0에 가까운 게 무기이니, 엔딩 카드에 game-ui-hud의 '처음부터' 버튼을 붙여 IntroScene으로 재진입시키고, 같은 타이틀 카드가 새 의미로 읽히게 한다. 같은 인트로 카드 문장을 STORY.md에 '1회차 읽기 / 2회차 읽기' 두 칸으로 적어 의도를 고정한다.
- **흔한 실패:** 되읽어도 새로 보이는 게 없으면 반전이 '그냥 충격'에 그치고 깊이가 없다. 반대로 이중 의미가 너무 노골적이면 1회차에 들킨다.
- **연관:** [TW-FAIR-PLAY](#tw-fair-play-공정하게--숨기지-말고-시선만-돌려라), [TW-RECONTEXT](#tw-recontext-재맥락화하는-転-kishotenketsu-reframe), ST-MIRROR-FRAME, WT-MOTIF-THREAD.

### TW-RULE3 3의 법칙 — 한 번은 디테일, 세 번은 의미
- **정의:** 핵심 단서는 서로 다른 맥락에서 3번 노출하면, 의식적으로 주목하지 않아도 기억에 각인되어 회수 때 '아 그거!'가 터진다. (한 번=디테일, 두 번=setup, 세 번=의미)
- **출처:** River Editor 'How to Foreshadow Plot Twists'; BioShock의 'would you kindly'가 게임 표본.
- **우리 엔진 구현(작은 웹게임):** 트리거가 될 단서(특정 단어·아이콘·소리) 하나를 인트로 카드·중간 막간·반전 직전이라는 3개 면에 흩뿌린다. 단어라면 bark 변형 안에, 아이콘이라면 PixelForge/sprite-picker 스프라이트로, 소리라면 ChipAudio의 동일 모티프 SFX로 같은 단서를 매번 다른 옷을 입혀 노출한다. 매번 자연스러운 이유를 붙여 '반복'이 아니라 '우연'처럼 보이게 한다.
- **흔한 실패:** 3회가 다 같은 톤·같은 자리면 플레이어가 패턴을 1회차에 눈치챈다. 반대로 1번만 노출하면 회수 때 '그런 게 있었나' 하고 안 걸린다.
- **연관:** [TW-HIDE-PLAIN](#tw-hide-plain-눈에-띄되-주목-안-되게-hide-in-plain-sight), [TW-PLANT-PAY](#tw-plant-pay-심고-회수하라-setup--payoff-계약), WT-MOTIF-THREAD, DL-BARKVARY.

### TW-HIDE-PLAIN 눈에 띄되 주목 안 되게 (Hide in Plain Sight)
- **정의:** 단서는 보이지만 눈에 띄지 않아야 한다. 캐릭터 특성처럼 위장하거나, 동등한 비중의 다른 항목들 사이에 끼워 어느 게 중요한지 못 고르게 한다.
- **출처:** River Editor / 추리 작법 — 캐릭터 quirk 위장 기법.
- **우리 엔진 구현(작은 웹게임):** 결정적 단서를 '그냥 캐릭터 quirk'로 분장시킨다(예: 특정 음식을 안 먹는 습관 → 사실은 숨은 정체의 힌트). 또는 환경 오브젝트 목록에 진짜 단서 스프라이트 1개를 잡동사니 4~5개와 같은 크기·같은 색·같은 z-order로 섞는다(VectorForge/PixelForge에서 강조색 금지). 절대로 단서에 반짝이 tween이나 튜토리얼 화살표를 붙이지 않는다 — juice-fx의 강조 연출은 미끼 쪽에만 쓴다.
- **흔한 실패:** 위장이 과해 단서가 완전히 안 보이면 fair play 위반(되읽어도 안 보임). 위장이 약해 단서만 유독 강조되면 1회차에 정답이 노출.
- **연관:** [TW-FAIR-PLAY](#tw-fair-play-공정하게--숨기지-말고-시선만-돌려라), [TW-ENV-CLUE](#tw-env-clue-환경에-단서를-박아라-environmental-clue), [TW-RED-HERRING](#tw-red-herring-정직한-미끼-red-herring), CH-ENVCLUE.

### TW-RED-HERRING 정직한 미끼 (Red Herring)
- **정의:** 거짓 단서는 충분히 그럴듯해 플레이어가 진심으로 믿되, 돌이켜보면 결코 정답이 아니었음이 보여야 한다. 미끼 인물에게는 '진짜 비밀(단, 핵심 범행과 무관한)'을 줘 수상한 행동을 정당화한다.
- **출처:** Writing Mastery / Story Grid — 'mislead without cheating'.
- **우리 엔진 구현(작은 웹게임):** 더 명백한 용의자/위협을 전면에 세워 플레이어 시선을 끌고(game-ui-hud로 그 위협을 강조, juice-fx로 연출), 그 뒤에서 진짜 단서를 조용히 깐다. 미끼 NPC(인물 상한 1~4명 안)에겐 '핵심과 무관한 작은 진짜 비밀'을 한 줄 줘서 그가 왜 수상하게 굴었는지 만족스러운 이유를 막간/엔딩 카드에서 반드시 해소한다. 미끼 비밀도 회수돼야 하는 '총'이다.
- **흔한 실패:** 미끼가 긴장을 잔뜩 쌓아놓고 설명 없이 사라지면 'cheat'처럼 느껴진다. 또 미끼가 너무 랜덤하면 안 믿기고, 너무 약하면 시선을 못 끈다.
- **연관:** [TW-HIDE-PLAIN](#tw-hide-plain-눈에-띄되-주목-안-되게-hide-in-plain-sight), [TW-FAIR-PLAY](#tw-fair-play-공정하게--숨기지-말고-시선만-돌려라), [TW-BETRAYAL](#tw-betrayal-신뢰를-쌓아-배신하라-hidden-villain--betrayal), CH-CONTRA.

### TW-PERI-ANAG 반전과 깨달음을 한 번에 (Peripeteia + Anagnorisis)
- **정의:** 외부 상황의 급반전(peripeteia)과 주인공/플레이어의 진실 인지(anagnorisis)를 같은 순간에 터뜨리면 충격이 압축·증폭된다. Aristotle이 꼽은 최상의 구조.
- **출처:** Aristotle 『Poetics』 — 복합 플롯, Oedipus 표본.
- **우리 엔진 구현(작은 웹게임):** 엔딩 한 화면에서 '세계가 뒤집히는 사건'과 '내가 한 일의 진짜 의미를 깨닫는 텍스트'를 동시에 띄운다. 가장 경제적인 묶음은 '마지막 클릭'에 거는 것 — 플레이어가 '구원' 버튼을 누른 순간, 그게 사실 파멸이었음이 같은 화면에 드러난다(아래 '마지막 클릭=반전 트리거' 절). 마지막 인터랙션 콜백 안에서 화면 색을 VectorForge 팔레트로 뒤집고(감정 전환), ChipAudio BGM을 반전 무드로 교체하고, 엔딩 카드 텍스트를 tween으로 띄운다 — 세 채널이 한 프레임에 합류한다.
- **흔한 실패:** 반전이 앞 행동의 '필연적 귀결'이 아니라 작가가 억지로 비튼 것이면(개연성 위반) 충격은커녕 반발만 산다. 깨달음과 반전을 따로 떼어 두 번에 나누면 임팩트가 분산된다.
- **연관:** [TW-PLANT-PAY](#tw-plant-pay-심고-회수하라-setup--payoff-계약), [TW-RECONTEXT](#tw-recontext-재맥락화하는-転-kishotenketsu-reframe), [TW-ONE-CLEAN](#tw-one-clean-짧은-게임엔-깨끗한-반전-하나-one-clean-twist), AR-TWIST-INEVITABLE.

### TW-DRAMATIC-IRONY 극적 아이러니로 긴장 적립 (Dramatic Irony)
- **정의:** 플레이어가 캐릭터보다 더(또는 덜) 아는 정보 비대칭을 만들면, 캐릭터가 모르고 내리는 결정마다 긴장·불안·블랙코미디가 쌓인다.
- **출처:** LitCharts / Grammarly — Romeo·Juliet, '헛간 속 살인마' 예.
- **우리 엔진 구현(작은 웹게임):** 반전 전에 플레이어에게만 작은 진실을 슬쩍 흘린다 — 막간 카드 한 줄이나 환경 단서로 NPC는 모르는 사실을 플레이어만 보게 해, 무지한 NPC(또는 무지한 과거의 자신)를 지켜보는 긴장을 만든다. 반대로 unreliable framing이면 인트로 화자를 통해 플레이어가 '덜 알게' 해 캐릭터의 결정이 나중에 재해석되게 한다. ChipAudio의 불안한 minor 무드 BGM으로 '뭔가 잘못됐다'는 비대칭의 정서를 값싸게 깐다.
- **흔한 실패:** 정보를 너무 일찍·너무 많이 주면 반전의 충격이 사라지고, 너무 안 주면 그냥 깜짝쇼가 된다. 비대칭의 '양 조절'이 관건.
- **연관:** [TW-UNRELIABLE](#tw-unreliable-신뢰할-수-없는-프레임-unreliable-narratorframing), [TW-FAIR-PLAY](#tw-fair-play-공정하게--숨기지-말고-시선만-돌려라), WT-AUDIO-PLACE, DL-SUBTEXT.

### TW-UNRELIABLE 신뢰할 수 없는 프레임 (Unreliable Narrator/Framing)
- **정의:** 인트로/안내 텍스트가 사실을 조작·은폐했음이 드러나며 플레이어가 본 모든 것을 재해석하게 만드는 반전. 단, 거짓 속에 진실의 단서(자기모순·기억 공백·말 바꿈)를 박아둬야 공정하다.
- **출처:** Plot twist taxonomy — unreliable narrator 유형.
- **우리 엔진 구현(작은 웹게임):** 게임을 안내하는 화자(튜토리얼 보이스, 인트로 내레이션 카드)를 일부러 '틀리게' 설계하고, 미세한 자기모순 1~2개를 심는다(예: 인트로가 약속한 목표와 막간 카드의 설명이 미묘하게 어긋남). 엔딩 카드에서 '화자가 거짓말했다'가 드러나면 앞의 모든 카드가 통째로 재해석된다 — 이때 game-ui-hud의 카드 스타일(폰트·색)을 바꿔 '화자가 바뀌었다'를 시각적으로 신호한다.
- **흔한 실패:** 거짓을 뒷받침할 복선 없이 '사실 다 거짓이었어'를 던지면 fair play 위반. 화자가 거짓인 '이유(동기)'가 없으면 값싼 트릭으로 전락.
- **연관:** [TW-FAIR-PLAY](#tw-fair-play-공정하게--숨기지-말고-시선만-돌려라), [TW-DRAMATIC-IRONY](#tw-dramatic-irony-극적-아이러니로-긴장-적립-dramatic-irony), [TW-RECONTEXT](#tw-recontext-재맥락화하는-転-kishotenketsu-reframe), DL-DUAL.

### TW-BETRAYAL 신뢰를 쌓아 배신하라 (Hidden Villain / Betrayal)
- **정의:** 배신 반전의 핵심은 '먼저 플레이어가 그 인물을 진심으로 신뢰하게 만드는 것'. 배신은 의외의 인물·의외의 시점에 오되, 돌이켜보면 단서가 추적 가능해야 하고, 배신할 분명한 동기가 있어야 한다.
- **출처:** Plot twist taxonomy — hidden villain / betrayal 유형.
- **우리 엔진 구현(작은 웹게임):** 초반에 안내자/동료 NPC가 플레이어를 실제로 돕게 한다 — 힌트 bark를 주거나, 길을 열어주거나, 위기에서 구해주는 실제 게임플레이 이득으로 신뢰를 쌓는다. 그 도움 뒤에 숨은 목적(ulterior motive)을 STORY.md에 한 줄로라도 설계하고, 배신 시 '왜 도왔는지'가 그 목적으로 설명되게 한다. NPC는 1~4명 상한 안에서 1명이면 충분 — 그 한 명에 신뢰와 배신을 모두 싣는다.
- **흔한 실패:** 신뢰 빌드업 없이 배신하면 '그래서 누구?' 하고 감흥이 없다. 동기 없이 '사실 악당이었음'만 던지면 캐릭터가 종이처럼 얇아진다.
- **연관:** [TW-RED-HERRING](#tw-red-herring-정직한-미끼-red-herring), [TW-PLANT-PAY](#tw-plant-pay-심고-회수하라-setup--payoff-계약), CH-WANT-NEED, AR-SHADOW-MIRROR.

### TW-RECONTEXT 재맥락화하는 転 (Kishōtenketsu Reframe)
- **정의:** 반전은 '새 갈등의 추가'가 아니라 '이미 본 것의 의미 전환(reframe)'일 때 짧은 게임에서 가장 경제적이다. 転은 앞 起承을 재해석시키고, 結이 그 새 관점을 정리한다.
- **출처:** Kishōtenketsu(起承転結) — Helping Writers Become Authors.
- **우리 엔진 구현(작은 웹게임):** 평온한 인트로 카드(起)+본 플레이(承)를 깔고, 막간/엔딩 카드에서 '지금까지의 행동의 진짜 맥락'을 뒤집는 한 문장을 던진다(転). 마지막 화면(結)이 그 새 의미를 정리한다. 갈등 클라이맥스나 보스전 없이도 한 방이 된다 — 미니 게임 4면이 起承転結에 그대로 매핑되므로 추가 Scene이 필요 없다. 転의 순간 VectorForge 색 팔레트와 ChipAudio 무드를 함께 전환해 '의미가 바뀌었다'를 감각으로 전한다.
- **흔한 실패:** 転을 '또 다른 사건'으로 만들면 짧은 게임에 갈등이 과적된다. 재맥락화가 앞 내용과 무관하면 '뜬금'이 되고, 結이 없으면 '그래서 뭐?'로 끝난다.
- **연관:** [TW-PERI-ANAG](#tw-peri-anag-반전과-깨달음을-한-번에-peripeteia--anagnorisis), [TW-REREAD](#tw-reread-되읽기-보상--리플레이하면-다르게-보이게), ST-KISHO-NOCONFLICT, GN-KISHO.

### TW-ENV-CLUE 환경에 단서를 박아라 (Environmental Clue)
- **정의:** 게임의 가장 강력한 복선 매체는 대사·컷신이 아니라 공간 자체다. 플레이어가 '직접 발견'한 단서는 떠먹여준 것보다 반전 때 훨씬 강하게 박힌다.
- **출처:** Environmental storytelling — Gone Home, BioShock, Half-Life 2.
- **우리 엔진 구현(작은 웹게임):** 배경 타일·클릭 가능한 메모·시간에 따라 변하는 환경 디테일에 단서를 심는다 — 예: 레벨이 진행될수록 배경에 같은 균열이 번진다(엔딩의 붕괴 복선). 환경 단서 스프라이트는 sprite-picker/sprite-forge로 배치하고, VectorForge/PixelForge로 '색=감정'을 깔아 단서가 분위기에 녹아들게 한다. 미니 게임은 표면이 좁으니 환경 단서 1~3개로 압축한다.
- **흔한 실패:** 탐색 보상이 전혀 없으면 플레이어가 단서를 안 보고 지나친다. 반대로 단서에 반짝이 강조를 달면 '여기 중요!'라고 외쳐 미스터리가 죽는다.
- **연관:** [TW-HIDE-PLAIN](#tw-hide-plain-눈에-띄되-주목-안-되게-hide-in-plain-sight), [TW-PLANT-PAY](#tw-plant-pay-심고-회수하라-setup--payoff-계약), ST-ENV-CLUE, GN-EMBED, CH-ENVCLUE.

### TW-ONE-CLEAN 짧은 게임엔 깨끗한 반전 하나 (One Clean Twist)
- **정의:** 미니 게임은 반전을 하나만, 한 유형으로 깨끗하게 골라 거기에 모든 단서를 집중시켜야 한다. 여러 반전을 욱여넣으면 표면이 부족해 다 얕아진다.
- **출처:** lane 종합 — 미니 게임 표면 제약에서 도출.
- **우리 엔진 구현(작은 웹게임):** TW-PERI-ANAG / TW-UNRELIABLE / TW-BETRAYAL 중 하나를 정하고, 인트로 카드·막간·환경·엔딩 카드라는 4개 표면 전부를 그 한 반전을 위한 setup-payoff에 할당한다. 두 번째 반전 아이디어는 과감히 버리거나 후속편(다른 `games/<slug>/`)으로. 4면이 곧 예산이므로, 반전이 둘이면 각 반전당 표면이 2면으로 쪼개져 단서 밀도가 절반이 된다.
- **흔한 실패:** '반전 위의 반전'을 짧은 분량에 넣으면 단서 밀도가 분산돼 둘 다 fair play를 못 지킨다. 결국 '충격은 많은데 만족은 없는' 게임이 된다.
- **연관:** [TW-PERI-ANAG](#tw-peri-anag-반전과-깨달음을-한-번에-peripeteia--anagnorisis), [TW-PLANT-PAY](#tw-plant-pay-심고-회수하라-setup--payoff-계약), ST-PICK-ONE, AR-ONE-TWIST.

---

## 반전 역산 설계법 (Backward Design)

미니 게임 반전은 **순서대로 쓰지 않고 거꾸로 짓는다.** 표면이 4개뿐이라 단서를 즉흥으로 흩뿌리면 반드시 회수 안 된 총이 남는다. 절차:

1. **엔딩 반전 한 문장 확정.** STORY.md 맨 위에 '엔딩에서 뒤집힐 한 문장'을 못 박는다. 예: "당신이 지킨 문은 당신이 가둔 것이었다" / "당신을 안내한 목소리가 당신을 사냥하고 있었다". 이 한 줄이 모든 단서의 north star다. (TW-PLANT-PAY)
2. **반전 종류 하나 선택.** 아래 '반전 종류 메뉴 3종'에서 단 하나만. (TW-ONE-CLEAN)
3. **단서 1~2개 역산.** 그 반전이 1회차에 fair하려면 어떤 사실이 미리 보여야 하는가? 그 사실을 인트로 카드(起)와 초반 환경(承)에 심는다. (TW-FAIR-PLAY, TW-ENV-CLUE)
4. **4면에 매핑.** 각 단서가 '4면 중 어디에 심기고(setup) 어디서 회수되는가(payoff)'를 표로 적는다. Kishōtenketsu 매핑: 인트로 카드=起 / 본 플레이=承 / 막간 텍스트=転 / 엔딩 카드=結.
5. **3의 법칙으로 트리거 1개 분산.** 핵심 트리거(단어·아이콘·소리) 하나를 인트로·막간·반전 직전 3면에 흩뿌린다. (TW-RULE3)
6. **되읽기 한 줄 설계.** 인트로 카드 최소 한 줄이 반전 후 정반대로 읽히게 쓰고, 엔딩에 '처음부터' 버튼을 단다. (TW-REREAD)

설계 결과를 STORY.md에 단서 표로 고정한다:

| 단서 | setup 면 | payoff 면 | 1회차 의미 | 2회차(반전 후) 의미 |
|---|---|---|---|---|
| (예) 안내자의 "곧 나가게 해줄게" | 인트로 카드(起) | 엔딩 카드(結) | 격려 | 협박/거짓 |

---

## '마지막 클릭 = 반전 트리거' 기본 패턴

게임 매체에서만 가능한 가장 값싸고 강한 반전 전달 방식이다. **플레이어의 최종 인터랙션 그 자체가 반전을 트리거하게** 만든다 — BioShock의 'would you kindly'처럼, 플레이어가 능동적으로 한 행동의 의미가 그 순간 뒤집힌다(TW-PERI-ANAG: peripeteia와 anagnorisis가 한 클릭에서 동시 발화).

기본 골격(Phaser 4):
- 마지막 레벨/엔딩 직전, 플레이어에게 '선해 보이는' 최종 선택을 준다(버튼·문 클릭·마지막 적 처치). game-ui-hud로 그 선택을 '구원/탈출/완료'처럼 프레이밍한다.
- 그 인터랙션의 `pointerdown`/완료 콜백 안에서 한 프레임에 합류시킨다:
  1. VectorForge 색 팔레트를 반전 무드로 교체(감정 뒤집기).
  2. ChipAudio BGM/stinger를 반전 무드로 전환.
  3. juice-fx로 flash·shake·slow 연출.
  4. 엔딩 카드(`this.add.text()`, ≤2문장)를 tween으로 띄워 '내가 방금 한 일의 진짜 의미'를 anagnorisis로 발화.
- 핵심: 플레이어가 **스스로** 눌렀기 때문에 공범 의식이 생긴다. '지켜본 반전'이 아니라 '내가 한 반전'이 된다.

제약: 그 마지막 행동이 앞 레벨에서 필연적으로 따라 나와야 한다(TW-PLANT-PAY). 갑자기 마지막에만 새 버튼을 주면 갑툭튀가 된다 — 같은 인터랙션(예: '문 닫기')을 게임 내내 반복시키다 마지막에 의미만 뒤집는 게 가장 깨끗하다.

---

## Fair-Play 감사 / Payoff 감사 체크리스트

반전 설계가 끝나면 스킬이 자동으로 돌려야 할 일관성 점검 패스. STORY.md의 단서 표를 입력으로 본다.

### Fair-Play 감사 (cheat 탐지)
- [ ] 엔딩 반전의 **모든 근거**가 1회차 플레이(인트로·본 플레이·막간·엔딩 직전)에 노출됐는가?
- [ ] 엔딩 카드가 '처음 보는 정보'로 반전을 만들고 있지 **않은가**? (엔딩에 등장하는 모든 사실이 단서 표의 setup 면에 이미 있어야 한다 — cheat 탐지의 핵심.)
- [ ] 진짜 단서가 강조(반짝이 tween·튜토리얼 화살표·강조색)되어 1회차에 정답을 누설하지 **않는가**? (TW-HIDE-PLAIN)
- [ ] 플레이어가 1회차에 본 정보만으로 (이론상) 진실에 닿을 수 있는가?

### Payoff 감사 (발사 안 된 총 탐지)
- [ ] 심은 단서가 **전부** 회수·해소되는가? (단서 표의 모든 행에 payoff 면이 채워졌는가 — TW-PLANT-PAY)
- [ ] **red herring(미끼)도** 전부 해소되는가? 미끼 인물이 왜 수상했는지 만족스러운 이유가 막간/엔딩에 있는가? (TW-RED-HERRING)
- [ ] 긴장만 쌓고 설명 없이 사라지는 요소가 없는가?

### 동기 감사
- [ ] 배신 NPC에게 '왜 도왔고 왜 배신하는가'의 동기(ulterior motive)가 STORY.md에 있는가? (TW-BETRAYAL)
- [ ] 거짓 화자에게 '왜 거짓말하는가'의 이유가 있는가? (TW-UNRELIABLE)

### 되읽기 감사
- [ ] 인트로 카드 최소 한 줄이 반전 후 정반대 의미로 읽히는가? (단서 표의 '1회차 의미 ≠ 2회차 의미'가 채워졌는가 — TW-REREAD)
- [ ] 엔딩 카드에 '처음부터' 버튼(IntroScene 재진입)이 있는가?

---

## 반전 종류 메뉴 3종 (하나만 골라라 — TW-ONE-CLEAN)

미니 게임에 가장 잘 맞는 세 가지. 스킬은 인터뷰에서 이 메뉴로 좁혀 **단 하나**만 고르게 한다.

- **(A) 정체/깨달음형 — peripeteia + anagnorisis.** '내 정체' 또는 '내가 한 일의 진짜 의미'가 마지막에 드러난다. 가장 게임적 — '마지막 클릭=반전 트리거' 패턴과 직결된다. 단서를 환경과 반복 인터랙션에 깐다. (TW-PERI-ANAG)
- **(B) 숨은 빌런/배신형.** 도왔던 안내자/동료 NPC가 적이었다. 신뢰를 실제 게임플레이 이득으로 쌓다가 동기와 함께 뒤집는다. 인물 1명에 집중. (TW-BETRAYAL + TW-RED-HERRING)
- **(C) 신뢰 못할 화자형 — unreliable framing.** 인트로의 안내·설명이 거짓이었다. 화자에 미세 자기모순 1~2개를 심고, 엔딩에서 앞의 모든 카드를 재해석시킨다. (TW-UNRELIABLE)

세 종류 모두 공통 헌법은 TW-FAIR-PLAY(1회차에 근거 노출) + TW-PLANT-PAY(역산으로 심고 회수). 골랐으면 4면 전부를 그 하나에 할당하고, 두 번째 반전은 버린다.

---

## 출처

- Chekhov's gun — Wikipedia. https://en.wikipedia.org/wiki/Chekhov%27s_gun
- Peripeteia — Wikipedia. https://en.wikipedia.org/wiki/Peripeteia
- How to Foreshadow Plot Twists Readers Miss Then Kick Themselves — River Editor. https://rivereditor.com/guides/how-to-foreshadow-plot-twists-2026
- Fair-Play Whodunnit (Knox·Van Dine 규칙) — TV Tropes. https://tvtropes.org/pmwiki/pmwiki.php/Main/FairPlayWhodunnit
- Bioshock: 5 Small Details Foreshadowing the Big Twist — Game Rant. https://gamerant.com/bioshock-details-foreshadowing-big-twist/
- How to Write a Red Herring without cheating — Writing Mastery / Story Grid. https://www.writingmastery.com/blog/what-is-a-red-herring-how-to-mislead-readers-without-cheating-them
- Kishōtenketsu Story Structure — Helping Writers Become Authors. https://www.helpingwritersbecomeauthors.com/kishotenketsu-story-structure/
- Plot twist — Wikipedia. https://en.wikipedia.org/wiki/Plot_twist
- Dramatic Irony — LitCharts / Grammarly. https://www.litcharts.com/literary-devices-and-terms/dramatic-irony
- BioShock 'Would You Kindly' twist 분석 — TheGamer. https://www.thegamer.com/revisiting-bioshock-would-you-kindly-twist-15-years-later/
