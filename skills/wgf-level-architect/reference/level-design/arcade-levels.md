# 아케이드·단일화면 난이도 진행

> 아케이드/단일화면(고정 화면) 게임의 난이도를 **레벨 데이터의 톱니 곡선 + 실시간 가속** 두 층으로 설계하는 처방전. 단일화면은 맵 길이로 난이도를 못 늘리므로 **시간축의 속도·밀도·페이즈·스폰**이 핵심 노브다. 공통 원칙은 [./principles.md](./principles.md), 재미요소(`FE-*`)는 [../../../wgf-web-game-builder/reference/game-dna/fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md), 빌드 위임은 [`arcade-classic`](#연계). 색인은 [./INDEX.md](./INDEX.md).

이 파일은 [./platformer-levels.md](./platformer-levels.md)·[./puzzle-levels.md](./puzzle-levels.md)와 같은 라이브러리의 장르 파일이다. Space Invaders·Tetris·Pac-Man·Breakout 4대 고전이 각각 다른 노브의 교과서이며, 그 원리를 이 저장소의 `runeburst`·`is-rule`·`super-runner` 스키마에 직접 매핑한다. 우리 엔진은 2D·단일플레이·모바일웹뷰·Arcade 물리·라이선스 안전·절차 제약을 따른다(서버 메타는 ❌ → 로컬 `localStorage`·시드 대체).

---

## 한눈에 보기 — 4대 고전이 가르치는 노브

| 고전 | 핵심 노브 | 대표 `LD-*` | 우리 엔진 매핑 |
|---|---|---|---|
| Space Invaders (1978) | 웨이브 내 단조 가속 + 웨이브 간 리셋 | `LD-CURVE` | 절차적 `enemySpeed(i)` 곡선 함수 |
| Tetris (NES) | frames-per-cell 단계 감소(미세 flow) | `LD-FLOW-CHANNEL` `LD-ONE-IDEA` | `gravityFramesPerCell(level)` 테이블 |
| Pac-Man | 결정적 AI + scatter/chase 페이싱 + Cruise Elroy | `LD-TELEGRAPH` `LD-PACING` `LD-DDA` | `phaseTimer` + 순수함수 타게팅 |
| Breakout (1976) | 색층 점수 + 리스크 결합 가속 | `LD-REWARD` | `scoreWeight` 가중 + 콤보 멀티 |

> 단일화면 아케이드 설계 격언 3줄: **(1) 한 번에 한 변수만(`LD-ONE-IDEA`), (2) 첫 화면은 가르치는 화면(`LD-TEACH`), (3) 추격 사이에 숨돌림(`LD-PACING`).**

---

## 1. 톱니형 난이도 곡선 — 웨이브 내 점증 + 웨이브 간 리셋 `LD-CURVE`

**정의.** 한 화면(웨이브) 안에서는 난이도가 단조 상승하다가, 다음 웨이브로 넘어갈 때 한 단계 낮은 지점에서 다시 시작해 전체로는 우상향 톱니(sawtooth)를 그리는 구조. 아케이드 단일화면 난이도의 기본 골격이다.

**왜 통하나.** Space Invaders(Tomohiro Nishikado, 1978)가 사실상 이 곡선을 우연히 발명했다. 1978년 하드웨어는 화면에 외계인이 많을수록 프레임을 느리게 렌더링했는데, 적이 줄수록 부하가 줄어 잔존 외계인이 빨라지는 '버그'가 곧 웨이브 내 점증을 만들었다. Nishikado가 '스릴이 늘어 좋다'며 이 가속을 의도적으로 보존한 것이 흔히 '진행할수록 어려워지는 첫 게임'·'난이도 곡선의 기원'으로 인용된다(이 '최초' 귀속 자체는 통설이지 엄밀한 사실 확정은 아니므로 단정은 피한다). 새 웨이브에서 외계인이 다시 가득 차 느리게 시작하는 것이 곧 리셋이다. Jamey Pittman의 'The Pac-Man Dossier'(Game Developer) 역시 21레벨에 걸쳐 13개 변수를 단계적으로 끌어올리되 레벨 시작 시 보드를 새로 채워 국소적 완화를 주며, 동일 챌린지 레벨 쌍은 극소수다. Jesse Schell은 'The Art of Game Design: A Book of Lenses'에서 이 상승-완화 반복을 관심 곡선/난이도 곡선으로 일반화한다.

**구체 규칙(체크리스트).**

- [ ] **웨이브 내 점증** — 한 화면 안에서 적 처치/벽돌 파괴가 진행될수록 속도·밀도를 단조 증가. 예) 적 수가 `N→N/2`로 줄면 잔존 적 속도 `+25%`.
- [ ] **웨이브 간 리셋** — 다음 화면 시작 시 난이도를 직전 정점의 약 70~80%로 내리고, 베이스라인 자체는 웨이브마다 `+5~10%` 끌어올림(예: wave `k`의 시작 속도 = `base*(1+0.07*k)`).
- [ ] **톱니 진폭 > 베이스 상승** — 국소 완화가 체감되도록 '정점 대비 -25% 하강'이 '웨이브당 베이스 +7% 상승'보다 크게 유지.
- [ ] **곡선을 데이터로 분리** — 화면 인덱스→{속도, 밀도, 적유형} 매핑을 `LEVELS`/wave 테이블로 두고 코드와 분리(Pac-Man Dossier식 변수 테이블화).

