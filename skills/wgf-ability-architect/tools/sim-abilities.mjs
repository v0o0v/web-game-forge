#!/usr/bin/env node
// sim-abilities.mjs — ability-architect 콤보/DPS·자원 지속성 시뮬레이터 (온디맨드)
// ─────────────────────────────────────────────────────────────────────────────
// 복잡한 킷(T3~T4: 빌드 시너지·스킬트리·자원 로테이션)에서 빌드별 **기대 DPS·자원 고갈률·
// 능력별 가동률·지배 능력**을 결정론적 그리디 로테이션으로 추정한다(런타임 무관, 설계 도구).
// 작은 킷(T0~T2)엔 과하다 — 빌드가 갈리고 자원/쿨다운이 맞물릴 때만 쓴다.
// 무의존성: Node 빌트인만. lint-abilities.mjs 출력 계약 준수(마지막 줄 단일 JSON).
//
// 모델(단순화·결정론):
//  - 매 dt 틱: 쿨다운 감소·자원 리젠 → 사용 가능한(쿨다운0·자원충분·잠금해제) "데미지 능력" 중
//    effect.damage(또는 dps 환산)이 가장 큰 것을 1개 사용(글로벌쿨다운 존중). 자원 소비·쿨다운 시작.
//  - cooldownReset·combo.grants 도 반영(무한 루프는 lint 가 별도로 검출).
//  - DoT(effect.dot{dps,dur}) 는 지속 누적. 표적 1개 가정(광역/다표적은 effect.targets 로 곱).
//
// 사용:
//   node skills/wgf-ability-architect/tools/sim-abilities.mjs games/<slug>/abilities.json
//   node ... abilities.json --build dash,fireball,ignite --duration 60 --dt 0.05
//   node ... abilities.json --json
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const argv = process.argv.slice(2)
let file = null, jsonOnly = false, duration = 60, dt = 0.05, build = null
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--json') jsonOnly = true
  else if (a === '--duration') duration = Number(argv[++i])
  else if (a === '--dt') dt = Number(argv[++i])
  else if (a === '--build') build = String(argv[++i]).split(',').map((s) => s.trim()).filter(Boolean)
  else if (a === '--file') file = argv[++i]
  else if (!a.startsWith('--')) file = a
}

function fail(msg) { console.log(JSON.stringify({ ok: false, error: msg })); process.exit(1) }
if (!file) fail('입력 파일 경로 없음. 사용: node sim-abilities.mjs games/<slug>/abilities.json')
let data
try { data = JSON.parse(readFileSync(resolve(file), 'utf8')) } catch (e) { fail('파싱 실패: ' + e.message) }

const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d
let abilities = Array.isArray(data.abilities) ? data.abilities : []
if (build) abilities = abilities.filter((a) => build.includes(a.id))
if (abilities.length === 0) fail('시뮬할 능력 없음(build 필터 확인).')

const resources = {}
for (const r of (Array.isArray(data.resources) ? data.resources : [])) if (r && r.id != null) {
  resources[r.id] = { def: r, max: num(r.max, 100), cur: r.startFull === false ? num(r.start, 0) : num(r.start, num(r.max, 100)), sinceSpend: 1e9 }
}

// 데미지 환산: effect.damage(즉발) + effect.dot{dps,dur} 누적. targets 로 다표적 곱.
function instantDamage(ab) {
  const e = ab.effect || {}
  let d = num(e.damage, 0)
  d *= num(e.targets, 1)
  return d
}
function dotOf(ab) {
  const e = ab.effect || {}
  if (e.dot && (e.dot.dps || e.dot.total)) {
    const dps = num(e.dot.dps, e.dot.total ? num(e.dot.total, 0) / num(e.dot.dur, 1) : 0)
    return { dps: dps * num(e.targets, 1), dur: num(e.dot.dur, 1) }
  }
  return null
}

const state = {}
for (const ab of abilities) state[ab.id] = { cd: 0, charges: num(ab.charges, 0) || 0, uses: 0, dmg: 0, lastUse: -1e9 }
const activeDots = [] // {dps, until}

const gcd = num((data.balanceConfig || {}).globalCooldown, 0)
let gcdLeft = 0
let totalDamage = 0
let starvedTicks = 0, totalTicks = 0
let time = 0

function ready(ab) {
  const s = state[ab.id]
  if (num(ab.charges, 0) > 0) return s.charges >= 1
  return s.cd <= 0
}
function affordable(ab) {
  if (!ab.cost || !ab.resource) return true
  const r = resources[ab.resource]; return r ? r.cur >= num(ab.cost, 0) : true
}

const damagers = abilities.filter((ab) => instantDamage(ab) > 0 || dotOf(ab))

