#!/usr/bin/env node
// lint-items.mjs — item-architect 아이템 밸런스/시너지 정적 린터
// ─────────────────────────────────────────────────────────────────────────────
// games/<slug>/items.json 을 읽어 설계-시 정량 결함을 검출한다(런타임 무관, 설계 도구).
// 무의존성: Node 빌트인(fs/path/url)만 사용. npm install 불요. wgf-sprite-picker/catalog/analyze-pack.mjs 컨벤션 준수.
//
// 검사 룰 그룹(consistency-tools.md 린트 체크리스트 a~h ↔ synergy-balance.md SYN-*):
//   a) schema      필수 필드·enum·중복 id·비주얼 슬롯 채움                (SYN 외 / UX-DESC-SLOTS)
//   b) dead-item   등급/비용 대비 파워예산 최저권 outlier(죽은 아이템)     (SYN-NO-TRAP/SYN-EV-COMPARE)
//   c) dominant    파레토 지배(같은 kind/slot에서 모든 축 우월 + 저비용)     (SYN-NO-DOMINANT)
//   d) mult-explode 상한 없는 곱연산 스택                                   (SYN-ADD-VS-MULT/SYN-EMERGENT-COMBO)
//   e) rarity-band 등급별 파워예산 밴드 이탈                               (SYN-POWER-BUDGET/ECON-RARITY)
//   f) synergy     고립 시너지 노드·과밀 허브·도달불가 세트                 (SYN-ENABLER-PAYOFF/SYN-SET-SOFTCAP)
//   g) softlock    게이트 그래프 도달가능성(필수 키 획득가능)              (UTIL-NO-SOFTLOCK/UTIL-GATE-GRAPH)
//
// 임계값은 하드코딩하지 않고 items.json 의 balanceConfig 에서 읽는다(없으면 보수적 기본값).
//
// 사용:
//   node skills/wgf-item-architect/tools/lint-items.mjs games/<slug>/items.json
//   node skills/wgf-item-architect/tools/lint-items.mjs --file games/<slug>/items.json --json
//   node skills/wgf-item-architect/tools/lint-items.mjs <file> --strict   (warn 도 실패로)
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

// ── 출력 헬퍼 ────────────────────────────────────────────────────────────────
function emit() {
  const counts = { error: 0, warn: 0, info: 0 }
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1
  const ok = counts.error === 0 && (!strict || counts.warn === 0)
  if (!jsonOnly) {
    const icon = { error: '✗', warn: '⚠', info: 'ℹ' }
    if (findings.length === 0) {
      console.log('✓ lint-items: 결함 없음')
    } else {
      for (const f of findings) {
        console.log(`${icon[f.severity] || '·'} [${f.rule}] ${f.id ? f.id + ': ' : ''}${f.message}`)
      }
    }
    console.log(`— error ${counts.error} · warn ${counts.warn} · info ${counts.info}`)
  }
  // 마지막 줄 = 단일 JSON 계약
  console.log(JSON.stringify({ ok, counts, findings, file: file || null }))
  process.exit(ok ? 0 : 1)
}

// ── 로드 ─────────────────────────────────────────────────────────────────────
if (!file) {
  add('schema', 'error', null, '입력 파일 경로가 없습니다. 사용: node lint-items.mjs games/<slug>/items.json')
  emit()
}
let data
try {
  data = JSON.parse(readFileSync(resolve(file), 'utf8'))
} catch (e) {
  add('schema', 'error', null, `items.json 읽기/파싱 실패: ${e.message}`)
  emit()
}

// ── balanceConfig 기본값(없으면 보수적 디폴트, ECON-* 정신: 임계값을 데이터로) ──
const cfg = data.balanceConfig || {}
const KIND_ENUM = cfg.kinds || ['consumable', 'equipment', 'key', 'material', 'currency', 'cosmetic']
const RARITY_ORDER = (data.rarities && data.rarities.map((r) => (typeof r === 'string' ? r : r.id))) ||
  cfg.rarities || ['common', 'rare', 'epic', 'legendary']
