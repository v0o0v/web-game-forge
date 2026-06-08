# 입체 캐릭터 + 원형·전형↔참신 (CH-* + AR-*)

> 작은 웹게임에서 인물을 값싸게 입체화하고, 검증된 원형 위에 '한 군데만' 비트는 기술. 색인은 [INDEX.md](./INDEX.md), 자매 SKILL은 [../../SKILL.md](../../SKILL.md).

이 파일은 두 lane을 합친다. 앞부분(**CH-***)은 한 인물을 내면의 거짓(Lie)·상처(Ghost)·필요(Need) 위에 세우는 입체화 기술이고, 뒷부분(**AR-***)은 원형(archetype)이라는 검증된 빈 틀로 빠르게 캐스팅하고 전형↔참신 축을 다루는 기술이다. 맨 아래 전용 절에 **인물 7슬롯 입체성 게이트**, **적/조연 게이트**, **장르별 전형 캐스트 메뉴 + 전형↔참신 비틀기 대조표**를 둔다.

핵심 매체 사실: 게임은 Phaser 4 기반 작은 2D 웹/모바일웹이다. AAA RPG가 아니다. 서사는 컷신이 아니라 **4채널 + bark**로 값싸게 전달한다 — (1) 인트로/타이틀 카드(≤2문장), (2) 레벨 사이 막간(≤1문장), (3) 승리/패배/엔딩 카드(각 ≤2문장), (4) 환경 단서(스프라이트·배치·색), (+bark: 이벤트당 floating text 변형 3~6개). 모든 텍스트·대사의 single source of truth는 `games/<slug>/STORY.md`다. 인물은 **1~4명 상한**, lore dump 금지. 분위기 라우팅은 VectorForge/PixelForge(색=감정), ChipAudio(무드 BGM·SFX), juice-fx(연출), game-ui-hud(카드/메뉴 UI), sprite-picker/sprite-forge(환경 단서 스프라이트).

---

## 프레임워크 요약

### 입체 캐릭터 (CH-*)
| 프레임워크 | 출처 | 한 줄 골자 | 미니 게임 쓰임 |
|---|---|---|---|
| Weakness–Need–Desire–Self-Revelation | John Truby, *The Anatomy of Story* (22 Steps) | 약점→필요(심리적+도덕적)→욕망→고통을 통한 갑작스러운 자기각성 | Want=게임 목표, Need=엔딩 카드 한 문장 각성 |
| Lie–Ghost–Want–Need & 5아크 | K.M. Weiland, *Creating Character Arcs* | Ghost(상처)→Lie(거짓 한 문장)→Want(외부 목표)→Need(진실). 아크 5종 | Lie는 인트로 한 줄, Ghost는 환경 단서, 아크는 분기 엔딩 |
| 3차원 Bone Structure | Lajos Egri, *The Art of Dramatic Writing* | physiology/sociology/psychology 3차원이 행동을 끈다(character determines action) | 작가 참고용으로 채우고 각 차원 디테일 1개씩만 노출 |
| Four-Corner Opposition & 같은 목표의 적 | John Truby (opponents) | 적은 방해자가 아니라 '같은 목표를 다른 가치로' 다툰다. 적=주인공의 어두운 버전 | 적 동기 1줄 = 주인공 Lie의 거울. 같은 것을 다투게 |
| Character Foil | 작법 일반 (Final Draft 등) | foil은 한 축만 반대로 대비시켜 주인공을 또렷하게 | 조연 1명으로 대사 없이 주제를 비춤 |
| Passions·경험 동기화·agency | Game Developer Ch.5 (Levine, Pink) | 백스토리 대신 Passions 3개. 같은 사건 동시 목격으로 빠른 애착. 선택이 캐릭터를 정의 | Passion 3개로 인터뷰 마감, 선택 결과를 화면에 반영 |
| Telling Detail / Show-don't-tell | 작법 (Story Mastery 등) | 첫 등장=의도 선언. 정밀한 디테일 2~3개가 인물을 살린다 | 첫 스프라이트 + 첫 행동 1번 + 환경 단서 1개 |

### 5가지 캐릭터 아크 (Weiland) — 게임 규모에 맞춰 1개만 고른다
| 아크 | 핵심 | 미니 게임 적합도 |
|---|---|---|
| Positive Change | 거짓 버리고 진실 깨달음(가장 흔한 성장 아크) | 분기 게임에서만 권장(풀아크는 길다) |
| Flat | 이미 진실을 아는 주인공이 세상을 바꿈('배우는 게 아니라 가르친다') | 짧은 퍼즐·구출형에 가장 경제적 |
| Disillusionment | 거짓은 깨지만 드러난 진실이 비극 | 다크 톤 짧은 게임 |
| Fall | 진실 옆에서도 거짓을 끝까지 붙듦 | 분기 게임의 '나쁜 엔딩' |
| Corruption | 진실을 알면서 거짓을 택함 | 빌런 기원·안티히어로 |

### 원형·전형↔참신 (AR-*)
| 프레임워크 | 출처 | 한 줄 골자 | 미니 게임 쓰임 |
|---|---|---|---|
| Jung 12 Archetypes | Mark & Pearson, *The Hero and the Outlaw* | Innocent/Everyman/Hero/Outlaw/Explorer/Creator/Ruler/Magician/Lover/Caregiver/Jester/Sage. 각각 goal·fear·strategy·shadow | 인물당 원형 1개로 인트로 한 줄. shadow=적 씨앗 |
| Campbell/Vogler 8 Archetypes | Vogler, *The Writer's Journey* | Hero/Mentor/Threshold Guardian/Herald/Shapeshifter/Shadow/Trickster/Ally. **고정 인물이 아니라 기능(function)** | 한 NPC가 여러 가면 겸함 — 인물 수 절약 |
| Propp 7역할 & 31기능 | Propp, *Morphology of the Folktale* | Villain/Donor/Helper/Princess/Dispatcher/Hero/False Hero. 기능 순서는 불변, 외형만 교체 | 레벨·퀘스트 골격(결핍→Donor→대결→귀환) |
| 전형↔참신 (Defamiliarization / Trope budget) | Russian Formalism(Shklovsky) + Scree Games | 전복이 지각되려면 기대가 선행해야. innovation budget을 한두 군데에만 몰아라 | 게임당 전복 포인트 정확히 1개 |
| Want vs Need (Truby) | Truby / Save the Cat 계열 | want=외적 목표(추진력), need=내적 약점 극복(열쇠) | want=승리 조건, need=엔딩 한 줄 깨달음 |

