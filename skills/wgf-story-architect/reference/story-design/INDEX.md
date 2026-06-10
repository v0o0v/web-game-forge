# 서사 설계 레퍼런스 라이브러리 — 색인 (INDEX)

> [`story-architect`](../../SKILL.md)가 게임에 **톤·이야기·캐릭터·대사·반전**을 입힐 때 쓰는 코드화 설계 자료다.
> 검증된 서사 작법(소설·시나리오·게임 내러티브 디자인)을 **작은 2D 웹게임**(인트로 카드·막간·승패·환경 단서·bark 4채널+)에
> 맞게 적응시켜 106개 코드화 원칙으로 정리했다. 핵심 목적: 인터뷰에서 *참신한 이야기를 제안*하고, 그 이야기를
> *모순 없이* STORY.md 바이블로 산출하는 것.

## 이 라이브러리를 쓰는 법 (중요)

- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter 없는 순수 레퍼런스라 스킬 listing 예산(컨텍스트 ~1%)을 먹지 않는다 — `reference/phaser/`·`game-dna/`와 같은 **온디맨드 Read** 방식. 필요할 때만 해당 파일을 읽는다.
- **서사 설계 단계**(`wgf-story-architect/SKILL.md`의 2단계 "서사 이론 적용", 인터뷰 [story-interview.md](../story-interview.md))에서 의사결정 도구로 쓴다.
- **먼저 [principles.md](./principles.md)를 Read**(엔진 제약·4채널 압축·공통 캐논·안티패턴) → 그다음 톤·장르에 맞는 도메인 파일 1~2개를 Read. 설계 결정마다 원칙 code(예: `ST-PICK-ONE`)를 한 줄 근거로 단다.

## 도메인 파일 라우팅

| 파일 | prefix | 무엇 (언제 Read) |
|---|---|---|
| **[principles.md](./principles.md)** | (공통) | ★항상 먼저. 엔진 제약·4채널 압축 공식·공통 캐논 11개·'섞지 말 것' 안티패턴·톤→프레임워크 빠른 처방. |
| [structure-frameworks.md](./structure-frameworks.md) | `ST-*` (13) | 서사 구조 프레임워크(3막·Kishōtenketsu·Story Circle·Save the Cat·Fichtean·Story Spine 등) + 미니게임 4채널 매핑 공식 + **프레임워크 셀렉터**(장르·길이·갈등 3질문→1추천). 구조를 정할 때. |
| [narrative-in-games.md](./narrative-in-games.md) | `GN-*` (13) | 게임 고유 전달(ludonarrative harmony·환경/내장 서사·agency·foldback·barks·diegetic UI·승패 프레이밍). "대사·컷신 없이 값싸게 몰입" 만들 때. |
| [characters-arcs.md](./characters-arcs.md) | `CH-*`·`AR-*` (27) | 입체 캐릭터(Want/Lie/Ghost/Need·3차원·foil·worthy foe) + 원형(Jung12/Vogler8/Propp7) + **전형↔참신 비틀기 대조표** + 인물 7슬롯 게이트. 캐릭터·전형/참신을 정할 때. |
| [twist-foreshadow.md](./twist-foreshadow.md) | `TW-*` (13) | 반전·복선(setup&payoff·fair-play·peripeteia+anagnorisis·배신·red herring) + **반전 역산 설계법** + Fair-Play/Payoff 감사 + '마지막 클릭=반전' 패턴. 반전을 넣을 때. |
| [dialogue-voice.md](./dialogue-voice.md) | `DL-*` (14) | 대사·보이스(이중기능·서브텍스트·voice bible 5축·bark 변형·reconverge·한국어 조사 비문) + **대사 자동 생성 게이트**. 대사를 쓰거나 자동 개입할 때. |
| [world-tone.md](./world-tone.md) | `WT-*` (13) | 세계관·톤·테마·**무드 throughline(몰입의 핵심)** + premise 작성 + iceberg + **tone 단어→VectorForge/ChipAudio 번역 게이트**(색=감정). 분위기를 정할 때. |
| [consistency-tools.md](./consistency-tools.md) | `TL-*` (13) | 일관성 도구(린 바이블·단일 canon·작성/검수 분리) + **STORY.md 섹션 스펙** + **연속성 린트 체크리스트(a~i)** + **도구 채택 결정 매트릭스**. STORY.md를 산출·검수할 때. |

## 빠른 처방 (톤 → 메인 프레임워크) — 자세히는 [principles.md](./principles.md) §4

