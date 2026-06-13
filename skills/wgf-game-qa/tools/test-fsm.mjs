#!/usr/bin/env node
// test-fsm.mjs — engine/fsm.js 결정론 유한상태머신 동작·결정성 회귀 테스트
// ─────────────────────────────────────────────────────────────────────────────
// (무의존성, Node 빌트인만. RngForge 를 주입해 결정론을 검증한다.)
//
// 검증 항목:
//   1) 상태 전이 정확 — to(name) 명시 전이 + current()/is() 조회
//   2) enter/exit/update 콜백 호출 — 전이 경계 enter/exit 1회, 매 프레임 update
//   3) update 콜백 반환값 전이 — update 가 상태명 반환 시 그 상태로 전이
//   4) when() 규칙 기반 자동 전이 + 전역 '*' 규칙
//   5) 결정론 — 같은 시드 + 같은 dt 시퀀스 → 동일 상태 궤적(무작위 전이 포함)
//   6) AbilityKit 페이즈 — cast→active→recovery→idle 타이밍 정확(지속시간 합)
//   7) 0-지속 페이즈 스킵 — cast:0 이면 active 부터 / 전부 0(즉발)이면 즉시 idle 복귀
//   8) 캔슬 — cast 중 cancel()→idle / active·recovery 는 캔슬 불가(cancelable 면 recovery 허용)
//   9) NaN/Infinity 가드 — update(NaN)/update(Infinity)/update(-1) 후 상태·시간 정상
//
// 사용: node skills/wgf-game-qa/tools/test-fsm.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const RngForge = require(resolve(here, '../../../engine/rngforge.js'))
const FSM = require(resolve(here, '../../../engine/fsm.js'))

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}
const approx = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-9 : eps)
const DT = 1 / 60 // 표준 프레임 델타(초)

// ── 1) 상태 전이 정확 — to() + current()/is() ────────────────────────────────
{
  const fsm = new FSM({ initial: 'idle', rng: RngForge.create(1) })
  fsm.addState('idle', {}).addState('walk', {}).addState('jump', {})
  fsm.start()
  ok('initial state is idle', fsm.current() === 'idle')
  fsm.to('walk')
  ok('to(walk) transitions', fsm.is('walk') && fsm.current() === 'walk')
  fsm.to('jump')
  ok('to(jump) transitions', fsm.current() === 'jump')
  ok('to(undefined-state) is ignored', fsm.to('nope') === false && fsm.current() === 'jump')
  ok('has() reports defined states', fsm.has('walk') && !fsm.has('nope'))
}

// ── 2) enter/exit/update 콜백 호출 ───────────────────────────────────────────
{
  const log = []
  const fsm = new FSM({ initial: 'a' })
  fsm.addState('a', {
    enter: () => log.push('a:enter'),
    update: () => log.push('a:update'),
    exit: () => log.push('a:exit')
  })
  fsm.addState('b', {
    enter: () => log.push('b:enter'),
    exit: () => log.push('b:exit')
  })
  fsm.start()                       // a:enter
  fsm.update(DT)                    // a:update
  fsm.update(DT)                    // a:update
  fsm.to('b')                       // a:exit, b:enter
  ok('enter fires once on start', log.filter(x => x === 'a:enter').length === 1)
  ok('update fires per frame', log.filter(x => x === 'a:update').length === 2)
  ok('exit fires on leaving state', log.filter(x => x === 'a:exit').length === 1)
  ok('enter fires on entering new state', log[log.length - 1] === 'b:enter')
  ok('exit→enter ordering', log.indexOf('a:exit') < log.indexOf('b:enter'))
}

// ── 3) update 콜백 반환값으로 전이 ───────────────────────────────────────────
{
  const fsm = new FSM({ initial: 'idle' })
  let moving = false
  fsm.addState('idle', { update: () => moving ? 'walk' : undefined })
  fsm.addState('walk', { update: () => !moving ? 'idle' : undefined })
  fsm.start()
  fsm.update(DT)
  ok('stays idle when condition false', fsm.is('idle'))
  moving = true
  fsm.update(DT)
  ok('update return-string transitions to walk', fsm.is('walk'))
  moving = false
  fsm.update(DT)
  ok('transitions back to idle', fsm.is('idle'))
}

