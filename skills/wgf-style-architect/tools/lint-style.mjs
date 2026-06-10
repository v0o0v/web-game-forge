#!/usr/bin/env node
// lint-style.mjs — style-architect 비주얼 아트 스타일 정적 린터
// ─────────────────────────────────────────────────────────────────────────────
// games/<slug>/style.json 을 읽어 설계-시 비주얼 결함을 검출한다(런타임 무관, 설계 도구).
// 무의존성: Node 빌트인(fs/path)만 사용. lint-abilities.mjs / lint-items.mjs 컨벤션 준수.
//
// 검사 룰:
//   a) schema          필수 필드·enum·hex 유효성·참조 무결성
//   b) palette-contrast WCAG 상대휘도 근사로 전경/배경·역할색 대비 < min_contrast_ratio
//   c) dead-token      미참조 ramp/role_color 경고
//   d) medium-match    style.json.medium ↔ 인접 game.js/index.html render.pixelArt 교차 D7
//   e) role-collision  player/enemy/danger/pickup 색 근접 혼동
//   f) preset-exists   lighting/postfx.preset·mood 알려진 집합/presets 스캔
//   g) ip-redword      키·mood·slug·문자열에 lintConfig.ip_redwords 등장
//   h) palette-size    총 색 > max_palette_colors 경고
//
// 임계값은 style.json 의 lintConfig 에서 읽는다(없으면 보수적 기본값).
//
// 사용:
//   node skills/wgf-style-architect/tools/lint-style.mjs games/<slug>/style.json
//   node skills/wgf-style-architect/tools/lint-style.mjs --file <path> --json
//   node skills/wgf-style-architect/tools/lint-style.mjs <file> --strict   (warn 도 실패로)
//
// 출력 계약: 사람용 라인들을 먼저 출력하고, **stdout 마지막 줄은 단일 JSON**:
//   {"ok":bool,"counts":{"error":n,"warn":n,"info":n},"findings":[{rule,severity,id,message}],"file":path}
// 종료코드: error 0건이면 0, 있으면 1 (--strict 면 warn 도 1).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'

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
    if (findings.length === 0) console.log('✓ lint-style: 결함 없음')
    else for (const f of findings) console.log(`${icon[f.severity] || '·'} [${f.rule}] ${f.id ? f.id + ': ' : ''}${f.message}`)
    console.log(`— error ${counts.error} · warn ${counts.warn} · info ${counts.info}`)
  }
  console.log(JSON.stringify({ ok, counts, findings, file: file || null }))
  process.exit(ok ? 0 : 1)
}

// ── 로드 ─────────────────────────────────────────────────────────────────────
if (!file) { add('schema', 'error', null, '입력 파일 경로가 없습니다. 사용: node lint-style.mjs games/<slug>/style.json'); emit() }
let data
try { data = JSON.parse(readFileSync(resolve(file), 'utf8')) }
catch (e) { add('schema', 'error', null, `style.json 읽기/파싱 실패: ${e.message}`); emit() }

// ── lintConfig 기본값 ─────────────────────────────────────────────────────────
const cfg = data.lintConfig || {}
const MIN_CONTRAST_RATIO = cfg.min_contrast_ratio == null ? 3.0 : Number(cfg.min_contrast_ratio)
const MAX_PALETTE_COLORS = cfg.max_palette_colors == null ? 48 : Number(cfg.max_palette_colors)
const IP_REDWORDS = Array.isArray(cfg.ip_redwords) ? cfg.ip_redwords.map((w) => w.toLowerCase()) : [
  'gungeon', 'enter the gungeon', 'mario', 'zelda', 'isaac', 'metroid'
]
// 역할색 근접 혼동 허용 최대 CIEDE 근사 거리(작을수록 엄격)
const ROLE_COLLISION_THRESHOLD = cfg.role_collision_threshold == null ? 25 : Number(cfg.role_collision_threshold)