| 톤·게임 결 | 메인 프레임워크 | 캐릭터 무게 | 반전 |
|---|---|---|---|
| 평화·퍼즐·사색·따뜻 | **Kishōtenketsu** (`ST-KISHO-NOCONFLICT`) | 가벼움(화자 0~1) | 시점 전환 '転' (`TW-RECONTEXT`) |
| 긴박·액션·아케이드·생존 | **Fichtean** (`ST-ESCALATE`) | 주인공+적 | 정체/배신 (`TW-BETRAYAL`) |
| 루프·반복·한 판 더 | **Story Circle** (`ST-WANT-NEED`) | 주인공 1 | Want↔Need 각성 (`CH-REVEAL`) |
| 갈등 영웅담·구출 | **3막/Hero's Journey 압축** | 주인공+멘토/적 | 깨달음 (`TW-PERI-ANAG`) |

> 항상 **하나만** 메인으로(`ST-PICK-ONE`), 전복도 **하나만**(`AR-ONE-TWIST`).

## 코드 빠른 색인 (prefix별 — 정식 정의는 각 도메인 파일)

- **`ST-*` 구조(13):** SPINE-FIRST · PICK-ONE · KISHO-NOCONFLICT · WANT-NEED · MIRROR-FRAME · ENV-CLUE · IN-MEDIAS · ESCALATE · MIDPOINT-FLIP · BEATS-AS-PLAY · TEXT-BUDGET · TONE-LOCK · NO-OVERFIT
- **`GN-*` 게임 서사(13):** LUDOHARMONY · EVOKE · EMBED · WHEREAMI · CONTRAST · AGENCY-FOCUS · FOLDBACK · FRAME-WINLOSE · BARK · DIEGETIC-UI · WANTNEED · KISHO · CONSISTENCY
- **`CH-*` 캐릭터(14):** WANT-NEED · LIE · GHOST · MORALNEED · REVEAL · ARCFIT · 3DIM · CONTRA · FOIL · WORTHYFOE · AGENCY · ENTRANCE · ENVCLUE · PASSIONS
- **`AR-*` 원형·전형↔참신(13):** FAST-CAST · EXPECT-FIRST · ONE-TWIST · FUNCTION-OVER-FACE · SHADOW-MIRROR · WANT-NEED · PLAYER-IS-HERO · DECONSTRUCT-WHY · LAMPSHADE · IMPLY-MINOR · GENRE-CAST · TWIST-INEVITABLE · MECHANIC-MATCH
- **`TW-*` 반전(13):** PLANT-PAY · FAIR-PLAY · REREAD · RULE3 · HIDE-PLAIN · RED-HERRING · PERI-ANAG · DRAMATIC-IRONY · UNRELIABLE · BETRAYAL · RECONTEXT · ENV-CLUE · ONE-CLEAN
- **`DL-*` 대사(14):** DUAL · SUBTEXT · NOTNOSE · CONCISE · VOICEBIBLE · IDIOLECT · BARKDUTY · BARKVARY · SHOWENV · RECONVERGE · CHOICEVOICE · FEEDBACK · L10N · READALOUD
- **`WT-*` 세계관·톤(13):** PREMISE-ONE · MOOD-THROUGHLINE · COHERENCE · CHOICE-CONVERGE · ACTION-ARGUES · ICEBERG · ENV-CLUE · COLOR-EMOTION · AUDIO-PLACE · MOTIF-THREAD · PACING-BREATHE · TONE-VOICE · TONE-SHIFT
- **`TL-*` 일관성 도구(13):** BIBLE-LEAN · CANON-SINGLE-SOURCE · CONTINUITY-LINT · REL-MATRIX · CHAR-VOICE · CHANNEL-MAP · SHOW-NOT-TELL · KISHOTEN · TIMELINE-ORDER · PLAYER-AGENCY-CANON · DIALOGUE-SCHEMA · AUTHOR-VS-REVIEW · DECISION-FIT

## 산출물

서사 설계의 산출물은 **`games/<slug>/STORY.md` 스토리 바이블**(모든 텍스트·대사의 single source of truth)이다.
섹션 스펙·연속성 린트 체크리스트·도구 결정 매트릭스는 [consistency-tools.md](./consistency-tools.md). 이 라이브러리는 그 바이블을 *설계*하는 자료다.

## 출처 · 원칙

- 본 자료는 잘 알려진 서사 작법(영웅의 여정·Kishōtenketsu·Truby/Egri/McKee 캐릭터·Chekhov's gun 등)과 게임 내러티브 디자인(ludonarrative·환경 서사·GDC)의 **공개된 통념**을 작은 웹게임용으로 정리한 것이다(각 파일 ## 출처 참고).
- **IP 안전 원칙:** 서사 원형·구조·기법은 저작권 대상이 아니므로 자유롭게 차용한다. 단, 특정 상용 작품의 고유 캐릭터·이름·세계관·스토리는 복제하지 않고 오리지널로 재구성한다. 고유명사는 STORY.md `## 8. Glossary`에 오리지널로 정의. 상세는 [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md).
