# 맵 화면 빌드 패턴 (MAP-SCHEMA · Map 씬 · 내비 · 영속)

> [`world-map-architect`](../../SKILL.md) 워크플로 **4) 빌드** 단계에서 Read 하는 구현 가이드. 설계([principles.md](./principles.md)
> ·[topologies.md](./topologies.md))로 정한 위상·게이팅·내비를 **실제 game.js 코드**로 옮기는 패턴이다.
> 저장소의 현재 코드 관례(Phaser 4 `Phaser.Class` 씬, `var`, `mulberry32(seed)`, localStorage, `DESIGN_W/H`)를
> 그대로 따른다. Phaser 4 API는 [reference/phaser/INDEX.md](../../../wgf-web-game-builder/reference/phaser/INDEX.md)
> (scenes · cameras · input · groups-and-containers · geometry-and-math).

핵심 원칙(빌드판):
- **선형은 그래프의 특수형.** 기존 게임(runeburst `LEVELS[]`+`rb-progress`, is-rule `LEVELS[]`)을 깨지 않고 점진 진화.
- **정의와 진행을 분리.** 노드 '정의'(불변 데이터, 코드/시드)와 노드 '진행 레코드'(localStorage)는 다른 구조.
- **잠금은 파생.** `isLocked()`를 매 진입 시 규칙으로 계산하고 저장하지 않는다.
- **맵 무저장.** 절차 맵은 시드+포인터만 저장(`MAP-SEED`).

---

## 1. MAP-SCHEMA — 평평한 `LEVELS[]` → 노드 그래프

### 1.1 노드 정의 (불변 데이터)

선형·분기·허브·무한을 **한 스키마**로 표현한다. 선형은 `next` 길이 1인 특수형.

```js
// 노드 '정의' — 코드/JSON 상수 또는 시드 생성 결과. localStorage 에 저장하지 않는다.
// { id, type, prereq, next, gate?, content, branch? }
var MAP_NODES = [
  { id: 'n01', type: 'stage', prereq: [],        next: ['n02'],        content: { levelIndex: 0 } },
  { id: 'n02', type: 'stage', prereq: ['n01'],   next: ['n03'],        content: { levelIndex: 1 } },
  { id: 'n03', type: 'boss',  prereq: ['n02'],   next: ['n04'],        content: { levelIndex: 2 } },
  // 가벼운 분기: n04 에서 두 갈래(쉬운 길/보상 큰 길)로 갈라졌다 n07 로 합류
  { id: 'n04', type: 'stage', prereq: ['n03'],   next: ['n05a','n05b'], content: { levelIndex: 3 } },
  { id: 'n05a',type: 'stage', prereq: ['n04'],   next: ['n07'], branch: 'b1', content: { levelIndex: 4 } },
  { id: 'n05b',type: 'elite', prereq: ['n04'],   next: ['n07'], branch: 'b1', content: { levelIndex: 5 } },
  { id: 'n07', type: 'stage', prereq: ['n05a','n05b'], next: [],     gate: { stars: 6 }, content: { levelIndex: 6 } }
];
// type: stage|boss|elite|shop|event|rest|bonus  (색+형태 이원부호화 — MAP-A11Y)
// prereq: OR 가 필요하면 [['n05a','n05b']] 같은 중첩으로(아래 isUnlocked 참고)
// gate: 이 노드에 추가로 거는 소프트 게이트(누적 별 등). 진행 게이트와 분리(MAP-STAR)
// id: 안정 문자열(배열 인덱스 금지). content.levelIndex 와 1:1 일 필요 없음(분기 n05a/n05b 처럼).
// 불변식: next 는 prereq 의 역방향 미러 — node.next 의 모든 대상 m 은 m.prereq 에 node.id 를 포함해야 한다(둘을 함께 갱신).
//   게이팅(isUnlocked)은 prereq 만, 도달성 검사(checkReachable)는 next 만 보므로 어긋나면 soft-lock 이 안 잡힌다(§6.1b 검사).
```

> **선형 그대로 쓰던 게임은** `LEVELS[]`를 자동으로 노드 체인으로 변환한다(아래 1.4). 새 포맷을 손코딩하지 않는다.

### 1.2 진행 레코드 (봉투형 영속 — MAP-PERSIST)