// 알려진 mood 프리셋 집합(프리셋 스캔 전 기본)
const KNOWN_MOODS = new Set(cfg.known_moods || [
  'cozy-dungeon', 'neon-city', 'haunted-forest', 'sunny-meadow',
  'ice-cave', 'lava-world', 'desert-temple', 'ocean-depths',
  'custom'
])
// 알려진 postfx preset 집합
const KNOWN_POSTFX_PRESETS = new Set(cfg.known_postfx_presets || [
  'warm-dungeon', 'cold-night', 'sepia', 'neon-glow', 'natural',
  'horror', 'retro', 'custom'
])
// 알려진 lighting preset 집합
const KNOWN_LIGHTING_PRESETS = new Set(cfg.known_lighting_presets || [
  'torch', 'moonlight', 'sunlight', 'neon', 'candle', 'overcast', 'custom'
])
// medium enum
const MEDIUM_ENUM = ['pixel', 'vector']
// shading.model enum
const SHADING_MODEL_ENUM = ['cell', 'soft', 'flat']
// line.outline enum
const LINE_OUTLINE_ENUM = ['none', 'selective', 'full']

// ── 유틸: hex 파싱 ────────────────────────────────────────────────────────────
function parseHex(hex) {
  // "#rrggbb" 또는 "#rrggbbaa" 형식 지원
  if (typeof hex !== 'string') return null
  const m = hex.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/)
  if (!m) return null
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  const a = m[2] ? parseInt(m[2], 16) : 255
  return { r, g, b, a }
}

function isValidHex(hex) {
  return parseHex(hex) !== null
}

// ── 유틸: WCAG 상대휘도 + 대비비 계산 ─────────────────────────────────────────
// WCAG 2.1 상대휘도 공식(sRGB 선형화)
function relativeLuminance(r, g, b) {
  function chan(c) {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
}

function contrastRatio(hex1, hex2) {
  const c1 = parseHex(hex1)
  const c2 = parseHex(hex2)
  if (!c1 || !c2) return null
  const l1 = relativeLuminance(c1.r, c1.g, c1.b)
  const l2 = relativeLuminance(c2.r, c2.g, c2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── 유틸: 색 거리 근사(RGB 유클리드 — 역할 혼동 검사용) ──────────────────────
function colorDistance(hex1, hex2) {
  const c1 = parseHex(hex1)
  const c2 = parseHex(hex2)
  if (!c1 || !c2) return Infinity
  const dr = c1.r - c2.r, dg = c1.g - c2.g, db = c1.b - c2.b
  // 가중 RGB 거리(인간 시각 근사)
  const rMean = (c1.r + c2.r) / 2
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db)
}

// ── 유틸: IP 적색어 검사(재귀 문자열 탐색) ────────────────────────────────────
function containsRedword(val, redwords) {
  if (typeof val === 'string') {
    const lower = val.toLowerCase()
    return redwords.filter((w) => lower.includes(w))
  }
  if (Array.isArray(val)) return val.flatMap((v) => containsRedword(v, redwords))
  if (val && typeof val === 'object') return Object.values(val).flatMap((v) => containsRedword(v, redwords))
  return []
}

// ── (g) ip-redword: 전체 스캔 먼저(slug/mood/키 전체) ────────────────────────
// slug 체크
const slugHits = data.slug ? containsRedword(data.slug, IP_REDWORDS) : []
if (slugHits.length) add('ip-redword', 'error', 'slug', `slug "${data.slug}" 에 IP 적색어 포함: ${[...new Set(slugHits)].join(', ')}`)

// mood 체크
const moodHits = data.mood ? containsRedword(data.mood, IP_REDWORDS) : []
if (moodHits.length) add('ip-redword', 'error', 'mood', `mood "${data.mood}" 에 IP 적색어 포함: ${[...new Set(moodHits)].join(', ')}`)

// 전체 문자열 재귀 탐색(키 이름 포함) — lintConfig·slug·mood 는 최상위에서 이미 처리했거나 메타 섹션이므로 제외
const REDWORD_SKIP_KEYS = new Set(['lintConfig', 'slug', 'mood'])
function deepRedwordScan(obj, path, redwords) {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj)) {
    const curPath = path ? `${path}.${k}` : k
    // 메타 섹션 및 최상위 별도 처리 키 스캔 제외
    if (REDWORD_SKIP_KEYS.has(k)) continue
    // 키 자체 검사
    const keyHits = containsRedword(k, redwords)
    if (keyHits.length) add('ip-redword', 'warn', curPath, `키 "${k}" 에 IP 적색어 포함: ${[...new Set(keyHits)].join(', ')}`)
    // 값 검사
    if (typeof v === 'string') {
      const vHits = containsRedword(v, redwords)
      if (vHits.length) add('ip-redword', 'warn', curPath, `값 "${v}" 에 IP 적색어 포함: ${[...new Set(vHits)].join(', ')}`)
    } else if (v && typeof v === 'object') {
      deepRedwordScan(v, curPath, redwords)
    }
  }
}
deepRedwordScan(data, '', IP_REDWORDS)