while (time < duration) {
  totalTicks++
  // 틱 진행: 쿨다운·gcd·자원 리젠·DoT
  for (const ab of abilities) {
    const s = state[ab.id]
    if (s.cd > 0) {
      const was = s.cd; s.cd = Math.max(0, s.cd - dt)
      if (num(ab.charges, 0) > 0 && was > 0 && s.cd === 0) { s.charges = Math.min(num(ab.charges, 0), s.charges + 1); if (s.charges < num(ab.charges, 0)) s.cd = num(ab.cooldown, 0) }
    }
  }
  if (gcdLeft > 0) gcdLeft = Math.max(0, gcdLeft - dt)
  for (const rid in resources) {
    const r = resources[rid]; r.sinceSpend += dt
    const regen = num(r.def.regen, 0), delay = num(r.def.rechargeDelay, 0)
    if (regen > 0 && r.cur < r.max && r.sinceSpend >= delay) r.cur = Math.min(r.max, r.cur + regen * dt)
  }
  for (const d of activeDots) { if (time < d.until) { totalDamage += d.dps * dt; d.acc += d.dps * dt } }

  // 사용 결정(그리디: 사용 가능한 데미지 능력 중 즉발 데미지 최대)
  if (gcdLeft <= 0) {
    let best = null, bestVal = 0
    for (const ab of damagers) {
      if (!ready(ab) || !affordable(ab)) continue
      const val = instantDamage(ab) + (dotOf(ab) ? dotOf(ab).dps * dotOf(ab).dur : 0)
      if (val > bestVal) { bestVal = val; best = ab }
    }
    if (best) {
      const s = state[best.id]
      // 자원 소비
      if (best.cost && best.resource && resources[best.resource]) { const r = resources[best.resource]; r.cur = Math.max(0, r.cur - num(best.cost, 0)); r.sinceSpend = 0 }
      // 쿨다운/충전
      if (num(best.charges, 0) > 0) { s.charges = Math.max(0, s.charges - 1); if (s.cd <= 0) s.cd = num(best.cooldown, 0) }
      else if (num(best.cooldown, 0) > 0) s.cd = num(best.cooldown, 0)
      // combo grants(콤보 윈도 안이면 자원 환급)
      if (best.combo && best.combo.grants) {
        const win = num(best.combo.window, 0)
        const hit = (best.combo.from || []).some((f) => state[f] && (time - state[f].lastUse) <= win)
        if (hit) for (const gid in best.combo.grants) if (resources[gid]) resources[gid].cur = Math.min(resources[gid].max, resources[gid].cur + num(best.combo.grants[gid], 0))
      }
      // cooldownReset
      for (const cr of (best.cooldownReset || [])) if (state[cr]) state[cr].cd = 0
      // 데미지
      const inst = instantDamage(best)
      totalDamage += inst; s.dmg += inst; s.uses++; s.lastUse = time
      const dot = dotOf(best)
      if (dot) { activeDots.push({ dps: dot.dps, until: time + dot.dur, acc: 0, owner: best.id }); }
      if (gcd > 0) gcdLeft = gcd
    } else if (damagers.some((ab) => ready(ab) === false || !affordable(ab))) {
      // 쓸 게 있는데 자원/쿨 때문에 못 씀 → 고갈 틱
      if (damagers.some((ab) => ready(ab) && !affordable(ab))) starvedTicks++
    }
  }
  time += dt
}

// DoT 의 owner 별 데미지 귀속(근사)
for (const d of activeDots) { const s = state[d.owner]; if (s) s.dmg += d.acc }

const dps = totalDamage / duration
const perAbility = abilities.map((ab) => ({ id: ab.id, uses: state[ab.id].uses, damage: Math.round(state[ab.id].dmg), share: totalDamage > 0 ? Math.round(state[ab.id].dmg / totalDamage * 100) : 0 }))
  .sort((a, b) => b.damage - a.damage)
const starvation = totalTicks > 0 ? Math.round(starvedTicks / totalTicks * 100) : 0
const dominant = perAbility[0] && perAbility[0].share >= 70 ? perAbility[0] : null

const summary = {
  ok: true,
  duration, dt,
  build: build || abilities.map((a) => a.id),
  dps: Math.round(dps * 100) / 100,
  totalDamage: Math.round(totalDamage),
  resourceStarvationPct: starvation,
  perAbility,
  dominantAbility: dominant ? dominant.id : null,
  file
}

if (!jsonOnly) {
  console.log(`▶ sim-abilities — 빌드 [${summary.build.join(', ')}] · ${duration}s @ dt ${dt}`)
  console.log(`  DPS ≈ ${summary.dps}  ·  총 데미지 ${summary.totalDamage}  ·  자원 고갈 틱 ${starvation}%`)
  for (const p of perAbility) console.log(`  · ${p.id}: ${p.uses}회 · 데미지 ${p.damage} (${p.share}%)`)
  if (dominant) console.log(`  ⚠ 지배 능력: "${dominant.id}" 가 데미지의 ${dominant.share}% — 다른 능력이 무의미(BAL-NO-DOMINANT)`)
  console.log('—')
}
console.log(JSON.stringify(summary))
process.exit(0)
