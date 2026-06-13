#!/usr/bin/env node
// test-juicekit.mjs — engine/juicekit.js 게임필 런타임 결정성·동작 회귀 테스트
// ─────────────────────────────────────────────────────────────────────────────
// (무의존성, Node 빌트인만. RngForge 를 주입해 결정론을 검증한다.)
//
// 검증 항목:
//   1) trauma decay 단조 감소 — update(dt) 마다 trauma 가 줄고 [0,1] clamp
//   2) 셰이크 강도 = trauma^2 — 비선형(Eiserloh) 강도 공식 검증
//   3) 결정론 — 같은 시드 + 같은 dt 시퀀스 → 동일한 셰이크 오프셋 수열
//   4) 히트스톱 — freeze(N) 동안 timeScale 0(시간 정지) → N 프레임 후 자동 복원
//   5) 파티클 — burst 개수·무작위 결정성·수명 만료(0개로 GC)
//   6) 트윈/이징 — from→to 보간, easeOutQuad 경계값, onComplete, 결정성
//
// 사용: node skills/wgf-game-qa/tools/test-juicekit.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const RngForge = require(resolve(here, '../../../engine/rngforge.js'))
const JuiceKit = require(resolve(here, '../../../engine/juicekit.js'))

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}
const approx = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-12 : eps)
const DT = 1 / 60 // 표준 프레임 델타(초)

// ── 1) trauma decay 단조 감소 + [0,1] clamp ──────────────────────────────────
{
  const jk = new JuiceKit(RngForge.create(1))
  jk.addTrauma(2.0) // over-add → clamp 1
  ok('addTrauma clamps to [0,1]', jk.getTrauma() === 1)
  let prev = jk.getTrauma()
  let monotonic = true
  for (let i = 0; i < 120; i++) {
    jk.update(DT)
    const cur = jk.getTrauma()
    if (cur > prev + 1e-12) monotonic = false
    prev = cur
  }
  ok('trauma decays monotonically', monotonic)
  ok('trauma reaches 0 (full decay)', jk.getTrauma() === 0, `final=${jk.getTrauma()}`)
}

// ── 2) 셰이크 강도 = trauma^2 (비선형) ────────────────────────────────────────
{
  // 노이즈는 rng 의존이라, 강도 공식을 직접 검증: maxOffset*trauma^2 가 상한.
  // 노이즈 ∈ [-1,1) 이므로 |offset| ≤ maxOffset*trauma^2. 다수 샘플 중 최댓값이 그 상한에 근접.
  const jk = new JuiceKit(RngForge.create(99))
  jk.decayRate = 0 // decay 끄고 trauma 고정
  jk.addTrauma(0.5)
  let maxAbsX = 0
  for (let i = 0; i < 4000; i++) { jk.update(DT); maxAbsX = Math.max(maxAbsX, Math.abs(jk.getShake().x)) }
  const bound = jk.maxOffset * 0.5 * 0.5 // maxOffset * trauma^2
  ok('shake offset never exceeds maxOffset*trauma^2', maxAbsX <= bound + 1e-9, `max=${maxAbsX.toFixed(4)} bound=${bound}`)
  ok('shake offset approaches the trauma^2 bound', maxAbsX > bound * 0.9, `max=${maxAbsX.toFixed(4)} bound=${bound}`)

  // trauma=1 vs trauma=0.5 의 상한 비 = 1/0.25 = 4 (제곱 비선형 확인)
  const jk1 = new JuiceKit(RngForge.create(99)); jk1.decayRate = 0; jk1.addTrauma(1.0)
  let max1 = 0
  for (let i = 0; i < 4000; i++) { jk1.update(DT); max1 = Math.max(max1, Math.abs(jk1.getShake().x)) }
  ok('trauma^2 nonlinearity (1.0 vs 0.5 ≈ 4x)', approx(max1 / maxAbsX, 4, 0.25), `ratio=${(max1 / maxAbsX).toFixed(3)}`)
}

// ── 3) 결정론 — 같은 시드 + 같은 dt → 동일 셰이크 수열 ───────────────────────
{
  function shakeSeq(seed) {
    const jk = new JuiceKit(RngForge.create(seed))
    jk.addTrauma(0.8)
    const seq = []
    for (let i = 0; i < 30; i++) { jk.update(DT); const s = jk.getShake(); seq.push(s.x, s.y, s.rotation) }
    return seq
  }
  const a = shakeSeq(2026), b = shakeSeq(2026), c = shakeSeq(2027)
  ok('same seed → identical shake sequence', a.every((v, i) => v === b[i]))
  ok('different seed → different shake sequence', !a.every((v, i) => v === c[i]))
}

