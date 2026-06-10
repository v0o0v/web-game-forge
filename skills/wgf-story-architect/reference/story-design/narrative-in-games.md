# 게임 고유 서사 사전 (GN-*)

> story-architect가 "이 게임의 이야기를 어떻게 값싸게 전달할지" 물을 때 쓰는 핵심 자료. 게임 서사는 '읽히는' 게 아니라 플레이어의 행위로 '경험되는' 것이라는 전제 위에서, 작은 웹게임이 컷신·대사 없이 몰입을 만드는 법을 **재사용 가능한 원칙(GN-*)**으로 분해한다. 색인 [INDEX.md](./INDEX.md) · 자매 SKILL [../../SKILL.md](../../SKILL.md)

게임 서사의 핵심 긴장은 작가가 의도한 이야기와 플레이어의 자유 사이의 **narrative paradox**다. 좋은 설계는 게임플레이(ludo)와 서사(narrative)가 서로를 강화하는 **ludonarrative harmony**를 추구한다. 짧은 미니 웹게임에서는 컷신·대사 대신 환경 단서·인트로/막간/엔딩 카드·아이템 설명·barks·승패 프레이밍 같은 값싼 수단으로 서사를 '심거나(embed)' 장르 연상으로 세계를 '암시(evoke)'하는 것이 정답이다. 설계자는 이야기를 들려주는 사람이 아니라 의미가 발생할 공간을 짓는 **narrative architect**로 일한다.

## 0. 우리 엔진 제약 (모든 원칙에 선적용)

이 사전의 모든 '엔진 구현'은 다음 전제 위에서만 처방한다. AAA RPG가 아니라 **Phaser 4 기반 작은 2D 웹/모바일웹 게임**이다.

| 제약 | 의미 | 서사 함의 |
| --- | --- | --- |
| 2D · 작은 미니게임 | 컷신·보이스·대사 트리 불가 | 서사는 '값싼 표면 4곳'에만 심는다 |
| 모바일 웹뷰 | 짧은 세션·작은 화면·한 손 | 텍스트 예산 극도로 빠듯, 카드 1~2문장 상한 |
| 분기 비용 폭발 | 상태추적·콘텐츠량이 곱으로 늘어남 | 거의 항상 선형(string of pearls)/Gauntlet/foldback |
| 인물 1~4명 상한 | lore dump 금지 | 캐릭터·세계는 암시로, 빙산의 일각만 |
| 텍스트=Scene 표면 | `this.add.text()`로 1:1 매핑 | 산출물은 'Scene별 텍스트 슬롯' 스키마로 |

### 서사를 심는 '값싼 표면 4곳' (+bark)

미니 브라우저 게임은 다음 4채널에만 서사를 집중 배치한다. 모든 GN-* 원칙은 결국 이 4곳(+bark) 중 하나로 라우팅된다.

1. **인트로/타이틀 카드** (≤2문장) — 장르 연상으로 세계를 공짜로 암시(GN-EVOKE), want/need 심기(GN-WANTNEED), '여기가 어디지'에 답(GN-WHEREAMI).
2. **레벨 사이 막간** (≤1문장) — '진주실'의 진주. 진행에 의미를 입힌다(GN-FOLDBACK).
3. **승리/패배/엔딩 카드** (각 ≤2문장) — 가장 자주 보이는 서사 표면. 디제시스로 프레이밍(GN-FRAME-WINLOSE) + 마지막 '転' 한 줄(GN-KISHO).
4. **환경 단서** (스프라이트·배치·색) — 플롯을 말하지 않고 심는다(GN-EMBED), cause-and-effect 비네트.
5. **(+bark)** 이벤트당 floating text 변형 3~6개 — 세계가 살아 있다는 느낌을 가장 싸게(GN-BARK).

산출물은 `games/<slug>/STORY.md`(스토리 바이블 = 모든 텍스트·대사의 single source of truth). 모든 텍스트 표면을 하나의 톤으로 정렬(GN-CONSISTENCY)하는 것이 몰입의 생명선이고, 핵심 동사가 주제와 같은 말을 하는지(GN-LUDOHARMONY)가 첫 검문 항목이다.

분위기 구현은 다음 제작요소 스킬로 라우팅한다: 색=감정은 VectorForge/PixelForge, 무드 BGM·SFX는 ChipAudio, 연출은 juice-fx, 카드/메뉴 UI는 game-ui-hud, 환경 단서 스프라이트는 sprite-picker/sprite-forge.