```js
// localStorage 단일 키. 봉투(version+ts) + 노드별 레코드. 잠금은 저장하지 않음(파생).
// { v, ts, nodes: { id: { done, stars, best, branch } }, meta: { coins, unlocked, cycle } }
var SAVE_KEY = 'rb-map';

function loadMap() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw == null) return migrateFromLegacy();        // 첫 실행 → 옛 저장 마이그레이션
    var s = JSON.parse(raw);
    if (!s || typeof s.v !== 'number') return emptySave(); // 검증 실패 → 폴백(throw 금지)
    s.nodes = s.nodes || {};
    // 검증 게이트: stars 클램프, 미지 필드 무시
    for (var id in s.nodes) {
      var n = s.nodes[id];
      n.stars = Math.max(0, Math.min(3, n.stars | 0));
    }
    return s;
  } catch (e) { return emptySave(); }                   // 손상 JSON → 빈 진행 폴백
}
function emptySave() { return { v: 2, ts: 0, nodes: {}, meta: { coins: 0, unlocked: [], cycle: 0 } }; }
function saveMap(s) {
  try { s.ts = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* quota: 무시 */ }
}

// 읽기/쓰기 단일 경로 — UI·게이팅·통계 모두 여기서 파생(localStorage 직접 접근 금지)
function getNode(s, id) { return s.nodes[id] || (s.nodes[id] = { done: false, stars: 0, best: 0, branch: null }); }
function setNode(s, id, patch) { var n = getNode(s, id); for (var k in patch) n[k] = patch[k]; saveMap(s); }
```

### 1.3 잠금 = 파생 (게이트 평가 — MAP-GATE)

```js
function totalStars(s) { var t = 0; for (var id in s.nodes) t += (s.nodes[id].stars | 0); return t; }
function isDone(s, id) { return !!(s.nodes[id] && s.nodes[id].done); }

// prereq 요소가 문자열이면 AND, 배열이면 그 안에서 OR (시퀀스 브레이킹/분기 OR 지원 — MAP-AGENCY)
function prereqMet(s, prereq) {
  return (prereq || []).every(function (p) {
    return Array.isArray(p) ? p.some(function (x) { return isDone(s, x); }) : isDone(s, p);
  });
}
function isUnlocked(s, node) {
  if (!prereqMet(s, node.prereq)) return false;
  if (node.gate && node.gate.stars && totalStars(s) < node.gate.stars) return false; // 누적 별 게이트
  return true;
}
function isCurrent(s, node) { return isUnlocked(s, node) && !isDone(s, node.id); } // 다음 진행 가능 노드
```

### 1.4 마이그레이션 (v1 단일 정수 → v2 노드맵)

runeburst의 현행 `rb-progress`(도달 인덱스 정수)와 `rb-best-*`를 **보존하며** 노드맵으로 펼친다.

```js
function migrateFromLegacy() {
  var s = emptySave();
  try {
    // loadProgress()는 length-1 로 클램프하므로 raw 를 직접 읽어 '전부 클리어' 시 마지막 노드까지 보존(off-by-one 방지)
    var prog = parseInt(localStorage.getItem('rb-progress'), 10);     // 옛 선형 진행(도달 인덱스)
    if (!isNaN(prog)) {
      for (var i = 0; i < prog; i++) {                                // 0..prog-1 은 클리어로 펼침
        var id = nodeIdForLevel(i);                                   // content.levelIndex 역조회(안정 문자열 id)
        if (!id) continue;                                            // 매칭 노드 없으면 skip
        var best = parseInt(localStorage.getItem('rb-best-' + i), 10);
        s.nodes[id] = { done: true, stars: 0, best: isNaN(best) ? 0 : best, branch: null };
      }
    }
  } catch (e) { /* 옛 저장 없음/손상 → 빈 진행 */ }
  saveMap(s);
  return s;
}
// 옛 선형 인덱스 → 노드 id 역조회(인덱스를 id 로 쓰지 않는다 — content.levelIndex 로 노드를 찾는다)
function nodeIdForLevel(i) {
  var n = MAP_NODES.find(function (x) { return x.content && x.content.levelIndex === i; });
  return n ? n.id : null;
}
```

> **마이그레이션 원칙:** v_n→v_{n+1} 순차 함수 체인으로. id 는 **안정 문자열**(배열 인덱스 금지 — 중간 노드 추가/삭제 시
> 전 진행이 어긋남). 검증·폴백을 항상 동반(손상 세이브로 게임이 멈추지 않게).

---

## 2. Map 씬 삽입 (Title ↔ Game 사이)

현재 흐름은 `Title → Game`(맵 화면 없음). 그 사이에 **`Map` 씬**을 끼워 진행 맵을 띄운다. runeburst의 `Phaser.Class`
패턴·`scene.start` 라우팅을 그대로 따른다.