// 등급별 파워예산 밴드. consistency-tools.md 스펙은 [min,max] 절댓값(budget 단위), 객체 {min,max}도 허용.
// 없으면 밴드 검사를 건너뛴다(상대 자동밴드는 noise가 커서 제거 — 밴드를 쓰려면 balanceConfig.rarityBands 명시).
const bands = cfg.rarityBands ? normBands(cfg.rarityBands) : null
const statWeights = cfg.statWeights || {} // {atk:1, def:1, heal:0.5, ...} 키별 가중치(기본 1)
const lowerIsBetter = new Set(cfg.lowerIsBetter || ['cooldown', 'cd', 'weight', 'ms']) // 작을수록 좋은 축
const multCap = cfg.multCap == null ? 2 : cfg.multCap // 동시 곱산 소스 허용 상한
const requiredVisual = cfg.requiredVisualSlots || ['silhouette', 'material', 'palette', 'focal_motif']
// 동급 중앙값 대비 이 비율 미만 효율이면 죽은템 후보. consistency-tools.md 스펙 키 deadItemBudgetPct 우선.
const deadItemFactor = cfg.deadItemBudgetPct != null ? cfg.deadItemBudgetPct
  : (cfg.deadItemFactor == null ? 0.5 : cfg.deadItemFactor)
const hubFactor = cfg.synergyHubFactor == null ? 0.5 : cfg.synergyHubFactor // 한 태그가 아이템의 이 비율 이상 차지하면 과밀 허브
// 파워로 밸런싱되는 범주만 등급밴드·죽은아이템 검사 대상(키/통화/코스메틱은 파워 무관 → 제외)
const POWER_KINDS = new Set(cfg.powerKinds || ['consumable', 'equipment', 'material'])
const evBandPct = cfg.evBandPct == null ? 0.25 : cfg.evBandPct       // 같은 kind+rarity EV 중앙값 대비 허용 편차(SYN-EV-COMPARE)
const pickRateFloor = cfg.pickRateFloor == null ? 0.05 : cfg.pickRateFloor // picked/seen 하한(SYN-METRICS)
const minSeen = cfg.minSeen == null ? 20 : cfg.minSeen               // 픽률 판정 최소 노출 표본

const items = Array.isArray(data.items) ? data.items : []
if (items.length === 0) {
  add('schema', 'warn', null, 'items 배열이 비어 있습니다(Tier 0~1이면 정상일 수 있음).')
  emit()
}

// rarityBands 를 {rarity:{min,max}} 로 정규화. [min,max] 배열·{min,max} 객체 양식 모두 허용.
function normBands(raw) {
  const b = {}
  for (const [r, v] of Object.entries(raw)) {
    if (Array.isArray(v)) b[r] = { min: Number(v[0]), max: Number(v[1]) }
    else if (v && typeof v === 'object') b[r] = { min: Number(v.min), max: Number(v.max) }
  }
  return b
}
function round2(n) { return Math.round(n * 100) / 100 }

// ── 파워 점수: effect 벡터의 가중 절댓값 합(상대 비교용, 절대 진리 아님) ──────────
function powerScore(item) {
  const eff = item.effect || {}
  let s = 0
  for (const [k, v] of Object.entries(eff)) {
    if (typeof v !== 'number') continue // buff 이름 등 비수치는 제외
    const w = statWeights[k] == null ? 1 : statWeights[k]
    // 곱산 키는 (배수-1)*scale 로 환산(예: mult 1.5 → 0.5*multScale)
    if (isMultKey(k)) s += Math.abs((v - 1)) * (cfg.multScale == null ? 6 : cfg.multScale) * w
    else s += Math.abs(v) * w
  }
  // grantsVerb(새 동사 부여)·set 멤버십은 정성 가치 → 소폭 가산(설계 신호)
  if (item.grantsVerb) s += cfg.verbValue == null ? 4 : cfg.verbValue
  return round2(s)
}
function isMultKey(k) { return /mult|xrate|pct|percent|scal/i.test(k) }

