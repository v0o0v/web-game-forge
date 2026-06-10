---
name: wgf-story-architect
description: >
  게임의 전체 서사·분위기·목표·등장인물·대사를 설계하고 게임에 입힌다 — 재미요소(메카닉)가 아니라
  "이 게임이 무엇에 관한 이야기인가"를 담당하는 상위 스킬. 현재 게임의 코어 동사·기존 텍스트 표면(타이틀·
  막간·승패 카드)·톤을 먼저 분석하고, 의도가 모호하면 탑다운 1문1답으로 끈질기게 캐물어, 매 라운드 Claude가
  먼저 참신한 주제 아이디어를 제안하며 사용자가 고르거나 비틀게 한다. 검증된 서사 이론(3막·Kishōtenketsu·
  Story Circle·Save the Cat·Fichtean / Want·Lie·Ghost 캐릭터 아크 / setup&payoff 반전 / voice bible 대사)으로
  몰입을 만드는 스토리를 설계해 games/<slug>/STORY.md 스토리 바이블로 산출하고, 인트로 카드·레벨 사이 막간·
  승패/엔딩 문구·환경 단서·NPC 대사로 게임에 적용한다. **전형(typical) vs 참신(novel) 여부를 반드시 묻고**,
  주요 캐릭터를 입체적 인물 + 반전 요소로 설계하며, **대사가 필요한 곳이 생기면 자동 개입해 캐릭터 보이스에 맞춰
  작성**한다. 게임 제작 초반뿐 아니라 중반에도 스토리 수정·캐릭터 추가/삭제로 언제든 활용한다.
  스토리/서사/이야기/플롯/세계관/분위기/톤/무드/주제, 등장인물/캐릭터/주인공/악당/NPC, 대사/대화/멘트/
  내레이션/대본, 반전/복선/떡밥, 인트로/오프닝/엔딩/막간을 만들·짜·쓰·넣·고쳐 달라는 요청에 사용.
  English: create or revise a game's story / narrative / plot / world / mood / tone / theme, design characters
  (protagonist, villain, NPC) with depth and twists, write dialogue / lines / barks / intro / ending text, or add
  a plot twist. Always asks typical-vs-novel; auto-writes dialogue in a character's voice; usable at start or
  mid-development. Keywords: 스토리, 서사, 이야기, 플롯, 세계관, 분위기, 톤, 무드, 주제, 캐릭터, 주인공, 악당,
  NPC, 대사, 대화, 멘트, 내레이션, 반전, 복선, 인트로, 엔딩, 막간, story, narrative, plot, lore, mood, tone,
  theme, character, villain, dialogue, line, bark, plot twist, foreshadowing, intro, ending.
  레벨 난이도·배치는 level-architect, 스테이지 진행 맵은 world-map-architect 소관 — 이 스킬은 그 위에 입히는 의미·이야기다.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, WebSearch, WebFetch
---

# story-architect — 게임 서사 디렉터 (톤·이야기·캐릭터·대사·반전)

게임에 **재미와 별개로 '의미와 이야기'를 입히는** 상위 스킬. 무엇을 *플레이하는가*(메카닉)가 아니라,
**이 게임이 무엇에 *관한* 이야기이고, 끝낸 플레이어가 어떤 감정을 갖고 떠나는가**를 설계한다. 코드를 바로
짜지 않고 **① 현재 게임 분석 → ② 사용자 의도를 인터뷰로 명확화 → ③ 검증된 서사 이론 적용 →
④ STORY.md 스토리 바이블로 산출 → ⑤ 게임 텍스트 표면에 적용(또는 위임) → ⑥ 검수 + 연속성 린트**한다.
web-game-builder 워크플로의 일부. `reference/` 의 코드화 원칙(검증된 서사 작법을 광범위한 웹 리서치로 모아 작은 웹게임용으로 정리한 라이브러리)으로 설계하고, 분위기 구현은 엔진 기반 제작요소 스킬(VectorForge·ChipAudio 등)에 위임한다.

