#!/usr/bin/env node
// lint-abilities.mjs — ability-architect 능력/스킬 밸런스·시너지·진행 정적 린터
// ─────────────────────────────────────────────────────────────────────────────
// games/<slug>/abilities.json 을 읽어 설계-시 정량 결함을 검출한다(런타임 무관, 설계 도구).
// 무의존성: Node 빌트인(fs/path)만 사용. lint-items.mjs / lint-audio.mjs 컨벤션 준수.
//
// 검사 룰 그룹(consistency-tools.md 린트 체크리스트 ↔ BAL-*/SYN-*/RES-*/PROG-*/GATE-*):
//   a) schema       필수 필드·enum·중복 id·visual 슬롯·참조 무결성(combo.from·requires·resource)
//   b) dead-skill   같은 kind 그룹에서 파워/비용 효율 최저권 outlier(죽은 능력)   (BAL-NO-DEAD-SKILL)
//   c) dominant     파레토 지배(같은 kind/slot 모든 축 우월 + 저비용/저쿨)         (BAL-NO-DOMINANT)
//   d) mult-explode 상한 없는 곱연산 스택 / 동시 곱산 소스 과다                     (SYN-ADD-VS-MULT)
//   e) resource     비용>자원최대(영구 사용불가) · 사실상 무비용(기회비용 0)        (RES-OPPORTUNITY-COST)
//   f) cooldown     고파워+저쿨/무쿨/무비용(밸런스 이탈)                            (BAL-POWER-BUDGET)
//   g) synergy      고립 enabler/payoff · 과밀 태그 허브 · 도달불가 세트            (SYN-ENABLER-PAYOFF)
//   h) tree         스킬트리 도달성·고아 노드·grants/requires 참조 무결성          (PROG-REACHABLE)
//   i) gate-softlock 능력 게이트 그래프 도달가능성(필수 능력 획득가능)             (GATE-NO-SOFTLOCK)
//   j) combo-loop   cooldownReset 순환 + 순(純)자원비용 ≤ 0 → 무한 콤보 루프        (COMBO-NO-INFINITE)
//   k) input-budget 모바일 동시 바인딩 액티브 슬롯 수 > 버튼 예산                   (UX-BUTTON-BUDGET)
//
// 임계값은 하드코딩하지 않고 abilities.json 의 balanceConfig 에서 읽는다(없으면 보수적 기본값).
//
// 사용:
//   node skills/ability-architect/tools/lint-abilities.mjs games/<slug>/abilities.json
//   node skills/ability-architect/tools/lint-abilities.mjs --file <path> --json
//   node skills/ability-architect/tools/lint-abilities.mjs <file> --strict   (warn 도 실패로)
//
// 출력 계약: 사람용 라인들을 먼저 출력하고, **stdout 마지막 줄은 단일 JSON**:
//   {"ok":bool,"counts":{"error":n,"warn":n,"info":n},"findings":[{rule,severity,id,message}],"file":path}
// 종료코드: error 0건이면 0, 있으면 1 (--strict 면 warn 도 1).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── 인자 파싱 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
let file = null
let jsonOnly = false
let strict = false
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--json') jsonOnly = true
  else if (a === '--strict') strict = true
  else if (a === '--file') file = argv[++i]
  else if (!a.startsWith('--')) file = a
}

const findings = []
const add = (rule, severity, id, message) => findings.push({ rule, severity, id, message })

function emit() {
  const counts = { error: 0, warn: 0, info: 0 }
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1
  const ok = counts.error === 0 && (!strict || counts.warn === 0)
  if (!jsonOnly) {
    const icon = { error: '✗', warn: '⚠', info: 'ℹ' }
    if (findings.length === 0) console.log('✓ lint-abilities: 결함 없음')
    else for (const f of findings) console.log(`${icon[f.severity] || '·'} [${f.rule}] ${f.id ? f.id + ': ' : ''}${f.message}`)
    console.log(`— error ${counts.error} · warn ${counts.warn} · info ${counts.info}`)
  }
  console.log(JSON.stringify({ ok, counts, findings, file: file || null }))
  process.exit(ok ? 0 : 1)
}