**우리 엔진 적용.** `runeburst`의 `LEVELS` 배열이 이미 톱니다. `goal`이 `1000→1600→2200`으로 베이스 상승하다가, 새 기믹을 도입하는 레벨에서 `moves↑`·`goal↓`로 국소 완화를 준다(L5 '성운을 걷어라' = `moves:22`/`goal:2000`로 직전 L4 `goal:2800`보다 낮춤). 단일화면 아케이드를 신규 제작할 땐 wave 인덱스 `i`에 대해 절차적 곡선 함수를 정의하고, 매 wave 시작 시 직전 정점의 0.75배로 리셋한다.

```js
// 절차적 톱니 곡선 — 코드와 데이터(튜닝 노브)를 분리
function difficultyCurve(i) {            // i = waveIndex (0부터)
  return {
    spawnInterval: 1200 * Math.pow(0.92, i), // 점점 촘촘 (ms)
    enemySpeed:    60 * (1 + 0.07 * i),       // 베이스 +7%/wave
    enemyTypes:    1 + Math.floor(i / 3)      // 3웨이브마다 유형 +1
  };
}
// 웨이브 간 리셋: 시작은 직전 정점의 0.75배에서 출발해 다시 상승
// Phaser4: this.time.addEvent({ delay: difficultyCurve(i).spawnInterval, ... })
```

`runeburst`처럼 데이터 테이블 방식을 그대로 따른다면, 신규 게임의 `WAVES` 배열도 인접 행이 한 필드만 달라지게 유지한다:

```js
var WAVES = [
  { speed: 60,  density: 4, types: 1 }, // 도입 — 가장 느림
  { speed: 64,  density: 5, types: 1 }, // density만 +1
  { speed: 68,  density: 5, types: 2 }, // types만 +1 (속도는 소폭)
  { speed: 56,  density: 6, types: 2 }  // 리셋: 직전 정점보다 speed↓, density는 누적
];
```

**주의·안티패턴.**
- 베이스 상승만 있고 웨이브 리셋이 없으면 단조 상승이라 휴식이 사라지고 금세 anxiety로 진입한다.
- 리셋 폭이 너무 크면 진행감(progression)이 사라져 지루해진다 — 정점은 **항상 직전 정점보다 높게**.
- 곡선을 코드에 하드코딩하면 튜닝 비용이 폭증한다 — 반드시 데이터 테이블로.

---

## 2. 몰입 채널 — 속도가 실력을 따라오게 `LD-FLOW-CHANNEL`

**정의.** 도전(challenge)이 플레이어 실력(skill)과 함께 점진 상승해 불안(anxiety, 너무 어려움)과 지루함(boredom, 너무 쉬움) 사이의 좁은 '몰입 채널'을 유지하는 것. 아케이드에선 화면 속도·밀도가 곧 도전 축이다.

**왜 통하나.** 도전과 실력의 균형이 맞을 때 불안(도전>실력)과 지루함(실력>도전) 사이의 최적 영역에서 몰입이 발생한다는 모델은 심리학자 Mihaly Csikszentmihalyi의 flow 이론에서 비롯된다. flow 개념과 불안/지루함 구도는 그의 1975년 저서 'Beyond Boredom and Anxiety: Experiencing Flow in Work and Play'에서 처음 정식화되었고, 1990년 'Flow: The Psychology of Optimal Experience'가 이를 체계화·대중화했다(이론의 기원 저작과 대중화 저작은 구분해야 한다). 원본 1975년 도식은 challenge-skill 평면을 anxiety/flow/boredom의 단순 3구역으로 나누었고, 1987년 Massimini·Csikszentmihalyi·Carli가 이를 8가지 정서 상태로 세분한 'Eight Channel Model(8채널 모델)'로 발전시켰다 — 흔히 인용되는 정식 도식 명칭은 8채널 모델이며 '3채널 모델'은 비표준 명칭이다. Jenova Chen이 2006년 MFA 논문 'Flow in Games'에서 이를 게임에 적용했고, Jesse Schell이 'The Art of Game Design'에서 디자인 핵심 개념으로 채택했다. 아케이드는 실력이 빨리 늘기에 도전이 더 빨리 올라가야 채널에 머문다 — NES Tetris의 가속 곡선이 대표 사례다.

**구체 규칙(체크리스트).**

- [ ] **도전 상승률을 실력 추정에 묶기** — 화면 클리어 속도/잔여 시간을 측정해 다음 화면 속도를 가감(간이 DDA, §8).
- [ ] **채널 폭 설계** — 매 단계 도전 증가분을 작게 쪼개 급경사 회피(NES Tetris처럼 frames-per-cell을 한 번에 1프레임씩).
- [ ] **상한 도전(정점)이 실력 천장 직전에** — 평균 플레이어 클리어 시점에 anxiety로 넘어가지 않게 정점 속도를 캡.
- [ ] **지루함 방어** — 같은 속도가 2화면 이상 연속이면 변주(적 유형/배치)로 도전 축을 바꿔 단조 회피.

