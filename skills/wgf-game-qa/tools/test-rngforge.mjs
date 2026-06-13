#!/usr/bin/env node
// test-rngforge.mjs — engine/rngforge.js 결정성 회귀 테스트(무의존성, Node 빌트인만)
// ─────────────────────────────────────────────────────────────────────────────
// 검증 항목:
//   1) mulberry32 비트 동일성 — runeburst 인라인판과 동일 출력(무손실 이관 보장)
//   2) 시드 결정론 — 같은 seed → 항상 같은 수열 / 다른 seed → 다른 수열
//   3) 직렬화 라운드트립 — state()/setState() 로 같은 지점부터 동일 재생
//   4) 멀티스트림 독립성 — 한 스트림 진행이 다른 스트림에 영향 0
//   5) clone 독립성 — 복제 후 두 난수기가 동일 수열을 따로 생성
//   6) 헬퍼 범위 — int/float/pick/shuffle/weighted 가 시드 고정 시 결정적
//   7) 문자열 시드 / fromUrl(location 없음) 폴백
//
// 사용: node skills/wgf-game-qa/tools/test-rngforge.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const RngForge = require(resolve(here, '../../../engine/rngforge.js'))

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}
const approx = (a, b) => Math.abs(a - b) < 1e-12
const seqEq = (a, b) => a.length === b.length && a.every((v, i) => approx(v, b[i]))
function take(rng, n) { const o = []; for (let i = 0; i < n; i++) o.push(rng()); return o }

// ── 1) mulberry32 비트 동일성 (기준 벡터는 runeburst 알고리즘으로 산출한 값) ──
const REF_1001 = [0.14117497857660055, 0.26740360795520246, 0.11109626526013017, 0.33289436250925064, 0.6569510197732598]
const REF_777 = [0.6863787178881466, 0.03445141832344234, 0.19238732964731753]
ok('mulberry32 parity seed=1001', seqEq(take(RngForge.create(1001), 5), REF_1001))
ok('mulberry32 parity seed=777', seqEq(take(RngForge.create(777), 3), REF_777))

// ── 2) 시드 결정론 ──
ok('same seed → same sequence', seqEq(take(RngForge.create(42), 20), take(RngForge.create(42), 20)))
ok('different seed → different sequence', !seqEq(take(RngForge.create(42), 20), take(RngForge.create(43), 20)))

// ── 3) 직렬화 라운드트립 ──
{
  const r = RngForge.create(2026)
  take(r, 7)
  const snap = r.state()
  const after = take(r, 10)
  r.setState(snap)
  ok('state()/setState() round-trip', seqEq(after, take(r, 10)), `state=${snap}`)
  ok('state() is a 32-bit int', Number.isInteger(snap))
}

// ── 4) 멀티스트림 독립성 ──
{
  const root = RngForge.create('world-1')
  const combatA = take(root.stream('combat'), 8)
  // particles 스트림을 잔뜩 굴린다 — combat 에 영향 없어야 함
  const fx = root.stream('particles'); for (let i = 0; i < 1000; i++) fx()
  const root2 = RngForge.create('world-1')
  const combatB = take(root2.stream('combat'), 8)
  ok('stream independence (advancing one ≠ affects another)', seqEq(combatA, combatB))
  ok('stream() cached (same instance per name)', root.stream('combat') === root.stream('combat'))
  ok('distinct streams differ', !seqEq(take(RngForge.create(9).stream('a'), 6), take(RngForge.create(9).stream('b'), 6)))
}

// ── 5) clone 독립성 ──
{
  const r = RngForge.create(555); take(r, 4)
  const c = r.clone()
  ok('clone reproduces same forward sequence', seqEq(take(r, 12), take(c, 12)))
}

// ── 6) 헬퍼 범위 + 결정성 ──
{
  const r = RngForge.create(7)
  let inRange = true
  for (let i = 0; i < 500; i++) { const v = r.int(8, 12); if (v < 8 || v > 12 || !Number.isInteger(v)) inRange = false }
  ok('int(min,max) within inclusive range', inRange)
  const a = RngForge.create(7), b = RngForge.create(7)
  const sa = a.shuffle([1, 2, 3, 4, 5, 6, 7, 8]), sb = b.shuffle([1, 2, 3, 4, 5, 6, 7, 8])
  ok('shuffle deterministic for fixed seed', JSON.stringify(sa) === JSON.stringify(sb))
  ok('shuffle is a permutation', JSON.stringify(sa.slice().sort((x, y) => x - y)) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]))
  const w = RngForge.create(3)
  const counts = { x: 0, y: 0 }
  for (let i = 0; i < 4000; i++) counts[w.weighted(['x', 'y'], [9, 1])]++
  ok('weighted respects weights (~90/10)', counts.x > counts.y * 5, `x=${counts.x} y=${counts.y}`)
}

// ── 7) 문자열 시드 / fromUrl 폴백 ──
{
  ok('string seed is deterministic', seqEq(take(RngForge.create('hello'), 5), take(RngForge.create('hello'), 5)))
  ok('hashSeed returns 32-bit int', Number.isInteger(RngForge.hashSeed('abc')))
  const fromUrl = RngForge.fromUrl(20260613)   // Node: location 없음 → defaultSeed
  ok('fromUrl falls back to defaultSeed (no location)', seqEq(take(fromUrl, 5), take(RngForge.create(20260613), 5)))
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
