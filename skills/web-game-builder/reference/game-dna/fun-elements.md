# 재미 요소 사전 & 조합 플레이북

> WebGameForge가 "어떤 게임 만들지" 물어볼 때 쓰는 핵심 자료. 게임의 재미를 **재사용 가능한 요소(FE-*)**로 분해하고, 코어 루프와 조합하는 법을 담는다. 게임별 분석은 [INDEX.md](./INDEX.md)의 장르 파일 참고.

## 1. 재미요소 사전 (FE-*)

각 요소는 정의 → 대표 게임 → 우리 엔진 구현 → 조합 주의 순으로 정리한다.

### FE-JUST-ONE-MORE 한 판 더
- **정의:** 한 판이 수십 초~2분으로 짧고 죽으면 즉시 재시작돼 점수·기록 갱신 욕구가 끊기지 않는 짧은 루프. 패배가 곧 다음 시도의 연료가 된다.
- **대표 게임:** Flappy Bird, 2048, Geometry Wars, Subway Surfers
- **우리 엔진 구현:** endless-runner/arcade-classic 스캐폴드의 게임오버→Title 즉시 전환을 0.5초 이내로 단축하고 Title을 건너뛰는 '재시작' 핫스타트 경로를 둔다. localStorage로 highscore 영속화 후 game-ui-hud로 'BEST' 라인을 항상 노출. juice-fx의 짧은 die 셰이크(120ms)+팝업으로 패배 임팩트를 주되 재시작 지연은 없게 한다.
- **조합 주의:** 멀티레벨 진행·긴 컷신·로딩과 충돌. 한 판이 2분을 넘으면 재시작 비용이 커져 '한 판 더'가 깨진다. FE-NARRATIVE와 묶을 때는 서사를 짧은 막간으로 쪼갠다.

### FE-FLOW 몰입 흐름
- **정의:** 입력→반응이 즉각적이고 관성·리듬이 끊기지 않아 손과 화면이 한 몸처럼 느껴지는 상태. 멈춤·로딩·뻑뻑한 조작이 흐름을 깬다.
- **대표 게임:** Celeste, Canabalt, Tetris, Doodle Jump
- **우리 엔진 구현:** platformer-game/super-runner 레시피의 가변 점프+코요테타임+점프버퍼를 적용해 입력 관용도를 높인다. Arcade 물리에서 가속/감속(drag, maxVelocity)을 튜닝하고 perf-60fps로 프레임 드랍을 제거(오브젝트 풀링 필수). 카메라 추적은 lerp로 부드럽게.
- **조합 주의:** 순수 턴제 사고형 퍼즐(FE-AHA 중심)과는 리듬축이 달라 한 장면에 섞으면 둘 다 약해진다. 과한 히트스톱·긴 셰이크는 오히려 흐름을 끊으니 80ms 이내로.

### FE-MASTERY 숙련 표현
- **정의:** 실력 천장이 높아 반복할수록 더 잘하게 되고, 자기 기록 경신·스피드런으로 숙련이 가시화되는 보상.
- **대표 게임:** Super Meat Boy, Cuphead, Geometry Dash, Jump King
- **우리 엔진 구현:** 고스트 리플레이(입력 타임라인을 localStorage에 기록 후 반투명 스프라이트로 재생)와 타임어택 모드를 둔다. game-ui-hud로 베스트/현재 기록 동시 표시. 결정론적 물리(고정 dt step, super-runner의 step(t,dt) 패턴)로 같은 입력이 같은 결과를 보장해 연습이 누적되게 한다.
- **조합 주의:** FE-SURPRISE(매판 RNG)와 정면충돌—난수가 크면 기록 비교가 무의미해진다. 숙련을 강조하려면 RNG는 시드 고정 또는 최소화.

### FE-RISK-REWARD 위험-보상
- **정의:** 더 욕심내면 보상이 크지만 잃을 위험도 커지는 푸시유어럭 선택. 멈출지 더 갈지를 매 순간 저울질하게 만든다.
- **대표 게임:** Alto's Odyssey, Crossy Road, Pac-Man, Snake
- **우리 엔진 구현:** 콤보 멀티플라이어를 누적시키되 피격 시 0으로 리셋하는 변수 하나로 구현. '지금 정산' 버튼 또는 안전지대 도달 시 확정. game-ui-hud로 현재 배율을 크게 띄워 잃을 게 보이게 한다. topdown-shooter의 봄 자원처럼 '아껴둔 카드를 언제 쓸지' 형태로도 변주.
- **조합 주의:** FE-FAIRNESS와 균형 필요—욕심내다 죽었을 때 '내 선택이었다'가 납득돼야 한다. 즉사+높은 RNG가 겹치면 위험-보상이 도박처럼 느껴져 불공정해진다.

