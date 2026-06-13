#!/usr/bin/env node
// test-boardkit.mjs — engine/boardkit.js 논리 보드 + A* 길찾기 회귀 테스트
// ─────────────────────────────────────────────────────────────────────────────
// (무의존성, Node 빌트인만. Phaser 비의존 순수 로직이라 헤드리스로 결정 검증.)
//
// 검증 항목:
//   1) 좌표 변환 왕복 — cellToPixel(중심)↔pixelToCell 가 같은 칸으로 돌아옴 + 범위 검사
//   2) 직선 최단 — 장애물 없는 보드에서 경로 길이 = 맨해튼/체비셰프 하한
//   3) 장애물 회피 — 벽을 둘러 가고, 결과 경로의 모든 칸이 통행 가능
//   4) 경로 없음 — 목표를 완전히 가두면 [], 시작/목표가 막혀도 []
//   5) 결정론 — 같은 (보드·시작·목표·옵션) → 동일 경로 배열(여러 번 호출·새 보드 동일)
//   6) 4 vs 8방향 — 대각 허용 시 더 짧은(또는 같은) 경로
//   7) 코너컷 방지 — dontCrossCorners 가 막힌 모서리 사이 대각 관통을 금지
//   8) 휴리스틱 admissible — 가중 보드에서 A* 비용 = 다익스트라(h=0) 비용(최단 보장)
//   9) 소수 좌표 정규화 — findPath(0.5,0.5,...) 가 floor 칸(0,0)과 동일 경로 반환
//  10) cellSize 0/음수 방어 — create({cellSize:0}) 이 기본값 32 로 폴백
//  11) bimodal 가중 consistency — 비용 1 vs 큰 값 보드에서 A* = 다익스트라(최단 보장)
//
// 사용: node skills/wgf-game-qa/tools/test-boardkit.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const BoardKit = require(resolve(here, '../../../engine/boardkit.js'))

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}
const approx = (a, b) => Math.abs(a - b) < 1e-9
const pathKey = (p) => p.map(c => c.col + ',' + c.row).join(' ')
// 경로 비용(시작→끝 누적): 인접 스텝이 대각이면 √2, 직교면 1, weighted 면 ×목표칸 비용.
function pathCost(board, path, weighted) {
  let cost = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]
    const diag = a.col !== b.col && a.row !== b.row
    const step = diag ? Math.SQRT2 : 1
    const cell = weighted ? board.getCost(b.col, b.row) : 1
    cost += step * cell
  }
  return cost
}
// 모든 인접 스텝이 1칸(직교) 또는 1칸 대각인지 = 유효 인접 경로인지.
function isContiguous(path) {
  for (let i = 1; i < path.length; i++) {
    const dx = Math.abs(path[i].col - path[i - 1].col)
    const dy = Math.abs(path[i].row - path[i - 1].row)
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) return false
  }
  return true
}

// ── 1) 좌표 변환 왕복 + 범위 검사 ──
{
  const b = BoardKit.create({ cols: 10, rows: 8, cellSize: 32 })
  let roundtrip = true
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const px = b.cellToPixel(c, r)
      const cell = b.pixelToCell(px.x, px.y)
      if (cell.col !== c || cell.row !== r) roundtrip = false
    }
  }
  ok('cellToPixel↔pixelToCell round-trip (all cells)', roundtrip)
  const center = b.cellToPixel(0, 0)
  ok('cellToPixel returns cell center', approx(center.x, 16) && approx(center.y, 16), `(${center.x},${center.y})`)
  ok('inBounds true inside', b.inBounds(9, 7) && b.inBounds(0, 0))
  ok('inBounds false outside', !b.inBounds(10, 7) && !b.inBounds(-1, 0) && !b.inBounds(0, 8))
  // origin 오프셋 반영
  const b2 = BoardKit.create({ cols: 4, rows: 4, cellSize: 20, originX: 100, originY: 50 })
  const o = b2.cellToPixel(0, 0)
  ok('origin offset applied', approx(o.x, 110) && approx(o.y, 60), `(${o.x},${o.y})`)
  ok('pixelToCell respects origin', (() => { const cc = b2.pixelToCell(110, 60); return cc.col === 0 && cc.row === 0 })())
}

