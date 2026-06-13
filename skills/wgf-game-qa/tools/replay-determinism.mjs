#!/usr/bin/env node
// replay-determinism.mjs — 결정성 회귀 하니스 (상태 스냅샷 + 2회 재생 해시)
// ─────────────────────────────────────────────────────────────────────────────
// game.step 게임상태를 직렬화해, 두 가지 방식으로 비결정성 누수를 자동 검출한다.
//
//   (a) 상태 스냅샷 회귀(golden):
//       시드 고정 game.step N프레임 후, 직렬화 게임상태(좌표는 양자화로 부동소수
//       노이즈 제거 · score/lives/엔티티수/rng.state 포함)를 값-스냅샷으로 박아
//       회귀를 잡는다. snapshot.mjs 의 golden 디렉터리/diff/--update 패턴과 동형.
//
//   (b) 2회 재생 해시:
//       같은 시드 + 같은 입력 타임라인(프레임별 입력 배열)을 2회 독립 재생해,
//       각 회차의 직렬화 상태 시퀀스를 해시(djb2+FNV)로 접는다. 두 해시가 다르면
//       step 내부에 Date.now()/Math.random()/순회순서 같은 비결정성이 샌 것이다.
//
// fixture 2종:
//   det-minigame   — 결정적 미니게임(엔트로피원=RngForge 뿐). 2회 재생 동일 해시여야 PASS.
//   nondet-minigame — Date.now()/Math.random() 를 step 에 주입한 음성 fixture.
//                     "검출돼야 정상"이므로, 도구가 2회 재생 불일치를 성공적으로
//                     잡으면(=발산하면) PASS 로 처리하는 메타 테스트.
//
// 헤드리스 한계: games/runeburst 등 실제 게임의 resolveStep 은 Phaser 의 scene/
//   tween/timer(this.time.delayedCall)에 깊게 묶여 있어 Node 헤드리스 step 이 불가하다.
//   대신 실제 engine/rngforge.js 를 유일 엔트로피원으로 쓰는 합성 game.step 으로
//   (a)(b) 둘 다 실증한다 — 시드 RNG 가 모든 스폰/이동/충돌/점수를 구동하는
//   runeburst 의 결정론 모델(rng 하나가 진실)과 동형이다.
//
// 모드:
//   node skills/wgf-game-qa/tools/replay-determinism.mjs           기본: golden 비교 + 2회 재생 검사
//   node skills/wgf-game-qa/tools/replay-determinism.mjs --update  golden 생성·갱신(재생 검사는 그대로)
//
// 출력 계약: 사람용 라인들 먼저, 마지막 줄 단일 JSON:
//   {"ok":bool,"pass":n,"fail":n,"updated":n,"cases":[...]}
// 종료코드: 전부 통과 → 0, 하나라도 실패(capture 실패 포함) → 1.
//           --update 모드에서도 실패가 있으면 exit 1.
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

// ── 직렬화 헬퍼 ──────────────────────────────────────────────────────────────
const QUANT = 1000
/** 좌표 양자화 — round(v*1000)/1000 로 부동소수 노이즈 제거. */
function q(v) { return Math.round(v * QUANT) / QUANT }

/**
 * 게임상태 → 결정적 직렬화 문자열.
 * 객체 키를 정렬해 순회순서 비결정성("키 순서가 곧 출력")까지 잡는다.
 * (JSON.stringify 자체는 삽입순서를 따르므로, 정렬 직렬화가 순회순서 누수를 노출한다.)
 */
function serialize(state) {
  return JSON.stringify(state, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted = {}
      for (const k of Object.keys(value).sort()) sorted[k] = value[k]
      return sorted
    }
    return value
  })
}

/**
 * djb2 + FNV-1a 32-bit 혼합 해시 — 상태 시퀀스(문자열들)를 하나의 지문으로 접는다.
 * 두 알고리즘을 함께 써 충돌 위험을 낮추고, 8자리 16진수 2개를 이어 반환한다.
 */
function hashSeq(strings) {
  let djb2 = 5381 >>> 0
  let fnv = 2166136261 >>> 0
  for (const s of strings) {
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i)
      djb2 = (Math.imul(djb2, 33) + ch) >>> 0
      fnv ^= ch
      fnv = Math.imul(fnv, 16777619) >>> 0
    }
    // 레코드 구분자 — 경계 충돌(인접 문자열 합쳐짐) 방지
    djb2 = (Math.imul(djb2, 33) + 0x1f) >>> 0
    fnv ^= 0x1f
    fnv = Math.imul(fnv, 16777619) >>> 0
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0')
  return hex(djb2) + hex(fnv)
}