// ── 로드 ─────────────────────────────────────────────────────────────────────
if (!file) { add('schema', 'error', null, '입력 파일 경로가 없습니다. 사용: node lint-abilities.mjs games/<slug>/abilities.json'); emit() }
let data
try { data = JSON.parse(readFileSync(resolve(file), 'utf8')) }
catch (e) { add('schema', 'error', null, `abilities.json 읽기/파싱 실패: ${e.message}`); emit() }

// ── balanceConfig 기본값 ──────────────────────────────────────────────────────
const cfg = data.balanceConfig || {}
const KIND_ENUM = cfg.kinds || ['active', 'passive', 'movement', 'utility', 'ultimate', 'reaction']
const ROLE_ENUM = cfg.roles || ['core', 'payoff', 'enabler', 'mobility', 'survival', 'control', 'burst', 'sustain', 'utility']
const INPUT_ENUM = cfg.inputs || ['instant', 'charge', 'toggle', 'hold', 'aim', 'target', 'passive']
const lowerIsBetter = new Set(cfg.lowerIsBetter || ['cooldown', 'cd', 'cost', 'cast', 'recovery', 'windup', 'ms'])
const multCap = cfg.multCap == null ? 2 : cfg.multCap
const requiredVisual = cfg.requiredVisualSlots || ['silhouette', 'material', 'palette', 'focal_motif']
const deadSkillFactor = cfg.deadSkillFactor == null ? 0.5 : cfg.deadSkillFactor
const hubFactor = cfg.synergyHubFactor == null ? 0.5 : cfg.synergyHubFactor
// 파워로 밸런싱되는 kind 만 죽은스킬/지배/쿨다운 검사 대상(패시브·이동·유틸 일부 제외 가능)
const POWER_KINDS = new Set(cfg.powerKinds || ['active', 'ultimate', 'reaction'])
const cooldownCostScale = cfg.cooldownCostScale == null ? 1 : cfg.cooldownCostScale // 쿨다운 1초 ≈ 비용 N
const spamCooldownMax = cfg.spamCooldownMax == null ? 1.5 : cfg.spamCooldownMax // 이하 쿨다운만 '스팸 가능'으로 무비용 검사
const inputBudgetMobile = cfg.inputBudgetMobile == null ? 4 : cfg.inputBudgetMobile
const budgetBands = cfg.budgetBands ? normBands(cfg.budgetBands) : null // {kind:{min,max}} 선택

const abilities = Array.isArray(data.abilities) ? data.abilities : []
if (abilities.length === 0) { add('schema', 'warn', null, 'abilities 배열이 비어 있습니다(T0이면 정상 — 능력 시스템 없음).'); emit() }

const resources = {}
for (const r of (Array.isArray(data.resources) ? data.resources : [])) if (r && r.id != null) resources[r.id] = r

