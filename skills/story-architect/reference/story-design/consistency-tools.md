# 서사 일관성 도구 + STORY.md 스펙 + 결정 매트릭스 (TL-*)

> 작은 웹게임의 서사를 모순 없이 유지하는 경량 텍스트 자산(STORY.md 바이블·캐릭터/관계 표·연속성 린트)과 도구 채택 결정 매트릭스. 색인은 [INDEX.md](./INDEX.md), 자매 SKILL은 [../../SKILL.md](../../SKILL.md).

서사 일관성 도구는 캐릭터·세계·플롯·타임라인·관계가 작품 전체에서 모순 없이 유지되도록 돕는 참조 장치다. 소설/TV의 story bible·series bible·style sheet, 게임의 narrative bible(Anna Megill 등), 그리고 Twine·Ink·Yarn Spinner·articy:draft·Arcweave 같은 저작 도구가 이 계열에 속한다. **핵심 통찰: 도구의 가치는 '규모'에 비례한다.** 대형 도구(articy:draft, World Anvil)는 학습비용과 lock-in이 크고 짧은 미니 웹게임에는 과잉이다. WebGameForge처럼 인트로/막간/엔딩 텍스트와 환경 단서로 서사를 전하는 작은 게임에는, 무거운 도구가 아니라 **'구조화된 STORY.md 바이블 + 캐릭터 표 + 관계 매트릭스 + 연속성 린트(자동 점검 패스)'**라는 경량 텍스트 자산이 정확히 들어맞는다. 게임 매체 특수성(플레이어 선택·분기)은 canon 추적을 어렵게 만들지만, 미니 게임은 분기가 얕아 표 수준의 추적으로 충분하다.

이 파일은 사용자가 채택한 **풀 세트**(STORY.md 바이블 + 캐릭터/관계 표 + 연속성 린트)를 정식화한다. 원칙 사전(TL-*) → STORY.md 섹션 스펙 → 연속성 린트 체크리스트 → 도구 채택 결정 매트릭스 → 출처 순이다.

---

## 프레임워크 요약

이 도메인은 단일 작법이 아니라 '일관성을 떠받치는 참조 구조'들의 모음이다. 각 프레임워크에서 무엇을 빌려오고 무엇을 버리는지가 핵심이다.

| 프레임워크 | 출처 | 핵심 | WebGameForge 차용 |
| --- | --- | --- | --- |
| Story Bible / Series Bible / Style Sheet | 출판·방송 작법 전통(편집자 style sheet, showrunner series bible) | 캐릭터·설정·플롯·타임라인을 1~2페이지 'cheat sheet'로 압축. lean하게 유지. | STORY.md '스토리 바이블'의 직접 모델. series 레벨 생략, 단일 게임용 1페이지 + 캐릭터 표 + 표기 규칙만. |
| Game Narrative Bible (Anna Megill / Ubisoft) | Game Developer 기고 'Building a basic story bible for your game' | 게임 바이블 7섹션 중 **Storytelling Methods**와 **Key Objects/Locations**가 소설과 결정적 차이 — 서사를 코드/씬/환경에 어떻게 심을지 명시. living document. | STORY.md에 '각 비트를 어느 채널로 전달하는가' 표(§5 Beats의 channel 열). |
| IF 저작 도구 스펙트럼 (Twine · Ink · Yarn Spinner · articy:draft · Arcweave) | Arcweave/NarrativeFlow 비교, inkle/Yarn 공식 문서 | 텍스트 스크립트(Ink knot/stitch, Yarn node, Twine passage) vs 비주얼 DB(articy:draft, Arcweave). 공통 한계: 엔진 lock-in·학습 곡선·약한 협업. | Phaser 기반이라 Unity 밀착(Yarn)·외부 DB(articy:draft)는 부적합. **'노드+선택지+조건/변수' 데이터 모델만** 평면 dialogue JSON으로 차용. |
| Worldbuilding/Continuity 플랫폼 (World Anvil · Campfire · Obsidian · Plottr · Scrivener) | Kindlepreneur·Storyflow 비교 | 전부 '중앙 집중 바이블 + 상호 참조'로 일관성 유지. | 미니 게임엔 과잉. Obsidian의 '연결 노트' 철학(한 캐릭터=한 표) 구조만 빌려옴. 도구는 도입 안 함. |
| Relationship Map (관계 매트릭스 + 라벨드 커넥션) | Ethereality(스프레드시트 매트릭스), Soukanzu/Milanote | 매트릭스: 인물을 행/열에 중복 배치, 교차 셀에 'A가 B를 보는 시각', 5~6색 코딩, **비대칭(A→B≠B→A)은 상/하삼각 분리**. | 마크다운 표 한 장으로 방향성 있는 관계 기록(§4 Relationships). 3~6명 미니 게임에 완벽. |
| Kishōtenketsu (起承転結) | timmykokke 블로그, 한·중·일 작법 전통 | 起(도입)→承(전개)→転(전환: 논리적이되 예상 밖)→結(결말). 중심 갈등 빌드업 불필요. Mario 3D World 레벨에 적용. | 4비트가 인트로 카드/막간/반전 한 줄/엔딩 화면에 정확히 매핑. 転이 짧은 게임의 기억점. |
| Environmental Storytelling / Show-Don't-Tell | Game Developer·Wayline·Reedsy | 노출이 아니라 공간·사물·분위기·서브텍스트로 전달(Journey, Inside, Edith Finch). 언어 경제: 강한 동사·여백. | 컷신 없는 미니 게임의 서사 전달 1순위 채널. 텍스트량을 강제로 줄임. |