## 1. 프레임워크 요약

게임 서사 설계의 토대가 되는 모델들. 작은 게임에서의 우선순위와 함께 정리한다.

| 프레임워크 | 출처 | 핵심 | 작은 게임에서 |
| --- | --- | --- | --- |
| **Jenkins의 4가지 서사 건축** (Evocative / Enacted / Embedded / Emergent) | Henry Jenkins, "Game Design as Narrative Architecture" (2004) | 게임은 '이야기'가 아니라 '서사 가능성으로 가득 찬 공간'. Evocative(장르 연상으로 암시), Enacted(행동이 곧 비트), Embedded(공간 단서를 모아 재구성), Emergent(시스템×플레이에서 발생). | 1순위는 **Evocative**(가장 값쌈) — 클리셰 하나로 세계의 90%를 무료로 채운다. Embedded는 아이템 설명·배경 오브젝트로 저렴. Enacted는 핵심 동사를 줄거리와 일치. Emergent는 미니게임엔 과함. |
| **Ludonarrative Harmony vs Dissonance** | Clint Hocking의 dissonance 개념 확장 | 게임플레이가 말하는 것과 서사가 말하는 것이 어긋나면 dissonance(몰입 붕괴), 같은 메시지면 harmony. | 미니게임일수록 **메커닉이 곧 메시지**. '핵심 동사가 주제와 같은 말을 하는가?'가 최상위 게이트. |
| **Narrative Paradox & 분기 택소노미** | Aylett/Louchart(paradox); Sam Kabo Ashwell, "Standard Patterns in Choice-Based Games" (2015) | 작가의 플롯과 플레이어 자유는 본질적 충돌. Gauntlet(중심 줄기+가지, 최저가), Branch-and-Bottleneck, Time Cave(비쌈), Sorting Hat, Loop and Grow. | 기본형은 **Gauntlet** 또는 **string of pearls**(선형 진주실). 진짜 분기는 비용 폭발 → 대부분 **foldback**으로 자유의 '느낌'만. |
| **플레이어 Agency의 차원들** | Sam Kabo Ashwell, "A Bestiary of Player Agency" (2014); Janet Murray | Agency는 단일하지 않다: Big Decisions, Protagonism, Velocity, Grasp, Motivational Alignment, Identity. '진짜 agency'만큼 '인상'도 중요. | 미니게임은 **하나만** 골라 집중 — 보통 **Protagonism**(세계의 중심이 나)과 **Grasp**(행동→결과의 명료함)가 비용 대비 효과 최고. |
| **Murray의 디지털 3대 쾌락** (Immersion / Agency / Transformation) | Janet H. Murray, "Hamlet on the Holodeck" (1997/2017) | 컴퓨터 매체는 procedural·participatory·encyclopedic·spatial. 3쾌락: Immersion(잠김, 깨지기 쉬움), Agency(의미 있는 행동+결과), Transformation(변화·재플레이). | 미니게임 체크리스트로 직결: (1)첫 화면이 끌어들이나(immersion)? (2)내 행동의 결과가 보이나(agency)? (3)끝났을 때 무언가 변했나(transformation)? |
| **Kishōtenketsu (起承転結)** — 갈등 없는 4막 | 동아시아 한시 유래; Nintendo식 레벨 디자인에 응용 | 起(도입)→承(전개)→転(관점을 뒤집는 예상 밖 요소)→結(재맥락화). 적·대립 없이 '발견'에서 긴장이 발생. | 전투 없는 평화 미니게임(정원·산책·정리)에 이상적. 짧은 게임에선 마지막 '転' 한 줄이 전체를 다시 의미화. |

## 2. GN-* 원칙 사전

각 원칙은 **정의 → 출처 → 우리 엔진 구현(작은 웹게임) → 흔한 실패 → 연관** 순으로 정리한다. 태그 표기(GN-LUDOHARMONY 등)는 모든 파일이 그대로 쓴다.

