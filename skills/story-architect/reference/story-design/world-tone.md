# 세계관·톤·테마 & 분위기 사전 (WT-*)

> 미니 웹게임의 **몰입**을 만드는 단 하나의 축 — premise 한 문장과 mood throughline — 을 정의하고, 그것을 색·소리·페이싱·텍스트로 값싸게 번역하는 원칙(WT-*)을 모은다. 색인 [INDEX.md](./INDEX.md) · 자매 SKILL [../../SKILL.md](../../SKILL.md)

짧은 게임에서 몰입은 화려한 컷신이 아니라 **하나의 명확한 의미(premise/controlling idea)** 와 그것을 감각적으로 일관되게 감싸는 **분위기(mood)** 에서 나온다. 작법 고전(Lajos Egri의 premise, Robert McKee의 controlling idea, John Truby의 moral argument)은 "한 문장으로 압축되는 의미"를 게임 전체의 척추로 삼으라 가르치고, 게임 매체 연구(environmental storytelling, atmosphere, leitmotif)는 그 의미를 대사 없이 공간·색·소리·페이싱으로 전달하는 법을 알려준다. 핵심 명제 — **"게임 전반의 분위기와 목표를 정하는 서사가 몰입의 핵심"** — 은 탄탄하다: 모든 표현 요소가 하나의 controlling idea를 향하면 플레이어는 "같은 의미가 반복된다"고 느끼고, 그 일관성이 곧 몰입이다.

이 파일은 WT-* 캐논 전체를 정의하는 1차 사전이다. 캐릭터(CH-*)·플롯/구조(ST-*)·대사(DL-*)·반전(TW-*) 등 형제 도메인은 같은 `reference/story-design/` 폴더의 다른 파일로 분기한다. 엔진 제약·API는 [../../../web-game-builder/reference/engine-api.md](../../../web-game-builder/reference/engine-api.md)와 [../../../web-game-builder/reference/phaser/INDEX.md](../../../web-game-builder/reference/phaser/INDEX.md).

---

## 0. 우리 엔진 제약 (모든 원칙에 선적용)

이 사전의 모든 '엔진 구현'은 다음을 전제로 한다. 어긋나는 처방은 채택하지 않는다.

| 제약 | 의미 | 서사·분위기 함의 |
| --- | --- | --- |
| Phaser 4 · 작은 2D 웹/모바일웹 | AAA RPG·오픈월드 아님 | 보이스·방대한 lore·다분기 시나리오 ❌. 서사는 4채널 + bark로 값싸게 |
| 짧은 세션 · 작은 화면 | 첫 30초 안에 톤이 서야 함 | 인트로 카드 ≤2문장, 막간 ≤1문장. lore dump는 즉시 이탈 |
| CC0 / 절차생성 에셋 | 고유 컷신 아트 불가 | 분위기는 팔레트(색=감정)·BGM 무드·연출(juice)로. 환경 단서는 단서 오브젝트 1개 |
| 단일 보이스 산출 | 텍스트 총량이 적음 | 적을수록 불일치가 더 눈에 띔 — tone document 1단락으로 통일 |
| 서버 메타 ❌ | 온라인 분기 추적 불가 | 분기 엔딩은 localStorage. 모든 엔딩이 같은 controlling idea로 수렴(WT-CHOICE-CONVERGE) |

서사 전달 표면은 **딱 5곳**이다 — 이 사전의 모든 처방은 이 5채널 + bark로 환원된다:

| 채널 | 분량 | 주 담당 원칙 | 엔진 라우팅 |
| --- | --- | --- | --- |
| (1) 인트로/타이틀 카드 | ≤2문장 | WT-PREMISE-ONE · WT-MOOD-THROUGHLINE | game-ui-hud 카드 + VectorForge/PixelForge 색 + ChipAudio 인트로 모티프 |
| (2) 레벨 사이 막간 | ≤1문장 | WT-TONE-VOICE · WT-ICEBERG | `this.add.text()` overlay (Scene 전환 시) |
| (3) 승리/패배/엔딩 카드 | 각 ≤2문장 | WT-COHERENCE · WT-CHOICE-CONVERGE | game-ui-hud 결과 카드 + juice-fx 연출 |
| (4) 환경 단서 | 텍스트 0줄 | WT-ENV-CLUE · WT-COLOR-EMOTION | sprite-picker/sprite-forge 단서 스프라이트 1개 + 팔레트·배치 |
| (+) bark | 이벤트당 floating text 3~6변형 | WT-TONE-VOICE | juice-fx 팝업 텍스트(변주 풀) |

산출물은 `games/<slug>/STORY.md` 하나 — **스토리 바이블 = 모든 텍스트·대사·톤의 single source of truth**. 인물 **1~4명 상한**, lore dump 금지. 게임 텍스트는 `this.add.text()`로 Scene 전환 카드·overlay·tween에 1:1 매핑한다.

---

## 1. 프레임워크 요약

