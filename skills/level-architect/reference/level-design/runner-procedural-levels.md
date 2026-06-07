# 러너·엔드리스·절차생성 레벨 디자인

> WebGameForge 레벨 디자인 레퍼런스. 러너/엔드리스/절차생성 장르에서 '레벨'은 정적 배치가 아니라 **생성 규칙 + 패턴 풀 + 시퀀싱 정책**이라는 점을 다룬다. 청크 풀, 가중 시퀀싱, 시드 PRNG, 항상통과 검증, 점증 가속, 호흡 배치를 우리 엔진(Phaser 4 + Arcade) 코드 힌트와 함께 정리한다. 원칙 사전은 [./principles.md](./principles.md), 색인은 [./INDEX.md](./INDEX.md), 매치3/퍼즐 인코딩은 [./puzzle-levels.md](./puzzle-levels.md)와 함께 본다.

이 문서는 **메카닉·원칙만** 다룬다. 고유명·에셋·특정 레벨 레이아웃은 차용하지 않으며, 모든 코스는 절차생성 오리지널로 환기한다(맨 아래 [IP 안전 메모](#ip-안전-메모) 참고). 법률 자문이 아니다.

## 한눈에 보기

| LD 태그 | 한 줄 | 1순위 불변식? |
|---|---|---|
| `청크-패턴풀`(NEW) | 손으로 검증한 조각을 절차적으로 잇는다 | 구조 |
| `LD-SOLVABLE` | 어떤 코스도 끝까지 갈 수 있다 | ✅ 1순위 |
| `LD-FAIR` | 회피 가능한 죽음, 기습 금지, 반응시간 보장 | ✅ 1순위 |
| `LD-BUDGET` | 비용 예산으로 가중 추첨해 난이도를 통제 | 곡선 |
| `LD-CURVE` | 점증 가속 + 톱니형 난이도 | 곡선 |
| `LD-PACING` | 정점 뒤 쉼표(sprint↔rest) | 호흡 |
| `LD-4BEAT` | 구간 단위 도입→전개→비틀기→마무리 | 학습 |
| `시드-재현성`(NEW) | 같은 시드면 같은 코스(일일/리플레이) | 인프라 |
| `LD-FLOW-CHANNEL` | 도전↔실력 균형 유지(선택적 DDA) | 개인화 |

> **핵심 한 줄:** 러너 엔드리스의 레벨 설계는 "장애물을 무작위로 뿌리는 것"이 아니라, **항상통과(`LD-SOLVABLE`)와 공정성(`LD-FAIR`)을 절대 불변식으로 깔고**, 그 위에 난이도 곡선·호흡·학습 리듬을 데이터로 얹는 일이다. 하나라도 깨지면 '부당한 죽음'이 되어 모바일 이탈로 직결된다.

이 저장소의 `super-runner`처럼 `LEVEL`을 통짜 선언 블록으로 두는 현재 방식은 '한 판 손배치 데모'다. 엔드리스화하려면 그 `features` 목록을 (1)티어 태깅된 청크 풀, (2)budget 기반 가중 시퀀서, (3)연결부 도달가능성 게이트, (4)seeded rng로 분해하는 게 정석 리팩터다.

---

## `청크-패턴풀` — 손으로 빚은 조각을 절차적으로 잇기

**정의.** 레벨을 통째로 절차생성하지 않고, 디자이너가 손으로 검증한 '패턴 조각(chunk/prefab)'을 풀에 담아 두고 런타임에 이어 붙여 무한 코스를 만든다. 각 조각은 그 자체로 한 번 통과 가능한 의미 단위다 — 점프 시퀀스, 계단, 스프링, 휴식 거리.

**왜 통하나.** Tommy Thompson이 'Sure Footing'의 절차생성을 분석한 글(Game Developer/Gamasutra, 'Keep Running')이 이 철학의 정수다 — '액션 제너레이터 17종 + 지오메트리 제너레이터 3종'으로 hopscotch·계단(stairwell)·드롭·스프링 같은 손으로 만든 변형을 풀에 쌓고, 추상 액션을 먼저 뽑은 뒤 거기에 맞는 prefab을 채운다. 순수 알고리즘 생성이 만드는 '지저분하고 초점 없는 레벨'과 달리, Derek Yu의 Spelunky도 방 템플릿(room template) 집합을 절차적으로 배치하는 같은 절충을 쓴다(Boss Fight Books의 Spelunky 단행본, Darius Kazemi의 'Spelunky Generator Lessons'). 손맛(authored)과 무한성(procedural)의 절충점이라 모바일 엔드리스에 최적이다.

**구체 규칙(체크리스트).**

| 항목 | 규칙 |
|---|---|
| 티어 분류 | `easy` 8~12개, `medium` 8~12개, `hard` 6~10개로 분류 |
| 변형 수 | 같은 의미(점프 한 칸)라도 변형 3개 이상 — 인지 단조로움 차단 |
| 가로 길이 | 화면 폭(`super-runner` 기준 24타일)의 0.5~1.5배. 너무 길면 패턴 인지가 흐려지고, 너무 짧으면 이음새가 잦다 |
| 연결 메타 | '입구 높이=출구 높이' 또는 명시된 높이 델타를 메타로 보관해 연결부가 항상 도달 가능 |

각 조각 메타 권장 형태: `{ id, tier, widthTiles, entryRow, exitRow, minSpeed, tags:['pit','stair','gap'] }`. `minSpeed`는 '이 속도 이하에서만 공정한' 조각임을 표시한다.

**우리 엔진 적용.** `super-runner`의 `features`/`pits`/`pipes`를 통짜 `LEVEL` 대신 청크 풀로 재구성하고, 빌드 함수가 `cursorCol`을 누적시키며 청크 cells의 `c`에 `cursorCol`을 더해 전역 좌표로 펼친다.

```js
// super-runner: LEVEL(통짜) → CHUNKS(풀) 재구성
// 기존 스키마: LEVEL = { width, rows, groundTop, pits:[[s,e]], features:[{t,c,r}], pipes, goal, start }
// 각 청크는 LEVEL의 한 조각을 로컬 좌표(c=0부터)로 떼어 낸 것.
var TILE = 16, ROWS = 14, GROUND_TOP = 12;

var CHUNKS = [
  // ── easy: 평지 코인길 (rest piece로도 재사용) ──────────────────
  { id: 'flat-coins', tier: 'easy', cost: 0, weight: 4,
    widthTiles: 12, entryRow: 12, exitRow: 12, pits: [],
    cells: [ { t: 'o', c: 4, r: 9 }, { t: 'o', c: 6, r: 9 }, { t: 'o', c: 8, r: 9 } ] },

  // ── easy: 단일 구덩이 (도달 가능 폭) ──────────────────────────
  { id: 'pit-1', tier: 'easy', cost: 1, weight: 3,
    widthTiles: 10, entryRow: 12, exitRow: 12, pits: [[4, 6]],
    cells: [ { t: 'o', c: 3, r: 8 }, { t: 'o', c: 5, r: 7 }, { t: 'o', c: 7, r: 8 } ] },

  // ── medium: 계단 + 공중 발판 ─────────────────────────────────
  { id: 'stair-up', tier: 'medium', cost: 3, weight: 2,
    widthTiles: 14, entryRow: 12, exitRow: 9, pits: [],
    cells: [ { t: 'S', c: 2, r: 11 }, { t: 'S', c: 3, r: 10 }, { t: 'S', c: 4, r: 9 },
             { t: 'B', c: 8, r: 6 }, { t: 'B', c: 9, r: 6 }, { t: 'o', c: 8, r: 4 } ] },

  // ── hard: 연속 구덩이 (정점) ─────────────────────────────────
  { id: 'pit-chain', tier: 'hard', cost: 5, weight: 1,
    widthTiles: 16, entryRow: 12, exitRow: 12, pits: [[3, 5], [9, 11]],
    cells: [ { t: 'o', c: 4, r: 7 }, { t: 'o', c: 10, r: 7 }, { t: 'e', c: 14, r: 11 } ] }
];

// 청크를 전역 좌표로 펼치며 통짜 LEVEL과 동형의 features/pits를 누적
function expandChunks(chunkSeq) {
  var features = [], pits = [], cursor = 4; // 시작 안전구간 4타일
  chunkSeq.forEach(function (ch) {
    ch.cells.forEach(function (f) { features.push({ t: f.t, c: f.c + cursor, r: f.r }); });
    ch.pits.forEach(function (p) { pits.push([p[0] + cursor, p[1] + cursor]); });
    cursor += ch.widthTiles;
  });
  return { width: cursor + 6, rows: ROWS, groundTop: GROUND_TOP, pits: pits, features: features };
}
```

`runeburst`는 `LEVELS` 배열 자체가 이미 '손으로 빚은 스테이지 풀'이므로, `shape`/blocker 조합을 청크 메타처럼 티어 태깅하면 동일 패턴이 된다. `is-rule`도 `ent` 격자 + `texts`를 '퍼즐 조각'으로 보고 `par`/규칙 수로 티어링한다.

**주의/안티패턴.**
- 조각 수가 너무 적으면(각 티어 4개 미만) 모바일 반복 플레이에서 즉시 외워져 지루해진다.
- 조각 메타에 entry/exit 높이를 안 넣고 이으면 연결부에서 도달 불가능한 점프가 생긴다(→ `LD-SOLVABLE`).

---

## `LD-SOLVABLE` — 항상 통과 가능 보장: 해결 경로 먼저, 장식은 나중

**정의.** 절차생성의 1순위 불변식이다. 생성된 어떤 코스도 '반드시 끝까지 갈 수 있어야' 한다. 무작위로 장애물을 뿌리고 통과되길 기대하는 게 아니라, **먼저 보장된 통과 경로(solution path)를 깐 뒤** 그 위에 위험·보상을 얹는다.

**왜 통하나.** Spelunky의 핵심 알고리즘이 이것이다(Darius Kazemi의 'Spelunky Generator Lessons', Derek Yu 원작 알고리즘 재현). 4×4=16방 그리드에서 입구 방을 두고 1~5 난수로 좌/우/아래로 '솔루션 경로'를 먼저 카브하며, 경로상의 방은 출구가 보장된 템플릿(type1=좌우 통과, type2=바닥 뚫림, type3=상단 열림)으로만 채워 '장애물을 얹기 전에 수학적으로 완주 가능'하게 만든다. Canabalt도 Adam Saltsman이 '점프가 항상 도달 가능하도록 보장하면서 흥미로운 난이도를 유지'한다고 밝혔다(Game Developer). 무한 러너에서 단 하나의 불가능 점프가 곧 부당한 죽음(`LD-FAIR` 위반)이다.

**구체 규칙(체크리스트).**
- **러너:** 조각을 잇기 전, 시작 속도에서의 점프 포물선으로 (구덩이 폭 + 착지대 높이차)가 도달 가능한지 검증. `exitRow - nextEntryRow`가 점프 가능 높이(예: 4타일) 이하, 구덩이 폭이 최대 점프 거리(예: 5타일) 이하인 조각만 연결 허용.
- **매치3:** 시작 보드에 최소 1개의 유효 매치(swap 1회로 3매치 성립)가 존재하도록 셔플하고, 교착(가능한 수 0) 감지 시 자동 셔플 — 항상 풀 수 있는 상태 유지.
- **퍼즐:** `par`(최적 이동수) 해가 실제로 존재하도록 생성/검증한 배치만 `LEVELS`에 넣는다. BFS/DFS 솔버로 풀이 가능성을 사전 검증.
- **장식:** 코인·적·블로커는 솔루션 경로의 '통과 가능성'을 절대 깨지 않는 위치에만 — 코인은 경로 위/근처, 적은 회피 가능 간격을 확보.

```js
// 러너: 두 청크의 '이음새'가 도달 가능한지 게이트
function canReach(prevExitRow, nextEntryRow, gapWidth, jump) {
  // jump = { maxUpTiles, maxGapTiles } — 시작 속도 기준 점프 능력
  var rise = prevExitRow - nextEntryRow;     // 양수=올라감
  if (rise > jump.maxUpTiles) return false;  // 너무 높이 점프해야 함
  if (gapWidth > jump.maxGapTiles) return false; // 구덩이가 너무 넓음
  return true;
}

function pickNextChunk(pool, prev, jump, rng) {
  var ok = pool.filter(function (ch) {
    var gap = ch.pits.length ? (ch.pits[0][1] - ch.pits[0][0] + 1) : 0;
    return canReach(prev.exitRow, ch.entryRow, gap, jump);
  });
  return ok[Math.floor(rng() * ok.length)]; // 통과 가능 조합만 후보
}
```

`runeburst`는 이미 이 불변식을 코드로 갖췄다 — 보드 생성 직후 `hasMove()` 검사 후 교착이면 `shuffleBoard()`를 호출한다(`if (!this.hasMove()) this.shuffleBoard(true);`). 캐스케이드 직후에도 `if (!this.hasMove()) this.shuffleBoard(false);`로 재검사한다. `is-rule`은 레벨 로드 시 또는 오프라인 도구로 솔버를 돌려 `par` 내 해 존재를 보증한 `ent`/`texts`만 출고한다.

**주의/안티패턴.**
- 장애물을 먼저 뿌리고 '대충 통과되겠지' 가정하는 것 — 엔드리스에서는 확률적으로 반드시 불가능 구간이 나온다.
- 연결부(이음새) 검증을 빼먹는 것: 각 조각은 통과 가능해도 두 조각의 경계에서 도달 불가가 생긴다.

---

## `LD-BUDGET` — 가중 시퀀싱 + 난이도 예산

**정의.** 다음 조각을 뽑을 때 균등 무작위가 아니라, 현재 거리/시간/플레이어 속도에 연동된 '예산(budget)'으로 가중 추첨한다. 각 조각엔 비용(cost)이 매겨지고, 예산이 늘수록 비싼(어려운) 조각이 풀려 난이도가 통제된 채로 상승한다.

**왜 통하나.** 'Sure Footing'의 명시적 설계다 — 각 서브시스템은 budget 위에 세워지고, '레벨 생성기 결정에 부여된 비용값이 레벨의 크기와 강도를 제약한다.' 각 패턴 변형이 고유 cost를 가져 '쉬운 버전→어려운 버전의 연속체'를 만들고, 예산이 점진 증가하며 더 어려운 콘텐츠를 연다(Game Developer). 온디바이스 게임 엔진 아키텍처를 다룬 특허 문헌도 'seed 값이 높을수록 더 복잡한 set piece를 더 많이 포함하도록 무작위 선택을 bias'한다고 같은 원리를 기술한다. 균등 추첨은 난이도 곡선을 통제하지 못하지만, 가중 + 예산은 `LD-CURVE`를 데이터로 만든다.

**구체 규칙(체크리스트).**

| 노브 | 규칙 |
|---|---|
| budget 식 | `budget = base + k * (distance 또는 elapsedTime)` |
| 후보 게이트 | `cost <= budget`인 조각만 후보로 |
| weight vs cost | weight='얼마나 자주', cost='언제부터' — 분리 제어. 어려운 조각도 등장 직후엔 낮은 weight로 가끔만 |
| cost 배분 | easy 0~1, medium 2~3, hard 4~6. budget이 4를 넘기 전엔 hard 게이트 |
| 연속 hard 방지 | 직전 N개 cost 합이 임계치 초과면 다음은 강제 휴식/easy(→ `LD-REST`) |

```js
// 가중 시퀀서: cost로 게이트, weight로 룰렛
function chooseChunk(pool, budget, rng, recentCostSum, restThreshold) {
  // 연속 hard 후 강제 휴식 (LD-PACING 연동)
  if (recentCostSum > restThreshold) {
    var rests = pool.filter(function (c) { return c.cost <= 1; });
    return rests[Math.floor(rng() * rests.length)];
  }
  var avail = pool.filter(function (c) { return c.cost <= budget; });
  var total = avail.reduce(function (s, c) { return s + c.weight; }, 0);
  var roll = rng() * total;
  for (var i = 0; i < avail.length; i++) {
    roll -= avail[i].weight;
    if (roll <= 0) return avail[i];
  }
  return avail[avail.length - 1];
}

// 거리 기준 budget (시간 기준보다 공정 — 느린 플레이어를 처벌하지 않음)
function budgetAt(chunkIndex) { return 2 + 0.6 * chunkIndex; }
```

`runeburst`에 무한 모드를 붙인다면 `colors`/`moves`/`goal`/blocker 수를 budget 함수로 산출한다: `colors = 5 + floor(budget/4)`, `moves = max(10, 30 - floor(budget))`, 블로커 수 `= floor(budget/3)`. `is-rule`의 무한/일일 모드라면 `par`·규칙 수·통로 길이를 budget으로 스케일한다.

**주의/안티패턴.**
- weight와 cost를 안 나누면, 어려운 조각이 '풀리자마자 자주' 나와 난이도가 계단이 아니라 절벽이 된다.
- budget을 시간(elapsedTime) 기준으로만 잡으면 느린 플레이어가 부당하게 빨리 어려워진다 — 거리/진척 기준이 더 공정하다.

---

## `LD-CURVE` — 점증 가속 + 톱니형 난이도 곡선

**정의.** 엔드리스의 시간 차원 난이도는 (1) 게임 속도/스폰 빈도의 단조 상승과 (2) 그 위에 얹힌 톱니(sawtooth) — 잠깐 쉬웠다가 정점, 다시 완화 — 두 축으로 만든다. 새 장애물을 추가하기보다 '같은 장애물을 더 빠른 속도에서 요구'하는 skill-gating이 핵심이다.

**왜 통하나.** Csikszentmihalyi의 flow 이론을 게임에 적용한 Jesse Schell은 'The Art of Game Design: A Book of Lenses'에서 flow를 도전 상승→보상→완화가 반복되는 'tense and release(긴장과 이완)' 사이클로 설명하며, 이 진동을 통해 플레이어를 flow 채널 안에 유지하라고 처방한다 — 이것이 톱니/intensity ramp다(흔히 인용되는 'Oscillation Method'라는 명칭은 Schell 본인의 책 용어가 아니라 그의 flow-channel 논의를 해설한 2차 글에서 붙은 라벨이며, tense-and-release는 flow의 대안이 아니라 flow를 실현하는 방식 그 자체다). Orçun Nişli의 엔드리스 러너 분석은 'Subway Surfers의 공중 제어(스와이프 다운)는 저속에선 불필요하지만 최고속에선 필수가 된다'며 새 메카닉 추가 없이 기존 도전을 속도로 재요구하는 skill-gating을 핵심으로 든다. Canabalt는 '현재 속도'를 입력으로 다음 장애물을 정한다 — 속도가 곧 난이도 노브다.

**구체 규칙(체크리스트).**
- `speed = baseSpeed * (1 + min(distance/D, capRatio))`. 상한(cap)을 둬 인간 반응한계 너머로 가속하지 않는다(→ `LD-FAIR`).
- 매 K개 조각마다 의도적 '저점' 삽입: 직전이 정점이었으면 다음은 cost 낮은 조각으로 한 박자 쉬어 톱니를 만든다.
- 새 장애물 종류는 '거리 마일스톤'에서만 도입(→ `LD-4BEAT`/`한 레벨 한 개념`): 0m 구덩이만, 300m 적 추가, 600m 공중 발판 추가 식으로 단계적.
- 속도 상승은 부드럽게(프레임당 미세 증가), 시각/청각 피드백(배경 스크롤·BPM 상승)으로 가속을 '느끼게'.

```js
// 속도(난이도)와 조각 budget을 같은 distance로 연동 — 두 축이 함께 상승
var BASE_SPEED = 90, SPEED_CAP_RATIO = 1.6, RAMP_DIST = 3000;

function scrollSpeedAt(distance) {
  var t = Math.min(distance / RAMP_DIST, SPEED_CAP_RATIO);
  return BASE_SPEED * (1 + t); // cap으로 인간 반응속도(~250ms) 보호
}
// budgetAt(chunkIndex)도 distance에 연동해 속도·조각난이도가 같이 오름.
// 톱니는 chooseChunk의 '연속 hard 후 강제 easy'로 구현된다.
```

`super-runner`는 현재 정적 `LEVEL`이다. 엔드리스화 시 `scrollSpeed`를 distance 함수로, `chooseChunk`의 budget도 동일 distance로 연동해 두 축이 함께 오르게 한다. `runeburst`의 `LEVELS`는 `colors`↑/`moves`↓/`goal`↑가 이미 단조 상승 곡선이다 — 사이사이 쉬운 스테이지(작은 `shape`, 블로커 0)를 끼워 톱니화한다. `is-rule`의 '새 규칙 1개씩' 마일스톤 도입은 `한 레벨 한 개념`+`LD-CURVE`를 동시에 충족한다.

**주의/안티패턴.**
- 속도를 무한 가속하면 어느 순간 인간 반응속도(약 250ms)로 회피 불가 — 반드시 cap.
- 단조 상승만 있고 톱니(쉼)가 없으면 긴장이 누적돼 피로/이탈. 정점 뒤 회복이 곡선의 절반이다.

---

## `LD-FAIR` — 공정성: 회피 가능한 죽음, 기습 금지, 반응시간 보장

**정의.** 절차생성 러너의 신뢰는 '내 실수로 죽었다'는 납득에서 온다. 화면에 들어오는 순간 회피 불가능한 장애물(기습), 인지 후 반응할 물리적 시간이 없는 배치는 금지다. 모든 위협은 텔레그래프되고, 최소 반응 거리가 보장돼야 한다.

**왜 통하나.** TV Tropes의 'Anti-Frustration Features' 대 'Fake Difficulty' 대비가 명확하다 — 회피 불가능한 장애물은 가짜 난이도다. Nişli는 '날아오는 장애물이 회피 불가능하지 않도록 보장해야' 하며 '플레이어 반응시간과 실력이 성패를 가르게(impossible-to-avoid가 아니라)' 해야 한다고 못박는다. Canabalt가 '점프가 항상 도달 가능'하도록 보장하는 것도 같은 원칙이다. 부당한 죽음 한 번이 모바일에선 즉시 이탈로 직결된다.

**구체 규칙(체크리스트).**

| 항목 | 규칙 |
|---|---|
| 최소 텔레그래프 거리 | 장애물은 화면 진입 후 `(현재속도 × 0.4초)` 이상 남기고 회피 입력이 가능해야 함. 속도가 오르면 최소 간격도 함께 늘림 |
| 동시 위협 상한 | 한 화면에 동시 회피 요구 위협은 1개(초급)~2개(상급). 점프로만/슬라이드로만 피하는 걸 같은 순간에 강요 금지 |
| 도입 면죄 | 첫 N초(또는 첫 조각)는 죽지 않는 안전 구간으로 시작(→ `무텍스트로 가르치기`) |
| 기습 금지 | 화면 밖에서 즉사하는 적/투사체가 회피 입력 없이 들어오지 않게 — 위협은 항상 보이는 곳에서 등장 |

```js
// 속도에 비례한 최소 간격 — 고속에서 자동으로 회피 불가가 생기지 않게
function minGapTiles(scrollSpeed, tileSize) {
  var px = scrollSpeed * 0.4;            // 0.4초 분량의 거리
  return Math.ceil(px / tileSize) + 1;   // 최소 1타일 여유
}

// 청크 연결 시 minGapAfter 보정: 이전 위협과의 간격을 현재 속도로 동적 확장
function placeChunk(chunk, cursor, scrollSpeed) {
  var need = minGapTiles(scrollSpeed, 16);
  var startCol = cursor + Math.max(chunk.minGapAfter || 0, need);
  return startCol;
}
```

`super-runner`는 청크 메타에 `minGapAfter`(이전 위협과의 최소 간격)를 추가하고, 빌드 시 현재 속도로 최소 간격을 동적 보정한다. 적/구덩이가 도입 첫 조각엔 안 나오게 tier 게이트한다. `runeburst`는 블로커가 한 번에 너무 많이 spread돼 무브 안에 못 풀게 되는 상황을 budget 상한으로 방지한다(공정한 `goal`/`moves` 비). `is-rule`은 '한 수 무르기(undo)' 또는 즉시 리셋으로 실패 비용을 낮춰(→ `LD-CHECKPOINT`) 부당함 체감을 완화한다.

**주의/안티패턴.**
- 속도만 올리고 최소 간격을 안 늘리면 고속에서 자동으로 회피 불가가 발생 — 간격을 속도에 비례시켜라.
- 두 종류 회피(점프+슬라이드)를 동시에 요구하는 조각을 풀에 넣으면 상급에서도 부당하게 느껴진다.

---

## `시드-재현성` — 같은 시드면 같은 코스(일일 챌린지·리플레이)

**정의.** 모든 절차 결정을 단일 시드로 초기화한 PRNG에서만 뽑아, 같은 시드는 어떤 기기/브라우저에서도 비트 단위로 동일한 코스를 만든다. 이게 일일 챌린지, 리더보드 공정성, 리플레이, 버그 재현, 공유 시드를 가능케 한다.

**왜 통하나.** PRNG의 정의 자체가 '시퀀스가 시드로 완전히 결정됨'이다. 실무 패턴: 날짜 문자열을 32비트 정수로 해시→`mulberry32` PRNG 시드→모든 생성 난수를 이 시퀀스에서 뽑으면 '네트워크 요청 없이 모든 기기에서 같은 날 같은 퍼즐'이 된다(Dave Clare의 deterministic shuffling 글). Minecraft 시드 공유가 같은 원리다. **이 저장소의 `runeburst`가 이미 `LEVELS`에 `seed` 필드를 갖고 `mulberry32(this.cfg.seed)`로 RNG를 초기화한다는 점이, 이 저장소가 재현성을 의도했다는 증거다.**

**구체 규칙(체크리스트).**
- `Math.random()`을 절차 경로에서 절대 직접 쓰지 않는다 — 전부 seeded `rng()`로 교체. 비결정 소스(시간, 부동소수 누적) 배제.
- 일일 챌린지: `seed = hash('YYYY-MM-DD')`. 공유 코드: seed를 base36 문자열로 노출해 친구가 같은 코스 도전.
- 생성 순서 고정: 청크 선택→장식 배치→적 배치 순서를 고정하고 각 단계가 `rng`를 순서대로 소비 — 순서가 바뀌면 같은 시드도 다른 결과.
- 리플레이/버그리포트: 실패 시 `seed` + 입력 로그를 저장하면 정확히 재현.

```js
// 이 저장소 runeburst가 실제로 쓰는 PRNG (game.js에 존재)
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 일일 시드: 날짜 → 정수 (runeburst의 데일리 모드 패턴)
// this.cfg.seed = parseInt(dateKey.replace(/-/g, ''), 10);  // 'YYYY-MM-DD' → 정수
var rng = mulberry32(seedFromDate('2026-06-07'));
// 이후 모든 절차 결정(chooseChunk·장식·적)이 이 rng만 소비 → 전 기기 동일 코스
```

> **Phaser-native 대안.** Phaser는 시드 가능한 RNG로 `Phaser.Math.RND`를 제공한다 — `Phaser.Math.RND.sow(['my-seed-string'])`로 시드를 심고 `Phaser.Math.RND.between(a, b)`/`.pick(arr)`/`.frac()`으로 소비한다. 다만 `Phaser.Math.RND`는 **전역 싱글톤**이라 씬/플러그인이 공유한다 — 절차 경로를 격리하려면 `new Phaser.Math.RandomDataGenerator(['seed'])`로 전용 인스턴스를 만들어 그것만 소비하는 편이 안전하다. 이 저장소는 외부 의존을 줄이려 `mulberry32`를 직접 들고 있으므로, 공용 `makeRng(seed)` 유틸을 `engine/`에 두고 `super-runner`의 `chooseChunk`·장식 배치를 전부 이 `rng`로 돌리는 게 일관적이다.

`runeburst`는 `seed` 필드를 보드 채움/블로커 배치 rng에 실제로 연결해 둔 상태다. `is-rule`은 절차 배치를 한다면 동일 rng를 쓰고, 손배치 레벨은 본래 결정적이라 무관하다. 모바일 웹뷰라 네트워크 없이 같은 코스를 보장하는 게 특히 가치가 크다.

**주의/안티패턴.**
- 라이브러리 내부(Phaser 셔플 등)가 전역 `Math.random`을 쓰면 재현성이 깨진다 — 절차 경로는 자체 `rng`로 격리.
- 객체 순회 순서(JS 객체 키 순서)나 Set 순서에 의존하면 환경별로 달라질 수 있다 — 배열+정렬로 결정성을 고정.

---

## `LD-PACING` — 패턴 사이 호흡: 정점 뒤 쉼표(rest piece)

**정의.** 고강도 패턴(연속 구덩이, 적 무리, 빠른 점프 시퀀스) 직후엔 평탄한 회복 구간을 강제로 끼워, 강도의 상승·하강 파동을 만든다. 쉼표는 긴장을 비우고 다음 정점을 더 크게 느끼게 한다.

**왜 통하나.** 'Sure Footing'은 레벨 구조를 'sprint(플랫폼 도전 구간)'과 'rest piece(거리/평지)'로 명시적으로 교차한다(Game Developer). Schell의 interest curve는 '충격으로 시작→작은 순간으로 이완→점점 키워 대미를'로, 잘 띄운 휴식기(well-spaced rest periods)가 좋은 페이싱의 조건이라 본다. 강도 척도를 그래프로 그리는 실무는 The Level Design Book에도 소개돼 있다 — Valve 디자이너들이 레벨 페이싱을 위해 비트를 Explore/Combat/Choreo/Puzzle로 분류하고 X축=시간(분), Y축=강도(intensity, 책 원문 기준 0-100% / 0-5 / 0-10 중 택일하는 단순 수치 척도, 값은 플레이테스트 직관에서 나오는 'gut feeling')로 페이싱을 설계했다고 책이 GDC China 2014 'Level Design Workshop: Pacing' 발표(Valve 디자이너 Matt Scott)에 귀속해 소개한다. Mike Stout의 'Intensity Ramps'(Trinity 시리즈) Principle #5는 강도의 상대성을 경고한다 — "항상 11로 틀어놓으면 11이 새로운 5가 된다." 휴식 없이 정점만 이으면 flow 채널을 벗어나 불안(→ `LD-FLOW-CHANNEL`)으로 빠진다.

**구체 규칙(체크리스트).**
- 정점 조각(cost ≥ hard 임계) 직후엔 반드시 cost 0~1의 평지/코인길 조각 1개. 연속 정점 금지.
- 휴식 구간 길이는 직전 정점 강도에 비례: 큰 정점일수록 더 긴 호흡(예: 정점 3타일당 평지 2타일).
- 휴식 구간은 '아무것도 없음'이 아니라 코인 라인·낮은 보상으로 채워 지루함 방지(→ `LD-REWARD`).
- 리듬 권장 패턴: `easy → build → PEAK → rest → build → PEAK(더 큼) → rest`, 톱니로 반복.

`super-runner`는 `LD-BUDGET`의 '연속 hard 후 강제 easy' 규칙으로 rest piece를 보장하고, rest 조각은 `features`에 코인 라인만 둔 평지 청크(`flat-coins`)로 풀에 포함한다. `runeburst`는 어려운 스테이지(블로커 多) 다음에 의도적으로 가벼운 스테이지(블로커 0, 작은 보드)를 배치해 파동을 만든다. `is-rule`은 까다로운 규칙 상호작용 퍼즐 뒤에 `par` 짧은 '확인용' 쉬운 퍼즐로 호흡한다.

**주의/안티패턴.**
- 휴식 구간이 너무 길거나 텅 비면 지루함(boredom)으로 flow 이탈 — 짧고 보상 있게.
- 정점만 연속하면 모바일 세션에서 빠르게 피로해 이탈률이 오른다.

---

## `LD-4BEAT` — 도입→전개→비틀기→마무리(kishōtenketsu) 구간 단위 적용

**정의.** 엔드리스라도 '구간(스테이지/거리 블록)' 단위로 4비트 구조를 쓴다: (起)새 기믹을 안전히 소개 → (承)그 기믹을 변형·심화 → (轉)기믹을 비틀거나 다른 것과 결합 → (結)정점 보상으로 마무리. 한 기믹을 약 한 구간 안에서 가르치고 굴리고 비틀고 버린다.

**왜 통하나.** 이 4단계 레벨 구조(introduction→development→twist→resolution)를 명시적 설계 원리로 **정식화한 주체는 닌텐도의 디렉터 Koichi Hayashida**다(개념 자체는 Miyamoto의 만화 4컷 경험에서 유래해 Super Mario Galaxy 2/3D Land 무렵 발전, 2012년 Gamasutra/Game Developer의 Super Mario 3D Land 인터뷰에서 일본 서사론 kishōtenketsu(起承轉結)로 명시적으로 언급됨). Mark Brown의 Game Maker's Toolkit 영상 'Super Mario 3D World's 4 Step Level Design'(2015)은 이 닌텐도의 기존 방법론을 4단 구조로 정리해 **대중화·해설**한 것이며, 영상 스스로도 'according to the game's director Koichi Hayashida'라고 Hayashida에게 귀속한다(즉 'GMTK가 정식화'가 아니라 'Hayashida가 정식화(2012), Brown이 대중화(2015)'가 정확하다). 절차생성이라도 '구간 템플릿'을 이 4비트로 짜면 무작위 속에서도 학습-숙달 리듬이 산다.

**구체 규칙(체크리스트).**
- 한 거리 블록(예: 200~300m)을 하나의 기믹(예: 이동 발판)에 헌정. 起=안전한 단독 등장, 承=연속/간격 변형, 轉=기존 위협(적·구덩이)과 결합, 結=그 기믹을 활용한 보상 구간.
- 起 구간은 `무텍스트로 가르치기` 안전지대 — 실패해도 죽지 않게, 기믹을 직접 만져보게.
- 轉(비틀기)은 구간당 1번만 — 같은 블록에서 기믹을 두 번 비틀면 `한 레벨 한 개념` 위반·과부하.
- 結 후엔 그 기믹을 '버리고' 다음 블록은 새 기믹으로 — 누적 강요 금지.

```js
// 청크 풀을 '기믹 그룹'으로 묶어 한 블록을 4비트 순서로 펼친다
var GIMMICK_BLOCKS = {
  'moving-platform': {
    intro:      'mp-solo-safe',   // 起: 단독, 아래 안전바닥
    develop:    'mp-gap',         // 承: 발판 사이 간격
    twist:      'mp-over-pit',    // 轉: 구덩이 위 이동발판 + 적
    resolution: 'mp-coin-ride'    // 結: 발판 타고 코인 보상
  }
  // 다음 블록은 다른 기믹 그룹으로 전환 (누적 강요 금지)
};

function buildBlock(gimmickKey, chunkById) {
  var b = GIMMICK_BLOCKS[gimmickKey];
  return [b.intro, b.develop, b.twist, b.resolution].map(function (id) {
    return chunkById[id];
  });
}
```

`runeburst`는 각 `LEVELS` 항목 또는 스테이지 묶음을 '새 블로커 1종'의 4비트로 설계한다(소개→증가→다른 블로커와 결합→그 블로커 클리어가 핵심인 정점). `is-rule`은 새 규칙(`X IS Y`) 1개를 起에서 단독 소개→承 응용→轉 다른 규칙과 충돌/결합→結 그 규칙으로만 풀리는 정점으로 — 이 장르에 가장 자연스럽게 들어맞는다.

**주의/안티패턴.**
- 4비트를 무시하고 무작위로만 이으면 학습 리듬이 사라져 '그냥 운빨 코스'처럼 느껴진다.
- 한 블록에 기믹을 2개 이상 새로 도입하면 인지 과부하(`한 레벨 한 개념` 위반).

---

## `LD-FLOW-CHANNEL` — 몰입 채널 유지: 도전과 실력의 균형(선택적 DDA)

**정의.** 난이도 상승률이 플레이어 실력 향상률과 맞물려야 flow 채널(불안↔지루 사이 띠) 안에 머문다. 절차생성은 고정 곡선으로 평균을 맞추되, 가능하면 플레이어 상태(최근 사망·연속 성공)에 따라 미세 조정(DDA)해 개인별로 채널을 좁힌다.

**왜 통하나.** 도전과 실력의 균형이 boredom과 anxiety를 가르는 flow(몰입) 개념은 심리학자 Mihaly Csikszentmihalyi가 1970년대에 정식화한 flow 이론에 기반한다(개념과 불안/지루 구도는 1975년 'Beyond Boredom and Anxiety'에서 처음 정식화, 1990년 'Flow: The Psychology of Optimal Experience'가 체계화·대중화). 원본 1975년 도식은 challenge-skill 평면을 anxiety / flow / boredom의 단순 3구역으로 나눴고, 1987년 Massimini·Csikszentmihalyi·Carli가 이를 8가지 정서 상태로 세분한 '8채널 모델(Eight Channel Model)'로 발전시켰다 — 흔히 인용되는 정식 도식 명칭은 8채널 모델이지 '3채널'이 아니다. Jenova Chen은 USC MFA 논문 'Flow in Games'에서 이를 게임에 적용하고 flOw로 DDA를 구현했다 — '플레이어 입력에 따라 난이도를 조정해 너무 불안하거나 지루하지 않게.' 모바일 엔드리스는 실력 분포가 넓어 단일 곡선으로는 일부가 채널을 벗어나므로, 약한 DDA가 잔류율을 높인다.

**구체 규칙(체크리스트).**
- 고정 곡선(`LD-CURVE`)을 기본값으로 깔되, 최근 3회 연속 같은 지점에서 죽으면 다음 생성에서 그 구간 cost를 1~2 낮춘다(완화).
- 반대로 무사고로 멀리 가면 budget 증가율을 소폭 올려 지루함 방지 — 단, 가시적 처벌감 없이 부드럽게.
- DDA 조정폭은 작게(±1 티어 이내) — 너무 크면 플레이어가 '봐주는' 걸 눈치채 성취감이 깎인다.
- DDA는 끄고 켤 수 있게: 일일 챌린지/리더보드 모드에선 공정성 위해 DDA off + 고정 시드.

`super-runner`는 런 상태(`deathCount`, `deathCol`, `runDistance`)를 추적해 `chooseChunk`의 budget/weight를 미세 보정한다. `runeburst`는 한 스테이지를 X회 실패하면 `moves +2` 또는 블로커 −1 같은 안티프러스트레이션 완화(→ `LD-FAIR`와 결합)를 적용한다. `is-rule`은 막힌 시간이 길면 `par` 힌트/한 수 보여주기를 한다. 단, '챌린지 모드'는 시드 재현성을 위해 DDA를 비활성한다.

**주의/안티패턴.**
- DDA가 너무 공격적이면 'rubber-banding'으로 성취감이 사라지고, 실력 향상 동기가 죽는다.
- 리더보드와 DDA를 동시에 켜면 점수 비교가 불공정 — 경쟁 모드는 반드시 고정 곡선+시드.

---

## 장르별 매핑 요약

| 게임 | 장르 | '레벨' 인코딩 | 절차생성 인프라 현황 | 우선 적용 |
|---|---|---|---|---|
| `super-runner` | 플랫포머 러너 | 통짜 `LEVEL`(width/pits/features/pipes) | 없음(정적 손배치) | 청크풀 + budget + canReach 게이트 + seeded rng |
| `runeburst` | 매치3 | `LEVELS[]`(shape/colors/moves/goal/win/blocker/seed) | **`seed` + `mulberry32` + 교착 자동 셔플 보유** | budget으로 무한 모드, 톱니화 |
| `is-rule` | 규칙조작 퍼즐 | `LEVELS[]`(par/ent 격자/texts) | 손배치 + 손검증 풀이 | 솔버로 풀이가능성 검증, 4비트 규칙 도입 |

- **`super-runner`**는 '공간을 절차로 잇는' 전형적 러너라 청크풀+budget이 직접 적용된다.
- **`runeburst`**는 시간이 아니라 '스테이지 풀'이 곡선을 이루며, 이미 `seed` 필드와 자동 셔플(교착 방지=`LD-SOLVABLE`)을 보유해 절차생성 인프라가 일부 갖춰져 있다.
- **`is-rule`**은 '절차생성'보다 '손배치+풀이가능성 검증(solver)'이 맞는 장르이며, kishōtenketsu 4비트(새 규칙 1개 도입→응용→충돌→정점)가 가장 자연스럽게 들어맞는다.

### 모바일 웹뷰·CC0 제약과의 정합
- seeded rng는 네트워크 없이 일일 챌린지/공유 시드를 가능케 해 모바일에 이상적이다(서버 메타는 ❌, localStorage/시드로 대체).
- 청크 풀 방식은 통짜 에셋 없이 코드로 무한 변주를 만들어 CC0/절차생성 철학과 맞는다.
- 무한 생성 중에는 객체 풀링(pre-warm, 매 프레임 `Instantiate`/`create` 회피)으로 GC 히치를 막는 게 모바일 성능 필수기법이다. Phaser에서는 `scene.add.group({ ... })`로 미리 풀을 만들고 `group.get()`/`killAndHide()`로 재사용한다 — 화면 밖으로 스크롤된 타일/적은 destroy하지 말고 풀로 되돌린다.
- 물리는 Arcade 우선. 러너의 점프·구덩이·스폰 판정은 전부 Arcade로 충분하다. 정밀 강체(밧줄·도미노)가 정말 필요할 때만 Matter ⚠️, 보통은 단순 임펄스(`setVelocityY`)를 권장한다.

---

## IP 안전 메모

- **메카닉·원칙은 자유 차용, 고유명·에셋·특정 레벨 레이아웃은 복제 금지.** 청크 패턴 풀, budget 시퀀싱, 솔루션-경로-우선 생성, skill-gating 가속, kishōtenketsu 4비트는 모두 장르 관습/디자인 원리라 저작권 보호 대상이 아니다 — 자유롭게 구현한다.
- 금지: 'Canabalt'·'Subway Surfers'·'Temple Run'·'Spelunky' 등 **고유 게임명·캐릭터명·로고**, 원작의 **특정 청크 레이아웃·스프라이트·음원**을 그대로 옮기는 것. Spelunky의 '4×4 방 그리드 + type1/2/3 출구 템플릿'은 **알고리즘 아이디어로 차용**하되, 방 크기·타일셋·기믹 종류는 우리 오리지널로 환기한다.
- 절차생성 오리지널 환기: 코스 비주얼은 PixelForge/VectorForge로 만든 오리지널 타일·캐릭터(예: '빨간 모자 러너' 같은 색 단서 1개만 남긴 오리지널 실루엣)로, 사운드는 ChipAudio 절차 칩튠으로 대체한다. 패턴 풀의 조각 자체를 손으로 새로 디자인하면 '특정 게임의 그 레벨을 베꼈다'는 시비가 원천 차단된다.
- 어떤 외부 에셋을 쓰더라도 CC0 게이트를 통과해야 하며, 코드 생성(절차) 에셋이 기본값이다. 이 문서는 법률 자문이 아니다.

---

## 연계

- **장르 스킬:** `endless-runner` 스킬 — 이 문서의 청크풀·budget·seeded rng·canReach 게이트를 실제 러너 스캐폴드에 얹는 구현 진입점. 자동 전진 + 단일 입력(점프/슬라이드) 모바일 러너의 코어 루프를 제공한다.
- **제작요소 스킬:** 레벨 빌드 메카닉(체크포인트·구덩이·스폰·zone 판정)은 [../../../level-designer/SKILL.md](../../../level-designer/SKILL.md)로 이어진다. 재미요소 태그(`FE-FLOW`/`FE-FAIRNESS`/`FE-JUST-ONE-MORE`/`FE-MASTERY` 등)는 [../../../web-game-builder/reference/game-dna/fun-elements.md](../../../web-game-builder/reference/game-dna/fun-elements.md), 게임 DNA 색인은 [../../../web-game-builder/reference/game-dna/INDEX.md](../../../web-game-builder/reference/game-dna/INDEX.md).
- **레벨 인터뷰:** 새 러너/엔드리스 레벨을 설계할 때 요구사항 크리스털라이징은 [../level-interview.md](../level-interview.md).
- **엔진/API:** seeded rng·객체 풀링·Arcade 점프 판정 구현은 [../../../web-game-builder/reference/engine-api.md](../../../web-game-builder/reference/engine-api.md)와 Phaser 4 레퍼런스 색인 [../../../web-game-builder/reference/phaser/INDEX.md](../../../web-game-builder/reference/phaser/INDEX.md)(특히 `physics-arcade.md`·`groups-and-containers.md`·`geometry-and-math.md`).
- **같은 라이브러리:** [./INDEX.md](./INDEX.md) · [./principles.md](./principles.md) · [./platformer-levels.md](./platformer-levels.md) · [./puzzle-levels.md](./puzzle-levels.md) · [./shooter-arena-levels.md](./shooter-arena-levels.md) · [./arcade-levels.md](./arcade-levels.md)