### GN-LUDOHARMONY 메커닉이 곧 메시지 (ludonarrative harmony)
- **정의:** 핵심 게임플레이 동사가 전달하는 의미와 서사가 전달하는 의미가 같은 방향을 가리켜야 한다. 어긋나면 ludonarrative dissonance로 몰입과 행위주체감이 무너진다. 미니게임일수록 메커닉의 표면적이 곧 서사의 표면적이라 어긋남이 즉시 드러난다.
- **출처:** Clint Hocking이 명명한 ludonarrative dissonance 개념의 확장(harmony 포함).
- **우리 엔진 구현(작은 웹게임):** 서사를 한 줄도 쓰기 전에 **핵심 동사**부터 STORY.md 맨 위에 적는다(점프/모으기/피하기/배달/되돌리기). 그 동사가 주제와 같은 말을 하는지 검문한다 — '연결의 이야기'면 잇는 행위, '상실의 이야기'면 잃는 메커닉. 이 검문은 web-game-builder의 game-interview 0단계 '핵심 동사' 확정 직후, 어떤 인트로/막간 텍스트를 쓰기 전에 게이트로 건다. 승리 보상(GN-FRAME-WINLOSE 카드 문구·점수 단위)이 캐릭터 동기와 같은 방향인지 확인한다. ChipAudio 무드와 juice-fx 연출도 동사의 의미를 거스르지 않게(예: '평화' 동사에 폭발 SFX·강한 셰이크 금지).
- **흔한 실패:** 예쁜 스토리를 먼저 쓰고 아무 메커닉이나 붙이기. '평화로운 정원사' 테마에 적을 밟아 죽이는 메커닉처럼 동사와 주제가 싸우는 경우 — 톤·색·음악을 아무리 맞춰도 손이 하는 행동이 배신한다.
- **연관:** GN-WANTNEED, GN-FRAME-WINLOSE, ST-TONE-LOCK, WT-ACTION-ARGUES

### GN-EVOKE 장르적 연상으로 세계를 공짜로 암시 (evocative space)
- **정의:** 플레이어가 이미 가진 문화·장르 지식을 빌리면, 적은 에셋으로도 거대한 세계를 머릿속에 짓게 만들 수 있다. 작은 게임의 1순위 서사 도구이자 가장 값싼 수단이다.
- **출처:** Henry Jenkins, "Game Design as Narrative Architecture" (2004)의 evocative space.
- **우리 엔진 구현(작은 웹게임):** 커스텀 로어를 쓰지 말고 **정확한 클리셰 1개**를 찍는다. 인트로 카드 한 줄로 장르를 신호한다('마지막 등대지기의 기록'). 시각 신호는 VectorForge/PixelForge의 색 팔레트로(깨진 네온+비=사이버펑크, 바랜 세피아+먼지=버려진 사무실), 환경 스프라이트는 sprite-picker/sprite-forge로(마른 화분, 먼지 쌓인 책상). ChipAudio 무드 한 줄(불길/쓸쓸/명랑)이 장르를 청각으로 못박는다. 플레이어가 빈칸을 무료로 채우게 두는 게 핵심 — STORY.md에 '빌려온 장르' 1줄을 명시 필드로 둔다.
- **흔한 실패:** 세계관을 처음부터 끝까지 설명하려 들기. 미니게임에서 장황한 오리지널 설정은 비용만 크고 읽히지 않는다. 또는 클리셰를 어중간하게 섞어(사이버펑크인지 스팀펑크인지 모호) 연상이 발동 안 하는 것.
- **연관:** GN-WHEREAMI, GN-EMBED, WT-COLOR-EMOTION, WT-ICEBERG

### GN-EMBED 이야기를 공간·오브젝트에 심기 (embedded narrative)
- **정의:** 플롯을 직접 말하지 말고, 환경과 오브젝트에 단서로 흩어두어 플레이어가 모아 재구성하게 한다. 스스로 도달한 결론이 더 깊게 남는다.
- **출처:** Henry Jenkins(2004) embedded narrative; Don Carson의 cause-and-effect 비네트.
- **우리 엔진 구현(작은 웹게임):** 2D 미니게임에서도 값싸다 — 아이템 설명 한 줄('두 사람 분량의 식기, 하나는 안 쓴 지 오래'), 배경 스프라이트(뒤집힌 의자, 시든 꽃: sprite-picker/sprite-forge로 배치), 점수판 옆 작은 메모(game-ui-hud overlay). cause-and-effect 비네트로 과거 사건을 암시(부서진 문=침입, 그을린 자국=화재). STORY.md에 환경 단서를 'cause-and-effect 비네트' 형식(원인 사건 → 보이는 흔적)으로 입력받아 구조화하고, 각 단서를 어떤 Scene의 어떤 좌표 스프라이트로 박을지 1:1 매핑한다.
- **흔한 실패:** 단서를 너무 친절하게 다 설명해버려 추리의 즐거움을 뺏기. 또는 단서가 너무 모호해 아무도 못 읽기 — 핵심 1~2개는 명료하게, 나머지는 분위기로.
- **연관:** GN-EVOKE, GN-CONTRAST, WT-ENV-CLUE, ST-ENV-CLUE

