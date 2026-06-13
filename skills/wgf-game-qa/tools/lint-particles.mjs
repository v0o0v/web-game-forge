#!/usr/bin/env node
// lint-particles.mjs — 파티클 프리셋 데이터(particles.json) 정적 검증 린터
// ─────────────────────────────────────────────────────────────────────────────
// engine/particles.json(또는 게임별 프리셋) 을 스캔해, JuiceKit.burstPreset 이
// 안전하게 발사할 수 있는 형태인지 + 결정론·sanity 위반이 없는지 검출한다.
// burst opts 는 모두 정적 수치 — 무작위는 런타임 rngforge 가 담당하므로, 데이터 자체에
// 시각함수/비시드 무작위가 끼어들 여지가 없어야 한다(결정론 위반 = 데이터에 함수/표현식).
//
// 검사 룰:
//   PTL-NO-PRESETS       presets 가 없거나 비어 있음                              [error]
//   PTL-BAD-COUNT        count 누락/비정수/음수/0/과다(>500)                      [error]
//   PTL-BAD-RANGE        speed/life/size 가 음수·역순([min>max])·비수치           [error]
//   PTL-BAD-LIFE         life 가 0 이하(영구 파티클) 또는 과다(>10s)              [error]
//   PTL-BAD-COLOR        color 가 잘못된 hex(#rrggbb/rrggbb) 또는 범위 밖 정수    [error]
//   PTL-BAD-GRAVITY      gravity 가 비수치                                        [error]
//   PTL-BAD-ANGLE        angle/spread 가 비수치 또는 spread 음수                  [error]
//   PTL-NONDETERMINISM   opts 값에 함수/시각함수/Math.random 등 비결정 표현       [error]
//   PTL-UNKNOWN-FIELD    burst 가 모르는 필드(오타 가능성)                        [warn]
//   PTL-NO-DESC          프리셋에 desc(설명) 없음                                 [warn]
//
// 사용:
//   node skills/wgf-game-qa/tools/lint-particles.mjs engine/particles.json
//   node skills/wgf-game-qa/tools/lint-particles.mjs <file> --json
//   node skills/wgf-game-qa/tools/lint-particles.mjs <file> --strict   (warn 도 실패로)
//
// 출력 계약: 사람용 라인들을 먼저 출력하고, **stdout 마지막 줄은 단일 JSON**:
//   {"ok":bool,"counts":{"error":n,"warn":n},"findings":[{rule,severity,preset,field,message}],"file":path}
// 종료코드: error 0건이면 0, 있으면 1 (--strict 면 warn 도 1).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
const add = (rule, severity, preset, field, message) =>
  findings.push({ rule, severity, preset, field, message })

function emit() {
  const counts = { error: 0, warn: 0 }
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1
  const ok = counts.error === 0 && (!strict || counts.warn === 0)
  if (!jsonOnly) {
    const icon = { error: '✗', warn: '⚠' }
    if (findings.length === 0) console.log('✓ lint-particles: 프리셋 데이터 이상 없음')
    else for (const f of findings)
      console.log(`${icon[f.severity] || '·'} [${f.rule}] ${f.preset || '-'}${f.field ? '.' + f.field : ''} — ${f.message}`)
    console.log(`— error ${counts.error} · warn ${counts.warn}`)
  }
  console.log(JSON.stringify({ ok, counts, findings, file: file || null }))
  process.exit(ok ? 0 : 1)
}

if (!file) {
  add('schema', 'error', null, null, '입력 파일 경로가 없습니다. 사용: node lint-particles.mjs engine/particles.json')
  emit()
}

let data
try {
  data = JSON.parse(readFileSync(resolve(file), 'utf8'))
} catch (e) {
  add('schema', 'error', null, null, `파일 읽기/파싱 실패: ${e.message}`)
  emit()
}

// burst() 가 인식하는 opts 필드 + 데이터 메타 필드.
const KNOWN_FIELDS = new Set(['count', 'speed', 'life', 'size', 'spread', 'angle', 'gravity', 'color', 'fade', 'desc'])

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// speed/life/size: 단일 수 또는 [min,max] 배열. 음수·역순·비수치 검사.
function checkRange(preset, field, v, allowZero) {
  let min, max
  if (isNum(v)) { min = max = v }
  else if (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])) { min = v[0]; max = v[1] }
  else { add('PTL-BAD-RANGE', 'error', preset, field, `수치 또는 [min,max] 배열이어야 합니다(현재: ${JSON.stringify(v)}).`); return null }
  if (min < 0 || max < 0) add('PTL-BAD-RANGE', 'error', preset, field, `음수 값은 허용되지 않습니다([${min}, ${max}]).`)
  if (min > max) add('PTL-BAD-RANGE', 'error', preset, field, `min 이 max 보다 큽니다([${min}, ${max}]).`)
  if (!allowZero && max <= 0) add('PTL-BAD-RANGE', 'error', preset, field, `0 이하만 가능하면 입자가 보이지 않습니다([${min}, ${max}]).`)
  return { min, max }
}

