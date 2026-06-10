#!/usr/bin/env node
// lint-audio.mjs — sound-architect 오디오 스펙 정적 린터
// ─────────────────────────────────────────────────────────────────────────────
// games/<slug>/audio.json 을 읽어 설계-시 결함을 검출한다(런타임 무관, 설계 도구).
// 무의존성: Node 빌트인(fs/path)만 사용. npm install 불요. lint-items.mjs 컨벤션 준수.
//
// 검사 룰 그룹(consistency-tools.md 린트 체크리스트 a~h ↔ reference 원칙 코드):
//   a) schema       필수 필드·enum(engine/scale/preset/pattern/sfx.kind)·중복 id·티어 정합   (SoundForge 계약)
//   b) mood-scale   무드↔스케일/BPM 정합(무드 권장 스케일·BPM 범위 이탈)                     (MOOD-COHERENCE)
//   c) voice-budget 피크 동시 보이스 추정 > budget.maxVoices(모바일 폴리포니 예산)            (MIX-VOICE-BUDGET)
//   d) layer-reach  베드 레이어(minIntensity≤0) 존재·minIntensity 범위·도달 가능성            (ADAPT-LAYER-GATE)
//   e) preset-pat   드럼 프리셋↔드럼 패턴 / 멜로딕 프리셋↔멜로딕 패턴 정합                     (TIMBRE-FIT)
//   f) mix-sanity   master volume/limiter/reverb decay 안전 범위·헤드룸                       (MIX-HEADROOM)
//   g) cc0          오리지널리티 affirmation(originalityNote/original) + 인용 의심 필드 스캔   (CC0-ORIGINAL)
//
// 임계값은 하드코딩하지 않고 audio.json 의 balanceConfig 에서 읽는다(없으면 보수적 기본값).
//
// 사용:
//   node skills/wgf-sound-architect/tools/lint-audio.mjs games/<slug>/audio.json
//   node skills/wgf-sound-architect/tools/lint-audio.mjs --file games/<slug>/audio.json --json
//   node skills/wgf-sound-architect/tools/lint-audio.mjs <file> --strict   (warn 도 실패로)
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
    if (findings.length === 0) console.log('✓ lint-audio: 결함 없음')
    else for (const f of findings) console.log(`${icon[f.severity] || '·'} [${f.rule}] ${f.id ? f.id + ': ' : ''}${f.message}`)
    console.log(`— error ${counts.error} · warn ${counts.warn} · info ${counts.info}`)
  }
  console.log(JSON.stringify({ ok, counts, findings, file: file || null }))
  process.exit(ok ? 0 : 1)
}

// ── 로드 ─────────────────────────────────────────────────────────────────────
if (!file) {
  add('schema', 'error', null, '입력 파일 경로가 없습니다. 사용: node lint-audio.mjs games/<slug>/audio.json')
  emit()
}
let data
try {
  data = JSON.parse(readFileSync(resolve(file), 'utf8'))
} catch (e) {
  add('schema', 'error', null, `audio.json 읽기/파싱 실패: ${e.message}`)
  emit()
}