---

## 원칙 사전 (TL-*)

### TL-BIBLE-LEAN 린(lean) 스토리 바이블 우선
- **정의:** 서사 자산은 '바꾸기 직전에 들춰보는 1~2페이지 cheat sheet'로 유지한다. 처음부터 방대한 세계관 문서가 아니라, 미니 게임 한 편에 실제로 필요한 최소 항목(전제·톤·인물 1~4·핵심 장소·반전 한 줄)만 STORY.md에 담는다.
- **출처:** Story Bible / Style Sheet(출판·방송 작법), The Novel Smithy('1~2페이지 cheat sheet'), Writers Helping Writers('디테일을 너무 일찍 과잉 명시 말 것').
- **우리 엔진 구현(작은 웹게임):** `games/<slug>/STORY.md`를 고정 섹션(§0 메타~§10 린트 로그)으로 생성하되 각 섹션을 짧게 강제한다. 인물은 **1~4명 상한**, lore dump 금지. 인터뷰에서 '이 게임 한 편에 정말 필요한가'를 매 항목 묻고, 후속작 여지(painting yourself into a corner 회피)는 비워둔다. 바이블이 게임보다 크면 즉시 가지치기.
- **흔한 실패:** 5~10분 게임에 World Anvil급 백과사전을 만들려다 정작 게임은 못 만든다. 바이블이 게임보다 커지면 실패.
- **연관:** TL-CANON-SINGLE-SOURCE, TL-DECISION-FIT, WT-ICEBERG, ST-TEXT-BUDGET

### TL-CANON-SINGLE-SOURCE 단일 진실 원천(canon)
- **정의:** 캐릭터 이름 철자·나이·외모·관계·세계 규칙은 STORY.md 한 곳에만 정의하고, 모든 대사·인트로·엔딩 텍스트는 그것을 참조한다. 사실이 두 곳에 적히면 반드시 갈라진다.
- **출처:** Style Sheet 전통(편집자 표기 기준선), Madeleine Vasaly(연속성 도구가 추적하는 항목).
- **우리 엔진 구현(작은 웹게임):** 인물명·고유명사·핵심 수치를 STORY.md의 §8 Glossary와 §3 Characters 표에 등록하고, 이후 생성되는 모든 게임 텍스트(인트로/막간/승패/bark)는 이 표의 표기를 그대로 쓴다. `this.add.text()`로 찍히는 카드·overlay 카피와 코드의 하드코딩 문자열도 이 표를 기준으로 검증한다 — STORY.md가 single source of truth.
- **흔한 실패:** 대사 파일과 바이블에 같은 인물 설정을 중복 기재 → 한쪽만 수정하면 'blue eyes turn brown' 류 모순 발생.
- **연관:** TL-BIBLE-LEAN, TL-CONTINUITY-LINT, TL-CHAR-VOICE, DL-VOICEBIBLE