// ── 4) when() 규칙 기반 자동 전이 + 전역 '*' ─────────────────────────────────
{
  const ctx = { hp: 10, dead: false }
  const fsm = new FSM({ initial: 'alive' })
  fsm.addState('alive', {}).addState('hurt', {}).addState('dead', {})
  fsm.when('alive', 'hurt', c => c.hp < 10)        // 상태별 규칙
  fsm.when('*', 'dead', c => c.dead)               // 전역 규칙
  fsm.start()
  fsm.update(DT, ctx)
  ok('no rule fires when conditions false', fsm.is('alive'))
  ctx.hp = 7
  fsm.update(DT, ctx)
  ok('when() rule fires (alive→hurt)', fsm.is('hurt'))
  ctx.dead = true
  fsm.update(DT, ctx)
  ok('global * rule fires from any state (hurt→dead)', fsm.is('dead'))
}

// ── 5) 결정론 — 같은 시드 + 같은 dt 시퀀스 → 동일 상태 궤적(무작위 전이) ──────
{
  // 무작위 전이: 'roam' 상태에서 rng.bool(0.3) 로 'rest' 전환, 'rest' 에서 rng.bool(0.5) 로 복귀.
  function buildTrajectory(seed) {
    const fsm = new FSM({ initial: 'roam', rng: RngForge.create(seed) })
    fsm.addState('roam', { update: function () { if (fsm.rng.bool(0.3)) return 'rest' } })
    fsm.addState('rest', { update: function () { if (fsm.rng.bool(0.5)) return 'roam' } })
    fsm.start()
    const traj = []
    for (let i = 0; i < 200; i++) { fsm.update(DT); traj.push(fsm.current()) }
    return traj.join(',')
  }
  const t1 = buildTrajectory(20260613)
  const t2 = buildTrajectory(20260613)
  const t3 = buildTrajectory(99)
  ok('same seed + same dt → identical state trajectory', t1 === t2)
  ok('different seed → different trajectory', t1 !== t3)
  ok('trajectory actually visits both states (rng wired)', t1.includes('roam') && t1.includes('rest'))
}

// ── 6) AbilityKit 페이즈 — cast→active→recovery→idle 타이밍 정확 ──────────────
{
  // activation-feel.md 예시 수치: cast 0.1, active 0.12, recovery 0.18 (초). 합 0.40s.
  const ability = { id: 'strike', cast: 0.1, active: 0.12, recovery: 0.18 }
  const seq = []
  const fsm = FSM.forAbility(ability, { onPhase: (p) => seq.push(p) })
  ok('forAbility starts idle', fsm.phase() === 'idle' && !fsm.isBusy())
  fsm.startAbility()
  ok('startAbility enters cast', fsm.phase() === 'cast' && fsm.isBusy())

  // 페이즈 경계 시각 측정(누적 dt). 각 페이즈가 지속시간만큼 지속하는지.
  let t = 0
  const enterTimes = { cast: 0 } // cast 진입은 시동 시점(t=0)
  let prev = fsm.phase()
  for (let i = 0; i < 60; i++) {  // 60프레임 ≈ 1.0s, 0.4s 페이즈 합을 충분히 넘김
    fsm.update(DT)
    t += DT
    const cur = fsm.phase()
    if (cur !== prev) { enterTimes[cur] = t; prev = cur }
  }
  ok('phase order cast→active→recovery→idle', seq.join('>') === 'idle>cast>active>recovery>idle',
    `seq=${seq.join('>')}`)
  // 이산 프레임(DT) 구동이라 각 페이즈 경계는 _stateTime>=지속시간 이 되는 첫 프레임에 일어난다.
  // 따라서 측정 진입시각은 [기대값, 기대값 + n*DT) — n=누적 경계 통과 수(active 1, recovery 2, idle 3).
  // 검증: 결코 일찍 끝나지 않고(>=), 경계당 1프레임 이내 오버슈트(< 기대 + n*DT + eps).
  function phaseTiming(name, label, expected, crossings) {
    const t = enterTimes[name]
    const lo = expected - 1e-9
    const hi = expected + crossings * DT + 1e-9
    ok(label, t >= lo && t < hi, `=${t} (expect ${expected}..<${(expected + crossings * DT).toFixed(4)})`)
  }
  phaseTiming('active', 'active begins after cast duration (~0.10s)', 0.10, 1)
  phaseTiming('recovery', 'recovery begins after cast+active (~0.22s)', 0.22, 2)
  phaseTiming('idle', 'idle resumes after total duration (~0.40s)', 0.40, 3)
  ok('returns to idle after full sequence', fsm.phase() === 'idle' && !fsm.isBusy())

  // 페이즈 콜백(onActive 에서 효과 실행) 검증
  let activeFired = 0
  const fsm2 = FSM.forAbility(ability, { onActive: () => activeFired++ })
  fsm2.startAbility()
  for (let i = 0; i < 60; i++) fsm2.update(DT)
  ok('onActive callback fires exactly once', activeFired === 1, `fired=${activeFired}`)

  // 중복 시동 방지: 진행 중 startAbility 무시
  const fsm3 = FSM.forAbility(ability)
  fsm3.startAbility()
  fsm3.update(DT)
  ok('startAbility ignored while busy', fsm3.startAbility() === false)
}