> **역할 분리 (4계층).** 같은 게임을 네 스킬이 다른 층에서 본다 — 반드시 구분한다.
> - **무엇을 플레이하나(재미·메카닉):** 재미요소 `FE-*` — [game-dna/fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md) (이 스킬은 그중 `FE-NARRATIVE`를 깊게 확장한다)
> - **개별 레벨의 내용·난이도 곡선:** `LD-*` — [`level-architect`](../wgf-level-architect/SKILL.md)
> - **스테이지를 잇는 진행 맵의 위상:** `MAP-*` — [`world-map-architect`](../wgf-world-map-architect/SKILL.md)
> - **그 위에 입히는 톤·이야기·캐릭터·대사·반전:** `ST GN CH AR TW DL WT TL-*` — **이 스킬** ([reference/story-design/INDEX.md](./reference/story-design/INDEX.md))
>
> **서사 ≠ 텍스트 떡칠.** 우리 게임은 작은 2D 웹게임이다. 서사는 컷신·대량 로어가 아니라
> **인트로 카드(≤2문장)·레벨 사이 막간(≤1문장)·승패/엔딩 카드·환경 단서·짧은 대사**라는 4채널 + bark로
> *값싸게* 실린다. 메카닉(코어 동사)이 곧 메시지가 되게 한다(`GN-LUDOHARMONY`).

## 언제 사용
- 새 게임에 **전체 서사·톤·목표·주인공**을 처음 설계할 때(web-game-builder가 "스토리 입힐까요?"로 위임)
- **분위기/무드를 정해 몰입**을 만들고 싶을 때("쓸쓸한 느낌으로", "긴박하게", "따뜻한 이야기")
- **주요 캐릭터를 입체적으로** 설계하거나(주인공·악당·NPC) **반전·복선**을 넣고 싶을 때
- **대사·멘트·내레이션·대본**이 필요할 때 — 인트로/엔딩 문구, NPC 한마디, bark. (대사 슬롯이 비거나
  placeholder면 이 스킬이 **자동 개입**한다 — 아래 "대사 자동 개입" 참고.)
- 제작 **중반에 스토리를 수정**하거나 **캐릭터를 추가/삭제**할 때(STORY.md를 단일 진실로 갱신)
- 서사가 "밋밋하다/겉돈다/캐릭터가 흔들린다"를 진단하고 **서사 리뷰·일관성 점검**을 할 때

## 핵심 원칙
1. **분석 먼저.** 새 서사를 진공에서 발명하지 않는다 — 현재 game.js 의 **코어 동사(핵심 메카닉)·기존 텍스트
   표면(Title/막간/승패 카드)·장르·톤**을 찾아 *그 위에* 이야기를 입힌다. 메카닉이 곧 메시지가 되게 한다(`GN-LUDOHARMONY`).
2. **톤을 가장 먼저 못 박는다.** 끝낸 플레이어가 느꼈으면 하는 한 감정(따뜻함/긴박/쓸쓸함/유쾌)을 단어 1~2개로
   먼저 확정한다(`ST-TONE-LOCK`·`WT-MOOD-THROUGHLINE`). 이 무드가 프레임워크·어휘·색·BGM을 전부 프레이밍한다 — 위가 흔들리면 아래를 물어도 소용없다.
3. **의도가 모호하면 끈질기게 묻고, Claude가 먼저 참신한 컨셉을 제안한다.** 탑다운 1문1답 인터뷰
   ([reference/story-interview.md](./reference/story-interview.md))로 약점 차원을 캔다. 빈 객관식을 던지지 않고
   매 라운드 *창의적 주제 아이디어를 먼저* 내고 본인 의견을 밝힌다(백지 금지). 사용자는 고르거나 비틀거나 자유 입력.
4. **하나만 강하게(과적재 금지).** 메인 서사 프레임워크는 **하나만**(`ST-PICK-ONE`·`ST-NO-OVERFIT`), 전복 포인트도
   **하나만**(`AR-ONE-TWIST`), 캐릭터는 **1~4명**. 짧은 게임에 3막+Hero's Journey+15비트를 다 채우면 "구조에 봉사당하는" 안티패턴이 된다.
5. **말하지 말고 보여준다 + 텍스트 예산.** 컷신·설교 대신 환경 단서·서브텍스트로 보여주고(`ST-ENV-CLUE`·`WT-ACTION-ARGUES`),
   4채널 텍스트 예산(인트로 ≤2문장·막간 ≤1문장·엔딩 ≤2문장)을 엄격히 지킨다(`ST-TEXT-BUDGET`).