WT-* 원칙은 다음 작법·게임 매체 프레임워크에서 길어 올렸다. 각 원칙 항목의 '출처'가 이 표를 참조한다.

| 프레임워크 | 출처 | 한 줄 요지 | 미니게임 적용 |
| --- | --- | --- | --- |
| **Premise** | Lajos Egri, *The Art of Dramatic Writing* (1942/1946) | '인격 + 갈등 + 결말'의 3부 인과 문장으로 압축한 작품의 논제 ('인색함은 파멸을 부른다'). thesis–antithesis–synthesis로 입증. | 모든 텍스트·레벨·승패를 정렬하는 '북극성' 한 문장. 인트로 카드 = premise의 시적 변형. |
| **Controlling Idea** | Robert McKee, *Story* (1997) | '인생의 가치가 어떻게·왜 바뀌는가'의 한 문장 = 가치 변화(value) + 원인(cause). idealistic/pessimistic/ironic 3유형. | 승패 화면 = 가치 변화의 최종 진술. 승리·패배 텍스트가 같은 controlling idea의 양면. |
| **Moral Argument** | John Truby, *The Anatomy of Story* (2007) | 테마는 캐릭터의 '행동'으로 펼치는 도덕적 논증. 마지막 도덕적 선택(funnel의 좁은 끝)이 논증을 완성. 설교 금지. | 플레이어의 '메커닉적 선택'이 곧 테마의 증명. opponent는 환경/규칙으로 추상화. |
| **Iceberg / Hollow Iceberg** | Hemingway의 Iceberg Theory + Brandon Sanderson의 'hollow iceberg' | 세계의 10%만 표면에, 90%는 물밑. 'iceberg tip' 몇 개만 심으면 독자가 나머지를 상상으로 채운다. | 세계관 문서 대신 iceberg tip 3~5개(고유명사·단서 오브젝트·암시 한 줄)만. |
| **Environmental Storytelling** | Harvey Smith & Matthias Worch, GDC | 사건의 '결과 tableau'를 배치하고 해석을 플레이어에게 넘기는 협업적 서사. '살아있던 사람이라면 무엇을 남겼을까?' | NPC·컷신 없는 미니게임에 최적. 배경 한 장에 단서 오브젝트 1개로 서사 밀도 ↑. |
| **Kishōtenketsu** (起承転結) | 동아시아 4막 무갈등 구조, Nintendo(Super Mario) 레벨 설계로 유명 | Ki(도입)→Shō(전개)→Ten(전환: 늦게 오는 재맥락화)→Ketsu(결말). 갈등 없이 'Ten'의 인식 전환이 발견의 만족을 준다. | 3레벨 = Ki·Shō·Ten/Ketsu. 후반 단일 전환(WT-TONE-SHIFT)으로 컷신 없이 여운. |
| **Leitmotif / Motif** | 바그너의 음악 leitmotif, Toby Fox의 *Undertale* 적용 | 짧은 반복 모티프(선율·색·오브젝트·구절)를 게임 전체의 정서적 실로. 의미 있는 순간에 회수해 감정 증폭. | 3음 멜로디 하나 또는 시각 모티프 하나를 인트로·전환·엔딩에 변주 반복. |

> **구조 분기 가이드:** 사색형/평화로운 톤 → **Kishōtenketsu**(갈등 없는 'Ten' 전환)를 기본 옵션으로. 갈등형/도덕적 선택이 있는 게임 → **Truby의 moral argument**(행동으로 증명) 템플릿으로.

---

## 2. WT-* 원칙 사전

각 원칙은 **정의 → 출처 → 우리 엔진 구현(작은 웹게임) → 흔한 실패 → 연관** 순으로 정리한다. 태그 표기(WT-PREMISE-ONE 등)는 모든 파일이 그대로 쓴다. 인터뷰는 탑다운으로 WT-PREMISE-ONE → WT-MOOD-THROUGHLINE을 가장 먼저, 끈질기게 받아낸 뒤에야 나머지로 내려간다.

### WT-PREMISE-ONE 한 문장 premise를 먼저 못 박는다
- **정의:** 게임 전체의 의미를 '가치 변화 + 원인'이 든 단 하나의 인과 문장으로 압축해, 모든 텍스트·레벨·승패가 그것을 증명하게 한다. Egri의 premise(인격+갈등+결말)와 McKee의 controlling idea(가치+원인)를 합친 '북극성'. 이 한 문장이 정해지기 전엔 캐릭터·레벨 설계로 내려가지 않는다.
- **출처:** Lajos Egri, *The Art of Dramatic Writing* (premise) + Robert McKee, *Story* (controlling idea).
- **우리 엔진 구현(작은 웹게임):** 인터뷰 첫 단계에서 "한 문장으로 이 게임이 증명하는 것은?"을 받아 `games/<slug>/STORY.md` 최상단 `premise:` 필드에 1줄로 못 박는다. 예: '욕심을 부릴수록 잃는다'. 이후 (1) 인트로 카드는 이 문장의 **시적 변형 한 줄**, (3) 승리·패배 카드는 같은 문장의 양면(긍정/대가)으로 쓴다. 'war' '사랑' '생존' 같은 한 단어 테마를 받으면 거부하고 "무엇이 어떻게·왜 변하는가?"의 인과 문장으로 다시 받는 리프레이밍 질문을 둔다. STORY.md의 모든 후속 텍스트 생성은 이 문장과의 정합으로 검증(WT-COHERENCE 게이트).
- **흔한 실패:** 테마를 '복수' '생존' 같은 추상 명사 하나로 두면 모든 게 그것을 가리키는 듯 보여도 실제로는 아무 방향도 주지 못한다. 인과(왜·어떻게 변하는가)가 빠진 테마는 척추 역할을 못 한다.
- **연관:** WT-MOOD-THROUGHLINE, WT-COHERENCE, WT-ACTION-ARGUES, ST-SPINE-FIRST