**우리 엔진 적용.** NES Tetris식 속도 곡선을 그대로 차용할 수 있다. NTSC 기준 중력표는 레벨당 frames-per-cell이 한 칸씩 줄며 미세한 곡선을 만든다(보통 10라인 클리어마다 레벨 증가). 아래 값은 통설로 널리 인용되나 PAL/NTSC 차이와 정확한 레벨업 라인 수는 단정하지 말 것.

```js
// NES Tetris NTSC 중력표 (frames-per-cell) — 한 번에 1프레임씩 줄여 급경사 회피
var GRAVITY = [48,43,38,33,28,23,18,13,8,6, // L0..L9
               5,5,5, 4,4,4, 3,3,3,         // L10..L18
               2,2,2,2,2,2,2,2,2,2,         // L19..L28
               1];                          // L29 (킬스크린)
function gravityFramesPerCell(level) {
  return GRAVITY[Math.min(level, GRAVITY.length - 1)];
}
// Phaser4: dropTimer 간격(ms) = gravityFramesPerCell(level) * (1000 / 60)
```

- `runeburst`라면 `colors`/`moves`가 도전 축이다. flow 유지를 위해 `colors`는 `5→6`으로 **한 번만** 올리고(급증 금지), `moves`는 `goal` 상승과 보조를 맞춰 칸당 여유를 일정하게 유지한다.
- `super-runner`는 `pits` 폭/연속과 `features`의 적(`'e'`) 밀도 증가율을 구간당 소폭으로 쪼갠다.

**주의·안티패턴.**
- 난이도 급경사(한 화면에서 속도 2배)는 즉시 anxiety로 채널 이탈을 부른다.
- 실력 상승을 무시한 고정 곡선은 숙련자에게 곧 boredom이 된다.
- 도전을 속도 하나로만 올리면 곧 반사신경 한계에 닿는다 — 밀도/패턴 등 다른 축과 병행해야 한다(§6과 연동).

---

## 3. 강도 파동 — 추격 페이즈와 산개 페이즈의 리듬 `LD-PACING`

**정의.** 긴장(고강도 추격)과 완화(저강도 산개)를 주기적으로 교대시켜 강도 곡선에 파동을 주는 것. 단일화면에서도 '쫓김↔숨돌림'의 리듬을 명시적 페이즈로 설계한다.

**왜 통하나.** Pac-Man(Toru Iwatani)의 scatter/chase 교대가 교과서적 사례다. Pac-Man Dossier에 따르면 레벨1은 scatter 7s→chase 20s→scatter 7s→chase 20s→scatter 5s→chase 20s 식으로 추격 사이에 짧은 산개(쉼)를 끼워 호흡 구간을 준다. 레벨이 오를수록 scatter가 7s→5s로 짧아지고 chase가 사실상 무한으로 늘어 쉼이 사라진다 — 페이싱 자체가 난이도 노브다(구체 초·임계 수치는 Dossier 통설이며 정밀 확정은 1차 자료가 필요하다).

Valve의 사례도 참고할 만하다. The Level Design Book에 따르면, Valve 디자이너들은 Half-Life 2: Episode Two와 Left 4 Dead의 페이싱을 위해 beat를 Explore/Combat/Choreo/Puzzle 4종으로 분류하고, X축=시간(분)·Y축=강도(intensity) 그래프로 페이싱을 설계했다(강도 척도는 0-100%, 0-5, 또는 0-10 중 선택하는 단순 수치이며 값은 '게임 감각과 플레이테스트 관찰에서 나오는 직관'이라고 책이 명시한다 — 이는 Valve가 공식 발표한 프레임워크가 아니라 내부 실무 관행이며, 1차 출처는 GDC China 2014 'Level Design Workshop: Pacing' 발표다). Left 4 Dead AI Director의 'Relax(이완)' 단계는 Michael Booth의 GDC 2009 'The AI Systems of Left 4 Dead' 1차 슬라이드 기준 **30-45초**(또는 Survivor가 다음 세이프룸 쪽으로 충분히 이동할 때까지) 지속한다(자주 인용되는 '35-40초'는 2차 정리본의 변형 수치다). 강도의 상대성도 페이싱 원리다 — Mike Stout의 'Trinity, Part 6 - Intensity Ramps'(2015) Principle #5는 "항상 11로 틀어놓으면 11이 새로운 5가 된다"며 고강도를 아껴야 정점이 정점답다고 처방한다.

**구체 규칙(체크리스트).**

- [ ] **명시적 페이즈 타이머** — '위협 페이즈(추격/고밀도)'와 '완화 페이즈(산개/저밀도)'를 초 단위 스케줄로 정의(예: chase 20s / scatter 7s).
- [ ] **난이도 상승 = 완화 페이즈 단축** — 후반 레벨에서 산개를 7s→5s→0으로 줄여 쉴 틈을 점진 제거.
- [ ] **완화 구간은 완전 안전이 아니라 '저강도'** — 위협은 존재하되 예측 가능·회피 쉬운 상태로.
- [ ] **파동 주기를 화면당 2~3회** — 한 화면에 최소 한 번은 '쫓김→숨돌림' 사이클이 들어가게.