> 두 lane 모두 want/need를 다룬다. CH-WANT-NEED는 한 인물의 내면 깊이 관점, AR-WANT-NEED는 원형의 '연료' 관점이다. STORY.md에는 **하나의 Want/Need 쌍**만 확정해 단일 출처로 고정한다.

---

## 원칙 사전 — 입체 캐릭터 (CH-*)

### CH-WANT-NEED 겉욕망과 속필요를 분리하라
- **정의:** 캐릭터가 의식적으로 좇는 외부 목표(Want/Desire)와 내면에서 진짜 채워야 할 것(Need/진실)을 명확히 다르게 설정한다. 둘이 같으면 내적 깊이가 사라진다.
- **출처:** John Truby, *The Anatomy of Story* / K.M. Weiland.
- **우리 엔진 구현(작은 웹게임):** 게임의 표면 목표(탈출·점수·구출=Want)를 인트로 카드(`this.add.text()`로 띄우는 타이틀 카드)에 노출한다. 별개로 주인공이 진짜 배워야 할 한 문장(Need: '혼자가 아니어도 된다')을 STORY.md에 박아두고 엔딩 카드에서만 각성으로 드러낸다. 같은 플레이가 두 겹으로 읽힌다. Want는 game-ui-hud의 목표 표시(점수·남은 적)와 1:1, Need는 ChipAudio의 엔딩 무드 전환과 묶는다.
- **흔한 실패:** Want와 Need를 같게 두기('적을 이기고 싶다=이겨야 한다'). 외부 승리만 남고 내적 변화가 없어 평면적이 된다.
- **연관:** CH-REVEAL, AR-WANT-NEED, GN-WANTNEED, ST-WANT-NEED

### CH-LIE 한 문장의 거짓을 심어라
- **정의:** 캐릭터가 자신·타인·세계에 대해 믿는 거짓 신념(the Lie)을 한 문장으로 진술 가능하게 정한다. 이 거짓이 결함·두려움·잘못된 선택의 뿌리다.
- **출처:** K.M. Weiland, *Creating Character Arcs* (the Lie).
- **우리 엔진 구현(작은 웹게임):** 인터뷰에서 '이 인물이 틀리게 믿는 한 문장은?'을 반드시 뽑아 STORY.md 인물 슬롯의 Lie 칸에 적는다('나는 약함을 보이면 버려진다'). 인트로 카드 한 줄 또는 첫 막간 독백에 거짓을 노출하고, 레벨 전개가 그 거짓을 계속 시험하게 한다. 색(VectorForge/PixelForge)으로 거짓의 무드를 깔면(차가운 단색) 텍스트 없이도 거짓이 환경에 스며든다.
- **흔한 실패:** 거짓이 모호하거나 추상적('인생은 힘들다')이면 무력하다. 행동으로 시험 가능한 구체적·개인적 명제여야 한다.
- **연관:** CH-GHOST, CH-REVEAL, CH-WORTHYFOE, ST-MIRROR-FRAME

### CH-GHOST 상처(Ghost)로 거짓의 출처를 만들라
- **정의:** 캐릭터가 왜 그 거짓을 믿게 됐는지 설명하는 과거의 상처/사건(the Ghost, wound)을 정한다. 거짓의 인과적 뿌리다.
- **출처:** K.M. Weiland, *Creating Character Arcs* (the Ghost).
- **우리 엔진 구현(작은 웹게임):** Ghost는 길게 서술하지 말고 '단서 하나'로 보여준다 — 찢어진 사진, 멈춘 시계, 빈 의자. sprite-picker/sprite-forge로 그 오브젝트 스프라이트를 만들어 배경에 배치하고, juice-fx로 플레이어가 가까이 가면 살짝 강조한다. 레벨 사이 막간 텍스트 한 줄로 암시하는 것도 충분하다. 플레이어가 추론하게 둔다.
- **흔한 실패:** 상처를 장황한 플래시백/설명으로 풀어버리는 것. 짧은 게임에선 단서로 암시하고 플레이어가 추론하게 둬야 효율적이고 강하다.
- **연관:** CH-ENVCLUE, CH-LIE, GN-EMBED, ST-ENV-CLUE

### CH-MORALNEED 심리적 결함에 도덕적 결함을 더하라
- **정의:** 자기만 해치는 심리적 필요를 넘어, 남을 해치고 있는 도덕적 약점(moral need)을 하나 얹으면 인물이 평면에서 입체로 올라선다.
- **출처:** John Truby, *The Anatomy of Story* (need = 심리적 + 도덕적).
- **우리 엔진 구현(작은 웹게임):** 주인공이 시작 시점에 누군가를 (사소하게라도) 해치고 있게 한다 — 동료를 이용함, 약자를 무시함. 첫 화면의 한 행동(CH-ENTRANCE)이나 한 번의 선택(CH-AGENCY)으로 이 도덕적 약점을 보인다. 게임 중 그 대가를 한 장면에서 겪고, 엔딩 카드에서 '남을 어떻게 대해야 하는가'를 배우게 한다. 한 장면·한 선택이면 된다.
- **흔한 실패:** 주인공을 무결한 피해자로만 그리는 것. 도덕적 약점이 없으면 '착하지만 불운한' 평면 캐릭터에 머문다.
- **연관:** CH-AGENCY, CH-REVEAL, CH-WANT-NEED, WT-ACTION-ARGUES

### CH-REVEAL 자기각성은 갑작스럽고 새롭게
- **정의:** 캐릭터의 깨달음(self-revelation)은 클라이맥스 근처에서 갑자기 와야 극적 힘이 최대가 된다. 이미 알던 것의 재확인이 아니라 '새로운' 진실이어야 한다.
- **출처:** John Truby, *The Anatomy of Story* (self-revelation).
- **우리 엔진 구현(작은 웹게임):** 엔딩 직전 결정적 순간(보스전 후, 마지막 선택)에 주인공이 거짓을 살아왔음을 처음 깨닫게 한다. 승/패 화면 직전 한 줄 독백(`this.add.text()` overlay + tween fade-in)이나 마지막 한 번의 선택으로 압축한다. 이 한 줄은 인트로의 Lie와 정확히 짝(거짓→진실)을 이뤄야 한다(ST-MIRROR-FRAME과 연동해 검증).
- **흔한 실패:** 각성을 게임 초반에 미리 말해버리거나, 점진적으로 흐릿하게 흘려 '갑작스러움'을 잃는 것. 김이 빠진다.
- **연관:** CH-LIE, CH-WANT-NEED, ST-MIRROR-FRAME, TW-PERI-ANAG