// ── 합성 미니게임 step ────────────────────────────────────────────────────────
// 보드 위의 엔티티들이 매 프레임 이동·벽반사하고, RNG 로 스폰/제거/점수가 결정된다.
// 모든 무작위는 주입된 rng(RngForge) 하나에서만 나온다 → 시드 고정 시 완전 결정적.
//
// makeStep(opts) 가 반환하는 step(state, frame, input):
//   - state: { tick, score, lives, ents:[{id,x,y,vx,vy}], rngState }
//   - frame: 경과 ms (게임 로직은 dt 비의존이지만 game.step 시그니처와 정합)
//   - input: 이 프레임의 입력 배열(예: ['left','spawn']) — 타임라인 재생용
//
// opts.entropy: 'rng'(결정적) | 'datenow' | 'mathrandom'(음성 fixture)
function makeMiniGame(seed, opts) {
  opts = opts || {}
  const entropy = opts.entropy || 'rng'
  const W = 360, H = 240

  const rng = RngForge.create(seed)
  // 멀티스트림: 스폰과 충돌판정을 분리해, 한쪽을 더 굴려도 다른 쪽이 안 밀리게.
  const spawnRng = rng.stream('spawn')
  const fxRng = rng.stream('fx')

  let nextId = 1
  const state = {
    tick: 0,
    score: 0,
    lives: 3,
    ents: [],
    rngState: rng.state()
  }

  // 비결정성 주입원 — entropy 모드에 따라 시각/Math.random 을 섞는다(음성 fixture 전용).
  function noise() {
    if (entropy === 'datenow') return Date.now() % 97            // rng-ok kitdep-ok: 비결정성 누수 검출용 음성 fixture — 의도적 비결정
    if (entropy === 'mathrandom') return Math.floor(Math.random() * 97) // rng-ok kitdep-ok: 비결정성 누수 검출용 음성 fixture — 의도적 비결정
    return 0 // 'rng' 결정적 모드 — 노이즈 없음
  }

  function spawn() {
    state.ents.push({
      id: nextId++,
      x: q(spawnRng.float(0, W)),
      y: q(spawnRng.float(0, H)),
      vx: q(spawnRng.float(-3, 3)),
      vy: q(spawnRng.float(-3, 3))
    })
  }

  function step(input) {
    state.tick++
    input = input || []

    if (input.includes('spawn')) spawn()

    // 입력 방향으로 전체 엔티티 가속(미세) — 입력 타임라인이 상태에 반영되게.
    const ax = input.includes('left') ? -0.5 : input.includes('right') ? 0.5 : 0
    const ay = input.includes('up') ? -0.5 : input.includes('down') ? 0.5 : 0

    for (const e of state.ents) {
      e.vx = q(e.vx + ax)
      e.vy = q(e.vy + ay)
      e.x = q(e.x + e.vx)
      e.y = q(e.y + e.vy)
      // 벽 반사
      if (e.x < 0) { e.x = 0; e.vx = q(-e.vx) }
      if (e.x > W) { e.x = W; e.vx = q(-e.vx) }
      if (e.y < 0) { e.y = 0; e.vy = q(-e.vy) }
      if (e.y > H) { e.y = H; e.vy = q(-e.vy) }
    }

    // 충돌/점수: fxRng + (음성 fixture 면) 시각 노이즈를 섞어 비결정성을 흘린다.
    if (state.ents.length >= 2) {
      const hit = fxRng.bool(0.3)
      if (hit) {
        const idx = (fxRng.int(0, state.ents.length - 1) + noise()) % state.ents.length
        state.ents.splice(idx, 1)
        state.score += 10 + noise()
        if (fxRng.bool(0.1)) state.lives = Math.max(0, state.lives - 1)
      }
    }

    state.rngState = rng.state()
    return state
  }

  return { step, getState: () => state, W, H }
}

/** 한 회차 전체 재생 — 입력 타임라인을 step 에 먹이고 프레임별 직렬화 상태 시퀀스를 모은다. */
function playTimeline(seed, timeline, opts) {
  const game = makeMiniGame(seed, opts)
  const FRAME = 1000 / 60
  const seq = []
  for (let i = 0; i < timeline.length; i++) {
    game.step(timeline[i])
    // 매 프레임 직렬화 상태를 시퀀스에 적재(해시·스냅샷 공용)
    seq.push(serialize(snapshotOf(game.getState())))
  }
  return seq
}