```js
// 흐름:  Boot → Title → Map → Game → (클리어) → Map → ...
// Title '모험 시작' 버튼이 loadProgress() 로 바로 Game 을 띄우던 것을 Map 으로 바꾼다.
this.bigButton(cx, DESIGN_H * 0.53, 300, 70, '모험 시작', '#6ea0ff', function () {
  audio.unlock(); audio.startBgm(); self.scene.start('Map');          // ← Game 대신 Map
});

var MapScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function MapScene() { Phaser.Scene.call(this, { key: 'Map' }); },
  create: function () {
    drawStarfield(this);
    this.save = loadMap();
    this.nodes = MAP_NODES;                          // 또는 generateMap(seed) (§4)
    this.drawNodes();
    this.centerOnCurrent();                          // 카메라를 현재 위치로 (MAP-NAV)
  },
  drawNodes: function () {
    var self = this, s = this.save;
    this.nodes.forEach(function (node) {
      var p = nodePos(node);                         // {x,y} — 세로 사가 좌표(절차 곡선)
      drawEdges(self, node);                          // 엣지: 열린 길=실선, 잠긴 길=점선(MAP-A11Y)
      var locked = !isUnlocked(s, node);
      var done = isDone(s, node.id);
      var icon = nodeIcon(node.type, { locked: locked, done: done }); // 색+형태 이원부호화
      var btn = self.add.image(p.x, p.y, icon).setDisplaySize(56, 56); // 탭 타깃 ≥48dp (MAP-MOBILE)
      if (isCurrent(s, node)) self.pulse(btn);        // 다음 노드 단일 강조(호흡 애니메이션)
      if (!locked) {                                   // 해금된 노드는 done 이어도 재플레이 가능(별 갱신 — MAP-STAR)
        btn.setInteractive({ useHandCursor: true })
           .on('pointerdown', function () { self.enter(node); });
      } else {
        btn.setInteractive().on('pointerdown', function () { self.showGateReason(node); }); // '★N 필요'
      }
    });
    this.markCurrent();                               // 현재 위치 아바타/펄스(가장 강한 신호)
  },
  enter: function (node) {
    // 노드 콘텐츠를 Game 으로 — 레벨 내용/난이도는 level-architect 설계, 여기선 라우팅만
    this.scene.start('Game', { mode: 'levels', level: node.content.levelIndex, nodeId: node.id });
  },
  centerOnCurrent: function () {
    var cur = this.nodes.find(isCurrent.bind(null, this.save));
    if (cur) { var p = nodePos(cur); this.cameras.main.centerOn(p.x, p.y + DESIGN_H * 0.18); } // thumb-zone 오프셋
  }
});
// 씬 등록 배열에 Map 추가:  scene: [Boot, Title, MapScene, Game]
```

Game 은 `init`에서 전달받은 `nodeId`를 **보존**해야 결과 기록이 올바른 노드로 간다(enter→init→결과 사슬의 필수 고리):

```js
// Game.init(data) — runeburst 현행 분기에 nodeId 보존 한 줄 추가
this.nodeId = data.nodeId || null;     // Map 진입 시 노드 id, 데일리/직접진입이면 null
```

클리어 시 Game 의 결과 처리에서 진행을 기록하고 Map 으로 복귀한다(현행 `saveProgress` 대체):

```js
// Game 결과(win) 시 — 보존한 nodeId 로 노드 레코드 갱신 후 맵 복귀. nodeId 없으면(데일리 등) 캠페인 진행 미기록.
if (win && this.nodeId) {
  var s = loadMap();
  setNode(s, this.nodeId, { done: true, stars: this.starsFor(this.score, this.cfg.goal),
                            best: Math.max(getNode(s, this.nodeId).best, this.score) });
}
this.resultButton(cx, y, 360, 60, 0x2fd07a, function () { self.scene.start('Map'); }, '맵으로 →');
// 복귀 시 Map 이 방금 깬 노드 → 다음 노드로 카메라 팬하면 '전진' 체감을 무료로 얻는다(MAP-PROGRESS)
```

---

## 3. 노드 렌더·내비 패턴 (MAP-NAV · MAP-MOBILE · MAP-A11Y)

- **세로 스크롤 사가 좌표:** `nodePos(node)`를 사인/베지어로 절차 생성해 데이터(노드 정의)와 분리. 레벨 추가 때 좌표를 손으로
  다시 깔지 않는다.