function normBands(raw) {
  const b = {}
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) b[k] = { min: Number(v[0]), max: Number(v[1]) }
    else if (v && typeof v === 'object') b[k] = { min: Number(v.min), max: Number(v.max) }
  }
  return b
}
function round2(n) { return Math.round(n * 100) / 100 }
function isMultKey(k) { return /mult|xrate|pct|percent|scal|amp/i.test(k) }
function groupBy(a, fn) { const m = {}; for (const x of a) { const k = fn(x) || '_'; (m[k] = m[k] || []).push(x) } return m }
function median(ns) { if (!ns.length) return 0; const s = [...ns].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

// ── 파워 점수: effect 벡터 가중 절댓값 합(상대 비교용) ─────────────────────────
const statWeights = cfg.statWeights || {}
function powerScore(ab) {
  const eff = ab.effect || {}
  let s = 0
  for (const [k, v] of Object.entries(eff)) {
    if (typeof v !== 'number') continue
    const w = statWeights[k] == null ? 1 : statWeights[k]
    if (isMultKey(k)) s += Math.abs(v - 1) * (cfg.multScale == null ? 6 : cfg.multScale) * w
    else s += Math.abs(v) * w
  }
  // scaling.mult(>1) 정성 가치
  if (ab.scaling && typeof ab.scaling.mult === 'number' && ab.scaling.mult > 1) s += (ab.scaling.mult - 1) * (cfg.multScale == null ? 6 : cfg.multScale)
  if (ab.grantsVerb) s += cfg.verbValue == null ? 4 : cfg.verbValue
  return round2(s)
}
const scores = abilities.map(powerScore)
const abilityPower = (i) => (Number.isFinite(abilities[i].budget) ? abilities[i].budget : scores[i])
// 비용 척도: 자원 비용 + 쿨다운 가중(둘 다 기회비용)
function costMetric(ab) {
  let c = 0
  if (Number(ab.cost) > 0) c += Number(ab.cost)
  if (Number(ab.cooldown) > 0) c += Number(ab.cooldown) * cooldownCostScale
  return c > 0 ? c : 1
}

const allIds = new Set(abilities.map((a) => a.id).filter((x) => x != null))

// ── (a) schema + 참조 무결성 ──────────────────────────────────────────────────
const seen = new Map()
abilities.forEach((ab, i) => {
  const id = ab.id != null ? String(ab.id) : null
  if (!id) { add('schema', 'error', `#${i}`, 'id 누락'); return }
  if (seen.has(id)) add('schema', 'error', id, `id 중복(이전 #${seen.get(id)})`)
  else seen.set(id, i)
  if (!ab.name) add('schema', 'warn', id, 'name 누락')
  if (!ab.kind) add('schema', 'error', id, 'kind 누락')
  else if (!KIND_ENUM.includes(ab.kind)) add('schema', 'error', id, `kind "${ab.kind}" 가 enum(${KIND_ENUM.join('|')}) 밖`)
  if (ab.role && !ROLE_ENUM.includes(ab.role)) add('schema', 'warn', id, `role "${ab.role}" 가 목록 밖(${ROLE_ENUM.join('|')})`)
  if (ab.input && !INPUT_ENUM.includes(ab.input)) add('schema', 'warn', id, `input "${ab.input}" 가 목록 밖(${INPUT_ENUM.join('|')})`)
  // 자원 참조
  if (ab.resource && !resources[ab.resource]) add('schema', 'error', id, `resource "${ab.resource}" 가 resources 에 정의 안 됨`)
  if (ab.cost && !ab.resource) add('schema', 'warn', id, 'cost 가 있는데 resource 미지정(어떤 자원을 쓰는지 불명)')
  // combo / cooldownReset / requires 참조 무결성
  if (ab.combo) for (const f of (Array.isArray(ab.combo.from) ? ab.combo.from : [])) if (!allIds.has(f)) add('schema', 'warn', id, `combo.from "${f}" 가 존재하지 않는 능력`)
  for (const cr of (Array.isArray(ab.cooldownReset) ? ab.cooldownReset : [])) if (!allIds.has(cr)) add('schema', 'warn', id, `cooldownReset "${cr}" 가 존재하지 않는 능력`)
  // 비주얼 슬롯(아이콘 핸드오프 — UX-DESC-SLOTS)
  const v = ab.visual || {}
  const missing = requiredVisual.filter((slot) => v[slot] == null || v[slot] === '')
  if (missing.length) add('schema', 'warn', id, `visual 슬롯 미채움: ${missing.join(', ')} (아이콘 생성 품질 저하)`)
  // 곱산 캡
  const hasMult = Object.keys(ab.effect || {}).some(isMultKey) || (ab.scaling && Number(ab.scaling.mult) > 1)
  if (hasMult && ab.cap == null && ab.maxStacks == null && !(ab.scaling && ab.scaling.cap != null)) {
    add('mult-explode', 'warn', id, '곱연산 소스에 캡(cap·maxStacks·scaling.cap) 명시 없음 — 무한 스택 위험(SYN-ADD-VS-MULT)')
  }
})

// ── (e) resource: 영구 사용불가 / 사실상 무비용 ───────────────────────────────
abilities.forEach((ab) => {
  if (!ab.cost || !ab.resource) return
  const r = resources[ab.resource]; if (!r) return
  const max = Number(r.max) || 0
  if (Number(ab.cost) > max) add('resource', 'error', String(ab.id), `cost ${ab.cost} > ${ab.resource} 최대 ${max} — 영구 사용 불가(죽은 능력)`)
  // 사실상 무비용: 짧은 쿨다운(스팸 가능)인데 리젠이 비용을 전액 회복하면 기회비용 0.
  // 긴 쿨다운(궁극기·중쿨)은 회복이 정상이므로 제외(spamCooldownMax 이하만 검사).
  const regen = Number(r.regen) || 0
  const cd = Number(ab.cooldown) || 0
  if (regen > 0 && cd > 0 && cd <= spamCooldownMax && regen * cd >= Number(ab.cost) && POWER_KINDS.has(ab.kind)) {
    add('resource', 'info', String(ab.id), `짧은 쿨다운(${cd}s)인데 리젠(${regen}/s)이 비용 ${ab.cost} 을 전액 회복 → 사실상 무비용(기회비용 0, RES-OPPORTUNITY-COST)`)
  }
})

// ── (b) dead-skill ────────────────────────────────────────────────────────────
const byKind = groupBy(abilities, (a) => a.kind)
for (const [kind, group] of Object.entries(byKind)) {
  if (!POWER_KINDS.has(kind) || group.length < 3) continue
  const effs = group.map((ab) => ({ ab, eff: abilityPower(abilities.indexOf(ab)) / costMetric(ab) }))
  const med = median(effs.map((e) => e.eff))
  if (med <= 0) continue
  for (const e of effs) {
    if (e.eff < med * deadSkillFactor) add('dead-skill', 'warn', String(e.ab.id), `${kind} 그룹 효율(파워/비용) ${round2(e.eff)} < 중앙값 ${round2(med)}의 ${deadSkillFactor}배 — 죽은 능력 후보(niche 부여 또는 강화)`)
  }
}

// ── (c) dominant: 같은 kind(+slot) 파레토 지배 ────────────────────────────────
for (const [, group] of Object.entries(byKind)) {
  for (let a = 0; a < group.length; a++) for (let b = 0; b < group.length; b++) {
    if (a === b) continue
    const A = group[a], B = group[b]
    if ((A.slot || null) !== (B.slot || null)) continue
    if (dominates(A, B)) add('dominant', 'warn', String(B.id), `"${A.id}" 가 "${B.id}" 를 파레토 지배(모든 효과축 ≥, 비용·쿨다운 ≤). "${B.id}" 존재 이유 없음 → 트레이드오프 부여(BAL-NO-DOMINANT)`)
  }
}
function dominates(A, B) {
  const ea = A.effect || {}, eb = B.effect || {}
  const keys = new Set([...Object.keys(ea), ...Object.keys(eb)])
  let strict = false
  for (const k of keys) {
    if (typeof (ea[k] ?? eb[k]) !== 'number') continue
    const va = Number(ea[k]) || 0, vb = Number(eb[k]) || 0
    const better = lowerIsBetter.has(k) ? va <= vb : va >= vb
    const strictly = lowerIsBetter.has(k) ? va < vb : va > vb
    if (!better) return false
    if (strictly) strict = true
  }
  // 비용·쿨다운(낮을수록 우월)
  for (const m of ['cost', 'cooldown']) {
    const ca = Number(A[m]) || 0, cb = Number(B[m]) || 0
    if (ca > cb) return false
    if (ca < cb) strict = true
  }
  return strict
}

// ── (d) mult-explode: 동시 적용 곱산 소스 수 ──────────────────────────────────
// 동시 적용 = 패시브/토글(상시) 곱산. 슬롯 액티브는 동시성이 낮아 제외.
const multSources = abilities.filter((ab) => {
  if (ab.kind !== 'passive' && ab.input !== 'toggle') return false
  return Object.keys(ab.effect || {}).some(isMultKey) || (ab.scaling && Number(ab.scaling.mult) > 1)
})
if (multSources.length > multCap) add('mult-explode', 'error', null, `동시 적용 가능한 곱연산 소스 ${multSources.length}개 > multCap ${multCap} (${multSources.map((m) => m.id).join(', ')}) — 곱산은 1~2종만 희소 격리(SYN-ADD-VS-MULT)`)

// ── (f) cooldown/budget band ─────────────────────────────────────────────────
abilities.forEach((ab, i) => {
  if (!POWER_KINDS.has(ab.kind)) return
  const p = abilityPower(i)
  // 고파워인데 무쿨+무비용 = 스팸 가능 = 밸런스 이탈
  if (p > 0 && !(Number(ab.cooldown) > 0) && !(Number(ab.cost) > 0)) {
    add('cooldown', 'warn', String(ab.id), `파워 ${round2(p)} 인데 쿨다운·비용 둘 다 없음 → 무한 스팸(기회비용 0). 쿨다운 또는 자원 비용 부여(BAL-POWER-BUDGET)`)
  }
  if (budgetBands && budgetBands[ab.kind] && Number.isFinite(ab.budget)) {
    const band = budgetBands[ab.kind]
    if (ab.budget < band.min) add('cooldown', 'warn', String(ab.id), `budget ${ab.budget} < ${ab.kind} 밴드 하한 ${band.min}`)
    else if (ab.budget > band.max) add('cooldown', 'warn', String(ab.id), `budget ${ab.budget} > ${ab.kind} 밴드 상한 ${band.max}`)
  }
})

// ── (g) synergy: 태그 응집·고립·과밀 허브·도달불가 세트 ────────────────────────
const tagCount = new Map()
for (const ab of abilities) for (const t of (ab.tags || [])) tagCount.set(t, (tagCount.get(t) || 0) + 1)
for (const ab of abilities) {
  if (ab.role === 'enabler' || ab.role === 'payoff') {
    const partners = (ab.tags || []).some((t) => (tagCount.get(t) || 0) >= 2)
    if (!partners) add('synergy', 'warn', String(ab.id), `role=${ab.role} 인데 공유 태그 동료 없음 — 고립 시너지(작동 안 함). 짝 enabler/payoff 추가 또는 태그 정렬(SYN-ENABLER-PAYOFF)`)
  }
}
for (const [t, c] of tagCount) if (c >= Math.max(3, abilities.length * hubFactor)) add('synergy', 'info', null, `태그 "${t}" 가 ${c}/${abilities.length} 능력에 집중 — 과밀 허브(이 태그 빌드 지배 위험)`)
const sets = Array.isArray(data.sets) ? data.sets : []
for (const s of sets) {
  const needed = s.threshold || s.need || (s.members && s.members.length) || 0
  const have = abilities.filter((ab) => (ab.set === s.id) || (ab.tags || []).includes(s.id) || (s.members || []).includes(ab.id)).length
  if (needed > 0 && have < needed) add('synergy', 'error', s.id, `세트 "${s.id}" 는 ${needed}개 필요한데 보유 능력 ${have}개 — 도달 불가`)
}

// ── (h) tree: 스킬트리 도달성·고아·참조 무결성 ────────────────────────────────
const tree = data.tree || null
if (tree && Array.isArray(tree.nodes)) {
  const nodeIds = new Set(tree.nodes.map((n) => n.id))
  // grants 가 존재하는 능력인지
  for (const n of tree.nodes) for (const g of (Array.isArray(n.grants) ? n.grants : [])) if (!allIds.has(g)) add('tree', 'warn', n.id, `노드 grants "${g}" 가 존재하지 않는 능력`)
  // requires 노드 참조
  for (const n of tree.nodes) for (const rq of (Array.isArray(n.requires) ? n.requires : [])) if (!nodeIds.has(rq)) add('tree', 'warn', n.id, `노드 requires "${rq}" 가 존재하지 않는 노드`)
  // 도달성 BFS(start 에서 edges/requires 충족하며)
  const edges = Array.isArray(tree.edges) ? tree.edges : []
  const start = tree.start || (tree.nodes[0] && tree.nodes[0].id)
  const reached = new Set(start ? [start] : [])
  let changed = true
  while (changed) {
    changed = false
    for (const n of tree.nodes) {
      if (reached.has(n.id)) continue
      const reqNodes = (Array.isArray(n.requires) ? n.requires : []).concat(edges.filter((e) => e.to === n.id).flatMap((e) => Array.isArray(e.requires) ? e.requires : []))
      const hasEdgeIn = edges.some((e) => e.to === n.id) || reqNodes.length > 0
      const reqOk = reqNodes.every((r) => reached.has(r))
      // 진입 간선이 없는 노드는 start 가 아니면 도달 경로 없음(고아)
      if (!hasEdgeIn && n.id !== start) continue
      if (reqOk) { reached.add(n.id); changed = true }
    }
  }
  for (const n of tree.nodes) if (!reached.has(n.id)) add('tree', 'warn', n.id, `스킬트리 노드 "${n.id}" 도달 불가(진입 간선 없음 또는 선행 미충족) — 고아 노드(PROG-REACHABLE)`)
}
// ability.requires 가 노드/능력 어디서도 안 나오면
for (const ab of abilities) for (const rq of (Array.isArray(ab.requires) ? ab.requires : [])) {
  const inTree = tree && Array.isArray(tree.nodes) && tree.nodes.some((n) => n.id === rq)
  const inAbil = allIds.has(rq)
  if (!inTree && !inAbil) add('tree', 'warn', String(ab.id), `requires "${rq}" 가 존재하지 않는 노드/능력`)
}

// ── (i) gate-softlock: 능력 게이트 그래프 도달가능성(lint-items 패턴) ──────────
const gates = data.gates || null
if (gates && Array.isArray(gates.nodes)) {
  const nodes = new Set(gates.nodes.map((n) => (typeof n === 'string' ? n : n.id)))
  const edges = gates.edges || []
  const start = gates.start || (gates.nodes[0] && (typeof gates.nodes[0] === 'string' ? gates.nodes[0] : gates.nodes[0].id))
  // 능력이 주는 키/동사: grantsVerb · unlocks · 능력 id 자체
  const grantable = new Set()
  for (const ab of abilities) { if (ab.grantsVerb) grantable.add(ab.grantsVerb); if (ab.unlocks) grantable.add(ab.unlocks); grantable.add(ab.id) }
  const adj = new Map(); for (const n of nodes) adj.set(n, [])
  for (const e of edges) if (adj.has(e.from)) adj.get(e.from).push(e)
  const have = new Set()
  let changed = true, reached = new Set([start])
  while (changed) {
    changed = false
    for (const n of [...reached]) {
      const node = gates.nodes.find((x) => (typeof x === 'string' ? x : x.id) === n)
      for (const g of (node && node.grants ? [].concat(node.grants) : [])) if (!have.has(g)) { have.add(g); changed = true }
      for (const e of (adj.get(n) || [])) {
        const req = e.requires ? [].concat(e.requires) : []
        if (req.every((r) => have.has(r) || grantable.has(r)) && !reached.has(e.to)) { reached.add(e.to); changed = true }
      }
    }
  }
  for (const n of nodes) if (!reached.has(n)) add('gate-softlock', 'error', n, `게이트 노드 "${n}" 도달 불가(필요 능력 미획득 경로) — softlock(GATE-NO-SOFTLOCK)`)
  for (const e of edges) for (const r of [].concat(e.requires || [])) {
    const fromAbil = grantable.has(r)
    const fromNode = gates.nodes.some((x) => x.grants && [].concat(x.grants).includes(r))
    if (!fromAbil && !fromNode) add('gate-softlock', 'error', r, `게이트 요구 "${r}" 를 주는 능력/노드가 없음`)
  }
}

// ── (j) combo-loop: cooldownReset 순환 + 순자원비용 ≤ 0 → 무한 콤보 ────────────
// 그래프: A --cooldownReset--> B (A 사용이 B 쿨다운 리셋). 순환이면 무한 반복 가능.
// 순환 내 능력들의 순(純) 자원수지(콤보 grants - cost)가 ≥ 0 이면 자원 제약 없이 영구 루프.
const resetAdj = new Map()
for (const ab of abilities) resetAdj.set(ab.id, (Array.isArray(ab.cooldownReset) ? ab.cooldownReset : []).filter((x) => allIds.has(x)))
const cycles = findCycles(resetAdj)
for (const cyc of cycles) {
  let net = 0 // 음수면 자원 소모(루프 지속 불가 = 안전), 양수/0이면 무한
  for (const id of cyc) {
    const ab = abilities.find((x) => x.id === id) || {}
    if (ab.cost) net -= Number(ab.cost) || 0
    if (ab.combo && ab.combo.grants) for (const v of Object.values(ab.combo.grants)) net += Number(v) || 0
  }
  if (net >= 0) add('combo-loop', 'error', cyc.join('→'), `cooldownReset 순환(${cyc.join('→')}) 의 순 자원수지 ${net} ≥ 0 → 무한 콤보 루프(COMBO-NO-INFINITE). 루프에 순소모 자원 또는 진입 캡 부여`)
  else add('combo-loop', 'info', cyc.join('→'), `cooldownReset 순환(${cyc.join('→')}) 발견 — 순 자원수지 ${net}(<0, 자원으로 자연 종료). 의도 확인`)
}
function findCycles(adj) {
  const out = [], color = new Map(), stack = []
  function dfs(u) {
    color.set(u, 1); stack.push(u)
    for (const v of (adj.get(u) || [])) {
      if (color.get(v) === 1) { const i = stack.indexOf(v); if (i >= 0) out.push(stack.slice(i)) }
      else if (!color.get(v)) dfs(v)
    }
    color.set(u, 2); stack.pop()
  }
  for (const u of adj.keys()) if (!color.get(u)) dfs(u)
  // 중복 제거(같은 순환의 회전)
  const seenC = new Set(), uniq = []
  for (const c of out) { const key = [...c].sort().join(',') ; if (!seenC.has(key)) { seenC.add(key); uniq.push(c) } }
  return uniq
}

// ── (k) input-budget: 모바일 동시 바인딩 액티브 슬롯 ───────────────────────────
const ACTIVE_KINDS = new Set(['active', 'movement', 'ultimate', 'utility', 'reaction'])
const boundSlots = new Set()
let unboundActive = 0
for (const ab of abilities) {
  if (!ACTIVE_KINDS.has(ab.kind)) continue
  if (ab.input === 'passive') continue
  if (ab.slot) boundSlots.add(ab.slot)
  else unboundActive++
}
if (boundSlots.size > inputBudgetMobile) add('input-budget', 'warn', null, `동시 바인딩 액티브 슬롯 ${boundSlots.size}개 > 모바일 버튼 예산 ${inputBudgetMobile} (${[...boundSlots].join(', ')}) — 엄지 조작 한계 초과(UX-BUTTON-BUDGET). 슬롯 통합·라디얼 메뉴·컨텍스트 입력 고려`)

emit()