// ── 4) 히트스톱 — freeze(N) 동안 timeScale 0 → 자동 복원 ─────────────────────
{
  const jk = new JuiceKit(RngForge.create(5))
  jk.addTrauma(1.0)
  jk.decayRate = 1.2
  jk.freeze(4) // 4프레임 정지
  ok('freeze sets frozen state', jk.isFrozen())
  const traumaBefore = jk.getTrauma()
  // 정지 기간: trauma(스케일 시간)는 변하지 않아야 함
  jk.update(DT); jk.update(DT)
  ok('timeScale is 0 during freeze', jk.timeScale === 0)
  ok('trauma frozen during hitstop', approx(jk.getTrauma(), traumaBefore), `before=${traumaBefore} now=${jk.getTrauma()}`)
  // 4프레임 경과 후 복원
  jk.update(DT); jk.update(DT)
  ok('timeScale restored to 1 after N frames', jk.timeScale === 1)
  ok('not frozen after freeze elapses', !jk.isFrozen())
  // 복원 후엔 trauma 가 다시 감쇠
  const t1 = jk.getTrauma(); jk.update(DT)
  ok('trauma resumes decay after hitstop', jk.getTrauma() < t1)
}

// ── 5) 파티클 — 개수·결정성·수명 만료 ────────────────────────────────────────
{
  const jk = new JuiceKit(RngForge.create(7))
  const created = jk.burst(100, 50, { count: 16, life: 0.5, color: 0xff0000 })
  ok('burst creates requested count', created.length === 16 && jk.particleCount() === 16)

  // 결정성: 같은 시드·같은 burst → 동일 초기 속도
  const jkA = new JuiceKit(RngForge.create(123)); const pa = jkA.burst(0, 0, { count: 5 })
  const jkB = new JuiceKit(RngForge.create(123)); const pb = jkB.burst(0, 0, { count: 5 })
  ok('burst is deterministic for same seed', pa.every((p, i) => p.vx === pb[i].vx && p.vy === pb[i].vy && approx(p.life, pb[i].life)))

  // 수명 만료: life=0.5s 인 파티클은 0.5s 후 모두 GC
  let frames = 0
  while (jk.particleCount() > 0 && frames < 200) { jk.update(DT); frames++ }
  ok('particles expire after lifespan (count → 0)', jk.particleCount() === 0, `frames=${frames}`)
  ok('particle array compacted (no dead leftovers)', jk.particles.length === 0)

  // 중력으로 vy 가 증가(아래로 가속)
  const jkG = new JuiceKit(RngForge.create(8))
  const g = jkG.burst(0, 0, { count: 1, gravity: 300, life: 1.0, speed: [0, 0] })[0]
  const vy0 = g.vy
  jkG.update(DT)
  ok('gravity accelerates particles downward', g.vy > vy0, `vy0=${vy0} vy1=${g.vy}`)
}

// ── 6) 트윈/이징 — 보간·경계값·완료·결정성 ──────────────────────────────────
{
  const jk = new JuiceKit(RngForge.create(11))
  let lastVal = null, completed = false
  const tw = jk.tween(0, 100, 0.5, 'linear', {
    onUpdate: (v) => { lastVal = v },
    onComplete: () => { completed = true }
  })
  ok('tween starts at from value', tw.value === 0)
  // 0.25s 진행(절반) → linear 면 ~50
  for (let i = 0; i < 15; i++) jk.update(DT) // 15*1/60 = 0.25s
  ok('linear tween midpoint ≈ 50', approx(lastVal, 50, 2), `val=${lastVal}`)
  // 완료까지
  for (let i = 0; i < 30; i++) jk.update(DT)
  ok('tween reaches to value', tw.value === 100, `val=${tw.value}`)
  ok('tween onComplete fires', completed)
  ok('completed tween is reaped', jk.tweens.length === 0)

  // easeOutQuad 경계: t=0→0, t=1→1
  const eq = JuiceKit.EASING.easeOutQuad
  ok('easeOutQuad(0)=0, (1)=1', eq(0) === 0 && approx(eq(1), 1))
  // easeOutBack 오버슈트: 중간에서 1을 넘는 구간 존재
  const eb = JuiceKit.EASING.easeOutBack
  let overshoots = false
  for (let t = 0; t <= 1.0001; t += 0.02) if (eb(t) > 1.0001) overshoots = true
  ok('easeOutBack overshoots past 1', overshoots)

  // 트윈 결정성(이징은 순수함수 — 같은 dt 시퀀스 → 같은 value 수열)
  function tweenSeq() {
    const k = new JuiceKit(RngForge.create(1))
    const vals = []
    k.tween(0, 1, 0.3, 'easeInOutCubic', { onUpdate: (v) => vals.push(v) })
    for (let i = 0; i < 20; i++) k.update(DT)
    return vals
  }
  const s1 = tweenSeq(), s2 = tweenSeq()
  ok('tween value sequence is deterministic', s1.length === s2.length && s1.every((v, i) => v === s2[i]))
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