### FE-SURPRISE 변주·무작위
- **정의:** 절차생성·RNG로 매 판의 배치·아이템·적이 달라져 외움이 안 통하고 늘 새롭다.
- **대표 게임:** The Binding of Isaac, Nuclear Throne, Brotato, Doodle Jump
- **우리 엔진 구현:** level-designer로 청크/룸 단위 절차 조립(미리 만든 안전한 패턴 풀에서 무작위 시퀀싱). 시드 기반 PRNG(Phaser.Math.RND.sow)로 재현/공유 가능하게. 아이템·적 테이블을 데이터로 분리해 weighted random 추출.
- **조합 주의:** FE-MASTERY(기록 경신)·정밀 스피드런과 충돌. 무작위가 즉사를 만들면 FE-FAIRNESS를 깨므로 '회피 가능한 배치만' 생성하도록 검증 규칙을 둔다.

### FE-COLLECT 수집·성장
- **정의:** 코인·업그레이드·언락·메타 progression을 모으며 캐릭터/선택지가 커지는 장기 보상.
- **대표 게임:** Subway Surfers, Jetpack Joyride, Hollow Knight, Vampire Survivors
- **우리 엔진 구현:** localStorage 기반 메타 저장(코인·해금 플래그). DataManager로 런타임 상태 관리, game-ui-hud로 수집 카운터·진행 바. 서버 없는 단일플레이라 가챠/시즌 메타는 ❌—해금 트리·업그레이드 상점 같은 로컬 progression으로 축소 재현.
- **조합 주의:** 수집 그라인드가 길면 FE-JUST-ONE-MORE의 즉시성과 충돌. 무한 성장은 FE-MASTERY(실력)를 '시간 투자'로 대체해 실력 천장을 흐릴 수 있다.

### FE-COMBO 연쇄·콤보
- **정의:** 한 동작이 다음을 연쇄로 터뜨리거나 멀티플라이어가 누적돼 작은 입력이 큰 결과로 증폭되는 쾌감.
- **대표 게임:** Candy Crush Saga, Fruit Ninja, Geometry Wars, Alto's Odyssey
- **우리 엔진 구현:** puzzle-game의 매치→중력낙하→리필→재매치 캐스케이드 루프, 또는 처치 간 타이머로 콤보 유지. juice-fx로 콤보 단계마다 셰이크·파티클·SFX 피치를 올려 증폭감을 청각화. 콤보 카운터는 game-ui-hud에 큼직하게.
- **조합 주의:** 콤보 연출이 과하면 FE-FLOW 입력 리듬을 가린다. FE-CONSTRAINT(제한 수) 퍼즐과 묶을 때 캐스케이드 난수가 운 의존을 키우면 FE-AHA(계획성)를 해친다.

### FE-TIMING 타이밍·리듬
- **정의:** 정확한 순간의 탭·비트 맞추기가 핵심이 되는 박자 기반 재미. 한 프레임 차이가 성패를 가른다.
- **대표 게임:** Geometry Dash, Stack, Cut the Rope, Cuphead
- **우리 엔진 구현:** chip-sound BGM의 BPM을 기준 클록으로 삼아 장애물/발판/입력 윈도를 비트에 정렬(time.now % beatMs). 판정 윈도(perfect/good)를 ms로 정의하고 game-ui-hud로 판정 피드백. arcade-classic Stack식 좌우 왕복 후 탭-정지도 동일 타이머로.
- **조합 주의:** FE-EXPLORE(느긋한 탐험)와 리듬축이 달라 섞이지 않는다. 박자 강제는 FE-EXPRESSION(자유 표현)을 제약하니 둘 중 하나를 주인공으로.

### FE-POWER-FANTASY 파워 판타지
- **정의:** 성장이 화면을 압도해 적떼를 쓸어담는 무력감의 반대—압도적 강함의 쾌감.
- **대표 게임:** Vampire Survivors, Brotato, The Binding of Isaac
- **우리 엔진 구현:** topdown-shooter 자동발사+레벨업 3택 빌드. 적은 오브젝트 풀로 대량 스폰하되 모바일은 동시 60~100체 상한+간단 AI(moveTo)로 부하 관리. juice-fx 파티클은 화면당 2~3 emitter 제한을 지키며 처치 이펙트를 batch 처리.
- **조합 주의:** FE-TENSION(아슬아슬)과 반대 곡선—초반 약함과 후반 압도의 대비로 설계해야 둘 다 산다. 모바일에서 대량 적+파티클은 perf-60fps 한계, 절차 무한증식은 ❌에 가까움.

