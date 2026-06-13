#!/usr/bin/env node
// snapshot.mjs — 값-스냅샷(golden) 회귀 테스트 하니스
// ─────────────────────────────────────────────────────────────────────────────
// 결정론 제너레이터(RngForge 등)의 출력을 JSON 픽스처로 저장·비교한다.
// 코드 변경으로 출력이 달라지면 불일치 diff 를 출력하고 비제로 종료해 회귀를 잡는다.
//
// 모드:
//   node skills/wgf-game-qa/tools/snapshot.mjs           기본: golden 비교, 불일치 시 종료 1
//   node skills/wgf-game-qa/tools/snapshot.mjs --update  golden 생성·갱신 후 종료 0
//
// 출력 계약: 사람용 라인들 먼저, 마지막 줄 단일 JSON:
//   {"ok":bool,"pass":n,"fail":n,"updated":n,"cases":[...]}
// 종료코드: 전부 일치(또는 --update) → 0, 하나라도 불일치 → 1.
//
// golden 픽스처 위치: skills/wgf-game-qa/tools/golden/<case-id>.json
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const GOLDEN_DIR = resolve(here, 'golden')
const engineDir  = resolve(here, '../../../engine')

const UPDATE_MODE = process.argv.includes('--update')

// ── 엔진 로드 ──────────────────────────────────────────────────────────────
const RngForge = require(resolve(engineDir, 'rngforge.js'))

// ── 헬퍼 ───────────────────────────────────────────────────────────────────
function take(rng, n) {
  const out = []
  for (let i = 0; i < n; i++) out.push(rng())
  return out
}

/** golden 파일 경로 */
function goldenPath(id) {
  return resolve(GOLDEN_DIR, `${id}.json`)
}

/** golden 저장 */
function saveGolden(id, value) {
  mkdirSync(GOLDEN_DIR, { recursive: true })
  writeFileSync(goldenPath(id), JSON.stringify(value, null, 2) + '\n', 'utf8')
}

/** golden 읽기 (없으면 null) */
function loadGolden(id) {
  const p = goldenPath(id)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8'))
}

/**
 * 두 값을 깊이 비교해 diff 문자열을 반환한다.
 * 동일하면 null 반환.
 */
function diffValues(expected, actual) {
  const es = JSON.stringify(expected, null, 2)
  const as = JSON.stringify(actual, null, 2)
  if (es === as) return null

  // 줄 단위 diff 요약 (첫 8개 불일치만)
  const el = es.split('\n')
  const al = as.split('\n')
  const maxLines = Math.max(el.length, al.length)
  const diffs = []
  for (let i = 0; i < maxLines && diffs.length < 8; i++) {
    const e = el[i] ?? '<missing>'
    const a = al[i] ?? '<missing>'
    if (e !== a) diffs.push(`  line ${i + 1}: expected ${e.trim()} | got ${a.trim()}`)
  }
  return diffs.join('\n')
}

// ── 스냅샷 케이스 정의 ──────────────────────────────────────────────────────
/**
 * 각 케이스: { id: string, describe: string, capture: () => unknown }
 *   id       — golden 파일명(영숫자·하이픈만)
 *   describe — 설명 (콘솔 출력용)
 *   capture  — 결정론 출력 반환 함수
 */