### WT-MOOD-THROUGHLINE 무드를 감정적 throughline으로 둔다
- **정의:** 플레이어가 처음부터 끝까지 느껴야 할 단 하나의 지배적 감정(예: 쓸쓸한 향수, 불안한 긴장, 따뜻한 안도)을 정하고, 색·음악·언어 톤·페이싱을 모두 그 감정에 맞춘다. **분위기는 장식이 아니라 몰입을 끄는 정서의 실**이다 — 이 도메인의 핵심 명제(무드 = 게임 전체의 감정적 throughline).
- **출처:** Myk Eff, 'Atmosphere & Progression' (분위기를 정서 throughline으로 보는 시각) + McKee의 controlling idea 정서 측면.
- **우리 엔진 구현(작은 웹게임):** premise 옆에 **'mood 단어' 1~2개**를 STORY.md `mood:` 필드에 같이 못 박는다(예: `mood: 쓸쓸한 향수, 체념`). 이후 모든 아트(PixelForge/VectorForge 팔레트)·오디오(ChipAudio 템포·음색·조성)·문구 선택을 'mood 단어에 부합하는가' 한 기준으로 검증하는 게이트를 건다(아래 §3 번역 표). 한 화면·한 트랙·한 줄이라도 mood를 거스르면 다시 만든다. 4채널 전부가 같은 mood로 수렴할 때 짧은 게임이 '한 편'으로 느껴진다.
- **흔한 실패:** 장면마다 톤이 들쭉날쭉(귀여운 인트로 + 잔혹한 엔딩 + 코믹 패배 화면)하면 플레이어가 게임 밖으로 튕겨 나온다. 의도적 톤 전환(WT-TONE-SHIFT)과 무계획적 톤 붕괴는 다르다 — 후자는 이 원칙의 정면 위반이다.
- **연관:** WT-PREMISE-ONE, WT-COLOR-EMOTION, WT-AUDIO-PLACE, WT-TONE-VOICE

### WT-COHERENCE 모든 표현이 같은 의미를 반복하게 한다
- **정의:** McKee의 원리 — 게임의 모든 부분이 같은 의미를 전달한다고 느껴질 때 몰입이 최대가 된다. 아트·오디오·텍스트·메커닉이 controlling idea와 mood를 향해 정렬되어야 한다. 미니게임은 요소가 적으므로 단 몇 개라도 빈틈없이 정렬하면 강한 응집감이 난다.
- **출처:** Robert McKee, *Story* (theme/anti-theme 진동으로 만드는 응집).
- **우리 엔진 구현(작은 웹게임):** 산출물마다 자동 체크리스트 '이 요소는 premise/mood를 강화하는가?'를 돌린다 — 배경색, BGM 분위기, 버튼 문구, 적 디자인, bark 한 줄까지. 이 게이트를 sprite-picker(스프라이트 선택)·VectorForge/PixelForge(팔레트)·ChipAudio(트랙) 결정 직전에 끼워, mood 단어로 통과 못 하는 에셋은 채택하지 않는다. STORY.md를 작성 패스로, 이 체크리스트를 검수 패스로 분리(작성-검수 분리 원칙)해 자기 검증을 피한다.
- **흔한 실패:** '재미있어 보여서' 테마와 무관한 에셋·농담·미니 시스템을 끼워 넣으면 응집이 깨진다. 작은 게임일수록 어긋난 요소 하나의 비중이 커서 치명적이다.
- **연관:** WT-PREMISE-ONE, WT-MOOD-THROUGHLINE, WT-TONE-VOICE, GN-CONSISTENCY