### FE-TENSION 긴장·니어미스
- **정의:** 아슬아슬하게 피했을 때의 짜릿함. 죽음이 코앞일수록 회피 성공의 쾌감이 커진다.
- **대표 게임:** Flappy Bird, Canabalt, Pac-Man, Geometry Wars
- **우리 엔진 구현:** 히트박스를 시각 스프라이트보다 약간 작게 잡아 '거의 닿았는데 살았다'를 자주 만든다. 니어미스 감지 시(근접 거리 임계) slow-mo(time.timeScale 0.5 짧게)+효과음으로 보상. juice-fx 비네팅/화면 가장자리 붉은 펄스로 위기 가시화.
- **조합 주의:** FE-NARRATIVE 젠 분위기·FE-EXPRESSION 샌드박스와 충돌. 지속적 고긴장은 FE-FLOW를 피로하게 하므로 압박-완화 파동을 둔다.

### FE-AHA 통찰·아하
- **정의:** 규칙을 발견하거나 해법이 머릿속에서 '딱' 맞아떨어지는 순간의 쾌감. 손보다 머리가 푸는 재미.
- **대표 게임:** Baba Is You, 2048, Cut the Rope, Angry Birds
- **우리 엔진 구현:** puzzle-game의 보드모델/렌더 분리 위에 결정론적 규칙을 둔다(같은 입력=같은 결과). 되돌리기(undo 스택)와 빠른 재시도로 가설검증 비용을 낮춘다. 힌트는 단계적으로. 물리 퍼즐은 Matter(⚠️)보다 단순 임펄스 모델을 우선.
- **조합 주의:** FE-ESCALATION 시간압박과 섞으면 사고할 여유가 사라져 아하가 죽는다. 정답이 RNG에 좌우되면(FE-SURPRISE) 통찰이 운으로 오염된다.

### FE-BUILD 빌드·시너지
- **정의:** 아이템·능력을 골라 조합하며 매 런 다른 시너지를 설계하는 묘미. 선택이 곱연산으로 작동한다.
- **대표 게임:** Vampire Survivors, Brotato, The Binding of Isaac, Nuclear Throne
- **우리 엔진 구현:** 무기/패시브를 데이터 테이블로 정의하고 레벨업 시 3택 카드 UI(game-ui-hud)를 띄운다. 효과는 스탯 가산/곱산 스택으로 합성, evolution 조건(무기 만렙+짝 패시브)을 룩업으로. topdown-shooter 자동발사 슬롯에 얹는 게 가장 자연스럽다.
- **조합 주의:** 선택지가 많으면 FE-JUST-ONE-MORE의 즉시성·FE-FLOW를 끊는다(카드 화면=멈춤). 빌드 깊이는 단일플레이 한 세션 안에서 닫히게 설계, 서버 메타 의존 ❌.

### FE-ESCALATION 점증 압박
- **정의:** 시간이 갈수록 속도·밀도·난도가 올라가 결국 무너지는 구조. 끝이 정해진 압박이 긴장을 만든다.
- **대표 게임:** Tetris, Canabalt, Subway Surfers, Jetpack Joyride
- **우리 엔진 구현:** speed = base + elapsed*factor 선형 가속(endless-runner 레시피)이 밸런스가 가장 쉽다. 스폰 간격 단축, 패턴 풀 난도 단계 전환. game-ui-hud로 현재 단계/속도 표시.
- **조합 주의:** FE-AHA·FE-EXPRESSION처럼 여유가 필요한 재미를 압살한다. FE-NARRATIVE 분위기 감상과도 충돌. 가속이 FE-FAIRNESS를 깨지 않게 '반응 가능 속도' 상한을 둔다.

### FE-EXPRESSION 자기표현·창의
- **정의:** 샌드박스·커스터마이즈로 플레이어가 자기만의 결과/스타일을 만드는 재미.
- **대표 게임:** World of Goo, Geometry Dash, Alto's Odyssey
- **우리 엔진 구현:** 스킨/팔레트 커스터마이즈(PixelForge 팔레트 교체, VectorForge 색 파라미터)를 옵션화. 단순 빌더(발판/구조물 배치)는 그리드 스냅 에디터로. 결과를 스크린샷/시드로 공유(FE-SOCIAL 연계).
- **조합 주의:** 엄격한 FE-TIMING·FE-ESCALATION이 자유를 제약한다. 본격 레벨에디터·UGC 공유 인프라는 서버 필요라 ❌, 로컬 커스터마이즈로 축소 재현.

### FE-NARRATIVE 서사·분위기
- **정의:** 미스터리·톤·아트·사운드가 플레이를 끌고 가는 분위기 주도형 재미. 명시적 스토리보다 atmosphere.
- **대표 게임:** Hollow Knight, Ori and the Blind Forest, Monument Valley, Celeste
- **우리 엔진 구현:** VectorForge 그라데이션/글로우+패럴랙스 다층 배경+chip-sound의 무드 BGM 레이어로 톤을 만든다. 동적 시간대/날씨 그라데이션(Alto식)으로 '예쁜 한 판'. 텍스트는 짧은 막간으로, 컷신은 최소화.
- **조합 주의:** FE-ESCALATION·고긴장 시간압박과 충돌(감상 여유 소멸). 단일플레이 2D 절차 에셋 한계로 방대한 월드/보이스는 ❌, 무드·암시 중심으로.