### GN-WHEREAMI 15초 안에 '여기가 어디지'에 답하라
- **정의:** 플레이어는 몰입하기 전에 먼저 자신이 어디에/누구로/왜 있는지를 환경 단서만으로 즉시 알아야 한다. 위치를 모르면 어떤 서사도 들러붙지 않는다.
- **출처:** Don Carson, "Environmental Storytelling" (Game Developer/Gamasutra) — 테마파크 산업 교훈.
- **우리 엔진 구현(작은 웹게임):** 타이틀/인트로 카드(≤2문장)와 첫 화면이 위치·역할·목표를 단번에 전한다. '낯선 세계'라도 익숙한 기준점 하나(우주선 콘솔, 등대, 부엌)를 첫 화면에 넣어 정서적으로 착지시킨다 — sprite-picker로 그 앵커 오브젝트를 명확히. 첫 화면의 색 팔레트(VectorForge/PixelForge)와 ChipAudio 첫 음이 톤(밝음/불길함/쓸쓸함)을 즉시 선언한다. 첫 Scene을 'TitleScene → 한 박자 → GameScene'으로 두고, 카드 텍스트가 다 사라지기 전에 첫 화면이 충분히 읽히도록 tween 타이밍을 잡는다.
- **흔한 실패:** 분위기에 취해 첫 화면에서 플레이어를 방치하기. 인트로 카드가 시적이지만 '어디/누구/왜'를 안 알려줘 플레이어가 길을 잃는 것. 기준점 없는 추상 공간으로 시작해 정서적 착지가 안 되는 것.
- **연관:** GN-EVOKE, GN-CONSISTENCY, ST-IN-MEDIAS, ST-MIRROR-FRAME

### GN-CONTRAST 대비와 절제로 시선과 의미를 연출
- **정의:** 변화·대비(좁다가 넓음, 어둡다가 밝음, 혼돈 뒤 질서)가 드라마를 만들고, 절제(less is more)가 중요한 것을 돋보이게 한다. 평탄한 균일함은 드라마를 죽인다.
- **출처:** Don Carson, "Environmental Storytelling" — 조명·프롭 배치·대비·절제.
- **우리 엔진 구현(작은 웹게임):** 빈 방에 조명 받은 단일 오브젝트 하나가 잡동사니 가득한 방보다 강하다. 중요한 서사 오브젝트만 밝게(VectorForge 글로우/조명 그라데이션), 나머진 그림자/저채도로 — 시선을 강제한다. 막간 직전 한 박자 비우기(juice-fx로 화면 정리·페이드), 엔딩 직전 색/음악을 비틀기(VectorForge 팔레트 시프트 + ChipAudio 키 전환)로 '結'의 무게를 만든다. game-ui-hud는 평소 절제하고 결정적 순간에만 강조.
- **흔한 실패:** 모든 화면을 장식과 디테일·파티클로 꽉 채워 정작 중요한 단서가 묻히는 것. 배경 채도가 목표 오브젝트보다 높아 '대비 역전'이 일어나는 것. 절제 없이 항상 최대 강도라 봉우리가 평탄해지는 것.
- **연관:** GN-EMBED, GN-DIEGETIC-UI, WT-COLOR-EMOTION, WT-PACING-BREATHE