// ── (a) schema: 필수 필드·enum 검사 ─────────────────────────────────────────
// 필수 최상위 필드
const REQUIRED_TOP = ['slug', 'schema_version', 'medium', 'master_palette', 'role_colors']
for (const field of REQUIRED_TOP) {
  if (data[field] == null) add('schema', 'error', field, `필수 필드 "${field}" 누락`)
}

// schema_version
if (data.schema_version != null && typeof data.schema_version !== 'number') {
  add('schema', 'error', 'schema_version', `schema_version 은 숫자여야 합니다(받은 값: ${JSON.stringify(data.schema_version)})`)
}

// medium enum
if (data.medium != null && !MEDIUM_ENUM.includes(data.medium)) {
  add('schema', 'error', 'medium', `medium "${data.medium}" 가 enum(${MEDIUM_ENUM.join('|')}) 밖`)
}

// tier 범위(0..3)
if (data.tier != null) {
  const t = Number(data.tier)
  if (!Number.isInteger(t) || t < 0 || t > 3) add('schema', 'warn', 'tier', `tier ${data.tier} 는 0..3 범위여야 합니다`)
}

// shading.model enum
if (data.shading && data.shading.model != null && !SHADING_MODEL_ENUM.includes(data.shading.model)) {
  add('schema', 'error', 'shading.model', `shading.model "${data.shading.model}" 가 enum(${SHADING_MODEL_ENUM.join('|')}) 밖`)
}

// line.outline enum
if (data.line && data.line.outline != null && !LINE_OUTLINE_ENUM.includes(data.line.outline)) {
  add('schema', 'error', 'line.outline', `line.outline "${data.line.outline}" 가 enum(${LINE_OUTLINE_ENUM.join('|')}) 밖`)
}

// ── hex 유효성 검사 헬퍼 ─────────────────────────────────────────────────────
function checkHex(val, label) {
  if (val == null) return
  // "darker-of-fill" 같은 키워드는 허용
  if (typeof val === 'string' && !val.startsWith('#')) return
  if (!isValidHex(val)) add('schema', 'error', label, `"${val}" 은(는) 유효한 hex 색상이 아닙니다(#rrggbb 또는 #rrggbbaa)`)
}

// master_palette hex 검사
if (data.master_palette) {
  const mp = data.master_palette
  // background
  checkHex(mp.background, 'master_palette.background')
  // neutrals
  if (mp.neutrals) {
    for (const [k, v] of Object.entries(mp.neutrals)) checkHex(v, `master_palette.neutrals.${k}`)
  }
  // ramps: 각 램프는 hex 배열
  if (mp.ramps) {
    for (const [rampName, ramp] of Object.entries(mp.ramps)) {
      if (!Array.isArray(ramp)) {
        add('schema', 'error', `master_palette.ramps.${rampName}`, '램프는 hex 배열이어야 합니다')
        continue
      }
      if (ramp.length < 2) add('schema', 'warn', `master_palette.ramps.${rampName}`, '램프는 최소 2단계 이상 권장합니다')
      ramp.forEach((c, i) => checkHex(c, `master_palette.ramps.${rampName}[${i}]`))
    }
  }
}