/** game.step 상태 → 양자화·정규화된 스냅샷(직렬화 대상). SKILL.md 6단계 계약과 정합. */
function snapshotOf(state) {
  return {
    tick: state.tick,
    score: state.score,
    lives: state.lives,
    entCount: state.ents.length,
    rngState: state.rngState,
    // 좌표는 이미 q()로 양자화돼 있으나, 한 번 더 안전 양자화(외부 주입 대비)
    ents: state.ents.map(e => ({ id: e.id, x: q(e.x), y: q(e.y), vx: q(e.vx), vy: q(e.vy) }))
  }
}

// ── 입력 타임라인 생성(시드 RNG 로 결정적으로 — 타임라인 자체가 재현 가능해야 함) ──
function buildTimeline(seedStr, frames) {
  const tr = RngForge.create(seedStr)
  const DIRS = ['left', 'right', 'up', 'down']
  const tl = []
  for (let i = 0; i < frames; i++) {
    const inp = []
    if (tr.bool(0.5)) inp.push(tr.pick(DIRS))
    if (tr.bool(0.25)) inp.push('spawn')
    tl.push(inp)
  }
  return tl
}

// ── golden 입출력(snapshot.mjs 와 동형) ──────────────────────────────────────
function goldenPath(id) { return resolve(GOLDEN_DIR, `${id}.json`) }
function saveGolden(id, value) {
  mkdirSync(GOLDEN_DIR, { recursive: true })
  writeFileSync(goldenPath(id), JSON.stringify(value, null, 2) + '\n', 'utf8')
}
function loadGolden(id) {
  const p = goldenPath(id)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** 두 값 깊이 비교 → diff 문자열(동일하면 null). snapshot.mjs 의 diffValues 와 동형. */
function diffValues(expected, actual) {
  const es = JSON.stringify(expected, null, 2)
  const as = JSON.stringify(actual, null, 2)
  if (es === as) return null
  const el = es.split('\n'), al = as.split('\n')
  const diffs = []
  if (Array.isArray(expected) && Array.isArray(actual) && expected.length !== actual.length) {
    diffs.push(`  expected ${expected.length} items, got ${actual.length} items`)
  }
  const maxLines = Math.max(el.length, al.length)
  for (let i = 0; i < maxLines && diffs.length < 9; i++) {
    const e = el[i] ?? '<missing>'
    const a = al[i] ?? '<missing>'
    if (e !== a) diffs.push(`  line ${i + 1}: expected ${e.trim()} | got ${a.trim()}`)
  }
  return diffs.join('\n')
}

// ── 케이스 정의 ──────────────────────────────────────────────────────────────
const TIMELINE_FRAMES = 240
const SNAPSHOT_FRAMES = 120

// (a) 상태 스냅샷 회귀 케이스 — 시드 고정 N프레임 후 직렬화 상태를 golden 으로 비교.
const SNAPSHOT_CASES = [
  {
    id: 'replay-det-minigame-snapshot',
    describe: '결정적 미니게임 — 시드 고정 120프레임 후 직렬화 상태(golden)',
    capture() {
      const tl = buildTimeline('snap-timeline-v1', SNAPSHOT_FRAMES)
      const game = makeMiniGame(20260613, { entropy: 'rng' })
      for (let i = 0; i < tl.length; i++) game.step(tl[i])
      return snapshotOf(game.getState())
    }
  }
]

// (b) 2회 재생 해시 케이스 — 같은 시드+타임라인 2회 독립 재생 → 해시 비교.
//   det:    동일 해시여야 PASS.
//   nondet: 불일치(발산)를 잡아야 PASS(메타 테스트).
const REPLAY_CASES = [
  {
    id: 'replay-twice-det',
    describe: '결정적 미니게임 — 같은 시드/타임라인 2회 재생 → 해시 동일이어야 통과',
    expectMatch: true,
    run() {
      const tl = buildTimeline('replay-timeline-v1', TIMELINE_FRAMES)
      const seqA = playTimeline(7777, tl, { entropy: 'rng' })
      const seqB = playTimeline(7777, tl, { entropy: 'rng' })
      return { hashA: hashSeq(seqA), hashB: hashSeq(seqB), frames: tl.length }
    }
  },
  {
    id: 'replay-twice-nondet-datenow',
    describe: 'Date.now 주입 음성 fixture — 2회 재생 불일치를 검출해야 통과(메타)',
    expectMatch: false,
    run() {
      const tl = buildTimeline('replay-timeline-v1', TIMELINE_FRAMES)
      const seqA = playTimeline(7777, tl, { entropy: 'datenow' })
      const seqB = playTimeline(7777, tl, { entropy: 'datenow' })
      return { hashA: hashSeq(seqA), hashB: hashSeq(seqB), frames: tl.length }
    }
  },
  {
    id: 'replay-twice-nondet-mathrandom',
    describe: 'Math.random 주입 음성 fixture — 2회 재생 불일치를 검출해야 통과(메타)',
    expectMatch: false,
    run() {
      const tl = buildTimeline('replay-timeline-v1', TIMELINE_FRAMES)
      const seqA = playTimeline(7777, tl, { entropy: 'mathrandom' })
      const seqB = playTimeline(7777, tl, { entropy: 'mathrandom' })
      return { hashA: hashSeq(seqA), hashB: hashSeq(seqB), frames: tl.length }
    }
  }
]

// ── 실행 ────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0, updated = 0
const results = []

// (a) 상태 스냅샷 회귀
for (const c of SNAPSHOT_CASES) {
  let actual
  try {
    actual = c.capture()
  } catch (err) {
    console.log(`✗ [capture-error] ${c.id} — ${err.message}`)
    fail++
    results.push({ id: c.id, kind: 'snapshot', ok: false, detail: `capture error: ${err.message}` })
    continue
  }

  if (UPDATE_MODE) {
    saveGolden(c.id, actual)
    updated++
    console.log(`↑ [updated] ${c.id}`)
    results.push({ id: c.id, kind: 'snapshot', ok: true, detail: 'updated' })
    continue
  }

  const golden = loadGolden(c.id)
  if (golden === null) {
    console.log(`✗ [no-golden] ${c.id} — golden 픽스처가 없습니다. --update 로 먼저 생성하세요.`)
    fail++
    results.push({ id: c.id, kind: 'snapshot', ok: false, detail: 'no golden file' })
    continue
  }

  const diff = diffValues(golden, actual)
  if (diff === null) {
    pass++
    console.log(`✓ ${c.id} — ${c.describe}`)
    results.push({ id: c.id, kind: 'snapshot', ok: true, detail: '' })
  } else {
    fail++
    console.log(`✗ [mismatch] ${c.id} — ${c.describe}`)
    console.log(diff)
    results.push({ id: c.id, kind: 'snapshot', ok: false, detail: diff })
  }
}

// (b) 2회 재생 해시 — golden 무관(항상 실행). --update 모드에서도 동일하게 검사.
for (const c of REPLAY_CASES) {
  let r
  try {
    r = c.run()
  } catch (err) {
    console.log(`✗ [run-error] ${c.id} — ${err.message}`)
    fail++
    results.push({ id: c.id, kind: 'replay', ok: false, detail: `run error: ${err.message}` })
    continue
  }

  const matched = r.hashA === r.hashB
  // expectMatch=true  → 동일 해시여야 통과(결정성 확인).
  // expectMatch=false → 불일치를 검출해야 통과(비결정성 누수 검출 = 도구가 일을 한다).
  const ok = c.expectMatch ? matched : !matched
  if (ok) {
    pass++
    if (c.expectMatch) {
      console.log(`✓ ${c.id} — ${c.describe} [hash=${r.hashA}]`)
    } else {
      console.log(`✓ ${c.id} — ${c.describe} [검출: A=${r.hashA} ≠ B=${r.hashB}]`)
    }
    results.push({ id: c.id, kind: 'replay', ok: true, expectMatch: c.expectMatch, hashA: r.hashA, hashB: r.hashB, frames: r.frames, detail: '' })
  } else {
    fail++
    if (c.expectMatch) {
      console.log(`✗ [divergence] ${c.id} — 결정적이어야 하는데 2회 재생이 불일치: A=${r.hashA} B=${r.hashB}`)
    } else {
      console.log(`✗ [not-detected] ${c.id} — 비결정성을 검출하지 못함(2회 재생이 우연히 일치): hash=${r.hashA}`)
    }
    results.push({ id: c.id, kind: 'replay', ok: false, expectMatch: c.expectMatch, hashA: r.hashA, hashB: r.hashB, frames: r.frames, detail: c.expectMatch ? 'unexpected divergence' : 'nondeterminism not detected' })
  }
}

// ── 출력 계약: 마지막 줄 단일 JSON ───────────────────────────────────────────
if (UPDATE_MODE) {
  console.log(`— updated ${updated} golden file(s) in ${GOLDEN_DIR}`)
  console.log(`— pass ${pass} · fail ${fail} (재생 검사는 --update 에서도 수행)`)
  const okAll = (fail === 0)
  console.log(JSON.stringify({ ok: okAll, pass, fail, updated, cases: results }))
  process.exit(okAll ? 0 : 1)
} else {
  console.log(`— pass ${pass} · fail ${fail}`)
  console.log(JSON.stringify({ ok: fail === 0, pass, fail, updated: 0, cases: results }))
  process.exit(fail === 0 ? 0 : 1)
}