- **상태 3구분 + 형태:** 완료=체크+저채도, 현재=아바타/펄스(크기·채도·움직임 중 2개 이상), 잠금=자물쇠+회색. **색만으로
  구분 금지**(WCAG 1.4.1).
- **다음 노드 단일 강조:** `isCurrent` 노드만 글로우/호흡. 분기여도 3개 이하. 4개+면 가독성 붕괴.
- **카메라:** 진입 시 현재 노드로 센터링하되 thumb-zone(하단 1/3)에 오도록 +Y 오프셋. 한 화면 노드 6~9개로 줌.
- **잠금 사유 노출:** 잠긴 노드 탭 시 '★14/15 필요'를 툴팁으로(자물쇠를 열쇠보다 먼저 — MAP-GATE). 곧 풀릴 게이트는
  조건 거의 충족을 시각화(목표 구배).
- **스크롤:** 세로 단일 축 + 노드 단위 스냅. 자유 2D 팬을 쓰면 '현재 위치로' 리센터 버튼 필수.

```js
// 노드 아이콘 키 규칙(예) — CC0/절차 아이콘. 색+형태로 type·상태를 이원부호화.
function nodeIcon(type, st) {
  if (st.locked) return 'node-lock';                 // 자물쇠(회색)
  if (st.done)   return 'node-done-' + type;         // 체크 오버레이
  return 'node-' + type;                             // stage/boss/elite/shop/event/rest/bonus
}
```

---

## 4. 시드 기반 절차 노드 그래프 (MAP-DAG · MAP-SEED)

분기 노드맵(로그라이크)·무한 맵은 **시드 1개**로 생성하고 맵 자체는 저장하지 않는다. runeburst의 `mulberry32`를 재사용.

```js
// 층(layer) 단위 DAG: 인접 층으로만 단방향, 교차 금지, 도달 불가 노드 제거 (topologies.md §4)
function generateMap(seed, opts) {
  var rng = mulberry32(seed);                         // 결정적 PRNG(같은 시드 → 같은 맵)
  var L = opts.layers, W = opts.width;               // 예: 15층 × 7열
  var grid = [];                                     // grid[layer] = [열별 노드 or null]
  // 1) 경로를 여러 번 깐다(시작 열 랜덤 → 다음 층 인접 ±1 열로 연결)
  for (var p = 0; p < opts.paths; p++) {
    var col = (rng() * W) | 0;
    for (var l = 0; l < L; l++) {
      ensureNode(grid, l, col);
      if (l < L - 1) { var nc = stepCol(col, W, rng); linkNoCross(grid, l, col, nc); col = nc; }
    }
  }
  pruneUnreachable(grid);                            // 들어오는 간선 0 인 노드 제거
  assignTypes(grid, rng, opts);                      // 가중 샘플링: 전투~50/이벤트~15/상점~10/보물~9/엘리트~8/휴식~5
  forceBossGate(grid);                              // 마지막 층은 단일 보스로 수렴(분기-병목)
  return gridToNodes(grid);                          // §1 노드 정의 형태로 변환
}
// 저장은 seed + 진행 포인터(현재 층·노드·HP·자원)만. 맵 통째 직렬화 금지.
```

생성 제약(가독성·공정성): 같은 두 인접 층에서 교차(X자) 금지, 한 노드의 복수 출간선 도착지는 서로 달라야, 시작 층 출발
노드 2개+ 보장, 엘리트/휴식은 특정 층 이상에서만. 노드 간 **최소 간격**을 생성 제약으로 넣어 모바일 오탭 방지.

---

## 5. 데일리·무한 영속 (MAP-DAILY · MAP-RUN — 캠페인과 별도 네임스페이스)

```js
// 데일리: 날짜 해시 시드 = '모두 같은 오늘의 맵' (서버 0줄). 캠페인과 다른 키.
// runeburst 현행은 parseInt(dateKey.replace(/-/g,''),10) 를 시드로 쓴다. 기존 데일리 기록 연속성을 지키려면 그 방식을,
// 더 균일한 분포가 필요하면 아래 charCode 해시를 쓴다(둘 다 결정적). 데일리는 별도 네임스페이스라 캠페인엔 무영향.
function dailySeed(dateKey) {                          // dateKey: 'YYYY-MM-DD'
  var h = 0; for (var i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) | 0;
  return h >>> 0;
}
// 별도 저장 네임스페이스(캠페인 진행을 데일리 리셋이 절대 건드리지 않게)
var DAILY_KEY = 'rb-daily';   // { 'YYYY-MM-DD': { best, stars, played }, streak: n, lastDay: 'YYYY-MM-DD' }
// 점수는 단일 정수 정렬키로 패킹(타이브레이커 없이 한 컬럼 비교 — Slay the Spire Daily Climb 방식)
// streak 끊김 페널티는 코스메틱/소폭만(MAP-ETHICS). 공유는 결과 이모지+날짜만(판/정답 누설 금지).
```