// 아이템 파워: 설계자가 명시한 budget(권장, consistency-tools.md 스펙)을 우선, 없으면 effect로 계산.
// 밴드·죽은아이템·효율 비교는 모두 이 단일 척도를 쓴다(게임 내에서 일관된 단위면 정합).
const scores = items.map(powerScore)
const itemPower = (i) => (Number.isFinite(items[i].budget) ? items[i].budget : scores[i])

// ── (a) schema ───────────────────────────────────────────────────────────────
const seenId = new Map()
items.forEach((it, i) => {
  const id = it.id != null ? String(it.id) : null
  if (!id) { add('schema', 'error', `#${i}`, 'id 누락'); return }
  if (seenId.has(id)) add('schema', 'error', id, `id 중복(이전 #${seenId.get(id)})`)
  else seenId.set(id, i)
  if (!it.name) add('schema', 'warn', id, 'name 누락')
  if (!it.kind) add('schema', 'error', id, 'kind 누락')
  else if (!KIND_ENUM.includes(it.kind)) add('schema', 'error', id, `kind "${it.kind}" 가 enum(${KIND_ENUM.join('|')}) 밖`)
  if (it.rarity && !RARITY_ORDER.includes(it.rarity)) add('schema', 'warn', id, `rarity "${it.rarity}" 가 등급 목록 밖`)
  // 비주얼 슬롯 채움(이미지 생성 핸드오프 — UX-DESC-SLOTS)
  const v = it.visual || {}
  const missing = requiredVisual.filter((slot) => v[slot] == null || v[slot] === '')
  if (it.kind !== 'currency' && missing.length) add('schema', 'warn', id, `visual 슬롯 미채움: ${missing.join(', ')} (이미지 생성 품질 저하)`)
})

// ── (e) rarity-band: 정규화 파워가 등급 밴드를 벗어나는가 ──────────────────────
if (bands) items.forEach((it, i) => {
  if (!it.rarity || !bands[it.rarity]) return
  if (!POWER_KINDS.has(it.kind)) return // 키/통화/코스메틱은 파워 밴드 무관
  const p = itemPower(i)
  const band = bands[it.rarity]
  if (p < band.min) add('rarity-band', 'warn', String(it.id), `파워예산 ${round2(p)} < ${it.rarity} 밴드 하한 ${band.min} (등급 대비 약함 — budget 상향 또는 등급 하향)`)
  else if (p > band.max) add('rarity-band', 'warn', String(it.id), `파워예산 ${round2(p)} > ${it.rarity} 밴드 상한 ${band.max} (등급 대비 과강 — budget 하향 또는 등급 상향)`)
})

// ── (b) dead-item: 같은 kind 그룹에서 파워/비용 효율이 중앙값의 deadItemFactor 미만 ──
const byKind = groupBy(items, (it) => it.kind)
for (const [kind, group] of Object.entries(byKind)) {
  if (!POWER_KINDS.has(kind)) continue // 키/통화/코스메틱은 효율 비교 무의미
  if (group.length < 3) continue
  const effs = group.map((it) => {
    const idx = items.indexOf(it)
    const cost = Number(it.cost) > 0 ? Number(it.cost) : 1
    return { it, eff: itemPower(idx) / cost }
  })
  const med = median(effs.map((e) => e.eff))
  if (med <= 0) continue
  for (const e of effs) {
    if (e.eff < med * deadItemFactor) {
      add('dead-item', 'warn', String(e.it.id), `${kind} 그룹 효율(파워/비용) ${round2(e.eff)} < 중앙값 ${round2(med)}의 ${deadItemFactor}배 — 죽은 아이템 후보(niche 1줄 부여 또는 강화)`)
    }
  }
}