**우리 엔진 적용.** 단일화면 추격형이라면 Phaser4 Scene에 `phaseTimer`를 두고 적 모드를 토글한다.

```js
// scatter/chase 페이즈 페이싱 — scatterDuration이 난이도 노브
function scatterDuration(level) { return Math.max(0, 7 - level); } // 7→5→3→...→0초
this.enemyMode = 'scatter';
this.time.addEvent({ delay: scatterDuration(level) * 1000, callback: function () {
  this.enemyMode = 'chase';            // 모드별 적 목표타일·속도를 분기
}, callbackScope: this });
```

- `runeburst`엔 직접 페이즈가 없지만 '캐스케이드 폭발(고강도)→리필 후 정적 보드(완화)'가 자연 파동이다. `overload` 셀 레벨(L6·L10·L12)은 고강도 비중을 올려 페이싱을 조절한다.
- `super-runner`는 적 밀집 구간(고강도, `'e'` 군집)과 코인 수집 평지(완화, `'o'` 길)를 교대 배치한다 — 이미 `features`에 그런 리듬이 있다.

**주의·안티패턴.**
- 완화 없는 연속 고강도는 피로·이탈을 부른다 — chase만 무한히 두지 말 것.
- 완화가 너무 길거나 완전 무위협이면 늘어진다.
- 페이즈 전환에 신호(시각/청각)가 없으면 플레이어가 리듬을 못 읽어 불공정하게 느낀다.

---

## 4. 안전지대에서 무텍스트 학습 — 첫 화면은 가르치는 화면 `LD-TEACH`

**정의.** 새 메카닉/위협을 텍스트 없이, 실패해도 거의 손해 없는 안전한 첫 화면에서 직접 체험시켜 익히게 하는 것. 아케이드 1면은 사실상 튜토리얼이다.

**왜 통하나.** GMTK(Mark Brown)의 'Super Mario 3D World's 4 Step Level Design'(2015)이 해설한 닌텐도식 4단 구조에서 'introduction(도입)' 단계가 바로 이것이다 — 메카닉을 안전한 환경에서 먼저 소개한 뒤 발전시킨다. Breakout·Pac-Man의 1면도 속도·적이 가장 느려 자연스러운 학습장이 된다(Pac-Man L1 고스트는 정상보다 느린 속도). Scott Rogers는 GDC 2009 강연과 'Level Up!'에서 디즈니랜드의 시각 유인물('weenie' — 먼 랜드마크로 방문객을 끌어당기는 장치)을 레벨 디자인에 차용·대중화하며 '가르친 뒤 시험하라'를 강조했다. TV Tropes의 'Antepiece'(Instructive Level Design의 sub-trope)도 같은 기법이다 — 앞으로 올 기믹을 위험 없는 안전한 형태로 미리 연습시킨다(흔히 인용되는 예: Mega Man X1의 안전한 구덩이로 Wall Jump 연습).

**구체 규칙(체크리스트).**

- [ ] **1번째 화면/레벨은 최저 속도·최소 밀도** — 새 입력/메카닉을 실패 비용 0에 가깝게 시연.
- [ ] **새 메카닉은 단독 노출** — 도입 화면에선 그 메카닉 외 다른 위협을 제거(§5 `LD-ONE-IDEA`와 연동).
- [ ] **성공이 자명하게 보이도록 배치** — 올바른 행동이 가장 눈에 띄는 위치/색으로(`LD-SIGNPOST`).
- [ ] **텍스트 의존 금지** — 배치·색·움직임만으로 '여기서 이렇게 하라'가 읽히게.

**우리 엔진 적용.**
- `runeburst` L1('첫 별빛', `square`/`colors:5`/`moves:20`/`goal:1000`)이 정확히 도입 화면이다 — 가장 쉬운 보드·넉넉한 이동수로 스왑/매치를 가르친다.
- `is-rule` L1('첫 걸음', `par:6`, 빈 보드에 `BLOB IS YOU`/`FLAG IS WIN`만)은 이동+승리를 무위협으로 학습시킨다.
- 신규 게임에선 `LEVELS[0]`을 항상 '최저 난이도 단일 메카닉' 화면으로 두고, `super-runner`처럼 `features` 배열 앞부분에 코인(`'o'`)+물음표블록(`'?'`)만 배치해 점프·블록치기를 안전하게 시연한다(현재 도입부가 `{t:'?',c:8,r:9}` + `{t:'o',c:6,r:9}`로 그렇게 되어 있다).

**주의·안티패턴.**
- 1면부터 풀세트 위협을 깔면 학습에 실패하고 진입 이탈이 난다.
- 텍스트 팝업으로 가르치면 읽지 않고 스킵한다 — 체험으로 가르쳐야 정착한다.
- 도입 화면이 너무 길면 숙련자에게 지루하다 — 짧고 명확하게.

---

## 5. 한 화면 한 변수 — 한 번에 하나의 노브만 돌린다 `LD-ONE-IDEA`