### WT-CHOICE-CONVERGE 여러 경로를 같은 thesis로 수렴시킨다
- **정의:** Emily Short의 처방 — 상호작용성과 테마 일관성은 양립한다. 여러 선택지·엔딩을 주되 모두가 하나의 공통 의미를 증명하게 한다. 결정적 선택은 '결말이 사실상 정해진' 시점에 배치한다. 선택은 의미를 바꾸지 말고 의미를 **굴절**시킨다.
- **출처:** Emily Short, 'The Art of Dramatic Writing (Lajos Egri) — and games' (인터랙티브 적용/한계 분석).
- **우리 엔진 구현(작은 웹게임):** 분기 엔딩을 만들 때 검증 규칙으로 '이 엔딩들이 같은 controlling idea의 다른 면(긍정/대가/아이러니)을 말하는가?'를 확인한다. 예: 모든 엔딩이 '욕심의 대가'를 다른 각도로. 분기 상태는 서버 없이 localStorage 플래그로 추적하고, 결정적 선택은 후반(결말 직전) 1곳에만 둔다. STORY.md에 엔딩 카드를 controlling idea의 양면으로 미리 묶어 적어, 어느 결과든 같은 의미를 체험하게 한다.
- **흔한 실패:** 엔딩마다 정반대 교훈을 주면(욕심이 좋다 vs 나쁘다) 게임이 무엇을 말하는지 모호해지고 의미가 증발한다. 자유 ≠ 메시지 분열.
- **연관:** WT-PREMISE-ONE, WT-ACTION-ARGUES, DL-RECONVERGE, GN-FOLDBACK

### WT-ACTION-ARGUES 테마를 행동으로 논증한다 (설교 금지)
- **정의:** Truby의 moral argument — 테마는 캐릭터/플레이어의 행동과 그 결과로 증명되지, 대사로 설명되지 않는다. **무엇을 하게 만드느냐가 곧 게임이 말하는 바**다. 마지막 행동/결과가 테마의 funnel(좁은 끝)이 된다.
- **출처:** John Truby, *The Anatomy of Story* (테마 = 행동으로 펼치는 moral argument).
- **우리 엔진 구현(작은 웹게임):** 메커닉 자체가 premise를 체현하게 설계한다 — '욕심의 대가' 게임이면 '더 먹을수록 느려져 잡힌다'처럼 규칙이 테마를 입증(ludonarrative harmony, GN-LUDOHARMONY와 결합). opponent는 NPC가 아니라 환경/규칙으로 추상화한다. 인트로·엔딩 카드에서 '이 게임의 교훈은…'을 직접 말하지 않고, 환경 단서(WT-ENV-CLUE)·승패 결과로 보여준다. STORY.md에 'premise를 입증하는 핵심 메커닉' 한 줄을 명시해 디자인과 테마를 잠근다.
- **흔한 실패:** 인트로나 엔딩에서 '이 게임의 교훈은…'이라고 직접 말하면 몰입이 깨지고 유치해진다. 보여주지 않고 말하면(telling) 플레이어는 자기가 만든 의미를 빼앗긴다.
- **연관:** WT-PREMISE-ONE, WT-ENV-CLUE, GN-LUDOHARMONY, ST-BEATS-AS-PLAY

### WT-ICEBERG 세계관은 빙산의 일각만 보여준다
- **정의:** Hemingway 생략이론 + Sanderson의 hollow iceberg — 세계를 다 설명하지 말고 '깊이가 있다는 신호'(iceberg tip) 몇 개만 심어 플레이어 상상이 나머지를 채우게 한다. 핵심에 닿는 것만 깊게, 나머지는 암시.
- **출처:** Ernest Hemingway의 Iceberg Theory + Brandon Sanderson의 'hollow iceberg' 응용 (Andrea Cerasoni의 Iceberg Method 정리).
- **우리 엔진 구현(작은 웹게임):** 미니게임당 STORY.md에 **iceberg tip 3~5개만** 정한다: 의미심장한 고유명사 하나, 배경의 단서 오브젝트 하나(WT-ENV-CLUE로 sprite-picker가 배치), 과거를 암시하는 한 줄(막간 채널에). lore 문서·연표·종족 설정은 만들지 않는다 — 이게 lore dump 방지 장치다. 막간(채널 2)은 ≤1문장이므로 iceberg tip 하나를 그 한 줄에 심는다. 플레이어가 '여기 더 있구나' 느끼면 성공.
- **흔한 실패:** 세계관을 다 만들려다 'worldbuilder's block'에 빠지거나, 인트로에서 역사·지명·종족을 쏟아붓는 lore dump로 첫 30초에 플레이어를 잃는다. 짧은 게임에 거대 설정은 사치다.
- **연관:** WT-ENV-CLUE, WT-TONE-VOICE, GN-EVOKE, TL-BIBLE-LEAN

