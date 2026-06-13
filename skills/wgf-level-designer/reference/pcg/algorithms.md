# PCG 알고리즘 메뉴 — level-designer 보조 레퍼런스

> 절차적 콘텐츠 생성(Procedural Content Generation) 알고리즘 4종 메뉴.  
> 모든 난수는 **RngForge**(`engine/rngforge.js`)로만 사용한다(`Math.random` 금지).  
> 결정론 동작 예제: [`examples/pcg-cave-cellular.mjs`](../../examples/pcg-cave-cellular.mjs)

---

## 목차

| 번호 | 알고리즘 | 용도 | 난이도 |
|------|----------|------|--------|
| 1 | [Cellular Automata](#1-cellular-automata) | 동굴·유기적 지형 | ★★☆ |
| 2 | [Wave Function Collapse (WFC)](#2-wave-function-collapse-wfc) | 타일 제약 생성 | ★★★ |
| 3 | [Poisson Disk Sampling](#3-poisson-disk-sampling) | 오브젝트 자연 분포 | ★★☆ |
| 4 | [n-gram / Markov 체인](#4-n-gram--markov-체인) | 이름·텍스트 생성 | ★★☆ |

---

## 1. Cellular Automata

### 무엇인가
격자(grid) 각 셀이 이웃 셀 상태(살아있음/죽음)에 따라 다음 세대 상태를 결정하는 알고리즘.
반복 시뮬레이션 후 동굴·지하 통로처럼 유기적·불규칙한 지형이 자연스럽게 등장한다.

### 언제 쓰나
- 던전·동굴·지하 레벨 지형 자동 생성
- 규칙적이지 않은 바위·협곡 지형
- 벽·바닥 배치가 엄격한 대칭을 피해야 할 때

### 핵심 절차
1. **초기화**: 각 셀을 확률 `p`로 `WALL(1)` / `FLOOR(0)` 랜덤 배정. (결정론: RngForge 시드 고정)
2. **반복(4~6회)**: 각 셀의 Moore 이웃(8방향) 중 벽 개수(`n`)를 센다.
   - `n >= threshold`(보통 5) → 다음 세대 WALL
   - `n < threshold` → 다음 세대 FLOOR
3. **후처리**: 경계(외곽) 강제 WALL, 작은 고립 지역 제거(flood-fill).

### 주요 파라미터
| 파라미터 | 권장값 | 효과 |
|----------|--------|------|
| `fillProb` | 0.45 | 초기 벽 밀도(낮을수록 열린 공간) |
| `threshold` | 5 | 벽 생존 기준 이웃 수 |
| `iterations` | 4~5 | 반복 횟수(많을수록 둥글어짐) |
| `width × height` | 80×50 | 격자 크기 |

### 복잡도
- 시간: O(iterations × width × height) — 실시간 생성 가능
- 공간: O(width × height) × 2 (현재/다음 버퍼)

### 결정론 예제
```js
// RngForge 시드 고정 → 같은 시드 = 항상 같은 동굴
var RngForge = require('../../../../engine/rngforge.js');
var rng = RngForge.create(42);

var W = 40, H = 20;
var grid = [];
for (var y = 0; y < H; y++) {
  grid[y] = [];
  for (var x = 0; x < W; x++) {
    // 외곽은 항상 WALL, 내부만 확률 배정
    grid[y][x] = (x === 0 || x === W-1 || y === 0 || y === H-1)
      ? 1
      : (rng() < 0.45 ? 1 : 0);
  }
}
// 4세대 시뮬레이션 → 같은 시드 = 동일 출력
// (실행 가능 전체 코드: examples/pcg-cave-cellular.mjs)
```

### 교차 스킬
- `wgf-level-designer`: 생성된 grid → `LEVEL.features` 피처리스트로 변환 후 `buildLevel` 투입
- `wgf-level-designer` Tiled 연동: `tools/ascii-to-tmj.mjs`에 ASCII 격자로 변환해 `.tmj` 베이킹

---

## 2. Wave Function Collapse (WFC)

### 무엇인가
타일들 간의 **인접 규칙**(adjacency constraints)을 제약 전파(constraint propagation)로 풀어
규칙을 모두 만족하는 맵을 생성하는 알고리즘. 입력 예시 타일셋만 주면 그 패턴을 확률적으로 재조합한다.

### 언제 쓰나
- 특정 타일셋의 시각 규칙을 일관되게 지키면서 무한 생성해야 할 때
- 던전 방·복도 타일 조합, 도시 도로망, 퍼즐 맵
- 손으로 만든 예시 맵을 기반으로 "비슷한" 맵을 무한 생성

### 핵심 절차
1. **가능성 초기화**: 모든 셀에 전체 타일 목록을 가능성으로 설정.
2. **관측(Observe)**: 가장 엔트로피가 낮은(가능성 수 최소) 셀을 선택, RngForge로 하나의 타일을 확정.
3. **전파(Propagate)**: 확정된 셀에서 인접 규칙을 전파해 이웃 셀 가능성을 제거.
4. **반복**: 모든 셀이 확정될 때까지 2~3 반복. 충돌(contradiction) 발생 시 백트래킹 또는 재시작.
5. **인접 규칙 학습**: 예시 맵에서 타일 쌍(상하좌우)을 추출해 허용 목록 자동 구성.

### 주요 파라미터
| 파라미터 | 설명 |
|----------|------|
| `tileSet` | 사용 가능한 타일 종류 배열 |
| `adjacencyRules` | `tile → {up,down,left,right}: Set<tile>` |
| `width × height` | 출력 격자 크기 |
| `backtrackLimit` | 충돌 시 재시작 상한 |

### 복잡도
- 시간: O(width × height × tiles) — 타일 수·격자 크기에 민감
- 충돌 빈도가 높으면 지수적 악화 가능 → 규칙 설계가 핵심

### 결정론 스니펫
```js
// WFC 핵심 루프 — 관측 단계 RngForge 사용
function observeMinEntropy(cells, rng) {
  // 가능성이 1개 초과인 셀 중 최소
  var candidates = cells.filter(function(c) { return c.options.length > 1; });
  if (!candidates.length) return null;
  var min = candidates.reduce(function(a, b) {
    return b.options.length < a.options.length ? b : a;
  });
  // RngForge로 확정 — 시드 고정 시 항상 같은 선택
  min.collapsed = rng.pick(min.options);
  min.options = [min.collapsed];
  return min;
}
```

### 교차 스킬
- `wgf-level-designer` Tiled 연동: `tools/ascii-to-tmj.mjs`로 WFC 출력 격자 → `.tmj` 변환
- `wgf-topdown-shooter`: 탑다운 던전 타일 생성에 직접 적용

---

## 3. Poisson Disk Sampling

### 무엇인가
최소 거리 `r` 이상 떨어진 점들을 균등하게 분포시키는 알고리즘. 순수 무작위보다 자연스럽고,
격자보다 불규칙한 "자연스러운 군집" 배치를 만든다.

### 언제 쓰나
- 나무·바위·식물 등 지형 오브젝트 자연 분포
- 적 스폰 포인트를 겹치지 않게 분산 배치
- 아이템·코인을 빽빽하지도 듬성듬성하지도 않게 뿌릴 때

### 핵심 절차 (Bridson 2007 빠른 버전)
1. **첫 점** 랜덤 배치 → 활성 목록(active list)에 추가.
2. 활성 목록에서 랜덤 점 `p`를 고름.
3. `p` 기준 반경 `[r, 2r]` 환형 영역에서 후보 점 `k`개(보통 30) 생성.
4. 모든 기존 점과 거리 `r` 이상이면 → 격자에 추가·활성 목록에 추가.
5. `k`번 모두 실패하면 `p`를 활성 목록에서 제거.
6. 활성 목록이 비면 완료.

### 주요 파라미터
| 파라미터 | 설명 |
|----------|------|
| `minDist` | 최소 거리 `r` (오브젝트 반지름의 2배 권장) |
| `k` | 후보 시도 횟수 (기본 30) |
| `width × height` | 샘플링 영역 |

### 복잡도
- 시간: O(n) — 점 개수에 선형 (Bridson 빠른 버전)
- 공간: O(width × height / r²)

### 결정론 스니펫
```js
function poissonDisk(width, height, minDist, k, rng) {
  var cellSize = minDist / Math.SQRT2;
  var cols = Math.ceil(width / cellSize);
  var rows = Math.ceil(height / cellSize);
  var grid = new Array(cols * rows).fill(null);
  var active = [];
  var result = [];

  function addPoint(p) {
    result.push(p);
    active.push(p);
    var cx = Math.floor(p[0] / cellSize);
    var cy = Math.floor(p[1] / cellSize);
    grid[cy * cols + cx] = p;
  }

  // 첫 점 — RngForge 시드 고정 시 항상 동일
  addPoint([rng.float(width), rng.float(height)]);

  while (active.length > 0) {
    var idx = rng.int(0, active.length - 1);
    var base = active[idx];
    var found = false;
    for (var attempt = 0; attempt < k; attempt++) {
      var angle = rng.float(Math.PI * 2);
      var dist  = rng.float(minDist, minDist * 2);
      var nx = base[0] + Math.cos(angle) * dist;
      var ny = base[1] + Math.sin(angle) * dist;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      var ok = true;
      var gcx = Math.floor(nx / cellSize);
      var gcy = Math.floor(ny / cellSize);
      for (var dy = -2; dy <= 2 && ok; dy++) {
        for (var dx = -2; dx <= 2 && ok; dx++) {
          var nx2 = gcx + dx, ny2 = gcy + dy;
          if (nx2 < 0 || nx2 >= cols || ny2 < 0 || ny2 >= rows) continue;  // 경계 가드
          var neighbor = grid[ny2 * cols + nx2];
          if (neighbor) {
            var dxx = neighbor[0]-nx, dyy = neighbor[1]-ny;
            if (dxx*dxx + dyy*dyy < minDist*minDist) ok = false;
          }
        }
      }
      if (ok) { addPoint([nx, ny]); found = true; break; }
    }
    if (!found) active.splice(idx, 1);
  }
  return result;
}
```

### 교차 스킬
- `wgf-topdown-shooter`: `poissonDisk()` 결과를 적 스폰 포인트로 직접 사용
- `wgf-level-designer`: 코인·아이템 피처 배치에 활용 (`LEVEL.features` 투입)
- `wgf-world-map-architect`: 월드맵 노드(마을·던전) 위치 자연 분산

---

## 4. n-gram / Markov 체인

### 무엇인가
기존 단어·이름 목록에서 n-gram(연속 문자 n개) 빈도를 학습하고,
그 통계로 새 이름·단어를 생성하는 언어 모델. 입력과 "비슷한 느낌"이지만 새로운 이름이 나온다.

### 언제 쓰나
- NPC·지역·아이템 이름 자동 생성 (판타지풍·SF풍·한국어풍 등)
- 퀘스트 제목·문장 생성
- 게임 내 "언어처럼 보이는" 텍스트 생성

### 핵심 절차
1. **학습(train)**: 입력 이름 배열에서 n-gram 전이 빈도 테이블 구축.
   - 예: n=2, "merlin" → `^m`→`me`, `me`→`er`, `er`→`rl`, `rl`→`li`, `li`→`in`, `in`→`$`
   - `^`=시작 토큰, `$`=종료 토큰
2. **생성(generate)**: 시작 토큰에서 출발해 현재 n-gram 이후 후보를 가중 선택(RngForge.weighted).
3. **종료 조건**: `$` 토큰 선택 or 최대 길이 초과.

### 주요 파라미터
| 파라미터 | 권장값 | 효과 |
|----------|--------|------|
| `n` | 2~3 | n이 클수록 원본 유사, 작을수록 자유로움 |
| `maxLen` | 10~15 | 생성 최대 길이 |
| `minLen` | 3~4 | 너무 짧은 이름 필터 |

### 복잡도
- 학습: O(corpus × nameLen)
- 생성: O(maxLen)

### 결정론 스니펫
```js
function buildMarkov(names, n) {
  var table = {};
  names.forEach(function(name) {
    var s = '^' + name.toLowerCase() + '$';
    // '^' 단독 키: 이름 첫 글자 빈도 등록 (generateName 진입점)
    if (!table['^']) table['^'] = {};
    table['^'][s[1]] = (table['^'][s[1]] || 0) + 1;
    // n-gram 전이 테이블 구축
    for (var i = 0; i < s.length - n; i++) {
      var key = s.slice(i, i + n);
      var next = s[i + n];
      if (!table[key]) table[key] = {};
      table[key][next] = (table[key][next] || 0) + 1;
    }
  });
  return table;
}

function generateName(table, n, rng, minLen, maxLen) {
  for (var attempt = 0; attempt < 20; attempt++) {
    var result = '';
    for (var i = 0; i < maxLen; i++) {
      // result 가 n-1 글자 미만이면 '^' 패딩을 앞에 붙여 n글자 키를 구성
      // 예) n=2, result='': key=('^'+'').slice(-2)='^' → table['^'] 에서 첫 글자 선택
      //     n=2, result='g': key=('^'+'g').slice(-2)='^g' → 정상 전이
      var padded = '^' + result;
      var key = padded.length >= n ? padded.slice(-n) : padded;
      var choices = table[key];
      if (!choices) break;
      var items = Object.keys(choices);
      var weights = items.map(function(k) { return choices[k]; });
      var next = rng.weighted(items, weights);  // RngForge 가중 선택
      if (next === '$' || next === undefined) break;
      result += next;
    }
    if (result.length >= minLen) return result;
  }
  return 'aria';  // 폴백
}
```

### 결정론 예제 (시드 고정)
```js
var RngForge = require('../../../../engine/rngforge.js');
var rng = RngForge.create(777);
var corpus = ['merlin','arthur','lancelot','gawain','percival','galahad','tristan'];
var table = buildMarkov(corpus, 2);

// 같은 시드 → 항상 같은 이름 목록
var names = [];
for (var i = 0; i < 5; i++) names.push(generateName(table, 2, rng, 3, 12));
console.log(names); // 시드 777 → 항상 동일
```

### 교차 스킬
- `wgf-story-architect`: NPC 이름·지역명·아이템명 자동 생성에 직접 적용
- `wgf-world-map-architect`: 월드맵 지역 이름 생성

---

## 알고리즘 선택 가이드

| 원하는 결과 | 추천 알고리즘 |
|-------------|---------------|
| 동굴·유기적 지형 | Cellular Automata |
| 타일셋 규칙을 지키는 맵 | WFC |
| 오브젝트 자연스러운 분포 | Poisson Disk Sampling |
| 이름·텍스트 자동 생성 | n-gram / Markov |
| 복잡한 던전(방+통로) | Cellular Automata + WFC 조합 |
| 적 스폰 + 아이템 배치 | Poisson Disk Sampling |

## 공통 원칙

- **모든 난수는 RngForge** — `Math.random()` 금지 (`lint-rng.mjs` 검증)
- **시드를 항상 명시** — 같은 시드 → 같은 레벨(재현 가능, QA 가능)
- **멀티스트림 활용** — 지형·오브젝트·이름 생성을 독립 스트림으로 분리:
  ```js
  var rng   = RngForge.create(seed);
  var tRng  = rng.stream('terrain');   // 지형 생성
  var oRng  = rng.stream('objects');   // 오브젝트 배치
  var nRng  = rng.stream('names');     // 이름 생성
  ```
- **결정론 검증** — 같은 시드로 2회 실행, 출력이 동일한지 확인