### TL-CONTINUITY-LINT 연속성 린트(자동 일관성 점검 패스)
- **정의:** 출력 직전 STORY.md를 기준으로 게임 텍스트 전체를 기계적으로 점검하는 별도 패스를 둔다. 이름 철자, 표기, 타임라인 순서, 인물 외모/나이, 장소 일관, 톤 일탈을 체크리스트로 훑는다.
- **출처:** Madeleine Vasaly('Helpful Tools for Maintaining Continuity in Fiction' — style sheet/타임라인/story map 점검), Style Sheet 전통.
- **우리 엔진 구현(작은 웹게임):** 스킬에 'continuity lint' 단계를 추가한다. (1) §8 Glossary로 고유명사 사전을 만들고 4채널 텍스트(인트로·막간·승패/엔딩·bark)와 환경 단서에서 미등록/오타 표기 검출, (2) §3의 인물별 외모·나이·voice 필드를 모든 대사·카드와 대조, (3) §5 Beats 타임라인 순서와 실제 Scene 전환 순서 대조, (4) §1 Tone 키워드 위반 후보 표시. 위반은 사람이 보게 §10 Continuity Lint Log에 리포트하고 **재생성**. 아래 '연속성 린트 체크리스트' 절이 이 패스의 정식 항목이다.
- **흔한 실패:** 린트를 작가 패스와 같은 호흡에 끼워 self-approve하면 놓친다 — 생성과 점검을 분리된 패스로.
- **연관:** TL-AUTHOR-VS-REVIEW, TL-CANON-SINGLE-SOURCE, TL-TIMELINE-ORDER, TW-FAIR-PLAY

### TL-REL-MATRIX 비대칭 관계 매트릭스
- **정의:** 인물·세력을 행/열에 두고 교차 셀에 'A가 B를 어떻게 느끼나'를 방향성 있게 기록한다. A→B와 B→A는 다를 수 있으므로 두 칸을 따로 채운다. 5~6단계(아주 가까움/우호/중립/유동/적대/원수)로 라벨링.
- **출처:** Ethereality('Mapping character and faction motivations and relationships with Excel' — 행/열 중복, 교차 셀, 5~6색, 비대칭 처리).
- **우리 엔진 구현(작은 웹게임):** 인물 1~4명이라 마크다운 표 한 장이면 충분. 스킬이 §4 Relationships 표(행=주체 A, 열=대상 B)를 생성하고 각 셀에 한 단어 라벨+한 줄 메모. 이 표가 대사 톤·bark 변형·분기 선택지 voice의 일관성 근거가 된다. 색=감정 라우팅(VectorForge/PixelForge)도 이 표의 관계 긴장에 맞춘다.
- **흔한 실패:** 관계를 양방향 동일로 가정하면 배신·짝사랑·세력 간 비대칭 긴장이 무너진다. 또한 표를 두고도 대사를 표와 안 맞추면 무의미.
- **연관:** TL-CHAR-VOICE, CH-FOIL, CH-WORTHYFOE, TW-BETRAYAL

### TL-CHAR-VOICE 캐릭터별 보이스 시트(do/don't)
- **정의:** 각 인물에 고유한 어조·어휘·말버릇을 1~3줄로 고정하고, '이 인물은 ~하게 말한다 / ~는 절대 안 한다'의 do·don't를 적는다. 여러 작가(또는 LLM 생성 반복)에서도 보이스가 흔들리지 않게 하는 장치.
- **출처:** Voice bible 작법(DL-VOICEBIBLE), Style Sheet 전통.
- **우리 엔진 구현(작은 웹게임):** §3 Characters 표에 'voice do/don't' 열을 둔다. 예) '냉소적·짧게 끊음·감탄사 없음 / 욕설 금지'. 대사·bark 생성 시 이 시트를 프롬프트 제약으로 주입하고, 린트에서 보이스 위반(예: 침묵형 인물이 장광설) 후보를 표시. bark 풀 3~6개도 같은 보이스로 통일한다. 단, 4채널 전체는 §7의 single voice(작성자 보이스)로 묶이므로, 인물 보이스 차별화는 대사·bark 안에서만 작동한다.
- **흔한 실패:** 모든 인물이 같은 톤(=작성자/모델의 디폴트 보이스)으로 수렴. 보이스 차별화 없으면 인물 구분이 사라진다.
- **연관:** TL-CANON-SINGLE-SOURCE, DL-VOICEBIBLE, DL-IDIOLECT, CH-3DIM

### TL-CHANNEL-MAP 서사 전달 채널 명시
- **정의:** 각 서사 비트를 '어떤 채널'로 전달할지 미리 못 박는다. 미니 웹게임의 채널은 인트로 카드·레벨 사이 한두 줄·승/패 화면·환경 오브젝트·간단한 대사로 한정된다(컷신 없음).
- **출처:** Anna Megill의 'Storytelling Methods'(정보를 '어떻게' 전달하는가를 정확히 정의)를 미니 규모로 축소.
- **우리 엔진 구현(작은 웹게임):** §5 Beats 표에 'channel' 열을 둔다. 예) '起=인트로 카드 2줄(game-ui-hud)', '転=마지막 레벨 환경 단서(sprite-picker/sprite-forge)+대사 1줄', '結=엔딩 화면(juice-fx tween)'. 4채널 라우팅: 인트로/타이틀 카드(≤2문장), 레벨 사이 막간(≤1문장), 승리/패배/엔딩 카드(각 ≤2문장), 환경 단서(스프라이트·배치·색), +bark(이벤트당 floating text 3~6). 분위기는 ChipAudio(무드 BGM·SFX)·VectorForge/PixelForge(색=감정)로 보강. 이걸로 '컷신에 의존' 같은 비현실적 설계를 차단.
- **흔한 실패:** 채널을 안 정하면 AAA식 컷신/긴 독백을 가정한 서사를 짜고, 실제 작은 게임에 안 들어가 버려진다.
- **연관:** TL-SHOW-NOT-TELL, ST-BEATS-AS-PLAY, GN-BARK, GN-FRAME-WINLOSE