### WT-ENV-CLUE 환경 단서로 말없이 서사를 깐다
- **정의:** 환경 스토리텔링 — 사건을 서술하는 대신 사건의 '결과 tableau'를 배치하고 해석을 플레이어에게 맡긴다. '살아있던 사람이라면 무엇을 남겼을까?'가 핵심 질문. 협업적이라 더 깊이 몰입시킨다. 텍스트 0줄로 서사 밀도를 가장 싸게 올리는 수단.
- **출처:** Harvey Smith & Matthias Worch, 'Environmental Storytelling' (GDC / Game Developer).
- **우리 엔진 구현(작은 웹게임):** 채널 4 그 자체다 — 배경 한 장에 **단서 오브젝트 하나만** 더한다(부서진 의자, 꺼진 모닥불, 남겨진 편지 한 장). sprite-picker/sprite-forge로 단서 스프라이트를 고르거나 만들고, 배치·색(WT-COLOR-EMOTION)으로 '무슨 일이 있었다'를 암시한다. NPC·컷신 없는 미니게임에서 텍스트 예산을 0으로 유지하며 서사를 깐다. STORY.md의 iceberg tip 중 '단서 오브젝트' 항목을 이 채널에 1:1 연결한다.
- **흔한 실패:** 단서를 너무 많이 흩뿌리면 노이즈가 되어 어떤 것도 의미로 안 읽힌다. 또는 단서가 너무 모호해 아무 해석도 안 떠오르면 '협업'이 아니라 '공백'이 된다 — 의도된 한두 개로 절제.
- **연관:** WT-ICEBERG, WT-COLOR-EMOTION, ST-ENV-CLUE, GN-EMBED, CH-ENVCLUE

### WT-COLOR-EMOTION 색 팔레트를 감정의 1차 언어로 쓴다
- **정의:** 색은 즉각적 정서 신호다 — 따뜻한 색(빨강·주황)은 흥분·열정, 차가운 색(파랑·초록)은 평온·고독, 채도 낮은 톤은 내성·우울. **팔레트는 mood throughline의 시각적 구현**이다.
- **출처:** Myk Eff, 'Atmosphere & Progression' (색·조명이 분위기를 구성).
- **우리 엔진 구현(작은 웹게임):** mood 단어를 PixelForge/VectorForge 팔레트로 직접 번역한다(아래 §3 색=감정 표). '쓸쓸한 향수' → 바랜 세피아·낮은 채도. 적은 색 수(4~6색)로도 일관되면 강하다. 톤 전환이 필요한 순간(WT-TONE-SHIFT)에만 팔레트를 의도적으로 바꾼다. 단서 오브젝트(WT-ENV-CLUE)의 색도 같은 팔레트 안에서 골라 응집을 유지한다. 모바일 소형 화면을 고려해 명도 대비를 충분히 크게.
- **흔한 실패:** 에셋마다 무드와 무관한 화려한 색을 섞으면 정서 신호가 상충해 분위기가 무너진다. '예뻐서' 고른 색이 테마의 감정을 거스르는 경우가 흔하다.
- **연관:** WT-MOOD-THROUGHLINE, WT-AUDIO-PLACE, WT-TONE-SHIFT, GN-CONTRAST

### WT-AUDIO-PLACE 음악·앰비언트로 장소와 감정을 동시에 깐다
- **정의:** 음악은 정서 반응을, 앰비언트 사운드는 '장소감'을 만든다 — 둘이 합쳐 대사 없이 안전/위험·고독·긴장을 전달한다. 사운드는 분위기 응집의 핵심 축이다. **침묵도 분위기의 도구**다.
- **출처:** Myk Eff, 'Atmosphere & Progression' (음악·앰비언트가 분위기를 구성) + leitmotif 연구.
- **우리 엔진 구현(작은 웹게임):** ChipAudio로 mood에 맞는 단일 BGM 톤(템포·음색·조성: 단조/장조, 느림/빠름)을 정하고, 짧은 앰비언트 레이어(바람·물·기계음) 하나를 깐다. 느린 페이싱 구간(WT-PACING-BREATHE)엔 음악을 비워 환경 스토리텔링이 들리게 한다. mood 단어를 ChipAudio 파라미터로 번역하는 표(§3)를 게이트로 쓴다 — 무드와 무관한 장르 관습 트랙은 채택 안 함. 반복 모티프(WT-MOTIF-THREAD)의 3음 멜로디도 여기서 산다.
- **흔한 실패:** 장르 관습만 따라 'BGM 깔면 되지' 식으로 무드와 무관한 트랙을 넣으면 오히려 몰입을 깬다. 침묵도 분위기의 도구인데 항상 채우려 든다.
- **연관:** WT-MOOD-THROUGHLINE, WT-COLOR-EMOTION, WT-MOTIF-THREAD, WT-PACING-BREATHE

### WT-MOTIF-THREAD 반복 모티프로 throughline을 짠다
- **정의:** Leitmotif/motif — 짧은 선율·색·도형·구절을 핵심 순간마다 변주 반복해 게임 전체를 하나의 정서적 실로 꿴다. *Undertale*의 ostinato처럼, 의미 있는 순간에 회수해 감정을 증폭한다.
- **출처:** 바그너의 leitmotif + Toby Fox의 *Undertale* 적용 ('An Examination of Leitmotifs in UNDERTALE', Game Developer).
- **우리 엔진 구현(작은 웹게임):** 3음 멜로디 하나(ChipAudio) 또는 시각 모티프 하나(특정 색·아이콘, VectorForge/PixelForge)를 정해 인트로(채널 1)·전환(WT-TONE-SHIFT 지점)·엔딩(채널 3)에 변주 등장시킨다. 엔딩에서 인트로 모티프가 변형되어 돌아오면(거울 프레이밍, ST-MIRROR-FRAME과 결합) 짧은 게임도 '완결된 한 편'으로 느껴진다. STORY.md에 'motif: {3음 멜로디 / 시각 아이콘}'을 명시해 어느 채널에서 회수할지 적는다.
- **흔한 실패:** 모티프를 너무 자주 노출하면 닳아 무의미해지고, 한 번만 쓰면 모티프로 인식되지 않는다. 반복 + 변주 + 절제의 균형이 필요하다.
- **연관:** WT-AUDIO-PLACE, WT-COLOR-EMOTION, ST-MIRROR-FRAME, TW-PLANT-PAY