// role_colors hex 검사
if (data.role_colors) {
  for (const [k, v] of Object.entries(data.role_colors)) checkHex(v, `role_colors.${k}`)
}

// lighting hex 검사
if (data.lighting) {
  const lt = data.lighting
  if (lt.ambient) checkHex(lt.ambient.color, 'lighting.ambient.color')
  if (lt.point_lights) checkHex(lt.point_lights.color, 'lighting.point_lights.color')
}

// canvas_fallback hex 검사
if (data.canvas_fallback) {
  checkHex(data.canvas_fallback.ambient_overlay, 'canvas_fallback.ambient_overlay')
}

// ── (b) palette-contrast: WCAG 상대휘도 대비 검사 ──────────────────────────
const bg = data.master_palette && data.master_palette.background

if (bg && isValidHex(bg)) {
  // 역할색 vs 배경 대비
  if (data.role_colors) {
    for (const [role, color] of Object.entries(data.role_colors)) {
      if (!isValidHex(color)) continue
      const ratio = contrastRatio(color, bg)
      if (ratio !== null && ratio < MIN_CONTRAST_RATIO) {
        add('palette-contrast', 'warn', `role_colors.${role}`,
          `역할색 "${role}"(${color}) vs 배경(${bg}) 대비비 ${ratio.toFixed(2)} < ${MIN_CONTRAST_RATIO} — HUD·UI 가독성 저하`)
      }
    }
  }

  // neutrals vs 배경 대비(white/black)
  if (data.master_palette && data.master_palette.neutrals) {
    for (const [k, v] of Object.entries(data.master_palette.neutrals)) {
      if (!isValidHex(v)) continue
      const ratio = contrastRatio(v, bg)
      if (ratio !== null && ratio < MIN_CONTRAST_RATIO) {
        add('palette-contrast', 'info', `master_palette.neutrals.${k}`,
          `중성색 "${k}"(${v}) vs 배경(${bg}) 대비비 ${ratio.toFixed(2)} < ${MIN_CONTRAST_RATIO}`)
      }
    }
  }

  // 램프 최상단(가장 밝은 색) vs 배경 대비
  if (data.master_palette && data.master_palette.ramps) {
    for (const [rampName, ramp] of Object.entries(data.master_palette.ramps)) {
      if (!Array.isArray(ramp) || ramp.length === 0) continue
      const topColor = ramp[ramp.length - 1]
      if (!isValidHex(topColor)) continue
      const ratio = contrastRatio(topColor, bg)
      if (ratio !== null && ratio < MIN_CONTRAST_RATIO) {
        add('palette-contrast', 'info', `master_palette.ramps.${rampName}`,
          `램프 "${rampName}" 최상단(${topColor}) vs 배경(${bg}) 대비비 ${ratio.toFixed(2)} < ${MIN_CONTRAST_RATIO}`)
      }
    }
  }
}