// ── (c) dominant: 같은 kind(+slot) 내 파레토 지배(strictly-better) ─────────────
for (const [, group] of Object.entries(byKind)) {
  for (let a = 0; a < group.length; a++) {
    for (let b = 0; b < group.length; b++) {
      if (a === b) continue
      const A = group[a], B = group[b]
      if ((A.slot || null) !== (B.slot || null)) continue
      if (dominates(A, B)) {
        add('dominant', 'warn', String(B.id), `"${A.id}" 가 "${B.id}" 를 파레토 지배(모든 축 ≥, 비용 ≤, 최소 1축 >). "${B.id}" 존재 이유 없음 → 트레이드오프 부여`)
      }
    }
  }
}
function dominates(A, B) {
  const ea = A.effect || {}, eb = B.effect || {}
  const keys = new Set([...Object.keys(ea), ...Object.keys(eb)])
  let strict = false
  for (const k of keys) {
    const va = Number(ea[k]) || 0, vb = Number(eb[k]) || 0
    const better = lowerIsBetter.has(k) ? (x, y) => x <= y : (x, y) => x >= y
    const strictly = lowerIsBetter.has(k) ? (x, y) => x < y : (x, y) => x > y
    if (!better(va, vb)) return false
    if (strictly(va, vb)) strict = true
  }
  const ca = Number(A.cost) || 0, cb = Number(B.cost) || 0
  if (ca > cb) return false
  if (ca < cb) strict = true
  return strict
}

// ── (d) mult-explode: 동시 적용 가능한 곱산 소스 수가 multCap 초과 ──────────────
// 동시 적용 = slot 없는 패시브/렐릭/소모버프(중첩 가능)에서 곱산 키를 가진 것들
const multSources = items.filter((it) => {
  if (it.slot) return false // 슬롯 장비는 슬롯 수가 상한 → 별도
  const eff = it.effect || {}
  return Object.keys(eff).some(isMultKey) || it.stackType === 'mult'
})
if (multSources.length > multCap) {
  add('mult-explode', 'error', null, `동시 중첩 가능한 곱연산 소스 ${multSources.length}개 > multCap ${multCap} (${multSources.map((m) => m.id).join(', ')}) — 곱산은 1~2종만 희소 격리(SYN-ADD-VS-MULT), 또는 proc/스택 캡 부여`)
}
// 캡 없는 개별 곱산 소스
for (const m of multSources) {
  const hasCap = m.cap != null || (m.effect && m.effect.cap != null) || m.maxStacks != null
  if (!hasCap) add('mult-explode', 'warn', String(m.id), '곱연산 소스에 스택/proc 캡(cap·maxStacks) 명시 없음 — 무한 스택 위험')
}

// ── (f) synergy: 태그 응집·고립 노드·과밀 허브·도달불가 세트 ────────────────────
const tagCount = new Map()
for (const it of items) for (const t of (it.tags || [])) tagCount.set(t, (tagCount.get(t) || 0) + 1)
// 고립: role 이 enabler/payoff 인데 공유 태그 동료가 없음
for (const it of items) {
  if (it.role === 'enabler' || it.role === 'payoff') {
    const partners = (it.tags || []).some((t) => (tagCount.get(t) || 0) >= 2)
    if (!partners) add('synergy', 'warn', String(it.id), `role=${it.role} 인데 공유 태그 동료 없음 — 고립 시너지(작동 안 함). 짝 enabler/payoff 추가 또는 태그 정렬`)
  }
}
// 과밀 허브: 한 태그가 아이템 전체의 hubFactor 이상
for (const [t, c] of tagCount) {
  if (c >= Math.max(3, items.length * hubFactor)) add('synergy', 'info', null, `태그 "${t}" 가 ${c}/${items.length} 아이템에 집중 — 과밀 허브(이 태그 빌드가 지배 전략화 위험)`)
}
// 도달불가 세트: set 정의가 요구 조각 > 보유 아이템
const sets = Array.isArray(data.sets) ? data.sets : []
for (const s of sets) {
  const needed = s.threshold || s.need || (s.pieces && s.pieces.length) || 0
  const have = items.filter((it) => (it.set === s.id) || (it.tags || []).includes(s.id) || (s.pieces || []).includes(it.id)).length
  if (needed > 0 && have < needed) add('synergy', 'error', s.id, `세트 "${s.id}" 는 ${needed}개 필요한데 보유 아이템 ${have}개 — 도달 불가`)
}