6. **단일 진실 + 작성/검수 분리.** 모든 텍스트·대사는 `games/<slug>/STORY.md` 스토리 바이블을 **유일한 출처**로
   생성한다(`TL-CANON-SINGLE-SOURCE`). 작성(3·4단계)과 **연속성 린트 검수(5단계)는 반드시 다른 패스**로 분리한다(`TL-AUTHOR-VS-REVIEW`) — 같은 호흡에 자기검수하면 모순을 놓친다.
7. **전형 vs 참신을 반드시 묻는다.** 익숙한 전형으로 빠르게 갈지, 한 군데만 참신하게 비틀지를 **사용자에게 명시적으로** 확정받는다(인터뷰 N3, `AR-EXPECT-FIRST`).

## 워크플로

### 0) 현재 게임 분석 (필수 · 서사 작성 전)
대상 게임의 `game.js`(또는 게임 디렉터리)와 있으면 기존 `STORY.md` 를 Read 해서 다음을 파악한다:
- **코어 동사(핵심 메카닉)** — 플레이어가 매 순간 *실제로 하는 행동*(점프·밀기·매치·쏘기·달리기). 서사의 주제는 이 동사와 같은 말을 해야 한다(`GN-LUDOHARMONY`).
- **기존 텍스트 표면** — Title 씬의 제목/안내, 레벨 사이 전환, 승리/패배/엔딩 카드, 말풍선·overlay. *어디에 이야기를 실을 자리가 있는지*(4채널)와 placeholder/빈 슬롯.
- **장르·톤·아트** — 픽셀(PixelForge) vs 미려한 스무스(VectorForge), 색감·BGM 무드. 이미 깔린 분위기.
- **기존 인물·화자** — 주인공 스프라이트, 적, 안내 화자가 있는지(없으면 화자 없이 환경·프레이밍으로 갈 수도).
- **진행 구조·분량** — 1레벨 vs 레벨팩(world-map-architect 산출), 한 판 길이. 서사를 몇 개 비트로 쪼갤지 결정.

분석 결과를 **한 화면 요약**(코어 동사 · 텍스트 표면 4채널 현황 · 톤·아트 · 화자 유무 · 분량)으로 읽어준 뒤 1)로 간다.

### 1) 의도 분석 + 서사 인터뷰 (모호하면 계속 질문)
요청이 한 줄·모호하거나 핵심 차원이 비어 있으면 **온디맨드로 [reference/story-interview.md](./reference/story-interview.md)를
Read** 해 탑다운 1문1답 인터뷰를 수행한다. `oh-my-claudecode` deep-interview / web-game-builder game-interview 방법론을 서사 설계에 적응시킨 것:
- **탑다운 순서**(N1 톤·분위기 → N2 premise/Story Spine 한 문단 → N3 **전형↔참신 ★반드시 질문** → N4 서사 프레임워크 1개 자동추천 → N5 입체 캐릭터 → N6 반전·복선 → N7 대사·보이스 → N8 채널 배분), 약점 차원 하나씩 + "왜 지금".
- **매 라운드 Claude가 먼저 참신한 주제 아이디어를 제안**(백지 금지)하고 본인 의견을 밝힌다. 추상적 답("그냥 감동적으로")은 구체 사례로 되묻는다.
- **준비도 게이트**(N1 톤 + N2 premise + N4 프레임워크 + 코어 동사 정합) 충족 전엔 설계를 확정하지 않는다.
- 사용자가 "알아서/그냥 만들어"라고 하면 분석 기반 추천 기본값으로 채워 진행한다(보통 3~6라운드면 수렴).