const CASES = [
  // ── 케이스 1: RngForge 고정 시드 수열 (mulberry32 비트 동일성 기준 벡터 포함) ──
  {
    id: 'rng-fixed-seed-sequences',
    describe: 'RngForge 고정 시드 수열 — mulberry32 출력 + 헬퍼(int/pick/shuffle)',
    capture() {
      const r1001 = RngForge.create(1001)
      const r777  = RngForge.create(777)
      const r42   = RngForge.create(42)

      // 멀티스트림: combat / particles 독립성
      const root   = RngForge.create('world-1')
      const combat = take(root.stream('combat'), 8)
      // particles 를 1000번 굴려도 combat 재현이 동일해야 함
      const fx = root.stream('particles')
      for (let i = 0; i < 1000; i++) fx()
      const root2  = RngForge.create('world-1')
      const combat2 = take(root2.stream('combat'), 8)

      // 직렬화: state()/setState() 체크포인트
      const rs = RngForge.create(2026)
      take(rs, 7)
      const snap = rs.state()
      const afterSnap = take(rs, 10)

      return {
        seed1001_first5:  take(r1001, 5),
        seed777_first3:   take(r777,  3),
        seed42_int_8_12:  (() => { const r = RngForge.create(42); return Array.from({length:10}, () => r.int(8, 12)) })(),
        seed42_pick:      (() => {
          const r = RngForge.create(42)
          const items = ['sword', 'shield', 'bow', 'staff', 'dagger']
          return Array.from({length:8}, () => r.pick(items))
        })(),
        seed42_shuffle:   (() => {
          const r = RngForge.create(42)
          return r.shuffle([1, 2, 3, 4, 5, 6, 7, 8])
        })(),
        seed42_float_0_100: take(r42, 5).map(v => Math.round(v * 100 * 1e6) / 1e6),
        stream_combat_world1: combat,
        stream_combat_world1_after_fx_1000: combat2,
        serialization_seed2026_snap: snap,
        serialization_seed2026_after10: afterSnap,
      }
    }
  },

  // ── 케이스 2: RngForge 문자열 시드 + weighted 분포 시드 고정 샘플 ──
  {
    id: 'rng-string-seed-weighted',
    describe: 'RngForge 문자열 시드 결정론 + weighted 선택 고정 샘플',
    capture() {
      const rHello = RngForge.create('hello')
      const rLevel = RngForge.create('level-forest-01')

      // weighted: 90/10 가중치로 50회 샘플
      const rW = RngForge.create('weighted-test')
      const wSamples = Array.from({length: 50}, () =>
        rW.weighted(['common', 'rare'], [9, 1])
      )

      // clone 독립성: clone 직후 10개 동일 수열
      const rBase = RngForge.create(555)
      take(rBase, 4)
      const cloneSeq = take(rBase.clone(), 10)

      // bool/sign 고정 샘플
      const rBool = RngForge.create(99)
      const boolSamples = Array.from({length: 10}, () => rBool.bool(0.3))
      const signSamples = Array.from({length: 10}, () => rBool.sign())

      return {
        hello_first8:          take(rHello, 8),
        level_forest_first8:   take(rLevel, 8),
        hashSeed_hello:        RngForge.hashSeed('hello'),
        hashSeed_world:        RngForge.hashSeed('world'),
        weighted_90_10_50:     wSamples,
        clone_after4_next10:   cloneSeq,
        bool_p03_10:           boolSamples,
        sign_10:               signSamples,
      }
    }
  }
]

// ── 실행 ────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0, updated = 0
const results = []

for (const c of CASES) {
  let actual
  try {
    actual = c.capture()
  } catch (err) {
    console.log(`✗ [capture-error] ${c.id} — ${err.message}`)
    fail++
    results.push({ id: c.id, ok: false, detail: `capture error: ${err.message}` })
    continue
  }

  if (UPDATE_MODE) {
    saveGolden(c.id, actual)
    updated++
    console.log(`↑ [updated] ${c.id}`)
    results.push({ id: c.id, ok: true, detail: 'updated' })
    continue
  }

  const golden = loadGolden(c.id)
  if (golden === null) {
    console.log(`✗ [no-golden] ${c.id} — golden 픽스처가 없습니다. --update 로 먼저 생성하세요.`)
    fail++
    results.push({ id: c.id, ok: false, detail: 'no golden file' })
    continue
  }

  const diff = diffValues(golden, actual)
  if (diff === null) {
    pass++
    console.log(`✓ ${c.id} — ${c.describe}`)
    results.push({ id: c.id, ok: true, detail: '' })
  } else {
    fail++
    console.log(`✗ [mismatch] ${c.id} — ${c.describe}`)
    console.log(diff)
    results.push({ id: c.id, ok: false, detail: diff })
  }
}

if (UPDATE_MODE) {
  console.log(`— updated ${updated} golden file(s) in ${GOLDEN_DIR}`)
  console.log(JSON.stringify({ ok: true, pass: 0, fail: 0, updated, cases: results }))
  process.exit(0)
} else {
  console.log(`— pass ${pass} · fail ${fail}`)
  console.log(JSON.stringify({ ok: fail === 0, pass, fail, updated: 0, cases: results }))
  process.exit(fail === 0 ? 0 : 1)
}