### WT-PACING-BREATHE 페이싱으로 분위기가 숨 쉬게 한다
- **정의:** 장애물 밀도(페이싱)가 긴장의 강약을 만든다 — 빠른 페이싱은 압박, 느린 페이싱은 분위기·환경 서사를 흡수할 여백을 준다. 분위기는 진행과 함께 변주되어야 신선하다.
- **출처:** Myk Eff, 'Atmosphere & Progression' (페이싱·진행과 함께 변주되는 분위기).
- **우리 엔진 구현(작은 웹게임):** 미니게임도 '느린 도입 → 긴장 상승 → 짧은 해소'의 호흡을 둔다. 인트로 카드 후 첫 화면은 천천히 보게 하고(환경 단서를 음미할 여백), 절정에서 페이싱을 조인다. Kishōtenketsu라면 Shō 구간을 느리게 둬 Ten의 전환(WT-TONE-SHIFT)이 돋보이게. 느린 구간엔 BGM을 비우는 WT-AUDIO-PLACE와 묶는다. 페이싱은 레벨 디자인(LD-PACING)과 같은 곡선을 공유하므로 level-architect와 정합을 맞춘다.
- **흔한 실패:** 처음부터 끝까지 같은 강도면 분위기가 평평해져 몰입이 안 생긴다. 반대로 쉴 틈 없이 몰아치면 환경 단서·정서를 음미할 여백이 사라진다.
- **연관:** WT-AUDIO-PLACE, WT-TONE-SHIFT, WT-ENV-CLUE

### WT-TONE-VOICE 단일 보이스로 모든 텍스트를 통일한다
- **정의:** voice(글의 일관된 인격)는 고정하고 tone(상황별 감정 색)만 유연하게 둔다. 대사·UI·승패 문구·튜토리얼까지 같은 보이스를 쓰지 않으면 작은 불일치가 플레이어를 빼낸다.
- **출처:** 'Crafting Engaging Tone and Voice in Game Design' (voice 고정·tone 유연 원칙).
- **우리 엔진 구현(작은 웹게임):** STORY.md에 미니 **tone document 한 단락**을 만든다: 화자는 누구인가(냉소적 관찰자? 다정한 안내자?), 문장 길이·어휘·구두점 규칙. 모든 텍스트(인트로·막간·승리·패배·버튼·bark 변형)를 이 보이스로 통과시킨다. bark(이벤트당 floating text 3~6변형)도 같은 보이스 안에서 변주하되 의미 중복을 피한다(DL-BARKVARY). 인물 1~4명이면 캐릭터별 voice는 이 단락의 하위 항목으로 간단히. 적은 텍스트라도 통일하면 인격이 선다.
- **흔한 실패:** 인트로는 시적인데 패배 화면은 사무적, 버튼은 밈 톤이면 게임의 '목소리'가 분열한다. 짧은 게임은 텍스트가 적어 불일치가 더 눈에 띈다.
- **연관:** WT-COHERENCE, WT-MOOD-THROUGHLINE, DL-VOICEBIBLE, DL-BARKVARY, TL-CHAR-VOICE

### WT-TONE-SHIFT 톤 전환은 의도적으로, 신호와 함께
- **정의:** 평화로운 마을이 반전 뒤 불길해지는 것처럼, 의도된 톤 전환은 강력한 도구다. 단 색·음악·환경 단서를 함께 바꿔 플레이어가 '의미가 바뀌었다'를 느끼게 해야 한다 (Kishōtenketsu의 Ten).
- **출처:** Kishōtenketsu의 Ten(재맥락화) + atmosphere 연구.
- **우리 엔진 구현(작은 웹게임):** 전환점을 **한 곳만** 정한다(미니게임은 보통 후반 1회, 3레벨이면 Ten 지점). 그 순간 팔레트(WT-COLOR-EMOTION)·BGM(WT-AUDIO-PLACE)·문구 톤을 **동시에** 전환해 앞 내용을 재맥락화한다. 전환 전 복선(작은 환경 단서 하나, WT-ENV-CLUE)을 깔면 '준비된 충격'이 된다(setup & payoff, TW-PLANT-PAY). 모티프(WT-MOTIF-THREAD)를 전환 순간에 변주로 회수하면 정서가 증폭된다. STORY.md에 '전환점: {레벨/시점} — 무엇이 재맥락화되나'를 1줄로 명시.
- **흔한 실패:** 신호 없이 톤만 갑자기 바꾸면 의도된 반전이 아니라 '톤 붕괴'(WT-MOOD-THROUGHLINE 위반)로 읽힌다. 전환을 여러 번 남발하면 어느 톤도 정착하지 못한다.
- **연관:** WT-MOOD-THROUGHLINE, WT-COLOR-EMOTION, WT-MOTIF-THREAD, TW-RECONTEXT, TW-PLANT-PAY