### GN-AGENCY-FOCUS 한 종류의 agency만 골라 강하게 준다
- **정의:** Agency는 여러 차원(큰 선택, Protagonism, Grasp, 속도 일치 등)이 있고, 작은 게임은 전부 줄 수 없다. 하나에 집중하라. '진짜 agency'만큼 '인상'도 중요하다 — 예술은 영리하게 유지된 환상이다.
- **출처:** Sam Kabo Ashwell, "A Bestiary of Player Agency" (2014); Janet Murray의 agency 정의.
- **우리 엔진 구현(작은 웹게임):** 미니게임은 보통 **Grasp**(내 행동→즉각 결과의 명료함)와 **Protagonism**(이 세계의 중심이 나)에 집중하는 게 효율적이다. 가짜 분기 트리를 만드는 대신, 모든 행동에 즉각적이고 읽히는 피드백을 줘 '내가 세계를 움직인다'는 느낌을 만든다 — juice-fx의 히트스톱·셰이크·팝업·파티클이 'Grasp'의 1차 도구다. barks(GN-BARK)로 세계가 내 행동에 반응한다는 인상을 더한다. STORY.md에 '이 게임이 주는 agency 차원 1개'를 명시 필드로 박아 설계 전체를 그쪽으로 정렬한다.
- **흔한 실패:** 예산을 분기 엔딩 5개에 쏟아 각각이 얄팍해지는 것. 넓고 얕은 자유보다 좁고 깊은 행위주체감이 낫다. 피드백이 약해(juice 없음) 행동했는데 세계가 무반응이면 agency가 죽는다.
- **연관:** GN-FOLDBACK, GN-BARK, GN-FRAME-WINLOSE, TL-PLAYER-AGENCY-CANON

### GN-FOLDBACK 필연 사건 사이에서만 자유 (foldback / string of pearls)
- **정의:** Narrative paradox의 현실적 타협. 몇 개의 결정적·필연적 비트를 고정해두고, 그 사이 이동 방식에서만 자유를 주다가 다시 본줄기로 접는다.
- **출처:** Sam Kabo Ashwell, "Standard Patterns in Choice-Based Games" (2015); narrative paradox(Louchart & Aylett).
- **우리 엔진 구현(작은 웹게임):** 짧은 웹게임 기본형은 **선형 진주실**(막간 텍스트=진주, 플레이 구간=실: GN의 레벨 사이 막간 채널) 또는 **Gauntlet**(중심 줄기+죽음/실패 가지). 엔딩은 **1~3개로 제한**하고, 도중의 작은 선택은 분기 대신 '대사/톤/단서 변주'로 자유의 느낌만 준다 — 같은 Scene 시퀀스에 막간 텍스트·bark 풀만 갈아끼우면 상태추적 비용 없이 변주가 된다. 진주(막간) 개수 = 레벨/스테이지 묶음 개수로 두면 level-architect의 곡선과 1:1 정렬된다.
- **흔한 실패:** 진짜 branching tree를 설계해 콘텐츠량과 상태추적 비용이 폭발하는 것. 미니게임 규모에서 Time Cave/Sorting Hat은 거의 항상 과투자다. 또는 막간 진주가 게임플레이와 무관한 lore dump가 되어 실(플레이)과 진주(텍스트)가 따로 노는 것.
- **연관:** GN-AGENCY-FOCUS, GN-KISHO, DL-RECONVERGE, TL-CHANNEL-MAP

### GN-FRAME-WINLOSE 승패를 서사로 프레이밍하라
- **정의:** 게임의 승리/실패 화면은 가장 자주 보이는 서사 표면이다. 단순 'You Win/Game Over' 대신 세계관 안의 의미로 감싼다.
- **출처:** 환경 서사 일반(Carson) + 디제시스 프레이밍 관행.
- **우리 엔진 구현(작은 웹게임):** 패배 카드: '등대 불이 꺼졌다. 배는 길을 잃었다.' 승리 카드: '아침이 왔다. 정원은 다시 숨 쉰다.'(각 ≤2문장) 재시도 버튼도 디제시스로: '다시 불을 밝힌다'(game-ui-hud 버튼 라벨). 점수도 가능하면 세계 안 단위로(구한 배 수, 피운 꽃 수) — game-ui-hud HUD 라벨을 STORY.md의 세계 명사와 일치시킨다. 승/패/엔딩 Scene 전환 카드는 `this.add.text()` + VectorForge 색 시프트 + ChipAudio 승패 스팅어로 1:1 매핑. STORY.md에 승리/패배/엔딩 문구를 시스템 기본값이 아닌 디제시스 템플릿으로 의무 채운다.
- **흔한 실패:** 기계적 'Game Over'로 어렵게 쌓은 톤을 한 번에 깨기. 승패 화면을 서사 밖 시스템 메시지로 방치하는 것. 점수를 'SCORE: 1200'처럼 차가운 숫자로만 둬 세계와 단절시키는 것.
- **연관:** GN-LUDOHARMONY, GN-KISHO, GN-WANTNEED, ST-MIRROR-FRAME