// ── (g) softlock: 게이트 그래프 도달가능성 + 필수 키 획득가능 ───────────────────
const gates = data.gates || null
if (gates && Array.isArray(gates.nodes)) {
  const nodes = new Set(gates.nodes.map((n) => (typeof n === 'string' ? n : n.id)))
  const edges = gates.edges || []
  const start = gates.start || (gates.nodes[0] && (typeof gates.nodes[0] === 'string' ? gates.nodes[0] : gates.nodes[0].id))
  // 키 보유 가정 없이, 키 획득 노드를 통과하며 BFS
  const keysFromItem = new Set(items.filter((it) => it.kind === 'key' || it.grantsVerb).map((it) => it.unlocks || it.grantsVerb).filter(Boolean))
  const adj = new Map()
  for (const n of nodes) adj.set(n, [])
  for (const e of edges) { if (adj.has(e.from)) adj.get(e.from).push(e) }
  const have = new Set()
  // 고정점 반복: 도달 가능한 노드에서 키를 줍고, 새로운 게이트를 연다
  let changed = true, reached = new Set([start])
  while (changed) {
    changed = false
    for (const n of [...reached]) {
      // 노드에서 키 획득
      const node = gates.nodes.find((x) => (typeof x === 'string' ? x : x.id) === n)
      const grants = node && node.grants ? [].concat(node.grants) : []
      for (const g of grants) if (!have.has(g)) { have.add(g); changed = true }
      for (const e of (adj.get(n) || [])) {
        const req = e.requires ? [].concat(e.requires) : []
        if (req.every((r) => have.has(r) || keysFromItem.has(r)) && !reached.has(e.to)) { reached.add(e.to); changed = true }
      }
    }
  }
  for (const n of nodes) if (!reached.has(n)) add('softlock', 'error', n, `게이트 노드 "${n}" 도달 불가(필요 키 미획득 경로) — softlock`)
  // 필수 키가 어디서도 안 나오는지
  for (const e of edges) for (const r of [].concat(e.requires || [])) {
    const fromItem = keysFromItem.has(r)
    const fromNode = gates.nodes.some((x) => x.grants && [].concat(x.grants).includes(r))
    if (!fromItem && !fromNode) add('softlock', 'error', r, `게이트 요구 키 "${r}" 를 주는 아이템/노드가 없음`)
  }
}

// ── (ev) SYN-EV-COMPARE: 같은 kind+rarity 그룹의 ev 편차 — `ev` 필드 제공 시에만 ───────
const evGroups = groupBy(items.filter((it) => Number.isFinite(it.ev)), (it) => `${it.kind}/${it.rarity}`)
for (const [key, group] of Object.entries(evGroups)) {
  if (group.length < 2) continue
  const med = median(group.map((it) => it.ev))
  if (med <= 0) continue
  for (const it of group) {
    const dev = Math.abs(it.ev - med) / med
    if (dev > evBandPct) add('ev-band', 'warn', String(it.id), `EV ${it.ev} 가 동급(${key}) 중앙값 ${round2(med)} 대비 ${Math.round(dev * 100)}% 이탈(±${Math.round(evBandPct * 100)}% 밴드 밖) — 역할 차이로 설명 안 되면 조정`)
  }
}

// ── (metrics) SYN-METRICS: 픽률 — data.itemStats({id:{seen,picked}}) 제공 시에만 ─────────
const stats = data.itemStats || null
if (stats) {
  for (const it of items) {
    const s = stats[it.id]
    if (!s || !Number.isFinite(s.seen) || s.seen < minSeen) continue
    const picked = Number(s.picked != null ? s.picked : s.used) || 0
    const rate = s.seen > 0 ? picked / s.seen : 0
    if (rate < pickRateFloor) add('pick-rate', 'warn', String(it.id), `픽률 ${Math.round(rate * 100)}% (picked ${picked}/seen ${s.seen}) < 하한 ${Math.round(pickRateFloor * 100)}% — 죽은/함정 후보(약함? 안 보임? 이해 안 됨?)`)
  }
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function groupBy(arr, fn) {
  const m = {}
  for (const x of arr) { const k = fn(x) || '_'; (m[k] = m[k] || []).push(x) }
  return m
}
function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

emit()