### 2) 서사 이론 적용 (설계 전 필수 Read)
[reference/story-design/INDEX.md](./reference/story-design/INDEX.md) 라우팅으로 **[principles.md](./reference/story-design/principles.md)**
(엔진 제약·4채널 압축·공통 캐논·안티패턴) + 톤·장르에 맞는 도메인 파일 1~2개를 Read 하고, 설계 결정마다 원칙 code 근거를 한 줄로 단다:
- **구조** → [structure-frameworks.md](./reference/story-design/structure-frameworks.md). 갈등 없으면 Kishōtenketsu(`ST-KISHO-NOCONFLICT`) 기본, 긴박이면 Fichtean(`ST-ESCALATE`), 루프면 Story Circle(`ST-WANT-NEED`). **하나만** 메인(`ST-PICK-ONE`).
- **캐릭터·전형↔참신** → [characters-arcs.md](./reference/story-design/characters-arcs.md). 인물 7슬롯(Want/Lie/Ghost/Need/Passion3/디테일/아크), 적대자=주인공 Lie의 극단(`AR-SHADOW-MIRROR`), 전복 1개(`AR-ONE-TWIST`).
- **반전·복선** → [twist-foreshadow.md](./reference/story-design/twist-foreshadow.md). 엔딩부터 역산해 단서를 심고(`TW-PLANT-PAY`) 공정하게(`TW-FAIR-PLAY`).
- **대사·보이스** → [dialogue-voice.md](./reference/story-design/dialogue-voice.md). voice bible로 일관성 강제(`DL-VOICEBIBLE`), 모든 대사는 두 가지 일(`DL-DUAL`).
- **세계관·톤·분위기** → [world-tone.md](./reference/story-design/world-tone.md). tone 단어를 색·음악으로 번역(`WT-COLOR-EMOTION`·`WT-AUDIO-PLACE`).
- **게임 고유 전달** → [narrative-in-games.md](./reference/story-design/narrative-in-games.md). 환경 서사·승패 프레이밍·bark.
- **일관성 도구** → [consistency-tools.md](./reference/story-design/consistency-tools.md). STORY.md 스펙 + 린트 체크리스트.
- **라이브 웹 리서치(WebSearch/WebFetch) — 장르·레퍼런스 작품·트렌드가 설계에 관건일 때:** 내장 원칙(ST~TL-*)은 광범위한 웹 리서치를 작은 웹게임용으로 정리한 1차 라이브러리이니 **항상 먼저 적용**한다. 그 위에, 사용자가 특정 작품·장르의 *느낌*을 원하거나 최신 서사 관습이 필요하면 그 장르의 서사 관습·유사작 구조·트렌드를 **능동 리서치해 STORY.md에 보강**한다. **IP 안전 가드**: 원형·구조·기법만 차용하고 고유 캐릭터·이름·스토리는 절대 복제하지 않는다(오리지널 재구성, [`ip-license-guard`](../wgf-ip-license-guard/SKILL.md)).