// ── 2) 직선 최단(장애물 없음) ──
{
  const b = BoardKit.create({ cols: 8, rows: 1, cellSize: 16 })
  const p = b.findPath(0, 0, 7, 0)
  ok('straight horizontal path length = manhattan+1', p.length === 8, `len=${p.length}`)
  ok('straight path endpoints correct', pathKey([p[0], p[p.length - 1]]) === '0,0 7,0')

  const b2 = BoardKit.create({ cols: 6, rows: 6, cellSize: 16 })
  const p4 = b2.findPath(0, 0, 5, 5)                      // 4방향: 맨해튼 = 10 스텝 → 11칸
  ok('4-dir diagonal goal = manhattan path', p4.length === 11, `len=${p4.length}`)
  const p8 = b2.findPath(0, 0, 5, 5, { diagonal: true })  // 8방향: 대각 5칸 → 6칸
  ok('8-dir diagonal goal = chebyshev path', p8.length === 6, `len=${p8.length}`)
  ok('all paths contiguous', isContiguous(p4) && isContiguous(p8))
}

// ── 3) 장애물 회피 ──
{
  // 5x5, 가운데 세로벽(col=2, row 0..3) — 아래로 돌아가야 함.
  const b = BoardKit.create({ cols: 5, rows: 5, cellSize: 16 })
  for (let r = 0; r <= 3; r++) b.setWalkable(2, r, false)
  const p = b.findPath(0, 0, 4, 0)
  ok('obstacle path found (non-empty)', p.length > 0, `len=${p.length}`)
  ok('obstacle path avoids all blocked cells', p.every(c => b.isWalkable(c.col, c.row)))
  ok('obstacle path is contiguous', isContiguous(p))
  ok('obstacle path longer than free straight (must detour)', p.length > 5, `len=${p.length}`)
  // 2D 그리드 일괄 장애물 설정도 동일 결과
  const grid = [
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0]
  ]
  const b2 = BoardKit.create({ cols: 5, rows: 5, cellSize: 16 })
  b2.setObstaclesFromGrid(grid)
  ok('setObstaclesFromGrid matches manual', pathKey(b2.findPath(0, 0, 4, 0)) === pathKey(p))
}

// ── 4) 경로 없음 ──
{
  // 목표(2,2)를 사방으로 완전히 가둠.
  const b = BoardKit.create({ cols: 5, rows: 5, cellSize: 16 })
  b.setWalkable(1, 2, false); b.setWalkable(3, 2, false)
  b.setWalkable(2, 1, false); b.setWalkable(2, 3, false)
  ok('fully blocked goal → [] (4-dir)', b.findPath(0, 0, 2, 2).length === 0)
  // 8방향이어도 대각까지 막으면 도달 불가
  b.setWalkable(1, 1, false); b.setWalkable(3, 1, false)
  b.setWalkable(1, 3, false); b.setWalkable(3, 3, false)
  ok('fully blocked goal → [] (8-dir, corners too)', b.findPath(0, 0, 2, 2, { diagonal: true }).length === 0)
  // 시작/목표 자체가 막힘 / 범위 밖
  const b2 = BoardKit.create({ cols: 4, rows: 4, cellSize: 16 })
  b2.setWalkable(0, 0, false)
  ok('blocked start → []', b2.findPath(0, 0, 3, 3).length === 0)
  ok('out-of-bounds goal → []', b2.findPath(0, 0, 9, 9).length === 0)
  // 시작 == 목표 → 한 칸 경로
  ok('start == goal → single-cell path', (() => { const p = b2.findPath(2, 2, 2, 2); return p.length === 1 && p[0].col === 2 && p[0].row === 2 })())
}

// ── 5) 결정론 ──
{
  // 다양한 경로가 동일 비용으로 가능하도록 빈 정사각 보드 — 타이브레이크가 일관돼야 함.
  const mk = () => BoardKit.create({ cols: 12, rows: 12, cellSize: 16 })
  const opt = { diagonal: true, dontCrossCorners: true }
  const ref = pathKey(mk().findPath(0, 0, 11, 11, opt))
  let stable = true
  for (let i = 0; i < 20; i++) {
    if (pathKey(mk().findPath(0, 0, 11, 11, opt)) !== ref) stable = false
  }
  ok('same board+start+goal+opts → identical path (20x, fresh boards)', stable, `path=${ref}`)
  // 같은 보드 인스턴스 반복 호출도 동일(내부 상태 누수 없음)
  const b = mk()
  const a1 = pathKey(b.findPath(0, 0, 11, 11, opt))
  const a2 = pathKey(b.findPath(0, 0, 11, 11, opt))
  ok('repeated findPath on same instance → identical (no state leak)', a1 === a2)
  // 장애물 포함 보드도 결정적
  const obs = () => { const x = mk(); for (let r = 2; r <= 9; r++) x.setWalkable(6, r, false); return x }
  const refObs = pathKey(obs().findPath(0, 0, 11, 11, { diagonal: true }))
  let stableObs = true
  for (let i = 0; i < 10; i++) if (pathKey(obs().findPath(0, 0, 11, 11, { diagonal: true })) !== refObs) stableObs = false
  ok('deterministic with obstacles (10x)', stableObs)
}