### FE-EXPLORE 탐험·발견
- **정의:** 개방형 맵에서 길을 찾고 비밀·새 지역을 발견하는 재미. 능력 게이트로 잠긴 곳을 나중에 여는 메트로배니아 동선.
- **대표 게임:** Hollow Knight, Ori and the Blind Forest, Monument Valley
- **우리 엔진 구현:** tilemap 기반 연결 룸(level-designer), 능력 해금 플래그로 게이트 개폐. 미니맵(game-ui-hud)과 발견 마커. 단일플레이 축소판: 한 화면씩 이어지는 소규모 맵+비밀방 2~3개.
- **조합 주의:** 대규모 콘텐츠/장시간 플레이라 FE-JUST-ONE-MORE 즉시성과 상충. 방대한 월드는 절차 에셋·코드생성 신뢰도상 ⚠️, 작게 시작해야 한다.

### FE-JUICE 감각 피드백
- **정의:** 스크린셰이크·파티클·사운드·스쿼시스트레치가 만드는 '손맛'. 같은 메카닉도 주스가 있으면 만족도가 배가된다.
- **대표 게임:** Geometry Wars, Fruit Ninja, Shovel Knight, Angry Birds
- **우리 엔진 구현:** juice-fx 전부—spark 텍스처 burst, 셰이크(50~200ms), 히트스톱(≤80ms), 스쿼시/스트레치 트윈, 팝업 텍스트. chip-sound로 이벤트마다 SFX. 모바일은 동시 emitter 2~3개·count≤6 제한 준수.
- **조합 주의:** '적게, 정확하게'—모든 이벤트에 다 쓰면 감각이 마비되고 FE-FLOW를 가린다. 과한 셰이크(magnitude>0.01)는 멀미. 저사양은 트윈 조각으로 대체.

### FE-SOCIAL 경쟁·공유
- **정의:** 리더보드·점수 자랑·따라하기로 남과 비교하며 동기를 얻는 재미.
- **대표 게임:** Flappy Bird, Jetpack Joyride, Geometry Dash
- **우리 엔진 구현:** 서버 없으니 로컬 리더보드(localStorage 상위 N)+고스트 셀프 경쟁이 기본. 점수/시드 문자열을 클립보드 복사·URL 쿼리(?seed=)로 '같은 판 도전' 공유. 결과 스크린샷 캡처 버튼.
- **조합 주의:** 온라인 글로벌 랭킹·친구 비교·실시간 멀티는 서버 필요라 ❌. 공유는 '내 기록 자랑'까지로 한정. FE-NARRATIVE 몰입형엔 군더더기일 수 있다.

### FE-FAIRNESS 공정한 죽음
- **정의:** '내 실수였다'고 납득되는 죽음. 죽음의 원인이 명확하고 회피 가능했어야 재도전 의욕이 생긴다.
- **대표 게임:** Celeste, Super Meat Boy, Snake, Geometry Wars
- **우리 엔진 구현:** 즉사 함정은 충분히 텔레그래프(예고 모션/색)하고 히트박스는 관대하게(시각보다 작게). 결정론적 물리로 같은 입력=같은 결과 보장. 화면 밖 기습 금지—스폰은 화면 안 가시 영역에서. 데스 리플레이로 원인 제시 가능.
- **조합 주의:** FE-SURPRISE 고RNG·화면 밖 기습과 정면충돌. FE-ESCALATION 가속이 인간 반응 한계를 넘으면 '불공정'으로 느껴진다.

### FE-CONSTRAINT 제약 퍼즐
- **정의:** 제한된 이동 수·자원 안에서 최적해를 찾는 재미. 자원이 적을수록 한 수의 무게가 커진다.
- **대표 게임:** 2048, Threes, Candy Crush Saga, Angry Birds
- **우리 엔진 구현:** 이동/발사/점프 횟수를 카운터로 제한하고 game-ui-hud에 잔여 자원을 크게. 별 1~3 판정으로 최적화 동기 부여. puzzle-game 보드모델+undo로 시행착오 저비용. 스테이지 클리어형이라 무한 대신 정해진 목표.
- **조합 주의:** FE-ESCALATION 시간압박을 같이 걸면 최적화 사고 시간이 없어진다(둘 중 하나만). FE-SURPRISE가 크면 같은 제약도 매번 운이라 최적해 학습이 안 된다.