// ── 7) 0-지속 페이즈 즉시통과 ────────────────────────────────────────────────
{
  // cast:0 → cast enter 발화 후 즉시 active 로 carry. startAbility() 반환 시 이미 active.
  // reviewer [HIGH] #2: "지속 0도 '건너뜀'이 아니라 '즉시 통과' — enter 1회 발화"
  const seqA = []
  const noCast = FSM.forAbility({ cast: 0, active: 0.1, recovery: 0.1 }, { onPhase: p => seqA.push(p) })
  noCast.startAbility()
  ok('cast:0 starts directly in active after startAbility', noCast.phase() === 'active')
  for (let i = 0; i < 30; i++) noCast.update(DT)
  // cast enter 는 즉시통과로 발화됨 — seq 에 cast 포함
  ok('cast:0 phase order: cast enter fires then immediately advances', seqA.join('>') === 'idle>cast>active>recovery>idle', `seq=${seqA.join('>')}`)

  // 전부 0(완전 즉발) → startAbility() 안에서 carry 가 모든 페이즈 enter 를 즉시 발화 + idle 복귀
  const seqB = []
  const instant = FSM.forAbility({ cast: 0, active: 0, recovery: 0 }, { onPhase: p => seqB.push(p) })
  instant.startAbility()
  ok('all-zero ability: immediately back to idle after startAbility', instant.phase() === 'idle' && !instant.isBusy())
  ok('all-zero: all phase enters fired (cast+active+recovery+idle)', seqB.join('>') === 'idle>cast>active>recovery>idle', `seq=${seqB.join('>')}`)
}

// ── 8) 캔슬 ──────────────────────────────────────────────────────────────────
{
  const ability = { cast: 0.2, active: 0.1, recovery: 0.1 }
  // cast 중 캔슬 → idle
  const fsm = FSM.forAbility(ability)
  fsm.startAbility()
  fsm.update(DT)                              // 아직 cast(0.0167 < 0.2)
  ok('still in cast before cast duration', fsm.phase() === 'cast')
  ok('cancel() during cast returns to idle', fsm.cancel() === true && fsm.phase() === 'idle')

  // active 중 캔슬 불가(커밋)
  const fsm2 = FSM.forAbility(ability)
  fsm2.startAbility()
  for (let i = 0; i < 15; i++) fsm2.update(DT)  // 0.25s → cast(0.2) 지나 active
  ok('reached active phase', fsm2.phase() === 'active')
  ok('cancel() during active is rejected (committed)', fsm2.cancel() === false && fsm2.phase() === 'active')

  // cancelable:true 면 recovery 중에도 캔슬 허용
  const fsm3 = FSM.forAbility(ability, { cancelable: true })
  fsm3.startAbility()
  for (let i = 0; i < 22; i++) fsm3.update(DT)  // 0.367s → recovery(0.3~0.4 구간)
  ok('reached recovery phase', fsm3.phase() === 'recovery')
  ok('cancelable allows cancel during recovery', fsm3.cancel() === true && fsm3.phase() === 'idle')
}

// ── 9) NaN/Infinity 가드 ─────────────────────────────────────────────────────
{
  const fsm = new FSM({ initial: 'idle' })
  let updates = 0
  fsm.addState('idle', { update: () => { updates++ } })
  fsm.start()
  fsm.update(NaN)
  fsm.update(Infinity)
  fsm.update(-5)
  ok('update(NaN/Infinity/negative) does not advance time', fsm.totalTime() === 0, `t=${fsm.totalTime()}`)
  ok('update still ran callback (dt coerced to 0)', updates === 3)
  fsm.update(DT)
  ok('valid dt resumes time accumulation', approx(fsm.totalTime(), DT), `t=${fsm.totalTime()}`)

  // 페이즈 머신도 NaN 가드로 페이즈가 밀리지 않음
  const ph = FSM.forAbility({ cast: 0.1, active: 0.1, recovery: 0.1 })
  ph.startAbility()
  ph.update(NaN); ph.update(Infinity)
  ok('phase machine: NaN/Infinity does not advance phase', ph.phase() === 'cast', `phase=${ph.phase()}`)
}