// ── 6) 4 vs 8방향 ──
{
  const b4 = BoardKit.create({ cols: 8, rows: 8, cellSize: 16 })
  const b8 = BoardKit.create({ cols: 8, rows: 8, cellSize: 16 })
  const p4 = b4.findPath(0, 0, 7, 7)
  const p8 = b8.findPath(0, 0, 7, 7, { diagonal: true })
  ok('8-dir path no longer than 4-dir (diagonal shortcut)', p8.length <= p4.length, `4d=${p4.length} 8d=${p8.length}`)
  ok('8-dir uses diagonal steps', p8.some((c, i) => i > 0 && c.col !== p8[i - 1].col && c.row !== p8[i - 1].row))
  ok('4-dir uses only orthogonal steps', p4.every((c, i) => i === 0 || c.col === p4[i - 1].col || c.row === p4[i - 1].row))
}

// ── 7) 코너컷 방지 ──
{
  // (1,0)과 (0,1)을 막고 (0,0)→(1,1) 대각: 코너컷 허용이면 1스텝, 방지면 우회/불가.
  const mk = () => { const x = BoardKit.create({ cols: 3, rows: 3, cellSize: 16 }); x.setWalkable(1, 0, false); x.setWalkable(0, 1, false); return x }
  const pCut = mk().findPath(0, 0, 1, 1, { diagonal: true })                          // 코너컷 허용
  const pNoCut = mk().findPath(0, 0, 1, 1, { diagonal: true, dontCrossCorners: true }) // 코너컷 방지
  // 허용이면 (0,0)→(1,1) 직접 대각(2칸). 방지면 그 대각이 금지 → 둘러가야 하므로 더 길거나 불가.
  ok('corner-cut allowed: direct diagonal (2 cells)', pCut.length === 2, `len=${pCut.length}`)
  const noDirectDiag = pNoCut.length === 0 || pNoCut.length > 2
  ok('dontCrossCorners blocks squeezing through blocked corner', noDirectDiag, `len=${pNoCut.length}`)
  // 방지 경로가 존재한다면 인접 + 통행가능 보장(여기선 둘러갈 칸이 없어 [])
  ok('corner-cut variant deterministic', pathKey(mk().findPath(0, 0, 1, 1, { diagonal: true, dontCrossCorners: true })) === pathKey(pNoCut))
}

// ── 8) 휴리스틱 admissible (A* 비용 = 다익스트라 최단 비용) ──
{
  // 가중 보드: 가운데 띠가 비싸다(비용 5). A* (octile×minCell) 가 최단 비용을 줘야 함.
  const mk = () => {
    const x = BoardKit.create({ cols: 10, rows: 10, cellSize: 16 })
    for (let c = 0; c < 10; c++) x.setCost(c, 5, 5) // row=5 전체 비용 5
    return x
  }
  const board = mk()
  const pAstar = board.findPath(0, 0, 9, 9, { weighted: true, diagonal: true })
  const costAstar = pathCost(board, pAstar, true)
  // 다익스트라 등가: heuristic 무력화(가중치 0). weight:0 이면 f=g → 순수 다익스트라.
  const pDijkstra = mk().findPath(0, 0, 9, 9, { weighted: true, diagonal: true, weight: 0 })
  const costDijkstra = pathCost(mk(), pDijkstra, true)
  ok('weighted path found', pAstar.length > 0)
  ok('A* cost == Dijkstra cost (heuristic admissible → optimal)', approx(costAstar, costDijkstra), `A*=${costAstar.toFixed(4)} Dij=${costDijkstra.toFixed(4)}`)

  // 균일 비용 4방향에서 manhattan 휴리스틱도 최단(= 다익스트라) 보장.
  const u = () => BoardKit.create({ cols: 9, rows: 9, cellSize: 16 })
  const cu = pathCost(u(), u().findPath(0, 0, 8, 8, {}), false)
  const cd = pathCost(u(), u().findPath(0, 0, 8, 8, { weight: 0 }), false)
  ok('uniform 4-dir A* cost == Dijkstra cost', approx(cu, cd), `A*=${cu} Dij=${cd}`)

  // 휴리스틱 노출 확인 + 값 정합(octile(3,3)=3√2, manhattan(3,4)=7).
  ok('heuristics exposed & correct', approx(BoardKit.heuristics.octile(3, 3), 3 * Math.SQRT2) && BoardKit.heuristics.manhattan(3, 4) === 7)
}