### FE-EMERGENCE 창발·시스템 상호작용
- **정의:** 규칙들이 상호작용해 설계자도 예상 못한 해법·상황이 생기는 재미. 시스템을 도구로 비틀어 푸는 자유.
- **대표 게임:** Baba Is You, World of Goo, The Binding of Isaac
- **우리 엔진 구현:** 속성을 데이터로 분리한 규칙 엔진(객체에 isPush/isWin/isYou 같은 플래그 비트마스크)과 매 틱 규칙 재평가 루프. 단순·조합 가능한 소수 규칙이 핵심—규칙 수보다 상호작용 깊이. 결정론 유지로 검증 가능.
- **조합 주의:** 창발은 버그와 종이 한 장—테스트(game-qa) 필수. FE-ESCALATION 실시간 압박과 섞으면 시스템을 음미할 시간이 없다. 규칙 폭발은 코드생성 신뢰도 ⚠️.

## 2. 조합 플레이북 (검증된 레시피)

각 패턴은 레시피 → 예시 신작 → 왜 재밌나 순으로 정리한다.

### 리듬 정밀 러너 (Rhythm Precision Runner)
- **레시피:** 코어 루프: endless-runner 자동전진 + FE-TIMING + FE-MASTERY + FE-FAIRNESS
- **예시 신작:** 네온 도시 옥상을 자동질주하는 다람쥐가 BGM 비트에 맞춰 탭 한 번으로 가시·갭을 넘고 진행률 %를 갱신하는 원탭 리듬 러너.
- **왜 재밌나:** chip-sound BPM 클록에 장애물을 정렬하면(FE-TIMING) 음악이 곧 난이도 예고가 되어 죽음이 공정(FE-FAIRNESS)해지고, 결정론적 코스라 반복할수록 더 잘하게 돼(FE-MASTERY) '한 판 더'가 자연 발생한다. endless-runner 스캐폴드+game-ui-hud 진행% 표시, 화면전체 탭 입력이 모바일과 완벽히 맞는다.

### 불릿헤븐 러너 (Bullet-Heaven Runner)
- **레시피:** 코어 루프: endless-runner + FE-BUILD + FE-POWER-FANTASY + FE-COLLECT
- **예시 신작:** 끝없이 달리며 좌우로 자동 사격하는 로봇이 일정 거리마다 무기/패시브 3택 카드를 골라 점점 화면을 정리하는 러너형 서바이버.
- **왜 재밌나:** 러너의 즉시성에 Vampire Survivors식 레벨업 3택(FE-BUILD)을 얹어 30초마다 체감 성장(FE-COLLECT)을 주고 후반 압도(FE-POWER-FANTASY)로 카타르시스를 만든다. endless-runner+topdown-shooter 자동발사 슬롯 혼합, 카드 UI는 game-ui-hud, 적/탄은 오브젝트 풀+perf-60fps로 부하 관리. 카드 화면이 러너의 자연스러운 페이스 완급이 된다.

### 매치3 무기 장전 슈터 (Match-to-Fire Arena)
- **레시피:** 코어 루프: topdown-shooter + FE-COMBO + FE-AHA + FE-BUILD
- **예시 신작:** 적을 처치하면 색 타일이 하단 보드에 떨어지고, 같은 색 3개를 스왑 정렬하면 그 색의 광역기가 발동하는 퍼즐-장전 트윈스틱 슈터.
- **왜 재밌나:** 슈팅의 즉각성에 매치3 캐스케이드(FE-COMBO)와 '어떤 색을 먼저 터뜨릴까'의 판단(FE-AHA)을 결합해 손과 머리를 동시에 쓴다. 색=무기 매핑이 빌드 선택(FE-BUILD)을 만든다. topdown-shooter+puzzle-game 보드모델을 렌더 분리 유지로 합성, 광역기 발동에 juice-fx 풀 패키지.

### 제약 물리 발사 퍼즐 (One-Shot Physics Puzzle)
- **레시피:** 코어 루프: arcade-classic 발사체 + FE-AHA + FE-CONSTRAINT + FE-JUICE
- **예시 신작:** 한 화면 당구대에서 제한된 3발의 임펄스로 슬라임 무리를 벽과 서로에게 튕겨 연쇄 제거하는 한 방 퍼즐, 남은 발수로 별 1~3개.
- **왜 재밌나:** 발사 각도/세기의 통찰(FE-AHA)과 '몇 발 안에'라는 제약(FE-CONSTRAINT)이 최적화 동기를 만들고, 충돌·파편 juice(FE-JUICE)가 한 방의 손맛을 보상한다. 정밀 강체는 Matter(⚠️) 대신 단순 임펄스+반사(Arcade)로 신뢰도 확보, game-ui-hud 잔여 발수+별 판정. 단발 승부라 즉시 재도전된다.