### GN-BARK barks·floating text로 살아있는 세계를 값싸게
- **정의:** 특정 트리거에 뜨는 짧은 한 줄(barks)은 세계가 스스로 살아 움직인다는 느낌을 가장 싸게 만든다. 명료·간결·맥락특정이 생명이다.
- **출처:** Sarah Beaulieu, "How a character says hello: writing barks for video games".
- **우리 엔진 구현(작은 웹게임):** 충돌/획득/위험 순간에 1~5단어를 floating text로 띄운다(`this.add.text()` + 위로 떠오르며 페이드하는 juice-fx tween). 적이 '거기 멈춰!', 아이템 획득 시 '드디어…'. 캐릭터화: 같은 인사라도 수줍은 NPC는 'Hmm?', 반가운 NPC는 '왔구나!'. **이벤트당 변형 3~6개**를 풀로 두고 무작위/순차 추출해 반복 피로를 막는다 — STORY.md에 트리거별 bark 풀과 발동 빈도를 함께 정의한다. 세계 고유 명사·파벌어를 넣어 로어를 은근히 쌓는다(GN-EVOKE 보강).
- **흔한 실패:** 반복 피로(Skyrim의 'Never should have come here' 증후군). 트리거가 너무 자주 같은 줄을 띄우면 몰입이 깨진다 — 변주 풀을 두거나 빈도를 낮춘다. 톤 어긋난 타이밍(비극 직전에 명랑한 인사)도 금물.
- **연관:** GN-AGENCY-FOCUS, GN-CONSISTENCY, DL-BARKVARY, DL-BARKDUTY

### GN-DIEGETIC-UI 가능하면 정보를 디제시스 안에 넣기
- **정의:** 정보(체력·힌트·점수)를 세계 안 사물로 표현하면(diegetic) 몰입이 유지되고, 화면 밖 오버레이(non-diegetic)는 톤을 깰 위험이 있다. 단, 가독성과의 트레이드오프가 있어 대부분 성공작은 4종을 혼용한다.
- **출처:** Erik Fagerholt & Magnus Lorentzon의 4분류(diegetic/non-diegetic/spatial/meta).
- **우리 엔진 구현(작은 웹게임):** 작은 2D 게임도 선택적으로 디제시스화한다 — 체력=캐릭터 표정/색 변화(PixelForge 팔레트 스왑, sprite-forge 표정 프레임), 힌트=세계 안 표지판/NPC 대사(bark), 위험=화면 가장자리 핏빛 펄스(meta: juice-fx 비네팅). 단, 점수·잔여 이동수처럼 명료성이 중요한 정보는 game-ui-hud의 non-diegetic 라벨로 둬도 된다. STORY.md에 'HUD 항목별 표현 방식(diegetic/non-diegetic)'을 정해 톤과 가독성을 균형 잡는다.
- **흔한 실패:** 몰입을 위해 모든 UI를 억지로 디제시스화해 가독성을 해치기. 반대로 분위기 게임인데 모든 정보를 차가운 오버레이로 띄워 톤을 깨기. 작은 화면에서 디제시스 단서가 너무 미묘해 안 읽히는 것.
- **연관:** GN-CONTRAST, GN-CONSISTENCY, WT-COLOR-EMOTION, TL-CHANNEL-MAP

### GN-WANTNEED want(외적 목표)와 need(내적 변화)를 분리해 짧게
- **정의:** 캐릭터의 want는 플롯을 미는 외적 목표, need는 테마와 캐릭터 아크를 만드는 내적 결핍. 둘의 긴장이 의미를 만든다.
- **출처:** John Truby의 want/need 구분(서사 일반).
- **우리 엔진 구현(작은 웹게임):** 미니게임이라도 STORY.md에 한 줄씩 둘 다 심는다. want='집에 돌아가기'(게임 목표=레벨 클리어, 곧 핵심 동사의 목적지), need='혼자가 아님을 받아들이기'(엔딩에서 드러남). 게임플레이는 want를 추구하고(GN-LUDOHARMONY로 동사와 정렬), 엔딩 카드/마지막 막간이 need를 건드려 짧아도 울림을 준다 — need는 보통 GN-KISHO의 '転' 슬롯에 얹는다. 인트로 카드는 want를, 엔딩 카드는 need를 담당하게 채널을 분리한다.
- **흔한 실패:** 외적 목표만 있고 내적 변화가 없어 '그래서 뭐?'로 끝나기. 반대로 짧은 게임에 복잡한 내면 아크를 욱여넣어 전달 안 되는 것. want와 need가 같은 말이라 긴장이 안 생기는 것.
- **연관:** GN-LUDOHARMONY, GN-KISHO, GN-FRAME-WINLOSE, CH-WANT-NEED