> 런 기반(roguelike)은 시드 + 포인터만 저장하고 in-run 획득물은 저장하지 않는다. 영속되는 건 **메타 진행**(`meta` 섹션)뿐
> (MAP-RUN·MAP-META). NG+/Ascension 은 노드 키를 `(cycle, nodeId)`로 확장하고 노브에 `modifier(cycle)`를 곱한다(원본 불변).

---

## 6. 검증 (스킬 5단계 — 빌드 후 필수 점검)

```js
// 6.1 그래프 도달 가능성 — 모든 노드가 시작에서 BFS 로 닿는가(고립 노드 0)
function checkReachable(nodes) {
  var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
  var starts = nodes.filter(function (n) { return (n.prereq || []).length === 0; });
  var seen = {}, q = starts.slice();
  while (q.length) { var n = q.shift(); if (seen[n.id]) continue; seen[n.id] = 1;
    (n.next || []).forEach(function (id) { if (byId[id]) q.push(byId[id]); }); }
  return nodes.filter(function (n) { return !seen[n.id]; });   // 비어 있어야 정상(도달 불가 노드 목록)
}
// 6.1b next↔prereq 정합 — next 와 prereq 가 서로 역방향 미러인가(한쪽만 채우면 게이팅/도달성 불일치)
function checkEdges(nodes) {
  var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
  var bad = [];
  nodes.forEach(function (n) {
    (n.next || []).forEach(function (id) {
      var m = byId[id];
      var flat = (m && m.prereq || []).reduce(function (a, p) { return a.concat(p); }, []); // 중첩 OR 평탄화
      if (!m || flat.indexOf(n.id) < 0) bad.push(n.id + '→' + id + ' (대상 prereq 에 역참조 없음)');
    });
  });
  return bad;                                                // 비어 있어야 정상
}
// 6.2 soft-lock — 키(선행)가 락보다 위상상 앞에 오는가(prereq 순환/역참조 없는가): 위상 정렬로 검사
// 6.3 게이트 — 각 gate.stars < 그 시점까지 누적 가능한 총 별(잉여 마진), 하드 게이트 연속 2개 금지
// 6.4 마이그레이션 — v1 rb-progress 가 v2 노드맵으로 진행 보존되는가, 손상 JSON 에 폴백하는가
// 6.5 거시 곡선 — content.levelIndex 의 difficulty 가 톱니(정점-휴식 교대)인가
```

빌드 후 로컬 서버(`python -m http.server 8766`)로 띄워 **맵 진입 → 노드 탭 → 레벨 → 클리어 → 맵 복귀 → 다음 노드 해금**
전 흐름을 확인하고, 가능하면 game-qa 헤드리스로 점검한 뒤 결과를 근거와 함께 보고한다.

---

## 7. 빌드 체크리스트

- [ ] 기존 게임의 진행 모델을 **마이그레이션**으로 보존했는가(rb-progress → 노드맵, 진행 안 날림)
- [ ] 노드 **정의(불변)**와 **진행 레코드(저장)**를 분리했는가 · id 가 **안정 문자열**인가
- [ ] **잠금을 저장하지 않고** `isUnlocked()`로 매번 파생하는가
- [ ] 봉투형(version+ts) + 검증 + 손상 시 폴백(throw로 게임 정지 금지)
- [ ] Title↔Game 사이에 Map 씬을 끼우고 클리어 후 맵 복귀·카메라 팬으로 진척을 체감시키는가
- [ ] 노드 상태/종류를 **색+형태**로 이원부호화, 다음 노드 단일 강조, 탭 타깃 ≥48dp·간격 ≥2mm
- [ ] 절차 맵은 시드+포인터만 저장(맵 무저장), 동일 시드 재현되는가
- [ ] 데일리/런을 캠페인과 **다른 네임스페이스**에 저장하는가
- [ ] 그래프 도달 가능성·soft-lock·게이트 잉여·곡선 톱니를 검증했는가
- [ ] 각 노드의 레벨 내용·난이도는 [`level-architect`](../../../wgf-level-architect/SKILL.md)에 위임했는가