### 규칙조작 그리드 퍼즐 (Rule-Bending Puzzle)
- **레시피:** 코어 루프: puzzle-game 그리드 + FE-AHA + FE-EMERGENCE + FE-CONSTRAINT
- **예시 신작:** 한 칸씩 캐릭터를 밀어 'WALL IS WIN' 'SPIKE IS YOU' 같은 단어블록을 재배열해 승리 조건 자체를 바꿔 출구에 닿는 소코반형 규칙조작 퍼즐.
- **왜 재밌나:** 규칙을 도구로 비틀어(FE-EMERGENCE) 예상 밖 해법을 찾는 아하(FE-AHA)가 핵심이고, 작은 보드와 적은 단어(FE-CONSTRAINT)가 해 공간을 음미 가능하게 한다. puzzle-game 보드모델+비트마스크 규칙엔진(isPush/isWin/isYou) 매 틱 재평가, 물리 불필요, undo로 가설검증 저비용, game-qa로 창발 버그 검증 필수.

### 역전 푸시유어럭 호퍼 (Reversal Push-Your-Luck Hopper)
- **레시피:** 코어 루프: arcade-classic 그리드 호퍼 + FE-RISK-REWARD + FE-TENSION + FE-FAIRNESS
- **예시 신작:** 흐르는 차도·강을 한 탭으로 한 칸씩 건너되, 추격자에게 둘러싸였을 때만 먹을 수 있는 '역전 코어'를 깔아 위기에서 잠깐 사냥꾼이 되는 욕심 호퍼.
- **왜 재밌나:** 멈추면 죽고 욕심내면 더 먹는 매 칸의 저울질(FE-RISK-REWARD)과 아슬한 회피(FE-TENSION)가 Crossy Road×Pac-Man을 만든다. 흐름이 예측 가능해 죽음이 납득(FE-FAIRNESS)된다. arcade-classic 그리드 이동+레인 스폰 타이머, 니어미스 slow-mo(juice-fx), 역전 코어는 근접 적 수 임계로 토글.

### 수직 빌드 점퍼 (Vertical Build Jumper)
- **레시피:** 코어 루프: endless-runner(수직 점퍼) + FE-SURPRISE + FE-RISK-REWARD + FE-COLLECT
- **예시 신작:** 자동 점프로 발판을 타고 끝없이 올라가는 슬라임이 절차생성 발판·적·파워업 사이에서 '깨지는 높은 발판 vs 안전한 낮은 발판'을 고르며 도달 높이를 갱신하는 수직 점퍼.
- **왜 재밌나:** Doodle Jump식 매판 다른 배치(FE-SURPRISE)와 위험한 점프의 보상(FE-RISK-REWARD), 파워업 수집(FE-COLLECT)이 짧은 루프에 변주를 준다. endless-runner를 수직축(카메라 scrollY)으로 전환, level-designer 발판 청크 풀 절차 시퀀싱+시드 PRNG, 회피 가능 검증으로 FE-FAIRNESS 보존. 좌우 기울기/탭만으로 모바일 친화.

### 점증 스택 타워 (Escalating Stack Tower)
- **레시피:** 코어 루프: arcade-classic(Stack) + FE-TIMING + FE-COMBO + FE-ESCALATION
- **예시 신작:** 좌우로 미끄러지는 블록을 정점에서 탭해 멈춰 쌓되, perfect로 맞추면 콤보 배수가 오르고 빗나가면 폭이 깎여 점점 좁아지는 원탭 타이밍 타워.
- **왜 재밌나:** 단일 탭 타이밍(FE-TIMING)에 perfect 연속 콤보(FE-COMBO)와 점점 좁아지는 점증 압박(FE-ESCALATION)이 겹쳐, 30초에 수십 층을 쌓는 '한 판 더'가 된다. arcade-classic Stack 로직(겹친 부분만 남김)+chip-sound 비트 클록, perfect 콤보에 juice-fx 셰이크·파티클 단계 상승, game-ui-hud 콤보 카운터. 규칙이 한 줄이라 누구나 즉시 이해.

### 분위기 트릭 콤보 보더 (Atmospheric Trick Boarder)
- **레시피:** 코어 루프: endless-runner(보드 슬로프) + FE-COMBO + FE-NARRATIVE + FE-RISK-REWARD
- **예시 신작:** 노을 지는 사막 사구를 미끄러져 내려오며 탭-홀드로 백플립을 걸고, 지형 접선에 맞춰 착지로 콤보를 확정해 속도와 점수를 불리는 분위기형 트릭 러너.
- **왜 재밌나:** Alto식 트릭 콤보(FE-COMBO)와 '한 번 더 회전할까 안전히 착지할까'의 위험-보상(FE-RISK-REWARD)에 동적 시간대/날씨 무드(FE-NARRATIVE)가 '예쁜 한 판'의 감상 가치를 더한다. endless-runner 슬로프 지형+탭-홀드 회전 입력, VectorForge 그라데이션 패럴랙스 다층+chip-sound 무드 BGM, 콤보 확정 정산은 RISK-REWARD 변수.