**정의.** 각 레벨/웨이브에서 난이도 변수(속도·밀도·적유형·제약)를 한 번에 하나씩만 변경해, 무엇이 어려워졌는지 플레이어가 인지·학습하게 하는 것. 4비트 구조(§9)와도 정합한다.

**왜 통하나.** Pac-Man Dossier가 결정적 근거다 — 21레벨 중 동일 챌린지 레벨 쌍은 극소수이고, 나머지는 13개 게임플레이 변수 중 '하나'를 바꿔 각 레벨에 고유 난이도를 부여했다(예: 같은 속도에서 fright time만 단축, 또는 ghost speed만 +). 변수를 하나씩 돌리면 점진성·가독성이 동시에 확보된다. GMTK가 해설한 'one mechanic per level'과도 정합한다.

**구체 규칙(체크리스트).**

| 인접 레벨 diff | 허용? | 이유 |
|---|---|---|
| 속도만 +1단계, 나머지 고정 | ✅ | 무엇이 어려워졌는지 학습 가능 |
| 새 적유형 1종 도입, 속도 동결 | ✅ | 새 패턴에 집중 |
| 속도 +1 **그리고** 새 적유형 동시 | ⚠️ | '비틀기(轉)' 레벨로 명시하고 전후를 단일 변수로 완충 |
| 속도·밀도·유형 동시 상향 | ❌ | 난이도 급등 + 학습 불가 |

- [ ] **레벨 간 변경 변수 1개 원칙** — 속도↑면 밀도·적유형 고정. 새 적유형 도입이면 속도 동결.
- [ ] **변수 변경 폭은 작게** — NES Tetris처럼 frames-per-cell을 한 번에 1프레임씩, `colors`는 한 번에 +1.
- [ ] **변수 테이블 명시화** — 레벨별 어떤 노브가 바뀌는지 주석/데이터로 추적 가능하게.

**우리 엔진 적용.** `runeburst` `LEVELS`는 이미 한 노브씩 변경한다 — L1→2는 `moves`만 `20→18`, L2→3은 `colors`만 `5→6`, L5에서 `win.type`만 `jelly` 추가. 이 규율을 신규 게임 `LEVELS` 작성 규칙으로 못박는다: **인접 레벨 diff가 한 필드만 달라지게.** `is-rule`도 레벨당 '규칙 1개 도입'(STOP→PUSH→규칙끊기→SINK)을 지킨다. `super-runner`는 구간별로 '구덩이만 넓힘' 또는 '적만 추가' 식으로 `features`를 단일 축 변주한다.

```js
// 좋은 예 — 인접 레벨이 한 필드만 다름 (runeburst 패턴)
{ name: '연쇄의 맛',   shape:'square', colors:5, moves:18, goal:1600 }, // moves -2
{ name: '라인 블래스터', shape:'square', colors:6, moves:18, goal:2200 }, // colors +1 (moves 동결)
// 나쁜 예 — colors·moves·shape 동시 변경 → 무엇이 어려운지 학습 불가
```

**주의·안티패턴.**
- 여러 변수를 한꺼번에 올리면 난이도 급등 + 무엇이 어려운지 학습 불가.
- 변수 변경이 너무 미세해 인지 안 되면 진행감이 사라진다 — 작되 체감되는 폭.
- 테이블 없이 즉흥 조정하면 곡선이 들쭉날쭉해진다.

---

## 6. 텔레그래프·예측가능성 — 위협의 결정성으로 공정한 가속 `LD-TELEGRAPH`

**정의.** 적 행동·위협을 결정적(deterministic)이고 예고된 형태로 만들어, 속도가 빨라져도 플레이어가 패턴을 읽고 대응할 수 있게 하는 것. 가속의 공정성(`LD-FAIR`)을 보장하는 장치다.

**왜 통하나.** Pac-Man의 고스트는 같은 위치에선 항상 같게 행동하는 결정적 AI다. 덕분에 고속에서도 패턴 학습·스피드런이 가능해 '공정한 어려움'이 된다. 각 고스트의 고유 타게팅(Blinky 직접추격, Pinky 4칸 앞, Inky 벡터, Clyde 거리조건)이 위협을 예고된 성격으로 만든다. Space Invaders의 가속도 '적 수↔속도'라는 일관 규칙이라 예측 가능하다.

**구체 규칙(체크리스트).**

- [ ] **위협을 결정적으로** — 같은 상태→같은 행동. 난수는 최소화하거나 시드 고정.
- [ ] **예비동작/궤적 노출** — 빨라질수록 공격 전 텔레그래프(점멸·예고선)를 더 명확히.
- [ ] **적 유형별 고유 패턴** — 균질한 적 대신 성격이 다른 2~4종으로 읽는 재미 + 학습 가능성.
- [ ] **가속 규칙을 일관되게** — '적 절반 처치 시 +25%'처럼 플레이어가 역산 가능한 단순 규칙.

**우리 엔진 적용.** 단일화면 추격형이면 적 AI를 Pac-Man식 결정적 타게팅으로 구현한다.