### 3) STORY.md 스토리 바이블 산출 (games/<slug>/STORY.md 영속 · 단일 진실)
이론을 적용해 **구체적 스토리 바이블**을 game.js 옆 `games/<slug>/STORY.md` 로 만든다(스펙: [consistency-tools.md](./reference/story-design/consistency-tools.md)).
초경량 카드로 — premise 1문장 + tone 단어 + 프레임워크 1개 + 캐릭터 표(Want/Lie/Ghost/Need/Passion3/노출디테일/voice do·don't)
+ 비대칭 관계 매트릭스 + Beats 표(채널 열 포함·비트=플레이어 행동 `ST-BEATS-AS-PLAY`) + 반전 setup→payoff 역산 라인
+ Glossary 표준 표기 + 엔딩 변형. **미니게임 규모 가드레일**(인트로 ≤2문장·막간 ≤1문장·엔딩 ≤2문장·인물 1~4명·lore dump 금지)을 지킨다.
그 위에서 모든 **텍스트 표면 카피**(인트로 카드·막간·승패/엔딩 문구·환경 단서·bark 풀)를 작성한다.

### 4) 게임 적용 / 위임
STORY.md의 텍스트 표면을 game.js의 Scene 전환 카드·overlay·tween 트리거에 **1:1 매핑**해 적용하거나 web-game-builder로 위임한다:
- **텍스트 표면 코드:** Title/막간/승패/엔딩 카드는 `this.add.text()` + tween(페이드/스케일), 환경 단서는 스프라이트 배치, bark는 floating text 풀. 카드 UI가 무거우면 [`game-ui-hud`](../wgf-game-ui-hud/SKILL.md)로.
- **분위기 구현:** 색=감정 팔레트는 [`vector-graphics`](../wgf-vector-graphics/SKILL.md)(VectorForge)/PixelForge, 무드 BGM은 [`chip-sound`](../wgf-chip-sound/SKILL.md), 연출은 [`juice-fx`](../wgf-juice-fx/SKILL.md), 환경 단서 스프라이트는 [`sprite-picker`](../wgf-sprite-picker/SKILL.md)/[`sprite-forge`](../wgf-sprite-forge/SKILL.md).
- **비트 ↔ 레벨 정합:** Beats 표의 '비트=플레이어 행동'을 [`level-architect`](../wgf-level-architect/SKILL.md)의 난이도 곡선·[`world-map-architect`](../wgf-world-map-architect/SKILL.md)의 진행과 교차 참조(예: Ten/midpoint 반전 = 곡선의 정점 직전 레벨).
- **중반 수정·캐릭터 추가/삭제:** STORY.md를 단일 진실로 갱신한 뒤 영향받은 표면만 재생성(STORY.md → game.js 한 방향).
  - **추가:** '대사 자동 개입 ②'의 미니 인터뷰로 의도를 캐고 [characters-arcs.md](./reference/story-design/characters-arcs.md)의 7슬롯 게이트로 `## 3. Characters` 표에 등록한 뒤 관련 표면을 생성.
  - **삭제:** `## 3`에서 제거한 다음, 그 인물이 흩어져 있는 **`## 4` Relationships 행/열·`## 6` Twist setup 단서·`## 7` bark 풀·`## 8` Glossary**에서 참조를 함께 제거하고, 그 인물이 맡던 서사 기능(foil·반전 단서 등)을 다른 인물로 재배치하거나 비트를 재설계한다. 잔존(고아) 참조는 5단계 연속성 린트 **(i)항**으로 기계 점검한다.

### 5) 검수 패스 + 연속성 린트 (작성과 분리 · 필수)
**별도 패스로** STORY.md를 단일 진실 삼아 게임 텍스트를 기계적으로 대조한다(체크리스트: [consistency-tools.md](./reference/story-design/consistency-tools.md)):
(a) 톤 일관성(인트로~엔딩 어휘·정서 일치), (b) Opening↔Final 거울쌍(`ST-MIRROR-FRAME`), (c) Want↔Need 분리·엔딩 self-revelation이 인트로 Lie와 호응,
(d) Fair-Play 감사(반전 근거가 1회차에 다 노출됐나·cheat 탐지 `TW-FAIR-PLAY`), (e) Payoff 감사(심은 단서·red herring 전부 회수 `TW-PLANT-PAY`),
(f) 코어 동사 = 주제(`GN-LUDOHARMONY`), (g) 채널별 텍스트 예산 초과, (h) Glossary 표기·타임라인 정합, (i) 고아 참조(삭제된 인물이 `## 4`/`## 6`/`## 7`/`## 8`·4채널 텍스트에 잔존).
위반은 **사람이 보게 리포트**하고 재생성한다. 가능하면 로컬 서버(`python -m http.server 8766`)로 띄워 표면 노출(인트로→막간→엔딩 흐름)을 확인하고 [`game-qa`](../wgf-game-qa/SKILL.md) 헤드리스 step 으로 점검 후 **근거와 함께 보고**한다.

## 대사 자동 개입 (캐릭터 보이스 일관성)
게임 제작/수정 중 **대사가 필요한 자리가 생기면 이 스킬이 능동 개입**해 작성한다 — 단, 즉흥이 아니라 STORY.md를 참조해 일관되게.
- **개입 신호:** (a) game.js에 NPC/적/안내 화자가 추가되거나 말풍선·overlay 대사 슬롯이 비어 있을 때, (b) 인트로/막간/승패/엔딩 카드 카피가 placeholder/누락일 때, (c) 사용자가 "여기 대사/멘트/한마디 넣어줘" 류를 말할 때.
- **개입 절차:** ① 화자가 STORY.md `## 3. Characters` 표에 있으면 그 voice bible(5축 + catchphrase + 금지어)을 컨텍스트로 자동 작성. ② 없으면 **1~2문항 미니 인터뷰**로 그 화자의 의도(Want/Lie/Passion 3개)만 캐고 표에 등록한 뒤 작성(의도가 꼭 필요할 때만 질문, 아니면 톤·기존 인물에서 추론). ③ 생성된 모든 대사는 **게이트**(두 기능 `DL-DUAL` + on-the-nose 금지어 + voice 금지단어 + 모바일 폭·길이)를 통과해야 출력 — 위반 시 재생성. ④ 반복 텍스트(bark)는 이벤트당 변형 3~6개로(`DL-BARKVARY`). 자세한 규칙: [dialogue-voice.md](./reference/story-design/dialogue-voice.md).

## 전형↔참신 · make-game 적용 게이트 (반드시 묻는 항목)
- **전형 vs 참신(N3):** 캐스트·세팅·반전을 '전형대로 빠르게' 갈지 '한 군데만 비틀지'를 **반드시 명시적으로 묻는다**. 전부 비틀면 기대가 없어 전복이 안 읽히고(`AR-EXPECT-FIRST`), 전부 전형이면 기억에 안 남는다 — 미니게임은 전복 **하나**에 단서를 집중(`AR-ONE-TWIST`).
- **make-game 적용:** web-game-builder/make-game 흐름에서 게임 청사진 인터뷰 직후 **"이 게임에 story-architect로 스토리/톤/캐릭터를 설계해 적용할까요?"를 반드시 묻는다**. '네'면 이 워크플로로, '아니요'면 `FE-NARRATIVE` 분위기 기본값만, '나중에'면 게임부터 만들고 중반에 이 스킬로 추가(초·중반 어디서든 가능).

## 연계 / 라우팅
- **상위:** [`web-game-builder`](../wgf-web-game-builder/SKILL.md) 오케스트레이션의 서사 설계 레인. 명시 호출은 [`commands/wgf-make-game.md`](../../commands/wgf-make-game.md), 게임 인터뷰는 [game-interview.md](../wgf-web-game-builder/reference/game-interview.md)(`FE-NARRATIVE` 선택 시 연계).
- **자매:** [`level-architect`](../wgf-level-architect/SKILL.md)(레벨 난이도·`LD-*`) · [`world-map-architect`](../wgf-world-map-architect/SKILL.md)(진행 맵·`MAP-*`) — Beats ↔ 곡선/진행을 교차 참조.
- **구현·분위기:** [`game-ui-hud`](../wgf-game-ui-hud/SKILL.md)(카드·메뉴) · [`vector-graphics`](../wgf-vector-graphics/SKILL.md)/[`sprite-forge`](../wgf-sprite-forge/SKILL.md)/[`sprite-picker`](../wgf-sprite-picker/SKILL.md)(색=감정·환경 단서) · [`chip-sound`](../wgf-chip-sound/SKILL.md)(무드 BGM) · [`juice-fx`](../wgf-juice-fx/SKILL.md)(연출) · [`game-qa`](../wgf-game-qa/SKILL.md)(검증).
- **레퍼런스:** 색인 [reference/story-design/INDEX.md](./reference/story-design/INDEX.md) · 공통 원칙 [principles.md](./reference/story-design/principles.md) · 인터뷰 [story-interview.md](./reference/story-interview.md) · 재미요소 [fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md)(`FE-NARRATIVE`) · Phaser4 [INDEX](../wgf-web-game-builder/reference/phaser/INDEX.md).

## IP 안전
- 서사 **원형·구조·기법**(영웅의 여정·Kishōtenketsu·setup&payoff·반전·아크 등)은 저작권 대상이 아니므로 자유롭게 차용한다.
- 단, **특정 상용 게임/작품의 고유 캐릭터·이름·세계관·스토리**(예: 젤다의 특정 인물·대사, 마리오 세계관)를 그대로 복제하지 않는다 — 원형·기법만 가져와 **오리지널로 재구성**한다.
- 이름·고유명사는 STORY.md `## 8. Glossary` 에 오리지널로 정의하고, 실존 상표·작품명과 충돌하지 않게 한다. 상세는 [`ip-license-guard`](../wgf-ip-license-guard/SKILL.md).