### 닷지롤 탄막 퍼즐 (Dodge-Roll Bullet Puzzle)
- **레시피:** 코어 루프: puzzle-game(턴제 회피) + FE-CONSTRAINT + FE-AHA + FE-TENSION
- **예시 신작:** 한 화면 보스의 탄 패턴을 보고 정해진 닷지롤 3회 안에 안전지대를 찾아 통과하는 턴제 탄막 회피 퍼즐.
- **왜 재밌나:** 실시간 탄막을 '몇 수 안에 안전지대 찾기'(FE-CONSTRAINT)로 바꿔 패턴 독해의 아하(FE-AHA)를 보상하고 마지막 한 칸의 긴장(FE-TENSION)을 남긴다. puzzle-game 보드모델로 탄 위치를 격자화+undo, Cuphead/Enter the Gungeon 회피를 사고형으로 변환, 실시간 정밀물리(❌급)를 피해 신뢰도 확보. 턴제라 모바일 입력 부담이 없다.

### 등반 머리싸움 퍼즐 (Climb Optimization Puzzle)
- **레시피:** 코어 루프: platformer-game(차징 점프) + FE-CONSTRAINT + FE-MASTERY + FE-FAIRNESS
- **예시 신작:** 좌우 방향+차징량으로 결정론적 포물선을 쏘는 등반가가 '최소 점프 수'로 정해진 발판만 밟아 정상에 닿는 차징 점프 퍼즐.
- **왜 재밌나:** Jump King의 커밋-후-무제어 점프를 횟수 제약(FE-CONSTRAINT)으로 머리싸움화하면서, 결정론적 물리로 숙련(FE-MASTERY)과 공정성(FE-FAIRNESS)을 모두 살린다. 빗나가면 추락이지만 '내 충전 실수'라 납득된다. platformer-game+차징바 입력, 결정론 step(t,dt), game-ui-hud 잔여 점프수+베스트, 발판은 level-designer 고정 배치.

## 3. 안티패턴 (섞지 말 것)

- **젠 분위기 + 극한 시간압박:** FE-NARRATIVE(느긋한 atmosphere 감상)와 FE-ESCALATION/고 FE-TENSION은 정반대의 페이싱을 요구한다. 예쁜 노을을 음미하라면서 0.1초 반응을 강요하면 플레이어는 둘 다 못 누린다—풍경은 안 보이고 압박만 남거나, 압박이 약하면 분위기가 지루해진다. Alto가 트릭을 넣으면서도 '죽음=즉시 끝'을 부드럽게 둔 이유. 둘을 다 원하면 압박 구간과 감상 구간을 시간적으로 분리하라.
- **사고형 퍼즐 + 실시간 점증 가속:** FE-AHA/FE-CONSTRAINT(최적해를 궁리할 여유)와 FE-ESCALATION(초당 빨라지는 압박)은 양립 불가다. 2048·Baba Is You의 통찰은 '멈춰서 생각할 수 있음'에서 나온다. 여기에 타임어택 가속을 걸면 플레이어는 사고를 포기하고 아무 수나 던지게 되어 퍼즐의 정체성이 붕괴한다. 시간압박을 원하면 퍼즐을 '패턴 반응형'으로 바꾸거나, 압박 대신 '이동 수 제한'(FE-CONSTRAINT)으로 긴장을 주라.
- **기록 경신 스피드런 + 강한 RNG 변주:** FE-MASTERY/FE-SOCIAL(자기·타인 기록 비교)는 '같은 조건의 반복'을 전제하는데, FE-SURPRISE(매판 다른 절차생성)는 그 전제를 깬다. 운으로 좋은 배치를 받은 판과 나쁜 배치를 받은 판의 기록을 나란히 두면 비교가 무의미해지고 경쟁 동기가 사라진다. 로그라이트의 RNG와 스피드런 리더보드를 같은 모드에 넣지 말고, 시드 고정 모드(FE-MASTERY용)와 무작위 모드(FE-SURPRISE용)를 분리하라.
- **즉사 난이도 + 화면 밖 기습/고RNG:** FE-FAIRNESS('내 실수였다'는 납득)는 죽음의 원인이 보였고 회피 가능했어야 성립한다. 즉사(Super Meat Boy급)에 화면 밖에서 튀어나오는 적이나 회피 불가능한 무작위 배치(FE-SURPRISE 남용)를 더하면 '불공정한 죽음'이 되어 재도전 의욕(FE-JUST-ONE-MORE)을 꺾는다. 즉사를 쓰려면 모든 위협을 화면 안에서 충분히 텔레그래프하고, 절차생성은 '회피 가능한 배치만' 생성하도록 검증 규칙을 둬야 한다.
- **무한 콘텐츠 탐험 + 즉시 한 판 더:** FE-EXPLORE(개방형 맵·장시간 탐사)와 FE-JUST-ONE-MORE(수십 초 루프·즉시 재시작)는 세션 길이가 충돌한다. 메트로배니아의 재미는 '쌓이는 진행'인데 즉사·즉시 리셋을 걸면 탐험 진행이 날아가 좌절만 남는다. 반대로 탐험을 살리면 한 판이 길어져 즉시성이 죽는다. 단일플레이 2D에서는 탐험을 '짧은 룸 묶음+체크포인트'로 축소하거나, 둘 중 하나를 코어로 정하고 다른 하나는 양념으로만 쓰라.
- **빌드 깊이 + 끊김 없는 FE-FLOW 동시 극대화:** FE-BUILD(레벨업마다 3택 카드로 시너지 설계)는 본질적으로 '게임을 멈추는' 선택 화면을 요구하는데, FE-FLOW(끊기지 않는 관성·리듬)는 어떤 멈춤도 흐름을 깬다고 본다. 정밀 러너·리듬게임에 깊은 빌드 메뉴를 자주 띄우면 박자가 끊겨 둘 다 약해진다. 빌드를 원하면 카드 화면을 자연스러운 완급(웨이브 사이)에 배치하거나, 흐름이 핵심이면 빌드를 '주우면 즉시 적용되는 패시브'로 단순화해 멈춤을 없애라.