---

## 3. tone 단어 → 엔진 번역 게이트

WT-MOOD-THROUGHLINE의 mood 단어 1~2개를 **VectorForge/PixelForge 팔레트 · ChipAudio 무드 · 페이싱**으로 번역하는 구체 표다. 인터뷰에서 mood 단어를 받는 즉시 이 표로 4채널 결정을 잠근다 — 모든 에셋은 'mood 단어에 부합하는가?'(WT-COHERENCE) 게이트를 이 표 기준으로 통과해야 한다.

### 3.1 색 = 감정 (PixelForge/VectorForge 팔레트)

| 정서 신호 | 색 영역 | 채도·명도 | 대표 mood 단어 | 엔진 처방 |
| --- | --- | --- | --- | --- |
| 흥분·열정·위험 | 빨강·주황 | 고채도 | 분노, 다급함, 축제 | 액션·절정 화면의 강조색. 배경에 과용 ❌(눈 피로) |
| 평온·고독·사색 | 파랑·청록 | 중채도·중명도 | 고독, 평온, 멜랑콜리 | 사색형(Kishōtenketsu) 기본 배경. 차가운 단색 + 강조 1색 |
| 성장·안정·자연 | 초록 | 중채도 | 치유, 안도, 향수 | 안전 구간·회복 비트. 따뜻한 초록은 노스탤지어 |
| 내성·우울·체념 | 저채도 전반 (회색·세피아) | 낮은 채도 | 쓸쓸함, 체념, 상실 | 바랜 세피아·탈색. iceberg tip 단서 오브젝트도 같은 톤 |
| 신비·불안·긴장 | 보라·자홍·심청 | 저명도 | 불안, 미스터리, 경외 | 톤 전환(WT-TONE-SHIFT) 이후 팔레트로 자주 쓰임 |
| 명랑·따뜻함·안전 | 노랑·연주황 | 고명도 | 따뜻함, 희망, 유쾌 | 인트로의 안전한 톤. 후반 전환으로 빼앗으면 대비 강함 |

> 규칙: mood 단어 1~2개 → 위 표에서 **베이스 1영역 + 강조 1색**을 고른다. 전체 4~6색으로 제한(미니게임 응집). 톤 전환 시에만 팔레트를 통째로 바꾼다.

### 3.2 무드 = 사운드 (ChipAudio)

| mood 방향 | 템포 | 조성 | 음색 | 앰비언트 레이어 |
| --- | --- | --- | --- | --- |
| 쓸쓸함·향수·상실 | 느림 (≤90 BPM) | 단조 | 부드러운 사인/삼각파, 잔향 | 바람·먼 종소리. 침묵 구간 허용 |
| 평온·사색 | 느림~중간 | 장조/도리안 | 맑은 단음, 적은 화성 | 물·새. 절정 외엔 음악 비움 |
| 긴장·불안 | 중간~빠름 | 단조/감화음 | 거친 사각파, 불협 | 저음 드론·기계음 |
| 다급함·위험 | 빠름 (≥130 BPM) | 단조 | 강한 펄스파, 빠른 아르페지오 | 경보·심박 |
| 따뜻함·희망 | 중간 | 장조 | 둥근 음색, 밝은 화성 | 가벼운 멜로디 루프 |

> 반복 모티프(WT-MOTIF-THREAD)의 3음 멜로디는 이 조성·음색 안에서 만들고, 톤 전환 시 같은 3음을 단조↔장조로 뒤집어 회수한다.

### 3.3 mood → 페이싱 (WT-PACING-BREATHE 연동)

| mood 방향 | 도입 페이싱 | 절정 페이싱 | 여백(환경 단서 음미) |
| --- | --- | --- | --- |
| 사색·향수 | 매우 느림 | 완만 | 길게 — 단서를 천천히 읽게 |
| 긴장·불안 | 느림→급가속 | 조임 | 짧게, 전환 직전에만 |
| 명랑·유쾌 | 빠른 진입 | 리드미컬 | 보상 구간에 짧게 |

> 페이싱 곡선은 level-architect의 LD-PACING과 공유한다 — 분위기(이 표)와 난이도(LD-*)가 같은 곡선 위에서 출렁이게 맞춘다.

---

## 4. premise 한 문장 작성법 (WT-PREMISE-ONE 실전)

`games/<slug>/STORY.md`의 `premise:` 한 줄을 만드는 절차. 인터뷰 최우선 단계이며, 이 문장이 서지 않으면 다음으로 내려가지 않는다.

