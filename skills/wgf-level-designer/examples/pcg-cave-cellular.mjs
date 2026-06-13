#!/usr/bin/env node
/**
 * pcg-cave-cellular.mjs — Cellular Automata 동굴 생성 결정론 예제
 * ─────────────────────────────────────────────────────────────────
 * PCG 알고리즘 메뉴 §1 "Cellular Automata" 동작 실증.
 * RngForge 시드를 고정하면 항상 동일한 동굴 격자가 출력된다.
 *
 * 사용:
 *   node skills/wgf-level-designer/examples/pcg-cave-cellular.mjs
 *   node skills/wgf-level-designer/examples/pcg-cave-cellular.mjs --test
 *
 * 출력 계약 (--test 플래그):
 *   stdout 마지막 줄: {"ok":bool,"seed":number,"wallCount":number,"floorCount":number,"identical":bool}
 *   exit 0 (ok=true) / exit 1 (ok=false)
 *
 * 참고: reference/pcg/algorithms.md §1
 * 의존: engine/rngforge.js (헤드리스 Node 로드 가능)
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// engine/rngforge.js 는 IIFE+module.exports 패턴 — require 로 로드
const RngForge = require(join(__dirname, '../../../engine/rngforge.js'))

// ─── 설정 ────────────────────────────────────────────────────────────────────

const DEFAULT_SEED = 42
const W            = 40    // 격자 너비 (타일 수)
const H            = 20    // 격자 높이 (타일 수)
const FILL_PROB    = 0.45  // 초기 벽 밀도
const THRESHOLD    = 5     // 벽 생존 기준 이웃 수 (Moore 8방향)
const ITERATIONS   = 4     // CA 반복 횟수

const WALL  = 1
const FLOOR = 0

// ─── Cellular Automata 핵심 함수 ─────────────────────────────────────────────

/** 격자 초기화: 외곽은 항상 WALL, 내부는 확률 `fillProb`로 WALL */
function initGrid(width, height, fillProb, rng) {
  var grid = []
  for (var y = 0; y < height; y++) {
    grid[y] = []
    for (var x = 0; x < width; x++) {
      var isBorder = (x === 0 || x === width - 1 || y === 0 || y === height - 1)
      grid[y][x] = isBorder ? WALL : (rng() < fillProb ? WALL : FLOOR)
    }
  }
  return grid
}

/** Moore 이웃(8방향) 중 WALL 개수 반환 — 경계 밖은 WALL 로 간주 */
function countNeighborWalls(grid, x, y, width, height) {
  var count = 0
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      var nx = x + dx, ny = y + dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) count++  // 경계 밖 = 벽
      else if (grid[ny][nx] === WALL) count++
    }
  }
  return count
}

/** 1세대 CA 진행: threshold 이상 이웃 벽 → WALL, 미만 → FLOOR */
function stepGrid(grid, width, height, threshold) {
  var next = []
  for (var y = 0; y < height; y++) {
    next[y] = []
    for (var x = 0; x < width; x++) {
      var isBorder = (x === 0 || x === width - 1 || y === 0 || y === height - 1)
      if (isBorder) { next[y][x] = WALL; continue }
      var n = countNeighborWalls(grid, x, y, width, height)
      next[y][x] = (n >= threshold) ? WALL : FLOOR
    }
  }
  return next
}

/**
 * Cellular Automata 동굴 생성 (결정론)
 * @param {number} seed    - RngForge 시드 (같은 값 → 같은 출력)
 * @param {object} [opts]  - 선택 파라미터 오버라이드
 * @returns {{ grid:number[][], wallCount:number, floorCount:number, seed:number }}
 */
function generateCave(seed, opts) {
  var cfg = Object.assign({ width: W, height: H, fillProb: FILL_PROB, threshold: THRESHOLD, iterations: ITERATIONS }, opts || {})
  var rng = RngForge.create(seed)

  var grid = initGrid(cfg.width, cfg.height, cfg.fillProb, rng)
  for (var i = 0; i < cfg.iterations; i++) {
    grid = stepGrid(grid, cfg.width, cfg.height, cfg.threshold)
  }

  var wallCount = 0, floorCount = 0
  for (var y = 0; y < cfg.height; y++) {
    for (var x = 0; x < cfg.width; x++) {
      if (grid[y][x] === WALL) wallCount++
      else floorCount++
    }
  }

  return { grid: grid, wallCount: wallCount, floorCount: floorCount, seed: seed }
}

/** 격자를 ASCII 아트로 출력 (WALL='#', FLOOR='.') */
function printGrid(grid) {
  for (var y = 0; y < grid.length; y++) {
    console.log(grid[y].map(function(c) { return c === WALL ? '#' : '.' }).join(''))
  }
}

// ─── 메인 실행 ────────────────────────────────────────────────────────────────

var args = process.argv.slice(2)
var testMode = args.includes('--test')
var seedArg = args.find(function(a) { return /^\d+$/.test(a) })
var seed = seedArg ? parseInt(seedArg, 10) : DEFAULT_SEED

// 결정론 검증: 같은 시드로 2회 생성, 완전 동일해야 함
var run1 = generateCave(seed)
var run2 = generateCave(seed)

var identical = true
for (var y = 0; y < H; y++) {
  for (var x = 0; x < W; x++) {
    if (run1.grid[y][x] !== run2.grid[y][x]) { identical = false; break }
  }
  if (!identical) break
}

// 격자 출력 (--test 아닐 때만)
if (!testMode) {
  console.log('=== Cellular Automata 동굴 (seed=' + seed + ') ===')
  printGrid(run1.grid)
  console.log('벽: ' + run1.wallCount + ' / 바닥: ' + run1.floorCount + ' / 결정론: ' + (identical ? '통과' : '실패'))
}

// 결과 JSON (stdout 마지막 줄)
var ok = identical && run1.floorCount > 0
console.log(JSON.stringify({ ok: ok, seed: seed, wallCount: run1.wallCount, floorCount: run1.floorCount, identical: identical }))
process.exit(ok ? 0 : 1)