```js
// 결정적 타게팅 — 순수함수 + 고정 타이브레이크(상>좌>하)로 패턴 학습 가능
function ghostTarget(type, pacTile, blinkyTile) {
  if (type === 'chaser')  return pacTile;                  // Blinky식 직접추격
  if (type === 'ambush')  return ahead(pacTile, 4);        // Pinky식 4칸 앞
  // ... 동률 시 방향 선택은 상>좌>하 고정 (난수 X)
}
```

이 저장소의 `mulberry32` 시드 PRNG를 재사용해 스폰을 결정적으로 만든다. `runeburst`는 각 레벨의 `seed` 필드(1001~1012)가 이미 보드를 결정적으로 만들어 데일리 시드 공유가 공정하다 — 이 결정성을 텔레그래프로 활용한다. `super-runner` 적은 단순 좌우 순찰이라 궤적을 예측할 수 있다.

**주의·안티패턴.**
- 고속 + 무작위 위협 = 회피 불가능한 기습 → 불공정(`LD-FAIR` 위반).
- 텔레그래프 시간이 속도에 비례해 줄지 않으면 후반에 반응이 불가능해진다.
- 완전 결정적이면 패턴 암기 후 지루해진다 — 약간의 변주(`LD-VARIETY`)와 균형을 맞춘다.

---

## 7. 리스크-리워드 스코어 추격 — 점수 보상이 가속을 유도 `LD-REWARD`

**정의.** 고위험 행동(파괴 어려운 표적·고속 구간·연쇄)에 높은 점수를 배정해, 플레이어가 스스로 더 어려운 플레이를 선택하도록 보상 스케줄로 페이싱을 견인하는 것.

**왜 통하나.** Breakout(Atari, 1976)의 색층 점수 구조가 원형이다 — 위쪽 어려운 벽돌일수록 고득점(아래부터 노랑1·초록3·주황5·빨강7점)이고, 동시에 주황·빨강 행 접촉 시 공이 가속한다(통설로는 4·12히트 및 색층 접촉 시 가속, 빨강 돌파 후 패들 절반 축소 — 정확한 히트 임계·축소 조건은 단정하지 말 것). 즉 '고득점=고난도'가 일치한다. Pac-Man의 고스트 연쇄 식사(200→400→800→1600)도 위험을 감수한 추격 보상이다. 가변비율 보상은 Schell이 'The Art of Game Design'에서 강화 스케줄로 설명한다.

**구체 규칙(체크리스트).**

- [ ] **고난도 표적 = 고점수** — 도달/파괴가 어려운 위치·유형에 점수 가중(Breakout 색층 1/3/5/7).
- [ ] **연쇄 보너스 체증** — 콤보/캐스케이드 깊이에 비례·초비례 점수(예: 칸당 점수 ×깊이).
- [ ] **리스크 가속 결합** — 고점수 구역 진입이 동시에 속도/난이도를 올려 '위험-보상'을 한 몸으로.
- [ ] **성취 가시화** — 점수 증가를 즉시·크게 피드백(숫자 팝업·피치 상승)해 추격 동기 강화.

**우리 엔진 적용.** `runeburst`가 정확히 이 원리다 — 캐스케이드가 깊을수록 칸당 점수 `×깊이`, `overload` 셀 매치 시 `×2`, 음 피치가 콤보마다 스택된다(`ChipAudio`). 신규 게임에선 표적별 `scoreWeight`를 두고 위험한 표적에 가중, `comboMultiplier = depth`로 체증한다.

```js
// 색층 점수 + 리스크 결합 (Breakout식) — 위쪽일수록 고점수·고가속
var ROW_SCORE = [7, 7, 5, 5, 3, 3, 1, 1]; // 위(빨강7) → 아래(노랑1)
function onBrickHit(row) {
  score += ROW_SCORE[row];
  if (row <= 3) ballSpeed *= 1.05;        // 고점수 행 = 가속 (리스크 결합)
}
// 콤보 멀티는 반드시 상한 — runeburst의 MULT_CAP=9 패턴 차용
combo = Math.min(combo + 1, MULT_CAP);
```

`super-runner`는 도달 어려운 공중 코인 아치(구덩이 위 `r:7-8` 배치, 예 `{t:'o',c:28,r:7}`)에 코인을 두어 위험-보상 분기를 이미 구현했다.

**주의·안티패턴.**
- 고점수 표적이 위험과 무관하면 플레이어가 안전 루트만 탄다 — 보상과 리스크를 묶어야 한다.
- 연쇄 보상이 무한 체증이면 점수 인플레로 의미가 사라진다 — `MULT_CAP` 같은 상한이 필요하다(`runeburst`는 `MULT_CAP=9`).
- 보상 피드백이 약하면 추격 동기가 저하된다.

---

## 8. 러버밴딩·동적 난이도 — 플레이어 상태로 가속을 미세조정 `LD-DDA`

**정의.** 플레이어의 현재 수행(잔여 표적·실수·진행속도)을 측정해 난이도를 실시간 미세조정하는 것. 아케이드의 'Cruise Elroy'식 상황 가속이 고전적 사례다.