// ── (c) dead-token: 미참조 ramp/role_color 경고 ──────────────────────────────
// 수집: 전체 style.json 에서 ramp 키와 role_colors 키가 다른 곳에서 참조되는지 검사
// 단순 문자열 존재 검사(참조는 shading·line·비주얼 기술에서 발생)
function collectAllStrings(obj) {
  const strs = new Set()
  function walk(v) {
    if (typeof v === 'string') strs.add(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(obj)
  return strs
}

// ramp dead-token: ramp 는 게임 코드 StyleKit.palette 매핑·visual.* 슬롯에서 외부 참조되므로
// style.json 내부 미참조는 신호가치가 낮음 → info 로만 안내(warn 하지 않음)
if (data.master_palette && data.master_palette.ramps) {
  for (const rampName of Object.keys(data.master_palette.ramps)) {
    // ramp 이름이 style.json 내부 다른 곳에서 참조되는지 계산(master_palette.ramps 키 자체는 count=1)
    let count = 0
    function countOccurrence(obj, target) {
      if (typeof obj === 'string') { if (obj === target) count++ }
      else if (Array.isArray(obj)) obj.forEach((v) => countOccurrence(v, target))
      else if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (k === target) count++
          countOccurrence(v, target)
        }
      }
    }
    countOccurrence(data, rampName)
    // style.json 내부 참조 없음 → info(게임 코드/visual.*에서 외부 참조 가능 — 미사용 의심만)
    if (count <= 1) {
      add('dead-token', 'info', `master_palette.ramps.${rampName}`,
        `램프 "${rampName}" 이 style.json 내부에서 참조되지 않음 — 게임 코드/visual.*에서 외부 참조 가능, 미사용 의심만`)
    }
  }
}

// role_colors dead-token: 표준 역할(player/enemy/danger/pickup/ui_accent)은 생략, 커스텀 키만 검사
const STANDARD_ROLES = new Set(['player', 'enemy', 'danger', 'pickup', 'ui_accent'])
if (data.role_colors) {
  const allStrs = collectAllStrings(data)
  for (const roleName of Object.keys(data.role_colors)) {
    if (STANDARD_ROLES.has(roleName)) continue
    let count = 0
    function countRoleOccurrence(obj, target) {
      if (typeof obj === 'string') { if (obj === target) count++ }
      else if (Array.isArray(obj)) obj.forEach((v) => countRoleOccurrence(v, target))
      else if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (k === target) count++
          countRoleOccurrence(v, target)
        }
      }
    }
    countRoleOccurrence(data, roleName)
    if (count <= 1) {
      add('dead-token', 'info', `role_colors.${roleName}`,
        `커스텀 역할색 "${roleName}" 이 다른 곳에서 참조되지 않음 — dead-token 후보`)
    }
  }
}

// ── (d) medium-match: style.json.medium ↔ 인접 game.js/index.html render.pixelArt ──
// 같은 games/<slug>/ 디렉터리의 game.js, index.html 에서 render.pixelArt 를 탐색
if (data.medium) {
  const styleDir = dirname(resolve(file))
  const candidates = [
    join(styleDir, 'game.js'),
    join(styleDir, 'index.html'),
    join(styleDir, 'src', 'game.js'),
  ]
  let foundMediumMismatch = false
  for (const cand of candidates) {
    if (!existsSync(cand)) continue
    let src
    try { src = readFileSync(cand, 'utf8') } catch { continue }
    // render.pixelArt: true / false / "pixelArt": true 패턴 탐색
    const matchTrue = /pixelArt\s*:\s*true/i.test(src)
    const matchFalse = /pixelArt\s*:\s*false/i.test(src)
    if (matchTrue && data.medium !== 'pixel') {
      add('medium-match', 'warn', 'medium',
        `${cand} 에서 pixelArt:true 발견이지만 style.json.medium="${data.medium}" — D7 불일치`)
      foundMediumMismatch = true
    } else if (matchFalse && data.medium === 'pixel') {
      add('medium-match', 'warn', 'medium',
        `${cand} 에서 pixelArt:false 발견이지만 style.json.medium="pixel" — D7 불일치`)
      foundMediumMismatch = true
    }
  }
  // 인접 파일을 못 찾으면 info
  const anyFound = candidates.some((c) => existsSync(c))
  if (!anyFound) {
    add('medium-match', 'info', 'medium',
      `인접 game.js/index.html 을 찾을 수 없어 render.pixelArt 교차 검증 건너뜀(D7)`)
  }
}