## 4. 조합 설계법 (명확화 단계에서)

WebGameForge의 '요청 명확화'(web-game-builder SKILL.md 0단계, make-game 커맨드)에서 이 사전을 의사결정 도구로 쓴다. 코드 작성 전, AskUserQuestion 1회(최대 4문항)로 핵심만 묶어 묻되 아래 4단계를 거쳐 답을 '장르 스킬 라우팅'으로 잇는다.

### 1단계: 템플릿 아키타입 제시
사용자 요청이 모호하면(예: '재밌는 게임 만들어줘') combination_patterns의 검증된 레시피 3~4개를 골라 AskUserQuestion 옵션으로 제시한다. 각 옵션 라벨은 친근한 이름, 설명은 example 한 문장. 첫 옵션에 무난한 추천(예: '리듬 정밀 러너')을 '(추천)'으로. 요청에 이미 장르 단서가 있으면(예: '슈팅') 그 코어 루프를 고정하고 이 단계를 건너뛴다.

### 2단계: 강조할 재미요소 선택
코어 루프가 정해지면, 그 장르에 잘 붙는 fun_elements 태그 2~3개를 후보로 AskUserQuestion한다. '이 게임에서 가장 중요한 손맛은?' 식으로 묻고 옵션은 korean_name+definition 요약. 동시에 anti_patterns를 내부 가드로 적용—사용자가 충돌 조합(예: 젠 분위기+극한 압박)을 고르면 그대로 만들지 말고 '둘 다 살리려면 구간 분리가 필요한데 어느 쪽을 코어로 할까요?'로 되묻는다.

### 3단계: 조합 설계
선택된 코어 루프 1개 + 재미요소 2~3개로 combination_patterns의 recipe 형식('코어 루프 + 태그들')을 즉석 조립한다. 매칭되는 기존 레시피가 있으면 그 why_works를 채택하고, 없으면 각 fun_element의 engine_impl과 combine_caution을 합쳐 새 레시피를 만든다. 이 시점에 아트 스타일(필수: PixelForge vs VectorForge)·테마·분량도 함께 확정한다.

### 4단계: 장르 스킬 라우팅
확정된 코어 루프를 web-game-builder의 라우팅 표대로 잇는다:

| 코어 루프 단서 | 라우팅 대상 스킬 |
| --- | --- |
| 옆스크롤/차징점프 | platformer-game |
| 자동전진/플래피/수직점퍼 | endless-runner |
| 벽돌깨기/스택/그리드호퍼 | arcade-classic |
| 그리드/매치/머지/규칙조작 | puzzle-game |
| 탑다운/트윈스틱/불릿헤븐 | topdown-shooter |

그다음 선택된 재미요소별 engine_impl이 가리키는 제작요소 스킬을 부가 호출한다:

- FE-JUICE → juice-fx
- FE-TIMING → chip-sound 클록
- FE-BUILD / FE-CONSTRAINT → game-ui-hud
- FE-SURPRISE / FE-EXPLORE → level-designer
- 아트 → sprite-forge / vector-graphics

물리 정밀도가 높은 조합(밧줄·강체)이면 Matter(⚠️) 대신 단순 임펄스 모델로 신뢰도를 확보하고, 멀티플레이어/서버 메타가 섞이면 로컬 리더보드·고스트·시드공유로 축소 재현(❌ 회피)함을 사용자에게 미리 고지한다. 답을 모두 받은 뒤에만 games/<slug>/ 스캐폴딩을 시작한다.
