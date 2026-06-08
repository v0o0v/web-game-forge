# 서사 구조 프레임워크 (ST-*)

> 미니 웹게임의 이야기를 '어떤 순서로, 어떤 정서 곡선으로' 펼칠지 정하는 뼈대 모음. 4채널(인트로 카드 / 막간 / 승패·엔딩 카드 / 환경 단서)로 강제 압축하는 법까지. · 색인: [INDEX.md](./INDEX.md) · 자매 SKILL: [../../SKILL.md](../../SKILL.md)

서사 구조 프레임워크는 이야기를 펼치는 순서와 정서 곡선을 정하는 골격이다. 서구 전통(3막, Freytag, Hero's Journey, Story Circle, Save the Cat, 7-point, Fichtean)은 대체로 갈등·욕구·변화를 축으로 긴장을 쌓아 절정에서 터뜨린다. 동아시아의 Kishōtenketsu는 갈등 대신 병치(juxtaposition)와 '전(転)'의 시점 전환으로 의미를 만든다. 이 스킬의 게임은 Phaser 4로 만드는 작은 2D 웹/모바일웹이다. **AAA RPG가 아니다.** 그래서 어떤 프레임워크든 '12스텝 컷신'이 아니라 인트로 카드 1장·레벨 사이 한두 줄·승패 화면·환경 단서라는 극소 단위로 압축해, **플레이어의 행동 자체가 구조의 한 비트가 되도록** 설계한다.

핵심 긴장은 두 가지다. (1) '구조를 따를 것인가 vs 구조에 매몰될 것인가' — 짧은 게임에서 정통 단계를 다 채우는 건 미덕이 아니라 군더더기다. (2) '게임은 이야기를 보여주는 매체가 아니라 플레이어가 행위로 통과하는 매체' — 서사의 무게는 메커닉·환경이 지고, 텍스트는 행동을 주석할 뿐이다.

---

## 프레임워크 요약

| 프레임워크 | 출처 | 한 줄 골격 | 미니 게임 적합도 |
|---|---|---|---|
| **Three-Act (3막)** | Aristotle · Syd Field | Setup→Confrontation→Resolution (25/50/25%) | ★★★ 가장 안전한 디폴트 |
| **Freytag's Pyramid (5막)** | Gustav Freytag (1863) | Exposition→Rising→Climax→Falling→Dénouement | ★ 하강부가 길어 보통 과함 |
| **Hero's Journey (12단계)** | Campbell · Vogler | 일상→문턱→시련(Ordeal)→변화된 귀환 | ★★ 풀 12단계는 무거움, 3박자 압축 |
| **Story Circle (8단계)** | Dan Harmon | You→Need→Go→Search→Find→Take→Return→Change | ★★★ 루프·반복형에 최강 |
| **Kishōtenketsu (4막)** | 한시 절구 · Hayashida | Ki→Shō→Ten(転)→Ketsu, 갈등 없는 병치 | ★★★ 평화·퍼즐·분위기형 최강 |
| **Save the Cat! (15비트)** | Blake Snyder (2005) | Opening Image→…→Midpoint→…→Final Image | ★★ 비트 4개만 골라 페이싱 체크리스트로 |
| **Fichtean Curve** | Fichte 변증법 어원 | 곧장 위기로 시작, 연쇄 위기 가속(등지느러미) | ★★★ 액션·아케이드·가속형 천연 적합 |
| **In Medias Res** | Horace · Homer | 한복판에서 열고 맥락은 나중에 | ★★★ 오프닝 기법 — 모든 구조에 결합 |
| **7-Point** | Dan Wells | Hook↔Resolution을 정반대로, 거꾸로 설계 | ★★ '엔딩부터 설계' 방법론이 유용 |
| **Story Spine** | Kenn Adams · Pixar | 옛날…매일…그러던 어느 날…그래서…마침내…그날 이후로 | ★★★ 기획용 한 문단 요약 엔진 |

비율 참고: Kishōtenketsu는 Ki 10% / Shō 45% / Ten 30% / Ketsu 10%. 3막은 25/50/25%. Save the Cat은 Catalyst ~10%, Break into Two ~20%, Midpoint 50%, All Is Lost ~75%.

---

## 프레임워크별 4채널 매핑 공식

미니 브라우저 게임의 서사 전달 채널은 사실상 4개뿐이다 — **(1) 인트로 카드**(≤2문장, 가능하면 in medias res 상황 한복판) · **(2) 레벨 사이 막간**(≤1문장) · **(3) 승리/패배/엔딩 카드**(각 ≤2문장, 인트로와 거울쌍) · **(4) 환경 단서**(스프라이트·배치·색·툴팁 — 정보의 70%를 여기 숨김). 어떤 프레임워크든 이 4채널로 강제 압축한다.

| 프레임워크 | ① 인트로 카드 | ② 레벨 사이 막간 | ③ 승패/엔딩 카드 | ④ 환경 단서 |
|---|---|---|---|---|
| **3막** | Setup 한 줄 | Midpoint 반전 한 줄 | Resolution(climax 후 정리) | 1·2·3막에 따라 색·배경 변화 |
| **Hero's Journey 3박자** | Ordinary World | Threshold/Tests | Ordeal=마지막 레벨, Return=엔딩 | Reward=해금·시각 변화 |
| **Story Circle 8단계** | You/Need | Go·Search·Find·Take(절반은 환경 흡수) | Return/Change(Want vs Need 암시) | 질서↔혼돈 공간 대비 |
| **Kishōtenketsu** | Ki(메커닉/풍경 소개) | Shō 연습 → **Ten(예상 밖 변주)** 막간 | Ketsu(앞을 새로 이해시키는 화해) | Ten의 병치를 스프라이트·색으로 |
| **Save the Cat 4비트** | Opening Image + Theme Stated | Midpoint(50%) | Final Image(Opening의 거울) | All Is Lost(~75%) 직전 레벨 분위기 |
| **Fichtean** | in medias res 위기 한 줄 | 레벨마다 작은 위기-해소 | 최대 위기 후 카타르시스 | 가속을 속도·색·SFX로 |
| **In Medias Res** | 상황 한복판 한 줄(설명 X) | 맥락 점진 보충 | (결합 프레임워크 따름) | 배경·회상 단서로 맥락 채움 |
| **7-Point** | Hook(시작 상태) | Pinch 1(중간 위협)·Pinch 2(최대 위협) | Resolution(Hook의 정반대) | 두 Pinch를 적·환경으로 가시화 |
| **Story Spine** | '그러던 어느 날' | '그래서…그래서'(레벨들) | '마침내'=클리어, '그날 이후로'=엔딩 | '매일'(status quo)을 배경으로 |

---

## 프레임워크 셀렉터 (3질문 → 1추천)

메인 구조는 **단 하나만** 고른다(ST-PICK-ONE). 인터뷰에서 세 질문을 던지고 자동으로 1개를 제안한 뒤 사용자 확인을 받는다.

1. **장르/톤은?** — 평화·퍼즐·슬라이스오브라이프 / 액션·아케이드·가속 / 루프·반복 / 갈등 영웅담
2. **길이는?** — 30초~1분(초단편) / 3~5분(단편) / 그 이상
3. **갈등이 있는가?** — 적·대립·압박이 있다 / 없다(병치·분위기 중심)

| 답 조합 | 추천 메인 프레임워크 | 이유 |
|---|---|---|
| 평화·퍼즐 / 갈등 없음 | **Kishōtenketsu** | 적 없이 '転' 하나로 완결(ST-KISHO-NOCONFLICT) |
| 긴박·아케이드 / 갈등 있음 / 가속 | **Fichtean** | 난이도 계단 = 서사 곡선이 동형(ST-ESCALATE) |
| 루프·반복·에피소드 | **Story Circle** | 원형 구조라 '귀환=다시 시작'과 맞음 |
| 갈등 영웅담 / 변화·성장 | **3막** 또는 **Hero's Journey 3박자 압축** | 가장 안전한 디폴트, RPG 정서를 한입 크기로 |
| (오프닝만 바꾸고 싶다) | **In Medias Res**를 위 추천에 **결합** | 구조가 아니라 오프닝 기법이므로 단독 채택 X |
| (페이싱만 정밀 관리) | **Save the Cat 4비트**를 위 추천에 **부분 차용** | 거울쌍·Midpoint·All Is Lost만 체크리스트로 |

선택 결과는 `games/<slug>/STORY.md`의 'Structure' 섹션에 한 줄로 못 박는다 — 모든 텍스트·대사의 single source of truth. **여러 구조를 동시에 강요하지 말 것**(ST-PICK-ONE, ST-NO-OVERFIT).

---

## 원칙 사전 (ST-*)

### ST-SPINE-FIRST Story Spine로 한 문단 먼저
- **정의:** 본격 설계 전에 Pixar Story Spine 빈칸('옛날…매일…그러던 어느 날…그래서…마침내…그날 이후로')을 채워 게임 전체 서사를 한 문단으로 압축한다.
- **출처:** Pixar Story Spine (Kenn Adams 1991, 즉흥극 교육 도구 / Pixar Emma Coats '22 Rules' 4번)
- **우리 엔진 구현(작은 웹게임):** 인터뷰 첫 단계에서 사용자와 함께 6~7줄을 채운다. '그러던 어느 날'은 인트로 카드(채널①), '그래서…그래서'는 각 레벨/스테이지(채널②), '마침내'는 클리어 화면, '그날 이후로'는 엔딩 카드(채널③)로 1:1 변환된다. 이 한 문단을 그대로 `games/<slug>/STORY.md` 맨 위에 적고, 거기서 도출된 텍스트를 `this.add.text()`로 각 Scene 전환 카드에 매핑한다. 미니 게임은 이 한 문단이 사실상 전체 각본이다.
- **흔한 실패:** 빈칸을 추상어('모험을 떠난다')로 채우면 변환이 막힌다. 구체 명사·동사('낡은 등대지기가 꺼진 불을 다시 켠다')로 강제해야 한다.
- **연관:** ST-PICK-ONE, ST-NO-OVERFIT, [WT-PREMISE-ONE](./world-tone.md), [TL-BIBLE-LEAN](./consistency-tools.md)

### ST-PICK-ONE 프레임워크 하나만 고른다
- **정의:** 게임 톤·길이·갈등 유무에 맞춰 메인 구조 프레임워크를 단 하나 선택하고, 다른 것은 부분 차용만 한다. 여러 구조를 동시에 다 적용하지 않는다.
- **출처:** 게임 서사 디자인 일반 원칙(과적재 안티패턴 회피)
- **우리 엔진 구현(작은 웹게임):** 위 '프레임워크 셀렉터'의 3질문으로 1개를 추천하고 사용자 확인을 받는다. 갈등형 액션→3막/Fichtean, 평화·퍼즐·분위기형→Kishōtenketsu, 루프·반복형→Story Circle, 페이싱 정밀 관리가 필요하면 Save the Cat 비트 중 4개만. 선택한 메인 프레임워크는 `STORY.md`에 한 줄로 박고, 4채널 매핑도 그 하나를 기준으로 채운다. VectorForge/PixelForge·ChipAudio·juice-fx의 연출 방향도 이 하나의 구조 곡선에 정렬한다.
- **흔한 실패:** 3막+Hero's Journey+15비트를 다 채우려다 5분짜리 게임이 과적재된다. '구조를 따르는 것'이 아니라 '구조에 봉사당하는' 안티패턴.
- **연관:** ST-NO-OVERFIT, ST-SPINE-FIRST, ST-TONE-LOCK, [CH-ARCFIT](./characters-arcs.md)

### ST-KISHO-NOCONFLICT 갈등 없이도 서사가 된다 (Kishōtenketsu)
- **정의:** 적·싸움·대립이 없는 게임도 Ki-Shō-Ten-Ketsu의 '전(転, 병치적 시점 전환)' 하나로 완결된 서사 만족을 줄 수 있다.
- **출처:** Kishōtenketsu / 起承転結 (한시 절구, Nintendo Koichi Hayashida의 Mario 레벨 설계)
- **우리 엔진 구현(작은 웹게임):** 평화로운 미니 게임에 Ten 비트 하나를 심는다 — 익숙한 메커닉/풍경을 중반 이후 예상 밖으로 비틀고(새 변주·관점 전환), 엔딩(Ketsu)에서 앞의 평온함을 새로 이해시킨다. Nintendo Mario식 '소개→연습→비틀기→숙련 증명' 레벨 곡선이 그대로 서사 곡선이 된다. Ten의 병치는 PixelForge/VectorForge로 색·스프라이트를 바꾸고, ChipAudio의 무드 BGM을 전환점에서 살짝 변주해 '깜짝'을 청각으로도 준다. 적·점수가 없어도 이야기를 포기하지 않는다.
- **흔한 실패:** 갈등 없는 게임에 억지로 악당을 끼워 넣어 톤을 망치는 것. 반대로 Ten 없이 평온만 이어지면 '아무 일도 없는 게임'이 된다 — 반드시 전환점 하나는 둔다.
- **연관:** ST-MIDPOINT-FLIP, ST-TONE-LOCK, [GN-KISHO](./narrative-in-games.md), [TW-RECONTEXT](./twist-foreshadow.md)

### ST-WANT-NEED Want과 Need를 분리한다
- **정의:** 플레이어/주인공이 '원하는 것(Want, 표면 목표)'과 '진짜 필요한 것(Need, 내면 교훈)'을 분리해, 짧아도 변화·반전의 정서를 만든다.
- **출처:** Dan Harmon Story Circle(Need/Change), Dan Wells 7-Point(Hook↔Resolution 대비)
- **우리 엔진 구현(작은 웹게임):** 표면 목표는 게임 승리 조건(점수·탈출·구출)으로 메커닉에 박고, 내면 교훈은 엔딩 카드(채널③) 한 줄로만 드러낸다('보물은 찾았지만, 두고 온 친구가 더 그립다'). Need는 절대 설교하지 않고 엔딩 텍스트 한 줄로 암시한다. game-ui-hud의 엔딩 카드에 이 한 줄을 tween으로 천천히 띄워 여운을 준다.
- **흔한 실패:** Want=Need로 일치시키면 엔딩이 밋밋하다. 반대로 미니 게임에서 Need를 길게 설교하면 거슬린다 — 엔딩 한 줄로 암시만.
- **연관:** ST-MIRROR-FRAME, [CH-WANT-NEED](./characters-arcs.md), [GN-WANTNEED](./narrative-in-games.md), [AR-WANT-NEED](./characters-arcs.md)

### ST-MIRROR-FRAME 시작 화면과 끝 화면을 거울로
- **정의:** Save the Cat의 Opening Image↔Final Image, 7-point의 Hook↔Resolution처럼 인트로 카드와 엔딩 카드를 의도적으로 대칭/대조시켜 '변화'를 시각·텍스트로 증명한다.
- **출처:** Save the Cat!(Opening↔Final Image), Dan Wells 7-Point(Hook↔Resolution)
- **우리 엔진 구현(작은 웹게임):** 같은 장소·같은 구도·같은 문장 틀을 인트로(채널①)와 엔딩(채널③)에 쓰되 한 요소만 바꾼다('불 꺼진 등대' → '불 켜진 등대'; '혼자였다' → '더는 혼자가 아니다'). 같은 배경 스프라이트를 PixelForge/VectorForge에서 한 변수만 교체해 재사용하고, ChipAudio로 같은 모티프를 장조/단조로 뒤집는다. 미니 게임에서 가장 적은 비용으로 가장 큰 서사 임팩트를 내는 장치 — 에셋 비용도 거의 0.
- **흔한 실패:** 엔딩을 시작과 무관하게 새로 그리면 변화가 안 읽힌다. 거울쌍을 안 잡으면 '그래서 뭐가 달라졌지?'가 남는다.
- **연관:** ST-WANT-NEED, ST-MIDPOINT-FLIP, [GN-FRAME-WINLOSE](./narrative-in-games.md), [WT-MOTIF-THREAD](./world-tone.md)

### ST-ENV-CLUE 말하지 말고 환경으로 보여준다
- **정의:** 컷신·긴 대사 대신 배경·소품·조명·배치·아이템 설명 같은 환경 단서로 서사를 전달한다(environmental storytelling).
- **출처:** Environmental Storytelling(게임 라이팅 5기법)
- **우리 엔진 구현(작은 웹게임):** 미니 게임은 단 하나의 '잘못 놓인 소품'(부서진 의자, 꺼진 모닥불, 버려진 장난감)으로 미시 서사를 암시한다 — sprite-picker/sprite-forge로 그 한 스프라이트를 골라 배치한다(채널④). 아이템 툴팁·획득 텍스트는 '설명'이 아니라 '질문을 유발하는 한 줄'로 쓴다. 레벨 기하학(좁아지는 통로=긴장, 트이는 시야=해방)으로 정서를 만들고, 색은 VectorForge/PixelForge로 감정에 매핑한다. **정보의 70%는 환경에 숨긴다.**
- **흔한 실패:** 인트로 카드에 세계관을 줄줄 설명하는 것. 텍스트로 다 말해버리면 환경 단서가 무의미해진다.
- **연관:** ST-TEXT-BUDGET, ST-IN-MEDIAS, [GN-EMBED](./narrative-in-games.md), [WT-ENV-CLUE](./world-tone.md), [CH-ENVCLUE](./characters-arcs.md)

### ST-IN-MEDIAS 한복판에서 연다 (In Medias Res)
- **정의:** 긴 설정 설명을 건너뛰고 긴장/행동의 한가운데서 인트로를 시작해, 맥락은 플레이하며 채운다.
- **출처:** In Medias Res (Horace 'Ars Poetica', Homer의 Iliad·Odyssey)
- **우리 엔진 구현(작은 웹게임):** 인트로 카드(채널①)를 배경 설명이 아니라 상황 한 줄로 쓴다('경보가 울린다. 3분 안에 나가라.'). 튜토리얼·로딩 피로를 줄이고 즉시 플레이로 던진다 — 첫 Scene을 곧장 게임플레이로 시작하고 카드는 ≤2문장 overlay로 짧게 띄운다. Fichtean·3막의 오프닝만 이 기법으로 교체하고, 맥락은 채널②·④로 점진 보충한다.
- **흔한 실패:** 맥락을 끝까지 안 채우면 '왜 하는지 모르는 게임'이 된다. 한복판 시작 + 막간/환경으로 점진 보충이 한 쌍이어야 한다.
- **연관:** ST-ENV-CLUE, ST-ESCALATE, ST-TEXT-BUDGET, [GN-WHEREAMI](./narrative-in-games.md)

### ST-ESCALATE 위기를 계단식으로 쌓는다 (Fichtean)
- **정의:** 단조로운 평지가 아니라 작은 위기-해소를 연쇄시키며 점점 가속해 마지막에 최대 위기를 둔다.
- **출처:** Fichtean Curve (Johann Gottlieb Fichte 변증법 어원)
- **우리 엔진 구현(작은 웹게임):** 레벨마다 작은 절정(미니 보스·속도 증가·새 장애물)을 넣고, 직전 레벨을 'All Is Lost'급 최난이도로, 마지막을 카타르시스로 설계한다. 게임 난이도 곡선 자체가 Fichtean 서사 곡선과 동형임을 이용한다. 가속은 ChipAudio의 BGM 템포 상승, juice-fx의 화면 흔들림·파티클 강화, 색의 채도 상승(VectorForge)으로 정서적으로 증폭한다. 설명은 막간(채널②) 한 줄로만 흘린다.
- **흔한 실패:** 난이도/긴장이 평탄하면 중반에 이탈한다. 반대로 처음부터 최대치면 상승 여지가 없어 절정이 안 산다.
- **연관:** ST-IN-MEDIAS, ST-MIDPOINT-FLIP, ST-BEATS-AS-PLAY, [GN-FRAME-WINLOSE](./narrative-in-games.md)

### ST-MIDPOINT-FLIP 중간 지점에 반전을 둔다
- **정의:** 3막·Save the Cat·7-point 공통의 Midpoint 개념 — 이야기 정중앙에서 상황을 뒤집어(수동→능동, 안전→위험, 거짓 승리→진실) 후반에 추진력을 준다.
- **출처:** Three-Act / Save the Cat!(Midpoint 50%) / 7-Point(Midpoint)
- **우리 엔진 구현(작은 웹게임):** 레벨 절반 지점에 막간(채널②) 한 줄 + 게임 변화(규칙 추가·목표 변경·정체 폭로)를 동시에 던진다. 미니 게임에서도 '중간 반전' 하나가 단조로움을 깬다('사실 쫓기던 게 아니라 쫓고 있었다'). 텍스트만으로 끝내지 말고 반드시 메커닉 변화와 묶고, juice-fx로 전환 순간을 연출(플래시·줌)해 비트를 플레이어가 '느끼게' 한다.
- **흔한 실패:** 반전을 끝에 몰아넣으면 중반이 늘어진다. midpoint 반전은 텍스트만으로 끝내지 말고 반드시 게임플레이 변화와 묶는다.
- **연관:** ST-BEATS-AS-PLAY, ST-KISHO-NOCONFLICT, ST-MIRROR-FRAME, [TW-ONE-CLEAN](./twist-foreshadow.md)

### ST-BEATS-AS-PLAY 비트를 컷신이 아니라 플레이로 구현
- **정의:** 각 구조 비트(발단·시련·절정·변화)를 텍스트 나열이 아니라 플레이어의 '행동'으로 통과시킨다. 게임은 보여주는 매체가 아니라 행하는 매체.
- **출처:** Player Agency / narrative design 일반(플레이어 경험 설계)
- **우리 엔진 구현(작은 웹게임):** Ordeal=가장 어려운 도전 레벨, Reward=클리어 보상/해금, Threshold Crossing=시작 버튼/첫 문 통과로 매핑한다. 막간 텍스트는 행동을 '주석'할 뿐, 서사의 무게는 Phaser 메커닉이 진다. 한 비트 = 한 Scene/한 화면 = 한두 줄. narrative designer는 캐릭터 경험이 아니라 '플레이어 경험'을 설계한다 — game-ui-hud의 카드는 행동 사이의 짧은 호흡일 뿐 플레이를 끊지 않는다.
- **흔한 실패:** 비트마다 컷신/텍스트 벽을 세워 플레이를 끊는 것. 미니 웹게임에서 긴 텍스트는 즉시 스킵된다 — 한 비트 = 한 화면 = 한두 줄.
- **연관:** ST-TEXT-BUDGET, ST-ESCALATE, ST-MIDPOINT-FLIP, [GN-LUDOHARMONY](./narrative-in-games.md)

### ST-TEXT-BUDGET 텍스트 예산을 엄격히 둔다
- **정의:** 미니 웹게임 서사의 전달 채널은 인트로 카드 1장, 레벨 사이 한두 줄, 승패 화면, 환경 단서뿐 — 각 채널의 단어 수 상한을 미리 못박는다.
- **출처:** 미니 게임 서사 채널 모델(4채널 강제 압축)
- **우리 엔진 구현(작은 웹게임):** 인트로 ≤2문장(채널①), 막간 ≤1문장(채널②), 엔딩 ≤2문장(채널③)을 스킬이 강제한다. bark는 이벤트당 floating text 변형 3~6개로 살아있는 세계를 값싸게 채운다. 넘치는 정보는 환경 단서(채널④)·소품·시각으로 옮긴다. `this.add.text()`로 띄울 분량이 모바일웹 가로/세로 한 화면에 읽히는지 기준으로 자른다. STORY.md에 채널별 예산을 표로 박아 초과를 린트한다.
- **흔한 실패:** 세계관·로어를 텍스트로 다 욱여넣는 것. 플레이어는 게임을 하러 왔지 읽으러 오지 않았다 — 분량 초과는 곧 스킵.
- **연관:** ST-ENV-CLUE, ST-BEATS-AS-PLAY, [GN-BARK](./narrative-in-games.md), [DL-CONCISE](./dialogue-voice.md), [TL-CHANNEL-MAP](./consistency-tools.md)

### ST-TONE-LOCK 톤과 분위기를 먼저 고정한다
- **정의:** 구조 비트보다 먼저 게임의 정서적 톤(따뜻함/긴박/쓸쓸함/유쾌)과 분위기를 한 단어로 확정하고, 모든 텍스트·환경·승패 프레이밍을 그 톤에 정렬한다.
- **출처:** 서사 일관성 원칙(톤 정렬)
- **우리 엔진 구현(작은 웹게임):** 인터뷰에서 '이 게임을 끝낸 플레이어가 느꼈으면 하는 한 감정'을 가장 먼저 묻는다. 그 톤이 프레임워크 선택(쓸쓸함→Kishōtenketsu, 긴박→Fichtean)을 자동으로 끌어내고, VectorForge/PixelForge의 색 팔레트·ChipAudio의 무드 BGM·juice-fx의 연출 강도를 결정한다. 확정된 톤 한 단어를 STORY.md 맨 위에 박고 모든 채널이 이를 위반하지 않는지 검사한다.
- **흔한 실패:** 비트만 채우고 톤을 안 잡으면 인트로는 코믹한데 엔딩은 비장한 식의 톤 분열이 난다. 일관성 검사 항목 1순위.
- **연관:** ST-PICK-ONE, ST-MIRROR-FRAME, [WT-MOOD-THROUGHLINE](./world-tone.md), [GN-CONSISTENCY](./narrative-in-games.md), [DL-VOICEBIBLE](./dialogue-voice.md)

### ST-NO-OVERFIT 구조에 매몰되지 않는다
- **정의:** 프레임워크는 점검표이지 의무가 아니다. 모든 단계를 억지로 채우기보다, 짧은 게임에 맞게 비트를 통합·생략한다.
- **출처:** 미니 게임 서사 압축 원칙(과적재 회피)
- **우리 엔진 구현(작은 웹게임):** Story Spine의 'because of that'를 1회로 줄이거나, Hero's Journey를 3박자로 압축하듯, 5분 게임엔 4~6비트면 충분하다. 빈 비트는 환경 단서(채널④)로 흡수하거나 과감히 버린다. 4채널에 다 안 들어가는 비트는 곧 불필요한 비트라는 신호 — STORY.md의 4채널 표가 채워지면 거기서 멈춘다.
- **흔한 실패:** '정통 12단계를 다 넣어야 진짜 이야기'라는 강박. 작은 게임에서 구조 충실도는 미덕이 아니라 군더더기다.
- **연관:** ST-PICK-ONE, ST-SPINE-FIRST, ST-TEXT-BUDGET, [TL-BIBLE-LEAN](./consistency-tools.md)

---

## 인터뷰 순서 (탑다운 고정)

이 도메인이 스킬에 주는 직접 권고 — 인터뷰는 항상 이 순서로 내려간다.

1. **ST-TONE-LOCK** — '끝낸 플레이어가 느낄 한 감정'을 먼저 묻는다. 톤이 프레임워크를 자동 추천한다.
2. **ST-SPINE-FIRST** — Story Spine 한 문단을 함께 채운다. 추상어는 구체 명사·동사로 되묻는 루프.
3. **ST-PICK-ONE** — 프레임워크 셀렉터 3질문으로 메인 1개 확정(다른 건 부분 차용만).
4. **비트 배분** — 선택한 프레임워크의 비트를 4채널 매핑 표로 강제 압축.
5. **채널 예산 검사** — ST-TEXT-BUDGET(인트로≤2 / 막간≤1 / 엔딩≤2문장)을 STORY.md에 박는다.

## 일관성 체크리스트 (검수 패스)

- **톤 정렬:** 인트로~엔딩 어휘·정서가 한 톤인가 (ST-TONE-LOCK)
- **거울쌍:** Opening Image↔Final Image가 한 요소만 다르게 잡혔는가 (ST-MIRROR-FRAME)
- **Want↔Need 분리:** 표면 목표는 메커닉, 내면 교훈은 엔딩 한 줄인가 (ST-WANT-NEED)
- **환경 이전:** 텍스트로 설명한 것 중 환경 단서로 옮길 수 있는 건 없는가 (ST-ENV-CLUE, 정보 70% 환경에)
- **비트=행동:** 각 비트가 텍스트가 아니라 게임플레이 행동으로 구현됐는가 (ST-BEATS-AS-PLAY)
- **전환점 보장:** 갈등 없는 게임이라도 Ten(전환점) 한 개는 있는가 (ST-KISHO-NOCONFLICT)
- **과적재 방지:** 4채널에 안 들어가는 비트를 억지로 넣지 않았는가 (ST-NO-OVERFIT, ST-PICK-ONE)

---

## 출처

- [Three-act structure — Wikipedia](https://en.wikipedia.org/wiki/Three-act_structure) — 3막(Setup/Confrontation/Resolution) 정의, Syd Field·Aristotle 계보.
- [Dan Harmon Story Circle: The 8-Step Storytelling Shortcut — Reedsy](https://reedsy.com/blog/guide/story-structure/dan-harmon-story-circle/) — You~Change 8단계, Hero's Journey 간소화, 에피소드형 적합.
- [Kishōtenketsu Story Structure Explained — September C. Fawkes](https://www.septembercfawkes.com/2026/02/kishotenketsu-story-structure-explained.html) — Ki/Shō/Ten/Ketsu 비율, 병치로 갈등 없이 의미 만들기, Ten의 시점 전환과 Ketsu의 화해.
- [The Story Spine: Pixar's 4th Rule of Storytelling — Aerogramme](https://www.aerogrammestudio.com/2013/03/22/the-story-spine-pixars-4th-rule-of-storytelling/) — Kenn Adams의 빈칸 채우기 골격 전문과 각 줄의 서사 기능.
- [Save the Cat Beat Sheet Explained — StudioBinder](https://www.studiobinder.com/blog/save-the-cat-beat-sheet/) — 15비트 순서와 퍼센트 위치, Opening↔Final Image 거울, Theme Stated·Midpoint·All Is Lost.
- [5 Environmental Storytelling Techniques Every Game Writer Should Master — Keewano](https://keewano.com/blog/5-environmental-storytelling-techniques-every-game-writer-must-know/) — 레벨 디자인·소품·아이템 설명·NPC 배치로 컷신 없이 서사 전달.
- [Kishōtenketsu: The Nintendo formula for level design — Kitsune devblog](http://kitsunethegame.blogspot.com/2016/03/kishotenketsu-nintendo-formula-for.html) — Hayashida/Mario의 4단계 레벨 설계(소개·연습·비틀기·숙련)가 곧 서사 곡선.
- [Dan Wells' Seven-Point Story Structure — Kindlepreneur](https://kindlepreneur.com/7-point-story/) — Hook~Resolution 7포인트, '결말 먼저 거꾸로 설계', Pinch Point.
- [The Fichtean Curve: A Story in Crisis — Reedsy](https://reedsy.com/blog/guide/story-structure/fichtean-curve/) — 연쇄 위기로 가속하는 구조, in medias res와의 차이.
- [In Medias Res — Wikipedia](https://en.wikipedia.org/wiki/In_medias_res) — 한복판에서 시작·배경은 회상/대사로 보충, Homer·Horace 기원.
- [Freytag's Pyramid — MasterClass](https://www.masterclass.com/articles/freytags-pyramid) — 5막(노출·상승·절정·하강·대단원), 절정 후 긴 falling action.
- [12 Stages Of The Hero's Journey — Christopher Vogler (Film Courage/Medium)](https://medium.com/film-courage/12-stages-of-the-heros-journey-christopher-vogler-eed53460ff7) — Vogler 12단계(Ordinary World~Return with Elixir).
- [Player Agency: How Game Design Affects Narrative — Game Developer](https://www.gamedeveloper.com/business/player-agency-how-game-design-affects-narrative) — 게임은 행위 매체, narrative designer는 '플레이어 경험'을 설계.