**왜 통하나.** Pac-Man의 Blinky 'Cruise Elroy'가 원형 DDA다 — 남은 펠릿이 임계치(통설: L1 잔여 20개) 이하로 떨어지면 Blinky가 가속하고, 두 번째 임계치(통설: L1 10개)에서 또 가속하며 scatter 때도 코너 대신 Pac-Man을 추격한다(구체 임계 펠릿·퍼센트는 Dossier 통설로 정밀 확정은 1차 자료 필요). 즉 '거의 클리어 직전'에 압박을 키워 마무리를 긴장시킨다 — 현대 DDA·러버밴딩의 직계 조상이다.

**구체 규칙(체크리스트).**

- [ ] **진행도 기반 가속** — 표적이 X% 남으면 위협 속도 +n%, Y%에서 추가 가속(Cruise Elroy 2단 임계).
- [ ] **마무리 압박** — '거의 끝'일수록 살짝 어렵게 해 클리어를 짜릿하게(완전 무위협 마무리 금지).
- [ ] **실패 시 완충(러버밴딩)** — 연속 사망/실수 감지 시 다음 시도 난이도를 소폭 하향해 좌절 방지.
- [ ] **조정은 은밀·소폭** — '봐준다'고 느끼지 않게 `±5~10%` 범위, 텔레그래프와 병행.

**우리 엔진 적용.** 단일화면 게임에서 잔여 비율로 적 속도 배율을 단계 분기한다.

```js
// Cruise Elroy식 2단 상황 가속 — 잔여 표적 비율로 마무리를 긴장시킴
function elroyMul(remaining, total) {
  var ratio = remaining / total;
  if (ratio < 0.20) return 1.10;  // 거의 끝 → +10%
  if (ratio < 0.40) return 1.05;  // 막바지 → +5%
  return 1.0;
}
// scatter 모드에서도 추격으로 전환하는 elroy 플래그를 함께 켠다
// Phaser4: this.events.on('update', ...) 에서 매 프레임 비율 체크
```

`runeburst`는 `moves` 잔여가 적을 때 힌트 강조/완화로 러버밴딩이 가능하고, **교착 시 자동 셔플**(이미 구현)이 일종의 안티프러스트레이션 DDA다. `is-rule`은 undo 무제한이 실패 비용을 완충한다(`LD-CHECKPOINT`).

**주의·안티패턴.**
- DDA가 과하면 '항상 아슬아슬'해 실력 향상이 점수에 반영 안 됨 → 성취감 상실.
- 노골적 러버밴딩은 들키면 몰입·공정성을 훼손한다.
- 마무리 가속이 무작위 기습이면 `LD-FAIR` 위반 — 결정적 텔레그래프(§6)와 결합이 필수다.

---

## 9. 단일화면 4비트 — 한 웨이브 안의 도입·전개·비틀기·마무리 `LD-4BEAT`

**정의.** 한 레벨/한 화면을 (1)메카닉 도입 →(2)발전(안전망 제거)→(3)비틀기(예상 밖 조합)→(4)마무리(숙달 확인)의 4단 자기완결 쇼케이스로 구성하는 것. 아케이드 단일화면에선 '한 웨이브 안의 4단계 페이즈'로 압축한다.

**왜 통하나.** 이 4단 구조(introduction→development→twist→resolution)를 명시적 설계 원리로 정식화한 주체는 닌텐도의 디렉터 Koichi Hayashida다 — 개념은 만화 4컷(kishōtenketsu, 起承轉結)의 영향에서 출발해 Super Mario Galaxy 2(2010)·3D Land(2011) 무렵 발전했고, Hayashida가 kishōtenketsu를 명시적으로 언급한 1차 출처는 2012년 Gamasutra/Game Developer 인터뷰(Christian Nutt, 대상 게임 Super Mario 3D Land)다. Mark Brown의 GMTK 영상 'Super Mario 3D World's 4 Step Level Design'(2015)은 이 닌텐도식 방법론을 4단 라벨로 정리해 **대중화·해설**한 것이다('GMTK가 정식화'는 과장이며 영상 자체도 구조를 Hayashida에게 귀속한다). 아케이드 단일화면에선 한 웨이브를 4페이즈로 압축할 수 있다.

**구체 규칙(체크리스트).**

- [ ] **도입(起)** — 새 메카닉을 안전하게 1회 노출(`LD-TEACH`).
- [ ] **전개(承)** — 같은 메카닉을 안전망 없이 반복 — 난이도 한 칸 상승.
- [ ] **비틀기(轉)** — 기존 메카닉을 새 맥락/조합으로 — 예상 깨기(예: 익숙한 위협 + 새 제약 동시).
- [ ] **마무리(結)** — 비튼 요소를 종합한 짧은 클라이맥스 후 종료 — 그 메카닉은 다음 레벨에서 버림.

**우리 엔진 적용.** `runeburst`의 12레벨 묶음을 4비트 메타 구조로 읽을 수 있다.

| 비트 | 레벨 | 내용 |
|---|---|---|
| 도입(起) | L1-2 | 기본 매치/캐스케이드 |
| 전개(承) | L3-4 | 라인 블래스터/컬러 코어 특수타일 |
| 비틀기(轉) | L5-9 | jelly/ice/spreader/ingredient 블로커 1종씩 새 조합 |
| 마무리(結) | L10-12 | `overload`+`ice` 복합 (L12 '마지막 한 수') |