### CH-ARCFIT 게임 규모에 맞는 아크 1개만 고른다
- **정의:** Positive Change / Flat / Disillusionment / Fall / Corruption 중 게임의 길이·톤·메커닉에 맞는 단 하나의 아크를 명시적으로 고른다.
- **출처:** K.M. Weiland, 5가지 캐릭터 아크.
- **우리 엔진 구현(작은 웹게임):** 퍼즐·구출형 짧은 게임엔 주인공이 안 변하고 세계를 바꾸는 **Flat 아크**가 가장 경제적이다. 분기 선택 게임이면 같은 Lie를 버리면 Positive, 붙들면 Fall로 엔딩 카드를 갈라 재플레이 가치를 만든다(Scene를 두 개의 EndScene으로 분기). 고른 아크 하나를 STORY.md 상단에 명시한다.
- **흔한 실패:** 5분짜리 게임에 완전한 Positive Change 아크(거짓→시험→각성→변모)를 욱여넣어 어느 단계도 설득력 없이 끝나는 것. 욕심을 줄여라.
- **연관:** CH-WANT-NEED, ST-PICK-ONE, ST-NO-OVERFIT, GN-FRAME-WINLOSE

### CH-3DIM 3차원을 채우되 하나씩만 노출하라
- **정의:** Egri의 physiology/sociology/psychology를 작가 참고용으로 채워 'bone structure'를 갖되, 게임 화면엔 각 차원에서 결정적 디테일 하나씩만 드러낸다.
- **출처:** Lajos Egri, *The Art of Dramatic Writing* (3차원 bone structure).
- **우리 엔진 구현(작은 웹게임):** 인터뷰에서 세 차원 체크리스트로 인물을 빠르게 세운다(노출용 아님, STORY.md 작가 메모). 화면 노출은 physiology(절뚝이는 걸음 애니메이션), sociology(낡은 광부 등불 스프라이트), psychology(아무 NPC와도 시선을 안 마주침) 각 1개씩. PixelForge/sprite-forge로 이 디테일을 스프라이트 한 장에 새긴다. 셋이 서로 모순되면(고운 손 + 거지 행색) 입체감이 급상승한다.
- **흔한 실패:** 설정한 3차원 디테일을 전부 대사·텍스트로 쏟아내는 것. 99%는 빙산 아래 두고 빙산 끝만 보여야 한다.
- **연관:** CH-ENTRANCE, CH-CONTRA, WT-ICEBERG, GN-EVOKE

### CH-CONTRA 모순과 내적 갈등으로 입체화하라
- **정의:** 캐릭터에게 동시에 양립하기 어려운 두 욕구/가치를 줘 내적 갈등을 만든다. 같은 특성이 강점이자 약점이 되게 한다.
- **출처:** Lajos Egri (내적 모순) / 작법 일반.
- **우리 엔진 구현(작은 웹게임):** '이 인물이 동시에 원하는 두 가지'를 한 줄로 STORY.md에 적는다(안전을 원하지만 모험도 갈망). 게임 선택지(CH-AGENCY)를 이 둘의 충돌로 설계하면 어떤 선택도 대가를 치르게 되어 캐릭터가 살아난다. 선택지는 game-ui-hud의 버튼 두 개 + juice-fx로 결과 연출.
- **흔한 실패:** 장점만 모은 무결점 캐릭터 또는 단점만 모은 캐릭터. 모순이 없으면 예측 가능하고 지루하다.
- **연관:** CH-3DIM, CH-AGENCY, CH-WANT-NEED, DL-CHOICEVOICE

### CH-FOIL 조연 한 명을 대조 거울로 세워라
- **정의:** 주인공의 한 축(동기·기질·신념)만 정반대인 foil 인물을 둬, 대사 없이도 주인공의 결함과 가치를 또렷하게 만든다.
- **출처:** 문학/시나리오 작법 일반 (Han Solo↔Luke, Laertes↔Hamlet).
- **우리 엔진 구현(작은 웹게임):** 동료/라이벌 NPC를 주인공과 **한 축만** 반대로 설계한다 — 주인공이 망설일 때 즉답하는 동료, 같은 상실을 정반대로 견디는 NPC. 인물 1~4명 상한 안에서 foil 한 명이 주제를 통째로 비추므로 비용 대비 효율 최고. foil의 색 팔레트를 주인공과 보색으로 두면(VectorForge) 대비가 시각으로도 선다.
- **흔한 실패:** foil을 모든 면에서 반대로 만들어 '정반대 클리셰'가 되는 것. 한 축만 대비시키고 나머지는 겹치게 둬야 진짜처럼 보인다.
- **연관:** CH-WORTHYFOE, AR-SHADOW-MIRROR, GN-CONTRAST, DL-IDIOLECT

### CH-WORTHYFOE 적대자를 주인공의 어두운 거울로
- **정의:** 강력한 적대자는 적어도 한 차원에서 주인공과 대등하거나 우월하고, 주인공이 '될 수도 있었던' 어두운 버전 — 같은 목표를 다른 가치로 좇는다.
- **출처:** John Truby (four-corner opposition, thematic opposition) / villain 작법.
- **우리 엔진 구현(작은 웹게임):** 적의 동기를 주인공 Lie의 극단 버전으로 설계한다('나도 한때 너처럼 믿었어'). 가능하면 적과 주인공이 같은 것을 원하게 하면(같은 사람/보물) 보스전 한 판도 가치 충돌로 읽힌다. 적의 한 줄 동기는 보스 등장 카드나 패배 화면에 노출하고, 본인 기준 정당해야 한다. 원형 관점에선 AR-SHADOW-MIRROR(주인공과 같은 원형의 shadow)로 1줄 직결.
- **흔한 실패:** '악하고 싶어 악한' 동기 없는 빌런. 매일 아침 악행을 궁리하는 진짜 인간은 없다 — 적도 자기 이야기의 주인공이다.
- **연관:** AR-SHADOW-MIRROR, CH-LIE, CH-FOIL, GN-FRAME-WINLOSE

### CH-AGENCY 선택으로 캐릭터를 드러내라
- **정의:** 게임은 보여주기를 넘어 '하게' 한다. 플레이어의 선택과 그 가시적 결과가 캐릭터의 동기·결함·가치를 정의한다.
- **출처:** Game Developer 'Storytelling in Games' Ch.5 (agency 연구).
- **우리 엔진 구현(작은 웹게임):** 압박 상황에서 캐릭터의 진짜 가치를 묻는 선택지를 **한 번** 넣는다(다친 적을 구할 것인가). game-ui-hud로 선택 UI를 띄우고, 결과를 화면/세계에 반영해(NPC 스프라이트 변화, 배경 색 전환) '내 선택이 이 인물을 이렇게 만들었다'는 책임감을 준다. DL-FEEDBACK과 묶어 '기억된다'는 신호를 준다. 한 번의 의미 있는 선택이 열 줄의 설명보다 강하다.
- **흔한 실패:** 결과 없는 가짜 선택(무엇을 골라도 같음). 변화가 안 보이면 선택은 무의미해지고 캐릭터도 공허해진다.
- **연관:** CH-CONTRA, CH-MORALNEED, DL-CHOICEVOICE, DL-FEEDBACK