// color: '#rrggbb' / 'rrggbb' hex 문자열 또는 0x000000~0xffffff 정수.
function checkColor(preset, v) {
  if (typeof v === 'string') {
    const h = v.charAt(0) === '#' ? v.slice(1) : v
    if (!/^[0-9a-fA-F]{6}$/.test(h)) add('PTL-BAD-COLOR', 'error', preset, 'color', `잘못된 hex 색상 '${v}' — '#rrggbb' 형식이어야 합니다.`)
  } else if (isNum(v)) {
    if (!Number.isInteger(v) || v < 0 || v > 0xffffff) add('PTL-BAD-COLOR', 'error', preset, 'color', `색상 정수 범위 밖(0x000000~0xffffff): ${v}.`)
  } else {
    add('PTL-BAD-COLOR', 'error', preset, 'color', `색상은 '#rrggbb' 문자열 또는 0xRRGGBB 정수여야 합니다(현재: ${JSON.stringify(v)}).`)
  }
}

// 결정론: opts 값은 정적 데이터여야 함. JSON.parse 결과엔 함수가 없지만, 문자열에
// Math.random/Date.now/performance.now/() => 같은 표현이 박혀 있으면(잘못된 데이터) 잡는다.
const NONDET_RE = /(Math\s*\.\s*random|Date\s*\.\s*now|performance\s*\.\s*now|=>|function\s*\()/
function checkNondeterminism(preset, field, v) {
  if (typeof v === 'function') { add('PTL-NONDETERMINISM', 'error', preset, field, '함수 값은 결정론 검증 불가 — 정적 수치만 허용.'); return }
  if (typeof v === 'string' && NONDET_RE.test(v)) add('PTL-NONDETERMINISM', 'error', preset, field, `결정론 위반 표현이 데이터에 포함됨: '${v}'.`)
}

const presets = data && (data.presets || (data.version === undefined ? data : null))
if (!presets || typeof presets !== 'object' || Object.keys(presets).length === 0) {
  add('PTL-NO-PRESETS', 'error', null, null, 'presets 객체가 없거나 비어 있습니다.')
  emit()
}

for (const name of Object.keys(presets)) {
  const p = presets[name]
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    add('PTL-NO-PRESETS', 'error', name, null, '프리셋은 opts 객체여야 합니다.')
    continue
  }

  // 비결정 표현 + 미지 필드(오타) 스캔
  for (const k of Object.keys(p)) {
    checkNondeterminism(name, k, p[k])
    if (!KNOWN_FIELDS.has(k)) add('PTL-UNKNOWN-FIELD', 'warn', name, k, `burst 가 모르는 필드 — 오타 가능성(허용: ${[...KNOWN_FIELDS].join(', ')}).`)
  }

  if (p.desc === undefined) add('PTL-NO-DESC', 'warn', name, 'desc', '프리셋 설명(desc)이 없습니다.')

  // count: 정수 1..500
  if (p.count === undefined || !isNum(p.count)) add('PTL-BAD-COUNT', 'error', name, 'count', 'count 는 필수 정수입니다.')
  else if (!Number.isInteger(p.count) || p.count <= 0) add('PTL-BAD-COUNT', 'error', name, 'count', `count 는 1 이상 정수여야 합니다(현재: ${p.count}).`)
  else if (p.count > 500) add('PTL-BAD-COUNT', 'error', name, 'count', `count 가 과다합니다(>500): ${p.count} — 성능 위험.`)

  // speed/size: 음수·역순 검사(0 허용 — 제자리 입자)
  if (p.speed !== undefined) checkRange(name, 'speed', p.speed, true)
  if (p.size !== undefined) {
    const r = checkRange(name, 'size', p.size, false)
    if (r && r.max > 64) add('PTL-BAD-RANGE', 'warn', name, 'size', `size 가 큽니다(>64): ${r.max}.`)
  }

  // life: 양수, 과다(>10s) 차단
  if (p.life !== undefined) {
    const r = checkRange(name, 'life', p.life, false)
    if (r) {
      if (r.min <= 0) add('PTL-BAD-LIFE', 'error', name, 'life', `life 는 0 보다 커야 합니다(영구 입자 방지): [${r.min}, ${r.max}].`)
      if (r.max > 10) add('PTL-BAD-LIFE', 'error', name, 'life', `life 가 과다합니다(>10s): ${r.max}.`)
    }
  }

  // gravity: 수치(음수=상승 허용)
  if (p.gravity !== undefined && !isNum(p.gravity)) add('PTL-BAD-GRAVITY', 'error', name, 'gravity', `gravity 는 수치여야 합니다(현재: ${JSON.stringify(p.gravity)}).`)

  // angle/spread: 수치, spread 음수 금지
  if (p.angle !== undefined && !isNum(p.angle)) add('PTL-BAD-ANGLE', 'error', name, 'angle', `angle(rad) 은 수치여야 합니다(현재: ${JSON.stringify(p.angle)}).`)
  if (p.spread !== undefined) {
    if (!isNum(p.spread)) add('PTL-BAD-ANGLE', 'error', name, 'spread', `spread(rad) 은 수치여야 합니다(현재: ${JSON.stringify(p.spread)}).`)
    else if (p.spread < 0) add('PTL-BAD-ANGLE', 'error', name, 'spread', `spread 는 음수일 수 없습니다: ${p.spread}.`)
  }

  // color
  if (p.color !== undefined) checkColor(name, p.color)
}

emit()