단일 레벨 내부도 4비트로 배치할 수 있다 — 보드 상단을 안전(도입), 중단을 블로커 밀집(전개·비틀기), 목표 타일을 하단(마무리)에. `is-rule`은 이미 레벨군이 PUSH→규칙끊기→규칙짓기→YOU전환→캡스톤으로 4비트 흐름을 이룬다(L3 '밀어내기'→L4 '규칙을 끊다'→L5 '규칙을 짓다'→L6 '내가 바뀐다'→L11 '뒤엉킨 규칙').

**주의·안티패턴.**
- 비틀기 없이 전개만 반복하면 단조하다 — 반드시 예상을 깨는 한 수.
- 한 화면에 메카닉 여러 개를 4비트로 동시에 돌리면 인지 과부하.
- 마무리가 클라이맥스가 아니라 또 다른 도입이면 완결감을 잃는다.

---

## IP 안전 메모

레벨 디자인의 **원칙·기법·메카닉은 저작권 보호 대상이 아니므로 자유롭게 차용**한다 — 톱니 곡선, scatter/chase 페이싱, 결정적 고스트 타게팅, Cruise Elroy 상황 가속, frames-per-cell 곡선, 색층 점수 같은 *설계 패턴*은 마음껏 쓴다. 단, 금지선은 명확하다.

- **고유명·에셋 금지.** 'Space Invaders'·'Pac-Man'·'Blinky/Pinky/Inky/Clyde'·'Tetris'·'Tetrimino'·'Breakout' 같은 명칭, 원작 스프라이트/사운드/UI, 특정 고스트 캐릭터 디자인을 그대로 쓰지 않는다. 외계인·고스트·블록은 `VectorForge`/`PixelForge`로 다른 실루엣·팔레트의 오리지널로 굽는다(이 저장소 `runeburst`의 네온 룬, `super-runner`의 '빨간 모자 러너'가 그 방식이다).
- **특정 레벨 레이아웃 복제 금지.** 마리오 1-1, 특정 캔디크러시 스테이지, Pac-Man 미로의 정확한 벽 배치를 1:1 복제하지 않는다 — 기법(웨이브 톱니, 페이즈 페이싱)만 가져와 **절차생성/오리지널 배치**로 재구성한다. NES Tetris 중력표 같은 수치는 통념적 튜닝 기준점으로 참고하되, 곡선은 자체 `difficultyCurve()`로 새로 정의한다.
- **결정성은 시드로 환기.** `mulberry32` 시드 PRNG로 보드/스폰을 결정적으로 만들면(이미 `runeburst`의 `seed` 필드가 그렇다) 원작 레이아웃을 베끼지 않고도 '공정한 패턴 학습·데일리 공유'를 오리지널로 구현할 수 있다.

본 자료는 GMTK·GDC 공개 분석과 디자인 통념(The Art of Game Design, The Pac-Man Dossier, Level Up!, The Level Design Book)을 한글로 소화한 것이며, 법률 자문이 아니다. 상세 게이트는 [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md).

---

## 연계

- **장르 스킬 (빌드 위임):** 이 파일의 처방은 [`arcade-classic`](../../../wgf-arcade-classic/SKILL.md) 스킬로 이어진다 — 벽돌깨기·스네이크·스택·픽스드 슈터 같은 단일화면 아케이드를 빌드할 때 `difficultyCurve()`·`phaseTimer`·`elroyMul()` 패턴을 적용한다.
- **인접 장르 파일:** 자동 전진·절차생성은 [./runner-procedural-levels.md](./runner-procedural-levels.md), 탄막/아레나 페이싱은 [./shooter-arena-levels.md](./shooter-arena-levels.md), 매치·규칙조작 퍼즐 곡선은 [./puzzle-levels.md](./puzzle-levels.md), 차징 점프 곡선은 [./platformer-levels.md](./platformer-levels.md).
- **제작요소 스킬:** 절차적 스프라이트는 `PixelForge`/`VectorForge`, 콤보 피치 스택·페이즈 전환음은 `ChipAudio`, 시드/결정성·점수 팝업·스크린셰이크는 `juice-fx`. 엔진 API는 [../../../wgf-web-game-builder/reference/engine-api.md](../../../wgf-web-game-builder/reference/engine-api.md), Phaser 4 색인은 [../../../wgf-web-game-builder/reference/phaser/INDEX.md](../../../wgf-web-game-builder/reference/phaser/INDEX.md).
- **레벨 빌드 메카닉:** 실제 레벨 데이터 산출(웨이브 테이블·`LEVELS` 배열 작성)은 [`level-designer`](../../../wgf-level-designer/SKILL.md)로 위임한다 — 본 파일은 *왜·어떻게* 곡선을 잡는지의 원칙, `level-designer`는 그 산출 실무다.
- **인터뷰:** 난이도 곡선·목표·페이싱 요구사항 도출은 [../level-interview.md](../level-interview.md) 플레이북. 공통 원칙 사전은 [./principles.md](./principles.md), 재미요소(`FE-*`)는 [../../../wgf-web-game-builder/reference/game-dna/fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md).