// ── 10) 청킹 동치 — 동일 총시간·상이 청킹 → 동일 최종 phase 궤적 ──────────────
// reviewer [CRITICAL] #1 + [MEDIUM] #5 핵심 검증:
// 30×(1/60)≈0.5s 와 1×0.5s 가 같은 궤적을 만들어야 한다.
{
  const ability = { cast: 0.1, active: 0.12, recovery: 0.18 } // 합 0.40s

  // 청킹 A: 60fps (30프레임 = 0.5s)
  const seqA = []
  const fsmA = FSM.forAbility(ability, { onPhase: p => seqA.push(p) })
  fsmA.startAbility()
  for (let i = 0; i < 30; i++) fsmA.update(1 / 60)

  // 청킹 B: 큰 dt 한 방 (0.5s 한 번)
  const seqB = []
  const fsmB = FSM.forAbility(ability, { onPhase: p => seqB.push(p) })
  fsmB.startAbility()
  fsmB.update(0.5)

  ok('chunking equivalence: 30×(1/60) phase seq === 1×0.5 phase seq',
    seqA.join('>') === seqB.join('>'),
    `A=${seqA.join('>')} B=${seqB.join('>')}`)
  ok('chunking equivalence: final phase same (idle)', fsmA.phase() === 'idle' && fsmB.phase() === 'idle')
  ok('chunking equivalence: full sequence cast→active→recovery→idle in both',
    seqA.join('>') === 'idle>cast>active>recovery>idle', `A=${seqA.join('>')}`)

  // 추가: 매우 작은 dt(600프레임분 = 10ms 단위) vs 1×1.0 큰 dt
  const seqC = []
  const fsmC = FSM.forAbility(ability, { onPhase: p => seqC.push(p) })
  fsmC.startAbility()
  for (let i = 0; i < 100; i++) fsmC.update(0.01)  // 100×0.01 = 1.0s

  const seqD = []
  const fsmD = FSM.forAbility(ability, { onPhase: p => seqD.push(p) })
  fsmD.startAbility()
  fsmD.update(1.0)

  ok('chunking equivalence: 100×0.01 phase seq === 1×1.0 phase seq',
    seqC.join('>') === seqD.join('>'),
    `C=${seqC.join('>')} D=${seqD.join('>')}`)
}

// ── 11) 즉발 onCast/onActive/onRecovery 개별 1회 발화 ─────────────────────────
// reviewer [HIGH] #2: 지속 0 도 "즉시 통과" — enter 1회 발화.
// startAbility() 단 한 번 호출(update 없음)으로 모든 콜백이 발화돼야 한다.
{
  let castFired = 0, activeFired = 0, recoveryFired = 0, idleFired = 0
  const inst = FSM.forAbility(
    { cast: 0, active: 0, recovery: 0 },
    {
      onCast:     () => castFired++,
      onActive:   () => activeFired++,
      onRecovery: () => recoveryFired++,
      onIdle:     () => idleFired++
    }
  )
  // forAbility 생성 시 idle enter 가 1회 발화됨
  ok('instant: onIdle fires on construction (idle enter)', idleFired === 1, `idleFired=${idleFired}`)
  inst.startAbility()
  ok('instant: onCast fires exactly once (dur=0, immediate pass)', castFired === 1, `castFired=${castFired}`)
  ok('instant: onActive fires exactly once (dur=0)', activeFired === 1, `activeFired=${activeFired}`)
  ok('instant: onRecovery fires exactly once (dur=0)', recoveryFired === 1, `recoveryFired=${recoveryFired}`)
  ok('instant: onIdle fires again after full cycle', idleFired === 2, `idleFired=${idleFired}`)
  ok('instant: phase is idle after startAbility', inst.phase() === 'idle')
}

// ── 12) 음수 지속 클램프 ─────────────────────────────────────────────────────
// reviewer [HIGH] #3: ability.cast/active/recovery 가 음수여도 0 으로 클램프.
{
  const seqNeg = []
  const neg = FSM.forAbility(
    { cast: -0.5, active: -1, recovery: -99 },
    { onPhase: p => seqNeg.push(p) }
  )
  ok('negative durations: durations clamped to 0', neg.durations.cast === 0 && neg.durations.active === 0 && neg.durations.recovery === 0)
  neg.startAbility()
  ok('negative durations: all phases pass instantly (idle after startAbility)', neg.phase() === 'idle')
  ok('negative durations: all enters fired (no silent swallow)', seqNeg.join('>') === 'idle>cast>active>recovery>idle', `seq=${seqNeg.join('>')}`)
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