### GN-KISHO 갈등 없이도 '転'으로 의미를 뒤집어라
- **정의:** Kishōtenketsu(起承転結): 악당·대립 없이 起(도입)→承(전개)→転(예상 밖 전환)→結(재맥락화)로 발견에서 긴장을 만든다. 転은 앞선 모든 것을 다시 보게 만드는 반전·병치다.
- **출처:** 동아시아 4막 구조(한시 유래); Nintendo식 레벨 디자인 응용.
- **우리 엔진 구현(작은 웹게임):** 전투·악당 없는 평화 미니게임(정원/산책/정리/수수께끼)에 이상적이다. 레벨 흐름에도 적용 — 안전 소개(起)→변주(承)→비트는 한 방(転)→숙달 증명(結), 이건 level-architect의 4비트 구조와 그대로 포갠다. 짧은 게임에선 **마지막 막간/엔딩 카드의 '転' 한 줄**(관점을 뒤집는 반전)이 앞 전체를 다시 의미화한다 — STORY.md의 엔딩에 '転 슬롯'을 의무 필드로 둬 짧아도 의미가 남게 한다. 転 순간엔 VectorForge 팔레트 시프트 + ChipAudio 키 전환으로 '아, 그렇구나'를 감각으로 보강.
- **흔한 실패:** 서구식 3막 갈등 구조를 모든 게임에 강요하기. 평화로운 게임에 억지 악당을 넣어 톤을 망치는 것. 반대로 転 없이 밋밋하게 끝내 인상이 안 남는 것.
- **연관:** GN-FOLDBACK, GN-FRAME-WINLOSE, ST-KISHO-NOCONFLICT, TW-RECONTEXT

### GN-CONSISTENCY 톤 일관성이 곧 몰입 (rule을 깨면 배신감)
- **정의:** 몰입은 깨지기 쉽다. 세계가 세운 규칙(톤·논리·시각언어)을 깨면 플레이어는 배신감을 느낀다. 일관성이 최우선 자원이다.
- **출처:** Don Carson / Janet Murray — immersion의 취약성.
- **우리 엔진 구현(작은 웹게임):** 한 게임 안에서 어휘·색팔레트·UI 톤·승패 문구·barks를 하나의 정서로 정렬한다. '쓸쓸한 등대' 게임이면 농담조 시스템 메시지나 화려한 파티클이 들어오면 안 된다 — VectorForge/PixelForge 팔레트, ChipAudio 무드, juice-fx 강도, game-ui-hud 라벨 톤을 STORY.md의 단일 톤 정의에 묶는다. STORY.md를 '텍스트 표면 레지스트리'로 운용해 인트로 카드·막간·bark 풀·힌트·승/패/엔딩·아이템 설명을 한 곳에서 생성·검토하고, 마지막에 **톤 일관성 패스**를 돌려 한 표면이라도 정서가 어긋나는지 검문한다(불일치 하나가 전체 몰입을 깬다).
- **흔한 실패:** 각 텍스트(인트로/힌트/Game Over/바크)를 따로 써서 톤이 제각각이 되는 것. 한 곳의 불일치가 전체 몰입을 깬다. 제작요소(색·음악·연출)와 텍스트의 톤이 어긋나는 것(예: 쓸쓸한 문구 + 명랑한 BGM).
- **연관:** GN-LUDOHARMONY, GN-BARK, WT-TONE-VOICE, TL-CONTINUITY-LINT

## 3. 대사·컷신 없이 값싸게 몰입 만들기

이 절은 위 원칙들을 '컷신·보이스·분기 트리를 못 쓰는 미니게임'이라는 제약 아래 한 흐름으로 엮는다. 핵심은 **서사를 만들지 말고 발생할 자리를 짓는 것**이다.