1. **사용자에게 묻는다:** "한 문장으로, 이 게임이 증명하는 것은 무엇입니까?"
2. **한 단어 테마가 오면 거부한다.** '생존' '복수' '사랑' 같은 추상 명사는 방향을 못 준다. → 리프레이밍: "무엇이 어떻게·왜 변합니까? (가치 변화 + 원인)"
3. **공식에 맞춘다:** `[가치] 가 [원인] 때문에 [어떻게] 변한다` 의 인과 한 문장.
   - 예: '욕심을 부릴수록 더 많이 잃는다' / '정직이 결국 기만을 이긴다' / '놓아줄 때 비로소 자유로워진다'
4. **유형을 고른다(McKee):** idealistic(긍정 결말) · pessimistic(부정 결말) · ironic(양면). 이 유형이 승패 카드의 양면(WT-CHOICE-CONVERGE)을 결정한다.
5. **4채널로 검증한다:** 이 한 문장이 (1)인트로 카드의 시적 변형, (3)승리·패배 카드의 양면, (4)환경 단서, 메커닉으로 각각 전개 가능한가? 안 되면 문장을 다시 벼린다.

> 산출: STORY.md 최상단에 `premise:` 1줄 + `mood:` 1~2단어 + `iceberg tips:` 3~5개 + `tone document:` 1단락. 이 **초경량 카드가 전체 '서사 바이블'**이다 — 별도 lore 문서·캐릭터 시트는 만들지 않는다(WT-ICEBERG).

---

## 5. 미니게임 적응 요약 (small-game adaptation)

미니 브라우저 게임 규모로 축소하는 핵심은 '**표면을 최소화하되 그 최소 표면을 빈틈없이 정렬**'하는 것이다.

- **서사 전달 표면은 5곳뿐:** (1) 인트로 카드 1~2장 — premise의 시적 변형 한 줄 + mood를 정하는 색/음악, (2) 레벨 사이 막간 한두 줄 — 분위기 유지 + 작은 iceberg tip, (3) 환경 단서 — 배경 한 장에 단서 오브젝트 하나(WT-ENV-CLUE), (4) 승패 화면 — controlling idea의 양면(긍정/대가) 진술, (+) 반복 모티프 — 3음 멜로디나 시각 아이콘 하나를 처음·전환·끝에 변주(WT-MOTIF-THREAD).
- **서사 바이블은 초경량 카드:** premise 1문장 + mood 단어 1~2개 + iceberg tip 3~5개 + tone document 1단락. 세계관 문서·캐릭터 시트·lore는 만들지 않는다.
- **구조는 3레벨이면 Kishōtenketsu:** Ki·Shō·Ten/Ketsu에 매핑해 갈등형 보스 없이도 후반 단일 전환(WT-TONE-SHIFT)으로 여운을 남긴다. 갈등형이면 Truby의 moral argument(행동으로 증명) 템플릿으로.
- **단일 게이트:** 모든 아트(PixelForge/VectorForge)·오디오(ChipAudio) 결정은 'mood 단어에 부합하는가' 한 기준(§3 번역 표)으로 검증한다(WT-COHERENCE).
- **텍스트는 적게, 보이스는 하나로:** 인트로 2줄, 막간 1줄×N, 승패 각 1~2줄. 전부 단일 보이스(WT-TONE-VOICE)로 통일하고 bark만 변주(3~6개).

---

## 출처

- The Art of Dramatic Writing (Lajos Egri) — and games — Emily Short's Interactive Storytelling — https://emshort.blog/2018/01/02/the-art-of-dramatic-writing-lajos-egri-and-games/
- What Is a Controlling Idea? Robert McKee's Focus on Theme — Shortform — https://www.shortform.com/blog/what-is-a-controlling-idea/
- Splitting the Theme into Oppositions / Moral Argument — John Truby, The Anatomy of Story (Medium notes) — https://medium.com/@pirangy/splitting-the-theme-into-oppositions-john-truby-the-anatomy-of-story-p-114-118-de9d37932d95
- Worldbuilding Made Easy with the Iceberg Method — Andrea Cerasoni — https://andreacerasoni.com/blog/iceberg-method
- Environmental Storytelling — Game Developer — https://www.gamedeveloper.com/design/environmental-storytelling
- Kishōtenketsu Story Structure — Helping Writers Become Authors — https://www.helpingwritersbecomeauthors.com/kishotenketsu-story-structure/
- An Examination of Leitmotifs in UNDERTALE — Game Developer — https://www.gamedeveloper.com/audio/an-examination-of-leitmotifs-and-their-use-to-shape-narrative-in-undertale---part-1-of-2
- Atmosphere & Progression — Myk Eff, Understanding Games (Medium) — https://medium.com/understanding-games/atmosphere-progression-91bd830731ca
- Crafting Engaging Tone and Voice in Game Design — Number Analytics — https://www.numberanalytics.com/blog/ultimate-guide-tone-voice-game-design
