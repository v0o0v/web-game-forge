/* ============================================================================
 * BoardKit — 논리 보드 좌표계 + A* 그리드 길찾기 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * 칸(cell) 단위로 사고하는 게임을 위한 **논리 격자** 부품. 퍼즐(2048·매치3),
 * 보드게임(체스·블로커스), 타워디펜스 크립 길찾기에 쓴다. 셀↔픽셀 좌표 변환과
 * 장애물 회피 A* 최단경로를 외부 의존성 0·결정론으로 제공한다.
 *
 * ▶ PathKit 과의 차이(역할 분리, 중복 금지):
 *   - PathKit = Phaser Curves/Path 기반 **연속 경로추종**(스플라인·패트롤·방사 탄막).
 *     "정해 둔 곡선 위를 부드럽게 따라가게" 하는 연출/이동 도구.
 *   - BoardKit = **논리 격자 길찾기**. "어느 칸들을 밟아야 막힌 칸을 피해 목적지에
 *     최단으로 닿는가"를 A* 로 *계산*한다. 출력은 칸 좌표 배열(연출 X).
 *   둘은 결합 가능 — BoardKit 으로 칸 경로를 구하고 PathKit/트윈으로 그 위를 움직인다.
 *
 * ▶ 결정론(RngForge 철학 정합):
 *   같은 (보드·시작·목표·옵션) → **항상 같은 경로 배열**. A* open-set 동점은 무작위가
 *   아니라 안정적 결정 타이브레이크로 깬다 — (1) f 작은 것 (2) h 작은 것(목표에 더 가까움)
 *   (3) 먼저 발견된 것(삽입 순서). `Math.random()`/시각함수 미사용 → 헤드리스 회귀 안정.
 *
 * 사용:
 *   var board = BoardKit.create({ cols:10, rows:8, cellSize:32 });
 *   var px = board.cellToPixel(3, 2);          // {x,y} 칸 중심 픽셀
 *   var cell = board.pixelToCell(120, 80);     // {col,row}
 *   board.setWalkable(5, 4, false);            // 장애물(통행 불가) 표시
 *   var path = board.findPath(0, 0, 9, 7);     // [{col,row}, ...] 시작·목표 포함, 없으면 []
 *
 *   // 8방향 + 코너컷 방지 + 옥타일 휴리스틱
 *   var p8 = board.findPath(0,0, 9,7, { diagonal:true, dontCrossCorners:true });
 *
 *   // 셀별 가중치(늪=비용3) — 가중 최단경로
 *   board.setCost(4, 4, 3);
 *   var pw = board.findPath(0,0, 9,7, { weighted:true });
 *
 * 주의:
 *   - 장애물 회피 = "통행 불가 셀"은 walkable=false. 비용(setCost)은 통행 가능하되 비싼 칸.
 *   - 휴리스틱은 admissible(과대평가 X)해야 A* 가 최단을 보장한다. 4방향=manhattan,
 *     8방향=octile 이 기본(자동 선택). 비용 가중 시에도 admissible 유지를 위해
 *     휴리스틱에 minCellCost 를 곱한다(기본 셀 비용 1 가정).
 *   - 경로 없음(완전 차단/범위 밖 시작·목표)은 **빈 배열 []**. null 이 필요하면 길이로 판별.
 *   - 헤드리스(Node require) 가능 — Phaser 비의존 순수 로직. 결정적 테스트에 사용.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var KIT_VERSION = '1.0.0';
  var SQRT2 = 1.4142135623730951;

  // ── 휴리스틱(셀 단위 거리, 비용 1 기준). 전부 admissible(과대평가 X). ──
  function hManhattan(dx, dy) { return dx + dy; }
  function hChebyshev(dx, dy) { return dx > dy ? dx : dy; }
  function hOctile(dx, dy) {
    // D*(dx+dy) + (D2-2D)*min — D=1, D2=√2. 8방향 이동 비용과 정확히 정합.
    var mn = dx < dy ? dx : dy, mx = dx < dy ? dy : dx;
    return (mx - mn) + SQRT2 * mn;
  }
  function hEuclidean(dx, dy) { return Math.sqrt(dx * dx + dy * dy); }

  var HEURISTICS = {
    manhattan: hManhattan,
    chebyshev: hChebyshev,
    octile: hOctile,
    euclidean: hEuclidean
  };

  // 4방향(상하좌우) / 8방향(대각선 포함) 오프셋. 순서 고정 = 탐색 결정론.
  var DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  function Board(cfg) {
    cfg = cfg || {};
    this.cols = Math.max(1, cfg.cols | 0 || 1);
    this.rows = Math.max(1, cfg.rows | 0 || 1);
    this.cellSize = cfg.cellSize == null ? 32 : cfg.cellSize;   // 정사각형 칸 변(픽셀)
    this.originX = cfg.originX == null ? 0 : cfg.originX;       // 그리드 좌상단 픽셀 오프셋
    this.originY = cfg.originY == null ? 0 : cfg.originY;

    var n = this.cols * this.rows;
    this._walk = new Uint8Array(n);   // 1=통행 가능, 0=장애물
    this._cost = new Float64Array(n); // 셀 진입 비용(통행 가능 칸에만 의미)
    for (var i = 0; i < n; i++) { this._walk[i] = 1; this._cost[i] = 1; }
  }

  // ── 인덱스 / 범위 ──
  Board.prototype.index = function (col, row) { return row * this.cols + col; };
  Board.prototype.inBounds = function (col, row) {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  };

  // ── 좌표 변환 ──
  // 칸 → 픽셀(칸 *중심*). 렌더에 바로 쓰기 좋게 중심을 반환.
  Board.prototype.cellToPixel = function (col, row) {
    return {
      x: this.originX + (col + 0.5) * this.cellSize,
      y: this.originY + (row + 0.5) * this.cellSize
    };
  };
  // 픽셀 → 칸(floor). 범위 밖이면 클램프하지 않고 그대로(inBounds 로 판별).
  Board.prototype.pixelToCell = function (x, y) {
    return {
      col: Math.floor((x - this.originX) / this.cellSize),
      row: Math.floor((y - this.originY) / this.cellSize)
    };
  };

  // ── 통행 가능 / 비용 ──
  Board.prototype.isWalkable = function (col, row) {
    return this.inBounds(col, row) && this._walk[this.index(col, row)] === 1;
  };
  Board.prototype.setWalkable = function (col, row, ok) {
    if (this.inBounds(col, row)) this._walk[this.index(col, row)] = ok ? 1 : 0;
    return this;
  };
  Board.prototype.getCost = function (col, row) {
    return this.inBounds(col, row) ? this._cost[this.index(col, row)] : Infinity;
  };
  // 셀 진입 비용(>=0). 늪·모래처럼 통행 가능하나 비싼 칸. 기본 1.
  Board.prototype.setCost = function (col, row, c) {
    if (this.inBounds(col, row)) this._cost[this.index(col, row)] = c < 0 ? 0 : c;
    return this;
  };

  // 2D 배열로 통행맵 일괄 설정. grid[row][col] 이 truthy=장애물(walkable=false).
  // (퍼즐/보드 데이터의 흔한 표기. blockedValue 로 어떤 값이 막힘인지 바꿀 수 있음.)
  Board.prototype.setObstaclesFromGrid = function (grid, blockedValue) {
    for (var r = 0; r < this.rows; r++) {
      var line = grid[r] || [];
      for (var c = 0; c < this.cols; c++) {
        var v = line[c];
        var blocked = blockedValue === undefined ? !!v : (v === blockedValue);
        this._walk[this.index(c, r)] = blocked ? 0 : 1;
      }
    }
    return this;
  };

  // ── A* 길찾기 ──
  // opts:
  //   diagonal:bool         8방향 허용(기본 false=4방향)
  //   dontCrossCorners:bool 대각 이동 시 양옆 직교 칸이 막혔으면 금지(코너컷 방지, 기본 false)
  //   heuristic:string      'manhattan'|'octile'|'euclidean'|'chebyshev' (미지정 시 자동)
  //   weighted:bool         셀별 비용(setCost) 반영(기본 false=균일 비용 1)
  //   weight:number         휴리스틱 가중(>1 이면 빠르지만 비최단 가능, 기본 1=admissible)
  // 반환: [{col,row}, ...] 시작·목표 포함. 경로 없으면 [].
  Board.prototype.findPath = function (sc, sr, gc, gr, opts) {
    opts = opts || {};
    var diagonal = !!opts.diagonal;
    var dirs = diagonal ? DIRS8 : DIRS4;
    var dontCross = !!opts.dontCrossCorners;
    var weighted = !!opts.weighted;
    var hWeight = opts.weight == null ? 1 : opts.weight;

    // 시작/목표가 범위 밖이거나 막혀 있으면 경로 없음.
    if (!this.isWalkable(sc, sr) || !this.isWalkable(gc, gr)) return [];

    var heuristic = HEURISTICS[opts.heuristic] ||
      (diagonal ? hOctile : hManhattan);

    // 가중 비용에서 admissible 유지: 휴리스틱에 최소 셀 비용을 곱한다.
    // (균일 비용이면 1. 가중이면 가장 싼 칸 비용으로 하한을 잡아 과대평가 방지.)
    var minCell = 1;
    if (weighted) {
      minCell = Infinity;
      for (var k = 0; k < this._cost.length; k++) {
        if (this._walk[k] === 1 && this._cost[k] < minCell) minCell = this._cost[k];
      }
      if (!isFinite(minCell)) minCell = 1;
    }

    var cols = this.cols;
    var n = cols * this.rows;
    var startIdx = sr * cols + sc;
    var goalIdx = gr * cols + gc;

    var g = new Float64Array(n);          // 시작→해당 칸 누적 비용
    var f = new Float64Array(n);          // g + h
    var parent = new Int32Array(n);       // 경로 복원용 부모 인덱스
    var order = new Float64Array(n);      // open 진입 순번(동점 타이브레이크)
    var state = new Uint8Array(n);        // 0=미발견, 1=open, 2=closed
    for (var i = 0; i < n; i++) parent[i] = -1;

    g[startIdx] = 0;
    f[startIdx] = heuristic(Math.abs(gc - sc), Math.abs(gr - sr)) * minCell * hWeight;
    order[startIdx] = 0;
    state[startIdx] = 1;
    var open = [startIdx];   // 단순 배열 open-set. best 선형 스캔 = 완전 결정론(힙 재배열 모호성 없음).
    var seq = 1;             // 단조 증가 삽입 순번(안정적 타이브레이크 키)

    while (open.length) {
      // best = (f 최소) → (h 최소: 목표에 더 가까움) → (order 최소: 먼저 발견) 의 사전식.
      var bestPos = 0, best = open[0];
      for (var p = 1; p < open.length; p++) {
        var cand = open[p];
        if (betterNode(cand, best, f, order, goalIdx, cols, heuristic, minCell)) {
          best = cand; bestPos = p;
        }
      }

      if (best === goalIdx) return reconstruct(parent, goalIdx, cols);

      // best 를 open 에서 제거(순서 보존 splice — 나머지 원소 상대순서 유지) 후 closed 로.
      open.splice(bestPos, 1);
      state[best] = 2;

      var bc = best % cols, br = (best / cols) | 0;
      for (var d = 0; d < dirs.length; d++) {
        var nc = bc + dirs[d][0], nr = br + dirs[d][1];
        if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
        var ni = nr * cols + nc;
        if (this._walk[ni] === 0 || state[ni] === 2) continue;

        var isDiag = dirs[d][0] !== 0 && dirs[d][1] !== 0;
        if (isDiag) {
          // 코너컷 방지: 대각선이 지나는 두 직교 칸 중 하나라도 막혔으면 통과 금지.
          if (dontCross &&
            (this._walk[br * cols + nc] === 0 || this._walk[nr * cols + bc] === 0)) continue;
        }

        var step = isDiag ? SQRT2 : 1;
        var cellCost = weighted ? this._cost[ni] : 1;
        var tentative = g[best] + step * cellCost;

        if (state[ni] === 0) {
          // 미발견 → open 추가.
          g[ni] = tentative;
          f[ni] = tentative + heuristic(Math.abs(gc - nc), Math.abs(gr - nr)) * minCell * hWeight;
          parent[ni] = best;
          order[ni] = seq++;
          state[ni] = 1;
          open.push(ni);
        } else if (tentative < g[ni]) {
          // 이미 open 인데 더 싼 경로 발견 → 갱신(order 는 최초 발견 순번 유지 = 안정 타이브레이크).
          g[ni] = tentative;
          f[ni] = tentative + heuristic(Math.abs(gc - nc), Math.abs(gr - nr)) * minCell * hWeight;
          parent[ni] = best;
        }
      }
    }
    return []; // open 소진 = 도달 불가.
  };

  // best 선택 비교: a 가 b 보다 "더 좋은" 노드인가? (사전식: f → h → order)
  function betterNode(a, b, f, order, goalIdx, cols, heuristic, minCell) {
    var EPS = 1e-9;
    if (f[a] < f[b] - EPS) return true;
    if (f[a] > f[b] + EPS) return false;
    // f 동점 → h(목표까지 추정) 작은 쪽. 부동소수 g 누적 차이를 흡수하는 안정 타이브레이크.
    var gcx = goalIdx % cols, gry = (goalIdx / cols) | 0;
    var ha = heuristic(Math.abs(gcx - (a % cols)), Math.abs(gry - ((a / cols) | 0))) * minCell;
    var hb = heuristic(Math.abs(gcx - (b % cols)), Math.abs(gry - ((b / cols) | 0))) * minCell;
    if (ha < hb - EPS) return true;
    if (ha > hb + EPS) return false;
    // h 도 동점 → 먼저 발견된(order 작은) 쪽. 완전한 결정 타이브레이크.
    return order[a] < order[b];
  }

  // parent 체인을 목표→시작 역추적 후 뒤집어 [{col,row}, ...] (시작·목표 포함) 반환.
  function reconstruct(parent, goalIdx, cols) {
    var path = [];
    var cur = goalIdx;
    while (cur !== -1) {
      path.push({ col: cur % cols, row: (cur / cols) | 0 });
      cur = parent[cur];
    }
    path.reverse();
    return path;
  }

  var BoardKit = {
    VERSION: KIT_VERSION,
    create: function (cfg) { return new Board(cfg); },
    Board: Board,
    // 휴리스틱 노출(커스텀 계산·테스트용).
    heuristics: HEURISTICS
  };

  global.BoardKit = BoardKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = BoardKit;
})(typeof window !== 'undefined' ? window : this);