// ── enum / 무드 매핑 (reference 와 1:1 — 자세한 정의는 mood-music-theory.md) ──
const SCALES = ['major', 'ionian', 'minor', 'aeolian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'harmonic-minor', 'major-pentatonic', 'minor-pentatonic', 'whole-tone']
// SoundForge._makeInstrument 와 동일 enum
const PRESETS = ['square-lead', 'pulse-lead', 'triangle-bass', 'saw-bass', 'supersaw', 'fm-bell', 'fm-ep', 'pad', 'pluck', 'organ', 'kit', 'drums']
const PATTERNS = ['chords', 'root8', 'pulse', 'arp', 'offbeat', 'backbeat', 'four-floor']
const DRUM_PRESETS = new Set(['kit', 'drums'])
const DRUM_PATTERNS = new Set(['backbeat', 'four-floor'])
const SFX_KINDS = ['tone', 'fm', 'noise', 'boom', 'metal']
const ENGINES = ['soundforge', 'chip']
// 무드 → 권장 스케일 + BPM 범위(MOOD-* 매핑의 린트 코드화). 자세히는 mood-music-theory.md.
const MOODS = {
  'cheerful': { scales: ['major', 'ionian', 'major-pentatonic', 'mixolydian'], bpm: [115, 155] },
  'warm':     { scales: ['major', 'mixolydian', 'major-pentatonic'], bpm: [75, 115] },
  'melancholy': { scales: ['minor', 'aeolian', 'dorian'], bpm: [55, 95] },
  'tense':    { scales: ['phrygian', 'harmonic-minor', 'minor', 'locrian'], bpm: [135, 185] },
  'anxious':  { scales: ['locrian', 'whole-tone', 'phrygian'], bpm: [65, 105] },
  'calm':     { scales: ['major-pentatonic', 'minor-pentatonic', 'lydian', 'dorian'], bpm: [48, 88] },
  'heroic':   { scales: ['major', 'mixolydian', 'lydian'], bpm: [88, 135] },
  'mystic':   { scales: ['lydian', 'dorian', 'major-pentatonic', 'minor-pentatonic'], bpm: [65, 105] }
}

// ── balanceConfig 기본값(없으면 보수적 디폴트) ──────────────────────────────
const cfg = data.balanceConfig || {}
const maxVoices = (data.budget && data.budget.maxVoices) || cfg.maxVoices || 16
const maxReverbDecay = cfg.maxReverbDecay == null ? 4 : cfg.maxReverbDecay
const bpmTolerance = cfg.bpmTolerance == null ? 12 : cfg.bpmTolerance // 무드 BPM 범위 밖 허용 오차
const volMin = cfg.masterVolMin == null ? -24 : cfg.masterVolMin
const limiterMin = cfg.limiterMin == null ? -12 : cfg.limiterMin
// 프리셋별 추정 동시 보이스(폴리포니) — voice-budget 추정용
const PRESET_VOICES = { pad: 5, organ: 5, kit: 3, drums: 3, supersaw: 1, 'saw-bass': 1, 'square-lead': 1, 'pulse-lead': 1, 'triangle-bass': 1, 'fm-bell': 2, 'fm-ep': 2, pluck: 2 }

// ── (a) schema ───────────────────────────────────────────────────────────────
const meta = data.meta || {}
const tier = Number(meta.tier == null ? 1 : meta.tier)
const engine = meta.engine || 'soundforge'
if (data.version == null) add('schema', 'warn', null, 'version 누락(권장: 1)')
if (!ENGINES.includes(engine)) add('schema', 'error', null, `meta.engine "${engine}" 가 enum(${ENGINES.join('|')}) 밖`)
if (!(tier >= 0 && tier <= 3)) add('schema', 'error', null, `meta.tier ${meta.tier} 가 0~3 밖`)
if (!meta.mood) add('schema', 'warn', null, 'meta.mood 누락(무드 토큰 권장 — 무드가 스케일·BPM·악기를 프레이밍)')
else if (!MOODS[meta.mood]) add('schema', 'info', null, `meta.mood "${meta.mood}" 가 표준 무드(${Object.keys(MOODS).join('/')}) 밖 — 커스텀이면 무시`)

// chip 엔진(Tier 0)이면 BGM/SFX 스펙 검사 대부분 생략 — ChipAudio 가 처리
if (engine === 'chip' || tier === 0) {
  add('schema', 'info', null, 'engine=chip / tier 0 — ChipAudio 경량 경로. audio.json 상세 스펙 검사 생략.')
  emit()
}

const bgm = data.bgm || {}
const tracks = bgm.tracks || {}
const trackIds = Object.keys(tracks)
if (trackIds.length === 0) add('schema', tier >= 1 ? 'warn' : 'info', null, 'bgm.tracks 비어 있음(SoundForge 내장 기본 트랙으로 폴백).')
if (bgm.defaultTrack && !tracks[bgm.defaultTrack]) add('schema', 'error', 'bgm.defaultTrack', `defaultTrack "${bgm.defaultTrack}" 가 tracks 에 없음`)

// 트랙별 schema + 레이어 검사
for (const tid of trackIds) {
  const tr = tracks[tid]
  if (tr.scale && !SCALES.includes(tr.scale)) add('schema', 'error', tid, `scale "${tr.scale}" 가 enum 밖(${SCALES.slice(0, 6).join('/')}...)`)
  if (tr.bpm != null && (tr.bpm < 30 || tr.bpm > 240)) add('schema', 'warn', tid, `bpm ${tr.bpm} 가 비정상 범위(30~240)`)
  if (!Array.isArray(tr.progression) || tr.progression.length === 0) add('schema', 'warn', tid, 'progression 누락/빈 배열(코드 진행 권장)')
  const layers = Array.isArray(tr.layers) ? tr.layers : []
  if (layers.length === 0) add('schema', 'warn', tid, 'layers 비어 있음')
  const seenLayer = new Set()
  for (const L of layers) {
    const lid = `${tid}/${L.id || '?'}`
    if (!L.id) add('schema', 'error', tid, '레이어 id 누락')
    else if (seenLayer.has(L.id)) add('schema', 'error', lid, '레이어 id 중복')
    else seenLayer.add(L.id)
    if (!L.preset) add('schema', 'error', lid, 'preset 누락')
    else if (!PRESETS.includes(L.preset)) add('schema', 'error', lid, `preset "${L.preset}" 가 enum 밖(${PRESETS.join('|')})`)
    if (L.pattern && !PATTERNS.includes(L.pattern)) add('schema', 'error', lid, `pattern "${L.pattern}" 가 enum 밖(${PATTERNS.join('|')})`)
    // (e) preset-pattern 정합
    if (L.preset && L.pattern) {
      const isDrumP = DRUM_PRESETS.has(L.preset), isDrumPat = DRUM_PATTERNS.has(L.pattern)
      if (isDrumP && !isDrumPat) add('preset-pat', 'warn', lid, `드럼 프리셋(${L.preset})에 멜로딕 패턴(${L.pattern}) — backbeat/four-floor 권장`)
      if (!isDrumP && isDrumPat) add('preset-pat', 'warn', lid, `멜로딕 프리셋(${L.preset})에 드럼 패턴(${L.pattern}) — kit/drums 프리셋이어야 발음됨`)
    }
  }

  // (b) mood-scale 정합
  const mood = tr.mood || meta.mood
  if (mood && MOODS[mood] && tr.scale) {
    if (!MOODS[mood].scales.includes(tr.scale)) add('mood-scale', 'warn', tid, `무드 "${mood}" 권장 스케일(${MOODS[mood].scales.join('/')})과 다른 "${tr.scale}" — 의도면 무시, 아니면 정합 검토`)
    if (tr.bpm != null) {
      const [lo, hi] = MOODS[mood].bpm
      if (tr.bpm < lo - bpmTolerance || tr.bpm > hi + bpmTolerance) add('mood-scale', 'warn', tid, `BPM ${tr.bpm} 가 무드 "${mood}" 범위(${lo}~${hi}±${bpmTolerance}) 밖`)
    }
  }

  // (c) voice-budget — 같은 시점 활성 가능한 레이어들의 추정 보이스 합 + SFX 헤드룸
  let peak = 0
  for (const L of layers) peak += (PRESET_VOICES[L.preset] || 1)
  const sfxHeadroom = 4
  if (peak + sfxHeadroom > maxVoices) add('voice-budget', 'warn', tid, `추정 피크 보이스 ${peak}(레이어) + ${sfxHeadroom}(SFX) > maxVoices ${maxVoices} — 모바일 폴리포니 예산 초과 위험(레이어 축소 또는 maxVoices 상향)`)

  // (d) layer-reach — 베드(minIntensity≤0) 존재 + 범위
  let hasBed = false
  for (const L of layers) {
    const mi = L.minIntensity == null ? 0 : L.minIntensity
    if (mi <= 0) hasBed = true
    if (mi < 0 || mi > 1) add('layer-reach', 'warn', `${tid}/${L.id}`, `minIntensity ${mi} 가 [0,1] 밖`)
    if (mi > 1) add('layer-reach', 'error', `${tid}/${L.id}`, `minIntensity ${mi} > 1 — 도달 불가(영원히 묵음)`)
  }
  if (layers.length && !hasBed) add('layer-reach', 'warn', tid, '인텐시티 0에서 울리는 베드 레이어(minIntensity≤0)가 없음 — 낮은 강도에서 무음. 패드/베이스 1개를 베드로.')
}

// sections 무결성
const sections = bgm.sections || {}
for (const s of Object.keys(sections)) {
  if (!tracks[sections[s]]) add('schema', 'error', `section/${s}`, `섹션 "${s}" 가 가리키는 트랙 "${sections[s]}" 없음`)
}

// sfx 검사
const sfx = data.sfx || {}
for (const name of Object.keys(sfx)) {
  const s = sfx[name]
  const layers = s.layers || [s]
  if (!Array.isArray(layers) || layers.length === 0) { add('schema', 'warn', `sfx/${name}`, 'sfx 레이어 비어 있음'); continue }
  for (const L of layers) {
    if (L.kind && !SFX_KINDS.includes(L.kind)) add('schema', 'error', `sfx/${name}`, `kind "${L.kind}" 가 enum 밖(${SFX_KINDS.join('|')})`)
  }
}

// ── (f) mix-sanity ───────────────────────────────────────────────────────────
const m = data.master || {}
if (m.volume != null && (m.volume > 0 || m.volume < volMin)) add('mix-sanity', 'warn', 'master.volume', `master.volume ${m.volume}dB 가 [${volMin},0] 밖`)
if (m.limiter != null && (m.limiter > 0 || m.limiter < limiterMin)) add('mix-sanity', 'warn', 'master.limiter', `limiter ${m.limiter}dB 가 [${limiterMin},0] 밖(클리핑/과압축)`)
if (m.reverb && m.reverb.decay != null && m.reverb.decay > maxReverbDecay) add('mix-sanity', 'warn', 'master.reverb', `reverb.decay ${m.reverb.decay}s > ${maxReverbDecay}s — 모바일 CPU 부담(ConvolverNode 비쌈)`)

// ── (g) cc0 — 오리지널리티 affirmation + 인용 의심 필드 ──────────────────────
const hasOriginality = data.original === true || meta.originalityNote || data.originalityNote
if (!hasOriginality) add('cc0', 'warn', null, '오리지널리티 명시 없음 — meta.originalityNote("절차 합성 오리지널, 어떤 곡도 인용 안 함") 또는 "original": true 추가 권장(CC0 보증)')
const SUSPECT = /(mario|zelda|tetris|sonic|pokemon|pokémon|final ?fantasy|theme of|메인테마|오프닝테마)/i
const blob = JSON.stringify(data)
let mm
const seenSus = new Set()
const re = new RegExp(SUSPECT.source, 'ig')
while ((mm = re.exec(blob)) !== null) { if (!seenSus.has(mm[0].toLowerCase())) { seenSus.add(mm[0].toLowerCase()); add('cc0', 'warn', null, `상용 곡 인용 의심 문자열 "${mm[0]}" 발견 — 특정 곡 멜로디/진행 인용 금지(오리지널 재구성)`) } }

emit()