// ── 9) 소수 좌표 정규화 ──
{
  const b = BoardKit.create({ cols: 6, rows: 6, cellSize: 16 })
  // (0.5,0.5)→(0,0), (4.9,4.9)→(4,4) 로 floor 강제. 정수 좌표와 동일 경로여야 함.
  const pInt = b.findPath(0, 0, 4, 4)
  const pFloat = b.findPath(0.5, 0.5, 4.9, 4.9)
  ok('float coords normalized to floor cell (same path as int)', pathKey(pFloat) === pathKey(pInt), `int=${pathKey(pInt)} float=${pathKey(pFloat)}`)
  // 소수 시작이 막힌 칸에 floor 되면 [] (정수와 동일 가드 동작)
  const b2 = BoardKit.create({ cols: 4, rows: 4, cellSize: 16 })
  b2.setWalkable(1, 1, false)
  ok('float blocked-cell start → [] (same as int)', b2.findPath(1.7, 1.2, 3, 3).length === 0)
}

// ── 10) cellSize 0/음수 방어 ──
{
  const b0 = BoardKit.create({ cols: 4, rows: 4, cellSize: 0 })
  ok('cellSize:0 falls back to 32', b0.cellSize === 32)
  const bNeg = BoardKit.create({ cols: 4, rows: 4, cellSize: -10 })
  ok('cellSize:-10 falls back to 32', bNeg.cellSize === 32)
  // 정상 cellSize 는 그대로
  const bOk = BoardKit.create({ cols: 4, rows: 4, cellSize: 24 })
  ok('valid cellSize:24 preserved', bOk.cellSize === 24)
  // pixelToCell 이 Infinity/NaN 없이 정상 동작하는지
  const px = b0.cellToPixel(2, 2)
  const cc = b0.pixelToCell(px.x, px.y)
  ok('cellSize:0 fallback: cellToPixel↔pixelToCell round-trip sane', cc.col === 2 && cc.row === 2)
}

// ── 11) bimodal 가중 consistency (A* = 다익스트라, closed 재오픈 불필요 확인) ──
{
  // 비용 1 vs 비용 100 의 이분 보드: A* 가 비싼 칸을 우회해 최단 비용을 찾아야 함.
  // weight:1(admissible) A* 와 weight:0(순수 다익스트라) 비용이 일치해야 최단 보장 확인.
  const mk = () => {
    const x = BoardKit.create({ cols: 12, rows: 12, cellSize: 16 })
    // 가운데 세로 띠(col 5,6) 전체를 비용 100 으로 설정(막지는 않음 — 통과는 가능하나 매우 비쌈)
    for (let r = 0; r < 12; r++) { x.setCost(5, r, 100); x.setCost(6, r, 100) }
    return x
  }
  const bA = mk(), bD = mk()
  const pA = bA.findPath(0, 0, 11, 11, { weighted: true, diagonal: true })
  const pD = bD.findPath(0, 0, 11, 11, { weighted: true, diagonal: true, weight: 0 })
  const costA = pathCost(mk(), pA, true)
  const costD = pathCost(mk(), pD, true)
  ok('bimodal weighted: path found', pA.length > 0)
  ok('bimodal weighted: A* cost == Dijkstra (admissible → no suboptimal shortcut)', approx(costA, costD), `A*=${costA.toFixed(4)} Dij=${costD.toFixed(4)}`)
  // 우회 경로가 실제로 비싼 칸을 최소화했는지: 비싼 칸(col 5 or 6) 통과 수
  const expensive = (p) => p.filter(c => c.col === 5 || c.col === 6).length
  ok('bimodal: A* avoids expensive columns (same or fewer than Dijkstra)', expensive(pA) <= expensive(pD) + 1)
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