1. **핵심 동사부터, 메시지 정렬**(GN-LUDOHARMONY) — 어떤 텍스트보다 먼저 '플레이어가 반복하는 행동 하나'를 적고 주제와 같은 말을 하는지 검문한다. 메커닉이 서사의 90%를 무료로 말한다.
2. **클리셰 1개로 세계 임대**(GN-EVOKE) — 인트로 카드 한 줄 + 색 팔레트(VectorForge/PixelForge) + 무드 한 줄(ChipAudio)로 장르를 못박으면 플레이어가 세계를 무료로 채운다. 오리지널 로어는 사치다.
3. **'여기가 어디지'에 즉답**(GN-WHEREAMI) — 첫 화면에 익숙한 앵커 1개와 톤 선언. 15초 안에 위치·역할·목표가 읽히게.
4. **단서는 환경에, 자랑은 절제로**(GN-EMBED + GN-CONTRAST) — 플롯은 배경 스프라이트·아이템 설명·cause-and-effect 비네트로 심고(sprite-picker/sprite-forge), 중요한 것만 밝게 두어 시선을 강제한다.
5. **자유는 느낌으로**(GN-FOLDBACK + GN-AGENCY-FOCUS) — 진짜 분기 대신 선형 진주실/Gauntlet. agency는 한 차원(보통 Grasp)에 몰아 juice-fx 즉각 피드백으로 '내가 세계를 움직인다'를 만든다.
6. **세계가 반응하는 한 줄**(GN-BARK) — 이벤트당 floating text 변형 3~6개로 살아있는 세계를 가장 싸게. 풀+빈도로 반복 피로 차단.
7. **승패·엔딩을 디제시스로, 마지막에 '転'**(GN-FRAME-WINLOSE + GN-KISHO + GN-WANTNEED) — 가장 자주 보이는 표면을 세계 안 의미로 감싸고, 엔딩의 '転' 한 줄이 want 너머의 need를 건드려 짧아도 울림을 남긴다.
8. **마지막은 톤 일관성 패스**(GN-CONSISTENCY) — 모든 텍스트 표면 + 색·음악·연출이 하나의 정서로 정렬됐는지 검문한다. 불일치 하나가 전체 몰입을 깬다.

이 8단계의 산출물은 전부 `games/<slug>/STORY.md`의 'Scene별 텍스트 슬롯'으로 모여, web-game-builder의 코드 생성 단계에서 `this.add.text()` 기반 Scene 전환 카드·overlay·tween 트리거로 1:1 매핑된다.

## 출처

- Don Carson — Environmental Storytelling: Creating Immersive 3D Worlds Using Lessons Learned from the Theme Park Industry (Game Developer/Gamasutra) — https://www.gamedeveloper.com/design/environmental-storytelling-creating-immersive-3d-worlds-using-lessons-learned-from-the-theme-park-industry
- Sam Kabo Ashwell — Standard Patterns in Choice-Based Games (These Heterogenous Tasks) — https://heterogenoustasks.wordpress.com/2015/01/26/standard-patterns-in-choice-based-games/
- Sam Kabo Ashwell — A Bestiary of Player Agency (These Heterogenous Tasks) — https://heterogenoustasks.wordpress.com/2014/09/22/a-bestiary-of-player-agency/
- Evocative, Enacted, Embedded & Emergent: Narrative Architectures for Immersive Storytelling (No Proscenium) — https://www.noproscenium.com/evocative-enacted-embedded-emergent-narrative-architectures-for-immersive-storytelling/
- Sarah Beaulieu — How a character says hello: writing "barks" for video games — https://sarah-beaulieu.com/en/writing-barks-for-video-games
- Diegetic vs Non-Diegetic UI: The 4-Type Framework (Nasty Rodent) — https://nastyrodent.com/diegetic-and-non-diegetic-ui/
- Kishōtenketsu — Wikipedia — https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu
- Louchart & Aylett — Solving the Narrative Paradox in VEs: Lessons from RPGs (PDF) — https://www.macs.hw.ac.uk/~ruth/Papers/narrative/IVA03-Louchart-Aylett.pdf
- Hamlet on the Holodeck — Janet Murray (Wikipedia/MIT Press) — https://en.wikipedia.org/wiki/Hamlet_on_the_Holodeck