### CH-ENTRANCE 첫 등장은 행동 한 번으로 선언하라
- **정의:** 캐릭터의 도입은 인사가 아니라 인격을 드러내는 행동/반응의 순간이어야 한다. 2~3개의 정밀한 디테일로 톤·성격·갈등을 압축한다.
- **출처:** 시나리오 작법 (telling detail, 첫 등장=의도 선언).
- **우리 엔진 구현(작은 웹게임):** 미니 게임의 캐릭터 도입 = 첫 스프라이트(PixelForge/sprite-picker) + 첫 행동 한 번(인트로 Scene의 짧은 tween/애니메이션) + 환경 단서 한 개. 첫 대사도 정보가 아니라 성격을 드러내는 선택으로(DL-DUAL). 결함을 보여주는 단 하나의 행동(약자를 지나침 vs 멈춤)을 첫 화면에 배치한다.
- **흔한 실패:** 도입을 이름·설정 나열로 채우는 것. 본 적 없는 관계나 전사(前史)를 텍스트로 떠먹이면 정서가 안 생긴다 — 행동으로 보여라.
- **연관:** CH-3DIM, CH-ENVCLUE, GN-WHEREAMI, ST-IN-MEDIAS

### CH-ENVCLUE 환경 단서로 인물을 말하라
- **정의:** 대사·컷신 없이 오브젝트와 공간이 인물의 성격·역사·정서를 암시하게 한다(embedded narrative). 플레이어가 추론하게 두는 것이 직접 서술보다 강하다.
- **출처:** 시나리오·게임 작법 (embedded narrative, show-don't-tell).
- **우리 엔진 구현(작은 웹게임):** 방·소지품·배경에 '말하는 디테일' 하나를 sprite-picker/sprite-forge 스프라이트로 심는다 — 무너진 벽에 똑바로 걸린 가족사진(누군가 돌아와 돌본다), 반쯤 남은 식사(급히 떠남). 한 화면의 오브젝트 1~2개로 부재한 인물까지 그려낸다. 색·조명(VectorForge/PixelForge)으로 정서를 보강.
- **흔한 실패:** 단서를 과하게 깔거나, 곧바로 텍스트로 정답을 알려줘 추론의 여지를 없애는 것. 절제와 선택적 배치가 핵심.
- **연관:** CH-GHOST, AR-DECONSTRUCT-WHY, GN-EMBED, ST-ENV-CLUE, WT-ENV-CLUE

### CH-PASSIONS 백스토리 대신 Passions 3개
- **정의:** 방대한 전사 대신, 플레이어 행동과 관련된 '캐릭터가 신경 쓰는 것' 2~3개만 추려 캐릭터를 정의한다(Ken Levine의 Passions).
- **출처:** Game Developer Ch.5 (Ken Levine, 'Passions').
- **우리 엔진 구현(작은 웹게임):** 각 인물을 '모험심, 아버지 콤플렉스, 증명 욕구'처럼 Passion 3개로 압축해 STORY.md 인물 슬롯에 적고 인터뷰를 마무리한다. 게임 내 모든 대사(bark 포함)·행동·반응이 이 3개에서 흘러나오게 하면 짧아도 일관되고 또렷하다. bark 변형 3~6개도 이 Passion에서 파생시킨다(DL-BARKDUTY).
- **흔한 실패:** 관련 없는 전기적 디테일(생일·고향·취미)을 잔뜩 만들고 정작 플레이어 경험과 연결 안 되는 것. 플레이와 무관한 설정은 버려라.
- **연관:** CH-3DIM, AR-FAST-CAST, DL-VOICEBIBLE, TL-BIBLE-LEAN

---

## 원칙 사전 — 원형·전형↔참신 (AR-*)

### AR-FAST-CAST 원형으로 즉석 캐스팅
- **정의:** 원형은 '검증된 빈 틀'이라 적은 텍스트로 즉각적 인지와 기대를 만든다. 인물마다 명확한 원형 하나를 부여해 player가 한 줄로 누구인지 알게 한다.
- **출처:** Jung 12 Archetypes (Mark & Pearson) / Vogler 8 Archetypes.
- **우리 엔진 구현(작은 웹게임):** 인트로 카드에 인물당 1원형: 'Mentor 노인이 첫 화면에서 규칙을 알려준다', '보스는 Ruler-shadow 폭군'. 묘사 대신 원형 신호로 전달한다 — 시각 팔레트(VectorForge/PixelForge), 말투(bark idiolect, DL-IDIOLECT), 아이콘 스프라이트(sprite-picker). 인물 1~4명 상한 안에서 각자 뚜렷한 원형 하나만.
- **흔한 실패:** 원형을 '도착점'으로 착각해 평면 클리셰로 끝내는 것. 원형은 출발점일 뿐("can't take you all the way").
- **연관:** CH-PASSIONS, AR-GENRE-CAST, AR-IMPLY-MINOR, GN-EVOKE

### AR-EXPECT-FIRST 기대를 먼저 세우고 깬다
- **정의:** 전복이 전복으로 지각되려면 먼저 전형을 충분히 보여줘 player의 기대를 정렬해야 한다. establish→then flip.
- **출처:** Russian Formalism (defamiliarization, '낯섦은 기대가 선행해야 지각된다') / Romancelvania 사례.
- **우리 엔진 구현(작은 웹게임):** 초반 1~2분/첫 인트로 카드에서 인물을 전형대로 행동시켜 기대를 심는다(Donor NPC가 평범하게 아이템을 줌). 그 뒤 막간 텍스트나 엔딩 카드에서 한 번 비튼다(돕던 NPC가 사실 False Hero). 4채널 중 인트로=기대 심기, 막간/엔딩=뒤집기로 역할 분담. 이 원칙은 짧은 게임에서 트위스트를 살리는 핵심이다.
- **흔한 실패:** 토대 없이 곧장 비틀면 player가 무엇이 뒤집혔는지 모른다 — 그냥 혼란일 뿐 놀라움이 아니다.
- **연관:** AR-ONE-TWIST, AR-TWIST-INEVITABLE, TW-PLANT-PAY, ST-MIRROR-FRAME

### AR-ONE-TWIST 전복 포인트는 하나만
- **정의:** innovation budget은 한정적이다. 대부분을 익숙하게 두고 한두 군데에만 참신함을 몰아야 신뢰와 신선함을 동시에 얻는다.
- **출처:** Scree Games 'Trope or Nope' (innovation budget, Disco Elysium 사례).
- **우리 엔진 구현(작은 웹게임):** 캐스트·메커닉·세계관 중 '딱 하나'만 참신하게. 미니 게임이면 보통 '한 인물의 동기 한 줄' 또는 'setting 한 가지'를 전복 포인트로 선택하고 나머지는 전형 유지. 인터뷰에서 사용자가 여러 개를 비틀려 하면 게이팅으로 막고 하나만 고르게 한다(아래 비틀기 대조표 참조).
- **흔한 실패:** 모든 걸 참신하게 하려다 너무 weird해져 audience를 못 찾거나, 아무것도 안 비틀어 generic해지는 양극단.
- **연관:** AR-EXPECT-FIRST, AR-GENRE-CAST, TW-ONE-CLEAN, ST-NO-OVERFIT

### AR-FUNCTION-OVER-FACE 인물보다 기능을 본다
- **정의:** Vogler·Propp의 핵심: 원형은 고정 인물이 아니라 극적 기능이며, 한 인물이 여러 가면을 쓸 수 있다. 기능의 순서는 불변, 외형만 교체 가능하다.
- **출처:** Vogler 8 Archetypes / Propp 31 Functions.
- **우리 엔진 구현(작은 웹게임):** 인물 수가 적은(1~4명) 미니 게임에서 한 NPC가 Herald(부름)+Threshold Guardian(첫 장애물)+Mentor(힌트)를 겸하게 압축한다. 퀘스트/레벨 골격은 Propp 기능 순서(결핍→파견→Donor→대결→귀환)로 짠다 — 이게 곧 Scene 흐름이 된다.
- **흔한 실패:** 기능 하나에 인물 하나씩 배정해 캐스트가 비대해지고 짧은 게임에 안 맞게 되는 것.
- **연관:** AR-IMPLY-MINOR, AR-MECHANIC-MATCH, GN-FOLDBACK, TL-BIBLE-LEAN

### AR-SHADOW-MIRROR 그림자로 적을 만든다
- **정의:** 모든 원형엔 shadow(그림자/타락형)가 있다. hero와 같은 원형의 그림자형을 villain에 배치하면 대조와 주제가 자동으로 선다.
- **출처:** Jung 12 Archetypes (각 원형의 shadow).
- **우리 엔진 구현(작은 웹게임):** hero가 Hero 원형이면 boss는 'ego에 잡아먹힌 Hero-shadow'(타락한 과거의 영웅). Sage hero ↔ 진리를 독점하려는 Sage-shadow. 1줄 villain 동기로 직결된다. CH-WORTHYFOE의 원형 버전 — 적대자 게이트에서 이 둘을 함께 적용한다. 적의 색 팔레트를 주인공과 같은 계열의 어두운 변주로 두면(VectorForge) '같은 동전의 양면'이 시각으로 선다.
- **흔한 실패:** villain을 '이유 없이 악함(evil for evil)'으로 두는 것 — 그림자는 반드시 hero와 같은 욕망의 뒤틀린 버전이어야 울림이 생긴다.
- **연관:** CH-WORTHYFOE, CH-LIE, AR-WANT-NEED, GN-FRAME-WINLOSE

### AR-WANT-NEED want와 need를 분리한다
- **정의:** 외적 목표(want)는 player가 따라갈 추진력, 내적 약점 극복(need)은 숨은 변화의 핵심. 깊이는 want를 좇다 need를 건드릴 때 나온다.
- **출처:** John Truby, *The Anatomy of Story* (want vs need).
- **우리 엔진 구현(작은 웹게임):** want=명시적 승리 조건(보스 처치/탈출)으로 인트로 카드·HUD에 노출, need=엔딩 한 줄의 깨달음으로 승리/패배 화면에 노출. villain에게도 '한때 가졌던 want가 비틀린 need'를 부여하면 1줄로 입체화된다. CH-WANT-NEED와 동일 쌍을 가리키므로 STORY.md에 단일 Want/Need만 확정.
- **흔한 실패:** want만 있고 need가 없으면 클리어해도 공허하다. 반대로 need 설교가 길면 짧은 게임의 호흡을 망친다.
- **연관:** CH-WANT-NEED, CH-REVEAL, GN-WANTNEED, ST-WANT-NEED

### AR-PLAYER-IS-HERO Hero 자리는 player가 채운다
- **정의:** 게임은 player가 직접 Hero 역할을 '수행'한다. 그래서 protagonist 원형은 묘사보다 player의 행동·선택으로 체험돼야 하며, 종종 의도적으로 비워 둔다(silent/avatar).
- **출처:** 게임 매체 agency 연구 / Vogler(Hero).
- **우리 엔진 구현(작은 웹게임):** 주인공 성격을 과하게 못 박지 말고 행동 여지를 남긴다. 원형의 무게는 주변 NPC(Mentor·Herald·Shadow)에 싣고, player에겐 '되어가는' 빈자리를 준다. 단, CH-* 입체화(Lie/Ghost/Want)는 STORY.md 작가 메모로는 유지하되 화면 노출은 절제 — 플레이어 동일시를 막지 않게 선택(CH-AGENCY)으로 드러낸다.
- **흔한 실패:** player 캐릭터에 강한 고정 성격·대사를 박아 player의 동일시(identification)와 agency를 막는 것.
- **연관:** CH-AGENCY, DL-CHOICEVOICE, AR-FAST-CAST, GN-AGENCY-FOCUS

### AR-DECONSTRUCT-WHY 클리셰엔 이유를 붙인다(deconstruct)
- **정의:** 전형적 행동을 심리적 이유로 설명하면 클리셰가 입체가 된다(Regina George의 queen bee 행동이 불안에서 나오듯).
- **출처:** Now Novel '5 Ways to Subvert' / Romancelvania (Sol 예시).
- **우리 엔진 구현(작은 웹게임):** 전형 인물에게 '왜 그런가' 한 줄을 환경 단서(CH-ENVCLUE)로 흘린다 — 냉정한 vampire가 사실 경험 부족·겁먹음 때문. 메모·낙서·배경 오브젝트 스프라이트(sprite-forge)나 막간 텍스트 한 줄로 전달. 이건 AR-ONE-TWIST의 '값싼 비틀기' 후보 — 동기 한 줄만 바꾸면 캐스트는 전형 그대로 두고도 참신해진다.
- **흔한 실패:** 이유 없이 트레잇만 나열하면 평면 클리셰. 반대로 배경설명이 길면 미니게임에 과하다 — 한 줄 단서로 족하다.
- **연관:** CH-ENVCLUE, CH-WORTHYFOE, AR-ONE-TWIST, GN-EMBED

### AR-LAMPSHADE 클리셰를 의식적으로 짚는다(lampshade)
- **정의:** 내러티브가 스스로 '이거 뻔한 trope인 거 안다'고 인정하면, 코미디·자각적 톤에서 player의 신뢰를 사고 전복의 발판을 만든다.
- **출처:** Now Novel '5 Ways to Subvert' (lampshade).
- **우리 엔진 구현(작은 웹게임):** 가벼운/코믹 미니게임에서 막간 텍스트나 bark로 '또 선택받은 용사라고? 그래, 또야.' 같은 자각 대사. 그 직후 진짜로 비튼다(AR-EXPECT-FIRST). 톤 일관성(ST-TONE-LOCK)이 코믹일 때만 쓴다. ChipAudio의 경쾌한 무드와 묶으면 자각 톤이 강화된다.
- **흔한 실패:** 진지·몰입형 게임에 남발하면 분위기가 깨진다 — lampshade는 톤이 허용할 때만.
- **연관:** AR-EXPECT-FIRST, ST-TONE-LOCK, DL-BARKVARY, WT-TONE-VOICE

### AR-IMPLY-MINOR 단역은 원형으로 암시만
- **정의:** 조연·단역은 원형을 굵은 선으로 암시해 player의 사전지식이 빈칸을 채우게 한다. 가장 좋은 클리셰 활용은 클리셰에 주의를 끌지 않는 것.
- **출처:** Now Novel '5 Ways to Subvert' (imply).
- **우리 엔진 구현(작은 웹게임):** 퀘스트 단역(상점 Donor, 문지기 Guardian)은 한 단어·한 아이콘 스프라이트(sprite-picker)로 원형만 찍고 넘어간다. 묘사 예산(텍스트·bark)은 핵심 1~2인에만 쓴다. 인물 1~4명 상한이 있으니 단역은 '명명된 인물' 수에 안 넣는 편이 낫다 — 배경 기능으로 처리.
- **흔한 실패:** 모든 단역을 입체화하려다 텍스트 예산을 낭비하고 페이스를 죽이는 것.
- **연관:** AR-FAST-CAST, AR-FUNCTION-OVER-FACE, ST-TEXT-BUDGET, DL-SHOWENV

### AR-GENRE-CAST 장르별 전형 캐스트 메뉴를 먼저 제시
- **정의:** 장르마다 player가 무의식적으로 기대하는 '전형 캐스트'가 있다(판타지: 선택받은 자·현자 멘토·암흑군주; 누아르: 기억상실 탐정·팜파탈). 이를 메뉴로 제시하면 빠른 합의가 된다.
- **출처:** 장르 관습 / 원형 작법 종합.
- **우리 엔진 구현(작은 웹게임):** 스킬 인터뷰에서 장르 확정 후 '이 장르의 전형 캐스트는 이것들이다'를 카드로 보여주고(아래 '장르별 전형 캐스트 메뉴' 절), 각 슬롯을 채택할지/비틀지 선택받는다. Phaser 장르(플랫포머/슈터/퍼즐/러너)별로 메뉴가 다르다 — 메커닉이 곧 원형 후보를 정한다(AR-MECHANIC-MATCH).
- **흔한 실패:** 장르 전형을 무시하고 백지에서 시작하면 인지 비용이 폭증 — 작은 게임에서 치명적.
- **연관:** AR-FAST-CAST, AR-ONE-TWIST, AR-MECHANIC-MATCH, GN-EVOKE

### AR-TWIST-INEVITABLE 전복은 '돌아보면 필연'이어야
- **정의:** 좋은 트위스트는 그 순간 놀랍지만 돌이켜보면 필연적이다. 캐릭터의 내적 진실·뿌린 단서에서 자라야 하며 임의의 충격이어선 안 된다.
- **출처:** 트위스트 작법 (peripeteia + 복선).
- **우리 엔진 구현(작은 웹게임):** False Hero·배신 트위스트를 쓸 거면 초반 인트로/첫 막간에 작은 단서(어긋난 bark 한 줄, 수상한 오브젝트 스프라이트)를 미리 심는다. 환경 단서(CH-ENVCLUE)가 복선 역할. 인터뷰에서 전복을 택하면 '복선 한 줄을 인트로에 심자'를 반드시 후속 질문으로 강제한다.
- **흔한 실패:** 캐릭터 진실과 무관한 '깜짝쇼' 전복 — player는 속았다고 느끼지 배신감의 카타르시스를 못 얻는다.
- **연관:** AR-EXPECT-FIRST, TW-PLANT-PAY, TW-FAIR-PLAY, TW-BETRAYAL

### AR-MECHANIC-MATCH 원형을 메커닉으로 번역한다
- **정의:** 게임에선 원형이 대사가 아니라 행동·능력으로 드러난다. 원형 트레잇을 게임플레이에 연결하면 서사와 메커닉이 한 몸이 된다.
- **출처:** Kreonit 'Archetypes in Games' (원형→메커닉) / ludonarrative.
- **우리 엔진 구현(작은 웹게임):** Trickster→스텔스/속임수 메커닉, Caregiver→힐/보호, Donor→아이템 부여 NPC, Threshold Guardian→잠금/관문 퍼즐. Phaser로 구현 가능한 행동으로 원형을 체험시킨다. 인물의 원형이 player 행동으로 드러나면 텍스트 예산이 절약되고 GN-LUDOHARMONY가 선다.
- **흔한 실패:** 원형을 텍스트로만 선언하고 메커닉과 따로 노는 것 — 게임 매체의 강점을 버리는 셈.
- **연관:** AR-FUNCTION-OVER-FACE, AR-GENRE-CAST, GN-LUDOHARMONY, CH-AGENCY

---

## 전용 절 1 — 인물 7슬롯 입체성 게이트

각 명명 인물(주인공 포함)마다 아래 7슬롯을 **빈칸 없이** 채운다. 빈칸이 곧 서사 구멍 — 인터뷰에서 끈질기게 되묻는다. 인물은 **1~4명 상한**. 탑다운 질문 순서는 **Ghost → Lie → Want → Need**(인과 사슬). 사용자가 Want부터 말하면 'why(거짓)'와 'where from(상처)'으로 거슬러 올라간다. Lie가 추상적이면('인생은 힘들다') 행동으로 시험 가능한 구체 명제가 나올 때까지 거부한다.

| 슬롯 | 채우는 것 | 노출 채널 | 관련 code |
|---|---|---|---|
| **이름** | 부르기 쉬운 짧은 이름(1~2음절 권장) | 인트로 카드 / bark 발화자 | AR-FAST-CAST |
| **원형** | Jung/Vogler 원형 1개 | 시각 팔레트·아이콘·말투(노출), 작가 메모 | AR-FAST-CAST, AR-MECHANIC-MATCH |
| **Want** | 의식적 외부 목표 = 게임 승리 조건 연결 | 인트로 카드 + HUD 목표 | CH-WANT-NEED, AR-WANT-NEED |
| **Lie** | 한 문장의 거짓 신념(행동으로 시험 가능) | 인트로 한 줄 / 첫 막간 독백 | CH-LIE |
| **Ghost** | 거짓의 출처인 과거 상처/사건 | 환경 단서 1개(스프라이트·막간 한 줄) | CH-GHOST, CH-ENVCLUE |
| **Need** | 거짓을 풀 진실 = 엔딩 각성 한 문장 | 엔딩/승패 카드 | CH-REVEAL, CH-WANT-NEED |
| **Passion ×3** | 신경 쓰는 것 3개(모든 대사·행동의 원천) | bark·선택지·반응 전반 | CH-PASSIONS |
| **노출 디테일 1~2** | 3차원 중 화면에 실제 보일 디테일 1~2개 | 스프라이트·애니메이션·배치 | CH-3DIM, CH-ENTRANCE |
| **voice do/don't** | 이 인물이 쓰는/안 쓰는 말투 한 줄씩 | bark·대사 일관성 | DL-VOICEBIBLE, DL-IDIOLECT |
| **아크 타입** | (주인공만) Flat/Positive/Fall 등 1개 | 엔딩 분기 | CH-ARCFIT |

검증 규칙:
- **Want ≠ Need**여야 한다(같으면 평면, CH-WANT-NEED). Need는 Lie의 정확한 반대 짝(엔딩의 self-revelation = 인트로 Lie와 호응, CH-REVEAL ↔ ST-MIRROR-FRAME).
- **노출 디테일**은 반드시 사용자가 명시적으로 1~2개 고른다 — 나머지 bone structure는 빙산 아래(CH-3DIM, WT-ICEBERG).
- **아크는 게임당 1개**. 5분 게임에 Positive Change 풀아크 금지(CH-ARCFIT). 짧은 퍼즐·구출은 Flat 기본값.
- 채워진 Lie/Passion/Want는 STORY.md에 single source of truth로 고정 — 인트로 카드·막간·엔딩·bark 생성 시 모두 이 출처에서만 파생(TL-CANON-SINGLE-SOURCE).

---

## 전용 절 2 — 적/조연 게이트

명명 인물이 적이거나 유일한 조연이면 아래 게이트를 **자동 적용**한다. 인물 2~3명짜리 미니 게임에 4-corner opposition 풀버전을 강요하지 않는다.

### 적대자 게이트 (AR-SHADOW-MIRROR + CH-WORTHYFOE)
적은 '방해 장애물'이 아니라 **주인공 Lie의 극단**이어야 한다.
- **체크 1 — 같은 원형의 shadow인가?** 주인공이 Hero면 적은 Hero-shadow(타락한 영웅), Sage면 Sage-shadow(진리 독점자). 같은 원형의 빛/그림자를 주인공/적에 각각 배치하면 대조가 자동으로 선다.
- **체크 2 — 같은 것을 다른 가치로 다투는가?** 가능하면 적과 주인공이 같은 것(같은 사람/보물)을 원하게 해 보스전 한 판도 가치 충돌로 읽히게 한다.
- **체크 3 — 한 줄 동기가 본인 기준 정당한가?** '나도 한때 너처럼 믿었어.' 적도 자기 이야기의 주인공. '이유 없이 악함'은 거부.
- **노출:** 보스 등장 카드 또는 패배 화면에 적의 한 줄 동기. 색 팔레트는 주인공 계열의 어두운 변주(VectorForge)로 '같은 동전의 양면'을 시각화.

### 조연 게이트 (CH-FOIL)
조연이 1명이면 주인공의 **한 축만** 반대인 foil로 세운다.
- **체크 1 — 어떤 한 축을 비추는가?** 동기·기질·신념 중 하나만 반대(주인공이 망설일 때 즉답하는 동료). 나머지 축은 겹치게 둬야 '정반대 클리셰'를 피한다.
- **체크 2 — 대사 없이도 대비가 보이는가?** foil의 색 팔레트를 주인공과 보색으로(VectorForge/PixelForge), 행동 리듬을 반대로(juice-fx). 같은 상황에서 둘이 정반대로 반응하는 한 장면을 만든다.
- **노출:** foil 한 명이 주제를 통째로 비추므로 비용 대비 효율 최고. 별도 백스토리 없이 Passion 3개 + voice do/don't만으로 충분.

> 적과 foil은 다르다 — 적은 대적하는 어두운 거울(CH-WORTHYFOE), foil은 한 축만 반대인 대조(CH-FOIL). 한 인물이 둘을 겸할 수도 있다(적대자이면서 주인공의 망설임을 비추는 foil).

---

## 전용 절 3 — 장르별 전형 캐스트 메뉴 + 전형↔참신 비틀기 대조표

### 장르별 전형 캐스트 메뉴 (AR-GENRE-CAST)
장르 확정 후 메뉴를 카드로 제시하고 각 슬롯을 채택/비틀기 선택받는다. Phaser 장르별로 메커닉이 원형 후보를 정한다(AR-MECHANIC-MATCH). 인물 1~4명 상한이므로 한 NPC가 여러 기능을 겸한다(AR-FUNCTION-OVER-FACE).

| 장르(Phaser) | Hero(player가 채움) | Mentor/Donor | Threshold Guardian | Shadow(적) | Ally/Foil |
|---|---|---|---|---|---|
| **플랫포머** | 도약하는 모험가(Explorer) | 첫 화면에서 조작을 알려주는 늙은 안내자 | 관문을 막는 미니보스/잠긴 문 | 정상에 군림하는 Ruler-shadow 폭군 | 먼저 뛰어드는 무모한 동료(망설임 foil) |
| **슈터** | 외로운 사수(Hero/Outlaw) | 무기를 주는 정비공 Donor | 방어선·포탑 Guardian | 같은 무기를 든 Hero-shadow 에이스 | 엄호하는 동료(자기희생 foil) |
| **퍼즐** | 관찰자(Sage) | 규칙을 흘리는 수수께끼 NPC | 잠금장치·조건 게이트 | 질서를 강요하는 Ruler-shadow 설계자 | 직관으로 푸는 동료(논리 foil) |
| **러너(endless)** | 쫓기는 자(Everyman/Innocent) | 길을 알려주는 목소리(Herald) | 추격자/장애물 벽 | 끝없이 쫓아오는 Shadow 그 자체 | 같이 달리다 뒤처지는 동료(포기 foil) |
| **탑다운 액션** | 떠도는 검객(Warrior/Hero) | 비전을 주는 은둔자 Mentor | 영역 수문장 Guardian | 같은 검을 든 타락한 스승 Hero-shadow | 같은 길을 다르게 걷는 라이벌(명예 foil) |

> 주인공 슬롯은 일부러 약하게 묻고 무게를 NPC에 싣는다(AR-PLAYER-IS-HERO). 단역은 원형 한 단어·아이콘으로만 암시(AR-IMPLY-MINOR).

### 전형↔참신 비틀기 대조표 (AR-ONE-TWIST · AR-EXPECT-FIRST)
전복은 **게임당 정확히 하나**. 아래는 각 전형을 '한 군데만' 비트는 예 — 캐스트는 전형 그대로 두고 동기 한 줄·정체 한 줄·setting 한 군데만 바꾼다. 비틀기를 택하면 인트로에 복선 한 줄을 반드시 심는다(AR-TWIST-INEVITABLE).

| 전형 슬롯 | 기대(전형대로) | '한 군데만' 비틀기 | 비틀기 기법 |
|---|---|---|---|
| Mentor 노인 | 지혜를 주고 길을 연다 | 사실 player를 함정으로 보내는 False Hero | AR-TWIST-INEVITABLE, TW-BETRAYAL |
| Donor 상점 NPC | 도구를 거래로 준다 | 대가로 player의 무언가를 몰래 가져간다 | AR-DECONSTRUCT-WHY |
| 암흑군주 Shadow | 이유 없이 세계를 파괴 | 주인공이 막은 바로 그 비극을 자기도 겪었다(같은 Want의 그림자) | AR-SHADOW-MIRROR |
| 팜파탈/Shapeshifter | 주인공을 배신할 듯한 긴장 | 끝까지 충직 — 의심한 player가 틀렸다 | AR-EXPECT-FIRST 역이용 |
| 선택받은 용사(player) | 예언대로 세계를 구한다 | 예언이 거짓 / player는 '선택받지 않은' 평범한 자 | AR-LAMPSHADE→비틀기 |
| 냉정한 라이벌 | 강하고 무자비 | 냉정함은 경험 부족·겁먹음의 가면(한 줄 단서) | AR-DECONSTRUCT-WHY |
| 구출 대상 Princess | 수동적으로 구원을 기다림 | 사실 자력으로 탈출 중 / player가 늦은 것 | AR-DECONSTRUCT-WHY |
| 평화로운 setting | 안전한 마을에서 출발 | 첫 화면에서 그 마을이 불탐(경험 동기화) | AR-ONE-TWIST(setting에 예산) |

핵심 가드레일:
- **establish → flip 순서를 지킨다**(AR-EXPECT-FIRST): 인트로에서 전형대로 한 번 보여주고, 막간/엔딩에서 뒤집는다. 토대 없는 전복은 혼란일 뿐.
- **비틀기는 캐스트·메커닉·세계관 중 하나에만**(AR-ONE-TWIST): 동기 한 줄 비틀기가 가장 값싸고 강하다(캐스트는 전형 유지).
- **임의 충격 금지**(AR-TWIST-INEVITABLE): 비틀기를 택하면 인트로 환경 단서/bark 한 줄로 복선을 심어 '돌아보면 필연'이 되게 한다.

---

## 출처
- Creating Stunning Character Arcs, Pt. 2: The Lie Your Character Believes — Helping Writers Become Authors. https://www.helpingwritersbecomeauthors.com/character-arcs-2/
- Creating Your Character's Inner Conflict: Want vs. Need — Helping Writers Become Authors. https://www.helpingwritersbecomeauthors.com/your-characters-inner-conflict-want-vs-want/
- Learn 5 Types of Character Arc at a Glance: The 2 Heroic Arcs — Helping Writers Become Authors. https://www.helpingwritersbecomeauthors.com/learn-5-types-of-character-arc-at-a-glance/
- Character building with Lajos Egri — TheSupercargo. https://thesupercargo.com/character-building-with-lajos-egri/
- Storytelling in Games and Interactive Media. Chapter 5: Character Design — Game Developer. https://www.gamedeveloper.com/game-platforms/storytelling-in-games-and-interactive-media-chapter-5-character-design
- How to Write compelling villains — Novela Studio Blog. https://novela.so/en/blog/how-to-write-compelling-villains
- What is a Foil Character? How Writers Can Leverage Contrasts — Final Draft. https://www.finaldraft.com/blog/what-is-a-foil-character-how-writers-can-leverage-contrasts
- Key Character Description: Vivid, Revealing Details — Story Mastery. https://storymastery.com/key-character-description-vivid-revealing-details/
- The Anatomy of Story 22 Steps (Self-Revelation, Need, and Desire) — beabrilliantwriter / Truby handout. https://www.beabrilliantwriter.com/anatomy-of-story-truby/
- Guide: 12 Jungian Archetypes (popularized by The Hero and the Outlaw) — Personality Psychology. https://personality-psychology.com/guide-12-jungian-archetypes/
- The Eight Character Archetypes of the Hero's Journey — Mythcreants. https://mythcreants.com/blog/the-eight-character-archetypes-of-the-heros-journey/
- Vladimir Propp — Character Types & Functions (Goucher College). http://faculty.goucher.edu/eng215/vladimir_propp_character_types-functions.htm
- Fulfilling and subverting archetypes in Romancelvania — Game Developer. https://www.gamedeveloper.com/design/fulfilling-and-subverting-archetypes-in-romancelvania
- Trope or Nope: Innovation and Familiarity in Game Design — Scree Games. https://screegames.com/2024/03/26/trope-or-nope-innovation-and-familiarity-in-game-design/
- Defamiliarization in Digital Games (estranging design strategies) — ResearchGate. https://www.researchgate.net/publication/377500411_Defamiliarization_in_Digital_Games_Developing_estranging_design_strategies_through_the_analysis_of_existing_knowledge
- 5 Ways to Subvert Character Clichés and Archetypes — Now Novel. https://nownovel.com/subverting-character-cliches/
- Need vs Desire in Storytelling — What John Truby Says (CherryEdits). https://cherryedits.com/2024/12/13/lets-talk-need-vs-desire-in-storytelling-heres-what-john-truby-says/
- Archetypes of Characters in Games — Kreonit. https://kreonit.com/idea-generation-and-game-design/archetypes/