### TL-SHOW-NOT-TELL 노출 대신 환경·서브텍스트로 보여주기
- **정의:** 배경 이야기·세계 규칙을 설명문으로 늘어놓지 않고, 배경 사물·공간·분위기·대사의 서브텍스트로 추론하게 한다. 인디 미니 게임의 기본기이자 텍스트 절약 수단.
- **출처:** Reedsy('Show, Don't Tell' — 행동·서브텍스트·환경, 언어 경제), Environmental Storytelling(Game Developer·Wayline).
- **우리 엔진 구현(작은 웹게임):** 스킬이 '이 정보를 환경 단서로 보여줄 수 있나?'를 먼저 묻고, 불가능할 때만 짧은 텍스트로 말한다. 예: 폐허 타일·깨진 표지판 스프라이트 하나(sprite-picker)로 '전쟁이 있었다'를 전달. 색 팔레트(VectorForge/PixelForge)와 BGM 무드(ChipAudio)가 분위기 노출을 대신한다. §7 Text Surfaces의 환경 단서 1~3개가 이 원칙의 산출물. 대사엔 침묵·여백·강한 동사.
- **흔한 실패:** 인트로 카드에 세계관을 3문단 쏟아붓는 'exposition dump' — 플레이어가 안 읽고, 작은 게임 분위기를 깬다.
- **연관:** TL-CHANNEL-MAP, GN-EMBED, ST-ENV-CLUE, WT-ENV-CLUE

### TL-KISHOTEN Kishōtenketsu 4비트로 압축
- **정의:** 起承転結(도입·전개·전환·결말)을 미니 게임 서사의 기본 골격으로 쓴다. 중심 갈등 빌드업이 없어 짧은 게임에 부담이 적고, 転(전환)이 기억점을 만든다.
- **출처:** Timmy Kokke('Kishōtenketsu in Video Game Design' — Mario 3D World 적용), Wikipedia, 한·중·일 작법 전통.
- **우리 엔진 구현(작은 웹게임):** §5 Beats를 4행으로 강제한다. 起=인트로 카드(인물·분위기), 承=중반 막간 한두 줄(세계 확장), 転=후반 반전(환경 단서+대사 1줄, 논리적으로 일관되되 예상 밖), 結=승/패 엔딩(선택의 결과·정서적 마무리). 각 비트는 **플레이어 행동**으로 표현하고(ST-BEATS-AS-PLAY) channel·텍스트 예산 열을 채운다. 갈등이 약한 캐주얼 게임에 특히 적합. 단, 프레임워크는 1개만 고르므로(ST-PICK-ONE) Kishōtenketsu 대신 다른 구조를 §0에서 택할 수도 있다.
- **흔한 실패:** 転을 '논리적 연결 없는 뜬금없는 반전'으로 만들면 일관성이 깨진다 — 反転은 앞선 단서에서 따라 나와야 한다.
- **연관:** TL-CHANNEL-MAP, ST-KISHO-NOCONFLICT, TW-RECONTEXT, ST-PICK-ONE

### TL-TIMELINE-ORDER 타임라인 정합성
- **정의:** 사건의 시간 순서, 인물 나이, 계절/시점이 텍스트 전반에서 모순되지 않게 유지한다. 연속성 오류의 최다 원인이 chronology lapse다.
- **출처:** Madeleine Vasaly(타임라인/달력 추적), Style Sheet 전통.
- **우리 엔진 구현(작은 웹게임):** 사건이 적으므로 STORY.md에 단순 순서 목록(또는 'before/now/after' 3칸)만 둔다. §5 Beats 순서와 일치시키고, 린트가 인트로·막간·엔딩의 시간 진술이 이 순서와 맞는지 대조한다. 회상/플래시백이 있으면 표시. §6 Twist Line의 단서 매설↔회수 역산 표와도 시점이 충돌하지 않아야 한다.
- **흔한 실패:** 막간 텍스트가 아직 안 일어난 사건을 언급하거나, 엔딩이 인트로와 시점 모순. 짧다고 방심하면 오히려 더 눈에 띈다.
- **연관:** TL-CONTINUITY-LINT, TW-PLANT-PAY, ST-MIRROR-FRAME, TL-KISHOTEN

### TL-PLAYER-AGENCY-CANON 플레이어 선택과 canon 추적
- **정의:** 분기·선택이 있으면 각 분기가 어떤 사실을 참(true)으로 만드는지 추적해야 canon이 갈라지지 않는다. 게임 매체 고유의 난점.
- **출처:** IF 저작 도구의 상태/변수 추적 모델(Ink/Yarn), 게임 매체 canon 논의.
- **우리 엔진 구현(작은 웹게임):** 분기를 얕게 유지(2~3 결말)하고, §9 Ending Variants 표에 각 결말이 가정하는 사실을 적는다. 각 변형이 같은 controlling idea의 다른 면인지 검증(WT-CHOICE-CONVERGE 정합). 깊은 상태 추적이 필요하면 그건 미니 게임 범위를 넘었다는 신호 — 스킬이 분기 축소를 권고한다. 분기 선택지는 game-ui-hud 메뉴로 띄우고 결과는 엔딩 카드로 수렴.
- **흔한 실패:** 선택지를 무분별하게 늘려 결말·후속 텍스트의 조합이 폭발 → 일관성 검증 불가. 작은 게임에서 분기는 비용임을 명시.
- **연관:** TL-DIALOGUE-SCHEMA, DL-RECONVERGE, GN-FOLDBACK, WT-CHOICE-CONVERGE

### TL-DIALOGUE-SCHEMA 단순 분기 대화 JSON 스키마
- **정의:** 대화가 필요하면 도구(Twine/Ink/Yarn) 도입 대신 최소 JSON 스키마로 노드 그래프를 표현한다: `id, speaker, text, choices[{label,next}], condition, next(-1=종료)`.
- **출처:** Ink(knot/stitch+JSON export)·Yarn Spinner(node)의 데이터 모델을 차용, NarrativeFlow 도구 비교.
- **우리 엔진 구현(작은 웹게임):** Ink/Yarn의 '노드+선택지+조건' 데이터 모델만 빌려와 Phaser에서 바로 파싱 가능한 평면 JSON으로 단순화. `speaker`는 반드시 §3 Characters 표의 표준 표기를 써서 canon·린트와 연결한다. 텍스트는 `this.add.text()` overlay로 렌더. 대부분의 미니 게임은 대화조차 없거나 선형이면 충분 — JSON은 분기 대화가 실제로 있을 때만 도입한다(결정 매트릭스의 '조건부' 항목).
- **흔한 실패:** 외부 저작 도구(articy:draft/World Anvil)를 도입해 Phaser 통합·JSON 변환·lock-in 비용을 떠안는 것. 작은 게임엔 자체 평면 JSON이 더 싸다.
- **연관:** TL-DECISION-FIT, TL-PLAYER-AGENCY-CANON, DL-RECONVERGE, DL-CHOICEVOICE

### TL-AUTHOR-VS-REVIEW 작성 패스와 검수 패스 분리
- **정의:** 서사를 '쓰는' 패스와 '일관성을 검수하는' 패스를 분리한다. 같은 호흡에서 자가 승인하면 모순을 못 본다(CLAUDE.md의 writer/reviewer 분리 원칙과 정합).
- **출처:** 편집 워크플로(작가 패스 vs 교정/연속성 패스), CLAUDE.md writer/reviewer 분리.
- **우리 엔진 구현(작은 웹게임):** 스킬 워크플로를 ①인터뷰→②바이블 생성(STORY.md §0~§9)→③텍스트 생성(작성 패스, 4채널 카피·bark·dialogue JSON)→④연속성 린트(검수 패스, 별도 단계)→⑤사람 확인으로 둔다. 검수 패스는 STORY.md만 진실로 보고 게임 텍스트를 기계적으로 대조하며, 위반은 §10 Continuity Lint Log에 적고 재생성한다. 작성과 검수는 절대 한 호흡에 합치지 않는다.
- **흔한 실패:** 한 번에 쓰고 바로 '됐다' 선언 → 이름 오타·톤 일탈·타임라인 모순이 그대로 출고.
- **연관:** TL-CONTINUITY-LINT, TL-CANON-SINGLE-SOURCE, DL-READALOUD, TW-FAIR-PLAY

### TL-DECISION-FIT 도구 선택은 규모 적합도로 (결정 매트릭스)
- **정의:** 어떤 일관성 도구를 쓸지는 '게임 규모 대비 비용/이득'으로 결정한다. 대형 도구의 학습비용·lock-in·협업 기능은 미니 웹게임에 음(-)의 가치다.
- **출처:** Arcweave 'Top 10 tools for narrative design', NarrativeFlow 'Twine vs Yarn vs Ink', Kindlepreneur 'Campfire vs World Anvil'.
- **우리 엔진 구현(작은 웹게임):** 스킬이 사용자에게 아래 '도구 채택 결정 매트릭스'를 명시적으로 제시하고 고르게 한다. 기본 권고: STORY.md 바이블·캐릭터/관계 표·연속성 린트=★강추(무료·경량·Phaser 무관), 단순 dialogue JSON=조건부(분기 대화가 있을 때만), Twine/Ink=대안(텍스트 무거운 변형 프로토타입), articy:draft/World Anvil/Yarn Spinner=비권장(학습비용·lock-in). '적합도≠인지도'를 코드화한다.
- **흔한 실패:** '프로가 쓰니까 좋다'는 이유로 articy:draft를 미니 게임에 도입 → 도구 익히다 게임을 못 만든다. 적합도≠인지도.
- **연관:** TL-BIBLE-LEAN, TL-DIALOGUE-SCHEMA, ST-PICK-ONE, ST-NO-OVERFIT

---

## (A) STORY.md 섹션 스펙

`games/<slug>/STORY.md`는 **모든 텍스트·대사의 single source of truth**이며, 거대 문서가 아니라 '초경량 카드'로 강제한다(미니게임 규모 가드레일, TL-BIBLE-LEAN). 인물은 **1~4명 상한**, lore dump 금지. 아래 11개 섹션을 그대로 생성한다.

### ## 0. 메타
- slug · 장르 · 코어 동사(코어 메커닉의 동사) · 목표 길이(분) · **선택 프레임워크 1개 + 이유**.
- 프레임워크는 ST-PICK-ONE에 따라 단 하나만(예: Kishōtenketsu / Hero's Journey / Story Spine 중 1개). 코어 동사는 GN-LUDOHARMONY 검증의 기준점.

### ## 1. Premise & Tone
- premise **한 문장**(WT-PREMISE-ONE) · tone 키워드 **1~2개**(ST-TONE-LOCK) · Story Spine **한 문단**(ST-SPINE-FIRST).
- tone은 4채널 전체와 ChipAudio 무드·색 팔레트의 1차 기준.

### ## 2. 전형↔참신
- 채택한 전형(원형·장르 클리셰)과 **전복 포인트 1개를 명시**(AR-ONE-TWIST). 전복은 '돌아보면 필연'(AR-TWIST-INEVITABLE)이어야 한다.

### ## 3. Characters (1~4명)
- 표 열: **이름 · 원형 · Want(겉욕망) · Lie(한 문장 거짓) · Ghost(상처) · Need(속필요) · Passions 3개 · 아크타입 · 노출 디테일(한 번에 하나) · voice do/don't**.
- CH-WANT-NEED·CH-LIE·CH-GHOST·CH-PASSIONS·CH-3DIM·TL-CHAR-VOICE 정합. 아크는 게임 규모에 맞게 1개만(CH-ARCFIT).

### ## 4. Relationships
- **비대칭 매트릭스**(행=주체 A, 열=대상 B). A→B ≠ B→A를 따로 채운다(TL-REL-MATRIX). 각 셀: 한 단어 라벨(아주 가까움/우호/중립/유동/적대/원수) + 한 줄 메모.

### ## 5. Beats
- 표(起承転結 또는 §0 선택 프레임워크): 열=**비트 · 요약 · 채널 · 텍스트 예산**.
- **비트=플레이어 행동**(ST-BEATS-AS-PLAY), 컷신 아님. channel은 4채널/bark 중 지정(TL-CHANNEL-MAP). 텍스트 예산은 §7 한도와 일치.

### ## 6. Twist Line
- 엔딩 반전 **한 문장** + **setup 단서 매설·회수 역산 표**(TW-PLANT-PAY) + 반전 종류 **1태그**(TW-ONE-CLEAN: 예 TW-BETRAYAL / TW-RECONTEXT / TW-UNRELIABLE 중 하나).
- 역산 표: 회수 지점(엔딩)에서 거꾸로 어느 비트·어느 채널에 단서를 심을지 명시. Fair-Play(TW-FAIR-PLAY)와 타임라인(TL-TIMELINE-ORDER) 정합.

### ## 7. Text Surfaces
- **인트로 ≤2문장 · 막간 ≤1문장 · 승패/엔딩 각 ≤2문장 · 환경 단서 1~3개 · bark 풀 3~6개**. 전부 **single voice**(WT-TONE-VOICE)로 통일.
- ST-TEXT-BUDGET·GN-BARK·DL-BARKVARY 정합. 환경 단서는 TL-SHOW-NOT-TELL의 산출물.

### ## 8. Glossary
- 고유명사 **표준 표기** 표(이름·표기·짧은 정의). canon의 사전이자 린트의 조회 테이블(TL-CANON-SINGLE-SOURCE).

### ## 9. Ending Variants
- 분기 시 **2~3개**. 각 결말이 **가정하는 사실**과 **같은 controlling idea의 다른 면인지** 명시(TL-PLAYER-AGENCY-CANON, WT-CHOICE-CONVERGE). 분기는 얕게 유지.

### ## 10. Continuity Lint Log
- 검수 패스(TL-AUTHOR-VS-REVIEW)의 **위반·해소 기록**. 각 항목: 위반 코드(아래 체크리스트 a~i) · 위치 · 조치 · 재생성 여부.

---

## (B) 연속성 린트 체크리스트

작성과 **분리된 검수 패스**다(TL-AUTHOR-VS-REVIEW). STORY.md를 단일 진실로 삼아 4채널 텍스트·bark·dialogue JSON·환경 단서를 기계적으로 대조한다. 위반은 §10 Continuity Lint Log에 리포트한 뒤 **재생성**한다. self-approve 금지.

| 코드 | 점검 항목 | 무엇을 대조하나 | 근거 원칙 |
| --- | --- | --- | --- |
| (a) 톤 일관성 | §1 Tone 키워드를 4채널·bark가 전부 지키는가. 톤 일탈 후보 표시. | §1 Tone ↔ §7 Text Surfaces 전부 | WT-TONE-VOICE, GN-CONSISTENCY |
| (b) Opening↔Final 거울쌍 | 인트로 카드와 엔딩 카드가 거울로 호응하는가(같은 모티프·구도 회수). | 인트로 ↔ 승/패·엔딩 | ST-MIRROR-FRAME, WT-MOTIF-THREAD |
| (c) Want↔Need 분리 / 인트로 Lie↔엔딩 self-revelation | Want과 Need가 분리됐는가, 엔딩의 자기각성이 인트로에 심은 Lie에 호응하는가. | §3 Want·Lie·Need ↔ 인트로·엔딩 | CH-WANT-NEED, CH-LIE, CH-REVEAL |
| (d) Fair-Play | 반전의 근거가 1회차에 노출됐는가. 숨기지 않고 시선만 돌렸는가(cheat 탐지). | §6 Twist 단서 ↔ 1회차 채널 노출 | TW-FAIR-PLAY, TW-HIDE-PLAIN |
| (e) Payoff | §6 역산 표의 단서·red herring이 전부 회수됐는가(미회수 단서/오발 미끼 탐지). | §6 매설 ↔ 엔딩 회수 | TW-PLANT-PAY, TW-RED-HERRING |
| (f) 코어 동사=주제 | §0 코어 동사가 §1 premise/테마를 논증하는가(메커닉=메시지). | §0 코어 동사 ↔ §1 premise | GN-LUDOHARMONY, WT-ACTION-ARGUES |
| (g) 채널별 텍스트 예산 초과 | 인트로≤2·막간≤1·승패/엔딩≤2·환경1~3·bark3~6 한도를 넘었는가. | §7 한도 ↔ 실제 카피 길이 | ST-TEXT-BUDGET, TL-CHANNEL-MAP |
| (h) Glossary 표기·타임라인 정합 | 고유명사 표기 오타/미등록, 사건 순서·인물 나이·시점 모순. | §8 Glossary·§5 순서 ↔ 4채널 텍스트 | TL-CANON-SINGLE-SOURCE, TL-TIMELINE-ORDER |
| (i) 고아 참조(캐릭터 삭제 후유증) | §3에서 **삭제된 인물**명이 §4 Relationships 행/열·§6 Twist 단서·§7 bark 풀·§8 Glossary·4채널 텍스트에 잔존하는가. 잔존 시 함께 제거·재배치. | §3 삭제 인물 ↔ §4/§6/§7/§8·4채널 | TL-CANON-SINGLE-SOURCE, TL-REL-MATRIX |

추가로 voice 위반(침묵형 인물의 장광설 등, TL-CHAR-VOICE)과 관계 표 불일치(대사 톤이 §4 매트릭스와 어긋남, TL-REL-MATRIX)도 같은 패스에서 후보로 표시한다.

---

## (C) 도구 채택 결정 매트릭스

스킬은 큰 도구를 권하려는 유혹을 **명시적으로 억제**하고 '규모 적합도'를 결정 기준으로 제시한다(TL-DECISION-FIT). 사용자가 직접 고르게 한다.

| 도구 | 무엇 | 비용 | 이득 | 미니게임 적합도 | 권고 |
| --- | --- | --- | --- | --- | --- |
| **풀 세트: STORY.md 바이블 + 캐릭터/관계 표 + 연속성 린트** | 1페이지 마크다운 바이블(§0~§10) + 마크다운 표 + 검수 패스 | 무료·경량·Phaser 무관·학습 0 | single source of truth, 비대칭 관계, 자동 일관성 점검 | ★★★ (1~4명·5~10분 게임에 정확히 맞음) | **강추(기본값)** |
| 단순 분기 대화 JSON | `id/speaker/text/choices/condition/next` 평면 JSON, Phaser 직접 파싱 | 낮음(스키마 한 장) | 얕은 분기 대화를 도구 없이 표현, canon 연결 | ★★ (분기 대화가 실제로 있을 때만) | **조건부** (대화 없거나 선형이면 불필요) |
| Twine | passage 기반 비주얼 플로차트, 입문 쉬움 | 중(규모에서 지저분, export 정리 필요) | 텍스트 무거운 변형 프로토타이핑 | ★ (텍스트 비중 큰 변형 한정) | **대안** (프로토타입용) |
| Ink (inkle) | knot/stitch 스크립트 + JSON export 내장 | 중(스크립트 학습) | 풍부한 분기·변수, 런타임 통합 | ★ (대사 분량 큰 게임 한정) | **대안** (필요 시 데이터 모델만 차용) |
| articy:draft | 비주얼 flowchart + 오브젝트 DB + 팀 협업 | 높음(구독·학습·Phaser 변환·lock-in) | 대형 분기 서사·팀 협업 | ✕ (미니 게임에 음의 가치) | **비권장** |
| World Anvil | 상호링크 위키·지도·타임라인·family tree | 높음(대형 세계관 전제·학습) | 방대한 worldbuilding 관리 | ✕ (백과사전 과잉) | **비권장** |
| Yarn Spinner | node 기반 마크업, Unity 밀착 | 높음(Unity lock-in) | Unity 대화 시스템 | ✕ (Phaser와 부적합) | **비권장** |

기본 결정: **풀 세트 = 강추**, 분기 대화 JSON = 조건부, Twine/Ink = 대안(프로토타입·텍스트 무거운 변형), articy:draft/World Anvil/Yarn Spinner = 비권장. 깊은 상태 추적이 필요해지면 그것은 미니 게임 범위 초과 신호이며, 스킬은 도구 도입이 아니라 **분기 축소**를 권고한다(TL-PLAYER-AGENCY-CANON).

---

## 출처

- Building a basic story bible for your game — Anna Megill (Game Developer): https://www.gamedeveloper.com/design/building-a-basic-story-bible-for-your-game
- Top 10 tools for narrative design — Arcweave blog: https://blog.arcweave.com/top-10-tools-for-narrative-design
- Twine vs Yarn Spinner vs Ink — NarrativeFlow: https://narrativeflow.dev/blog/twine-vs-yarn-spinner-vs-ink-vs-narrativeflow-which-branching-dialogue-tool-is-right-for-your-game/
- How to Create a Story Bible for Your Novel — The Novel Smithy: https://thenovelsmithy.com/create-a-story-bible/
- Helpful Tools for Maintaining Continuity in Fiction — Madeleine Vasaly: https://www.madeleinevasaly.com/blog/2022/8/3/tools-for-maintaining-continuity-in-fiction
- Top Story World and Story Bible Tips — Writers Helping Writers: https://writershelpingwriters.net/2024/04/top-story-world-and-story-bible-tips/
- Kishōtenketsu in Video Game Design — Timmy Kokke: https://timmykokke.com/blog/2023/2023-05-17-kishotenketsu/
- Mapping character and faction motivations and relationships with Excel — Ethereality: https://www.ethereality.info/ethereality_website/about_me/wordpress/?p=2499
- Campfire vs World Anvil — Kindlepreneur: https://kindlepreneur.com/campfire-vs-world-anvil/
- Show, Don't Tell — Reedsy: https://blog.reedsy.com/show-dont-tell/