// ── (e) role-collision: player/enemy/danger/pickup 색 근접 혼동 ───────────────
// 게임플레이 핵심 역할색 쌍 검사
const CRITICAL_ROLE_PAIRS = [
  ['player', 'enemy'],
  ['player', 'danger'],
  ['enemy', 'danger'],
  ['danger', 'pickup'],
  ['player', 'pickup'],
]
if (data.role_colors) {
  for (const [r1, r2] of CRITICAL_ROLE_PAIRS) {
    const c1 = data.role_colors[r1]
    const c2 = data.role_colors[r2]
    if (!c1 || !c2) continue
    if (!isValidHex(c1) || !isValidHex(c2)) continue
    const dist = colorDistance(c1, c2)
    if (dist < ROLE_COLLISION_THRESHOLD) {
      add('role-collision', 'error', `role_colors.${r1}+${r2}`,
        `역할색 "${r1}"(${c1}) ↔ "${r2}"(${c2}) 색 거리 ${dist.toFixed(1)} < ${ROLE_COLLISION_THRESHOLD} — 시각 혼동 위험(게임플레이 피드백 손상)`)
    }
  }
}

// ── (f) preset-exists: lighting/postfx.preset·mood 알려진 집합 검사 ─────────
// 스킬 자체 presets 폴더에서 알려진 프리셋 동적 확장
// (게임 로컬 presets/ 우선 + 이 스크립트 기준 reference/presets — 입력 파일 위치와 무관하게 동작)
const { readdirSync } = await import('node:fs')
const { fileURLToPath } = await import('node:url')
const presetsSearchDirs = [
  join(dirname(resolve(file)), 'presets'),
  join(dirname(fileURLToPath(import.meta.url)), '..', 'reference', 'presets'),
]
for (const dir of presetsSearchDirs) {
  if (existsSync(dir)) {
    try {
      for (const f of readdirSync(dir)) {
        const name = f.replace(/\.(json|yaml|yml)$/, '')
        KNOWN_MOODS.add(name)
        KNOWN_POSTFX_PRESETS.add(name)
      }
    } catch {}
  }
}

// mood 검사
if (data.mood != null && !KNOWN_MOODS.has(data.mood)) {
  add('preset-exists', 'warn', 'mood', `mood "${data.mood}" 가 알려진 프리셋 집합에 없음(커스텀이면 "custom"으로 명시)`)
}

// postfx.preset 검사
if (data.postfx && data.postfx.preset != null && !KNOWN_POSTFX_PRESETS.has(data.postfx.preset)) {
  add('preset-exists', 'warn', 'postfx.preset', `postfx.preset "${data.postfx.preset}" 가 알려진 집합에 없음`)
}

// lighting.preset 검사(직접 preset 필드 있을 때)
if (data.lighting && data.lighting.preset != null && !KNOWN_LIGHTING_PRESETS.has(data.lighting.preset)) {
  add('preset-exists', 'warn', 'lighting.preset', `lighting.preset "${data.lighting.preset}" 가 알려진 집합에 없음`)
}

// ── (h) palette-size: 총 색 수 > max_palette_colors ──────────────────────────
const allColors = new Set()
function collectColors(obj) {
  if (typeof obj === 'string' && isValidHex(obj)) {
    // #rrggbbaa → #rrggbb 로 정규화(불투명도 무시)
    allColors.add(obj.slice(0, 7).toLowerCase())
  } else if (Array.isArray(obj)) {
    obj.forEach(collectColors)
  } else if (obj && typeof obj === 'object') {
    Object.values(obj).forEach(collectColors)
  }
}
collectColors(data)
if (allColors.size > MAX_PALETTE_COLORS) {
  add('palette-size', 'warn', null,
    `총 색 수 ${allColors.size} > max_palette_colors ${MAX_PALETTE_COLORS} — 팔레트 과다(렌더 비용·아트 일관성 저하)`)
}

emit()
