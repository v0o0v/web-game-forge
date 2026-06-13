#!/usr/bin/env node
// qa-score.mjs — BH/VU/IA 3축 QA 품질 점수 리포트 (web-game-builder)
// ─────────────────────────────────────────────────────────────────────────────
// 게임 하나에 대해 세 축 품질 점수를 산출한다. 순수 계산은 qa-score-core.mjs(헤드리스·
// 결정적)가 담당하고, 이 파일은 *입력을 뽑아오는 캡처 어댑터* 다:
//
//   BH (Build Health)     — lint 도구(rng/juice/particles/kit-deps)를 자식 프로세스로
//                           돌려 마지막 줄 JSON 을 회수 + (선택) 콘솔에러·step결과 주입.
//   VU (Visual Usability) — 게임 프레임 픽셀을 받아 검은화면·정지를 감지. 픽셀은 헤드리스
//                           직접 캡처가 불가하므로(아래 한계), 외부에서 캡처한 프레임 JSON
//                           (--frames)을 먹이거나, 없으면 인터페이스만 두고 한계를 표시.
//   IA (Intent Alignment) — 요구 스펙(--spec/--require/바이블)을 산출물(game.js+index.html)
//                           텍스트와 대조.
//
// ── VU 헤드리스 캡처 한계(정직 명시) ──────────────────────────────────────────
//   Node 헤드리스에는 WebGL/canvas 픽셀을 신뢰성 있게 뽑을 경로가 없다. 메모리 교훈:
//   "스크린샷이 진실, CDP evaluate 는 컨텍스트 플래핑·프로브 고정값 함정". 따라서 실게임
//   픽셀 VU 는 *외부 캡처 단계*(chrome-devtools take_screenshot 또는 브라우저에서
//   canvas.getImageData)에서 프레임 픽셀을 떠 JSON 으로 저장하고, 이 도구에 --frames 로
//   먹인다. (juicekit/screenfx 가 WebGL 시각을 한계로 둔 것과 동형 — 코어는 완전 검증,
//   실게임 픽셀 캡처는 어댑터 경계.) --frames 없이 실행하면 VU 는 skipped 로 표시되고
//   3축 ok 게이트에서 VU 는 중립 처리된다(거짓 통과·거짓 실패 방지).
//
// 사용:
//   node skills/wgf-game-qa/tools/qa-score.mjs <game-slug-or-dir>
//   node skills/wgf-game-qa/tools/qa-score.mjs games/super-runner
//   node skills/wgf-game-qa/tools/qa-score.mjs super-runner --require "coin,jump,score"
//   node skills/wgf-game-qa/tools/qa-score.mjs super-runner --spec spec.json
//   node skills/wgf-game-qa/tools/qa-score.mjs super-runner --frames frames.json
//   node skills/wgf-game-qa/tools/qa-score.mjs super-runner --runtime runtime.json
//   node skills/wgf-game-qa/tools/qa-score.mjs super-runner --json
//
//   --require "a,b,c"  쉼표 구분 요구 키워드(스펙 인라인 주입)
//   --spec <file>      { "require":[...], "optional":[...] } JSON 스펙 파일
//   --frames <file>    [ [r,g,b,a, ...], [...], ... ] 프레임 픽셀 배열들(외부 캡처)
//                      또는 { "channels":n, "frames":[...] }
//   --runtime <file>   { "consoleErrors":n, "stepFrames":n, "stepTarget":n,
//                        "stepCrashed":bool } 런타임 캡처 결과(없으면 보수적 기본).
//   --threshold <n>    3축 ok 임계(기본 60)
//   --json             사람용 라인 생략, JSON 만(마지막 줄 계약은 동일)
//
// 출력 계약: 사람용 라인들 먼저, 마지막 줄 단일 JSON:
//   {"ok":bool,"bh":n,"vu":n,"ia":n, ...}
// 종료코드: ok 면 0, 아니면 1.
//
// 결정성: Math.random/Date.now/performance.now 미사용(점수 계산). 자식 lint 도 결정적.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, basename } from 'node:path'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

import { vuScore, bhScore, iaScore, toLuminance, specFromBible, composeReport } from './qa-score-core.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)   // 향후 엔진 모듈 직접 require 시 사용(snapshot.mjs 패턴 정합)
const repoRoot = resolve(here, '../../..')       // skills/wgf-game-qa/tools → repo 루트
const engineDir = resolve(here, '../../../engine')

// ── 인자 파싱 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
let target = null
let jsonOnly = false
let requireInline = null
let specFile = null
let framesFile = null
let runtimeFile = null
let threshold = 60
let requireVu = false   // --require-vu: VU skipped 를 게이트 실패로 처리
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--json') jsonOnly = true
  else if (a === '--require') requireInline = argv[++i]
  else if (a === '--spec') specFile = argv[++i]
  else if (a === '--frames') framesFile = argv[++i]
  else if (a === '--runtime') runtimeFile = argv[++i]
  else if (a === '--require-vu') requireVu = true
  else if (a === '--threshold') { const t = parseInt(argv[++i], 10); threshold = Number.isFinite(t) ? t : 60 }
  else if (!a.startsWith('--')) target = a
}

// 사람용 출력 게이트
const say = (...args) => { if (!jsonOnly) console.log(...args) }

/** 치명 오류 → 마지막 줄 JSON 계약 유지하고 exit 1. */
function bail(message) {
  say(`✗ ${message}`)
  console.log(JSON.stringify({ ok: false, bh: 0, vu: 0, ia: 0, error: message }))
  process.exit(1)
}

if (!target) bail('대상 게임이 없습니다. 사용: node qa-score.mjs <game-slug-or-dir>')

// ── 게임 디렉터리 해석 ────────────────────────────────────────────────────────
// 인자는 슬러그(super-runner) 또는 경로(games/super-runner). 둘 다 repo 기준으로 해석.
function resolveGameDir(t) {
  const candidates = [
    resolve(repoRoot, t),
    resolve(repoRoot, 'games', t),
    resolve(process.cwd(), t)
  ]
  for (const c of candidates) {
    try { if (statSync(c).isDirectory()) return c } catch (e) { /* 다음 후보 */ }
  }
  return null
}

const gameDir = resolveGameDir(target)
if (!gameDir) bail(`게임 디렉터리를 찾을 수 없습니다: ${target}`)
const slug = basename(gameDir)
const gameJs = join(gameDir, 'game.js')
const indexHtml = join(gameDir, 'index.html')

if (!existsSync(gameJs)) bail(`game.js 가 없습니다: ${gameJs}`)

say(`# QA 3축 점수 — ${slug}`)
say(`  게임 디렉터리: ${gameDir}`)

// ════════════════════════════════════════════════════════════════════════════
// BH — lint 자식 프로세스 + 런타임(콘솔/step) 캡처
// ════════════════════════════════════════════════════════════════════════════

/** lint 도구를 자식 프로세스로 실행하고 마지막 줄 JSON 을 파싱한다. */
function runLint(toolFile, lintArgs) {
  const toolPath = join(here, toolFile)
  if (!existsSync(toolPath)) return { ok: false, errors: 1, warnings: 0, missing: true }
  const r = spawnSync(process.execPath, [toolPath, ...lintArgs, '--json'], {
    encoding: 'utf8',
    cwd: repoRoot
  })
  const out = (r.stdout || '').trim().split('\n')
  const last = out[out.length - 1] || ''
  try {
    const j = JSON.parse(last)
    const counts = j.counts || {}
    return { ok: j.ok === true, errors: counts.error | 0, warnings: counts.warn | 0 }
  } catch (e) {
    // 파싱 실패 → 비정상으로 보수 처리(점수에 반영)
    return { ok: false, errors: 1, warnings: 0, parseError: true }
  }
}

say('')
say('## BH (Build Health) — lint · 콘솔 · 크래시')

// lint-rng 는 게임 game.js 대상, 나머지는 엔진/데이터 대상(헤더 명세 준수).
const lints = []
lints.push(Object.assign({ id: 'rng' }, runLint('lint-rng.mjs', [gameJs])))
lints.push(Object.assign({ id: 'juice' }, runLint('lint-juice.mjs', [gameJs])))

// particles: 게임별 particles.json 우선, 없으면 엔진 기본 particles.json.
const gameParticles = join(gameDir, 'particles.json')
const engineParticlesPath = join(engineDir, 'particles.json')
if (existsSync(gameParticles)) {
  lints.push(Object.assign({ id: 'particles' }, runLint('lint-particles.mjs', [gameParticles])))
} else if (existsSync(engineParticlesPath)) {
  lints.push(Object.assign({ id: 'particles' }, runLint('lint-particles.mjs', [engineParticlesPath])))
}
// kit-deps: 엔진 매니페스트 대상(기본 경로 자동).
lints.push(Object.assign({ id: 'kit-deps' }, runLint('lint-kit-deps.mjs', [])))

for (const l of lints) {
  const mark = l.ok ? '✓' : '✗'
  const extra = l.missing ? ' (도구 없음)' : l.parseError ? ' (출력 파싱 실패)' : ''
  say(`  ${mark} lint-${l.id}: error ${l.errors} · warn ${l.warnings}${extra}`)
}

// 런타임(콘솔 에러·step 크래시) — 헤드리스 직접 캡처 불가하므로 외부 주입(--runtime).
// 미주입 시 기본: 콘솔 0 + step 미수행(stepTarget=0 → crashTerm 평가에서 reach=0 회피)
//   → 보수적으로 "step 측정 안 됨"을 명시하되 BH 가 과대평가되지 않게 stepTarget 도 미설정.
//   여기서는 stepTarget 을 주지 않으면 코어가 1 로 보정하고 stepFrames 0 이면 reach=0 →
//   crashTerm=0 으로 BH 가 깎인다. 이는 의도된 보수성(측정 안 했으면 만점 주지 않음).
let runtime = { consoleErrors: 0, stepFrames: 0, stepTarget: 0, stepCrashed: false, measured: false }
if (runtimeFile) {
  try {
    const r = JSON.parse(readFileSync(resolve(runtimeFile), 'utf8'))
    runtime = {
      consoleErrors: r.consoleErrors | 0,
      stepFrames: r.stepFrames | 0,
      stepTarget: r.stepTarget | 0,
      stepCrashed: !!r.stepCrashed,
      measured: true
    }
  } catch (e) {
    bail(`--runtime 파일 파싱 실패: ${e.message}`)
  }
}

const bh = bhScore({
  lints,
  consoleErrors: runtime.consoleErrors,
  stepFrames: runtime.stepFrames,
  stepTarget: runtime.measured ? runtime.stepTarget : 0,
  stepCrashed: runtime.stepCrashed
})

if (!runtime.measured) {
  say('  ⚠ 런타임(콘솔에러·step무크래시) 미측정 — --runtime <file> 로 주입 가능(미주입 시 보수 감점).')
}
say(`  → BH ${bh.bh}/100  [lint ${bh.lintTerm} · console ${bh.consoleTerm} · crash ${bh.crashTerm}]`)
if (bh.flags.length) say(`    flags: ${bh.flags.join(' · ')}`)

// ════════════════════════════════════════════════════════════════════════════
// VU — 프레임 픽셀(외부 캡처) 검은화면·정지 감지
// ════════════════════════════════════════════════════════════════════════════
say('')
say('## VU (Visual Usability) — 프레임 엔트로피 · 모션')

let vu = null
let vuSkipped = false
if (framesFile) {
  let parsed
  try { parsed = JSON.parse(readFileSync(resolve(framesFile), 'utf8')) }
  catch (e) { bail(`--frames 파일 파싱 실패: ${e.message}`) }

  // 형식: 배열(프레임들) 또는 { channels, frames }
  let rawFrames, channels
  if (Array.isArray(parsed)) { rawFrames = parsed; channels = 4 }
  else { rawFrames = parsed.frames || []; channels = parsed.channels || 4 }

  if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
    bail('--frames 에 프레임이 없습니다(빈 배열).')
  }
  // 각 프레임 픽셀 배열 → 휘도 배열
  const lumFrames = rawFrames.map(px => toLuminance(px, channels))
  vu = vuScore(lumFrames)
  say(`  프레임 ${vu.frames}장 · 평균엔트로피 ${vu.avgEntropy} · 모션활성 ${vu.motionRatio} · 검은비율 ${vu.blackRatio}`)
  say(`  → VU ${vu.vu}/100`)
  if (vu.flags.length) say(`    flags: ${vu.flags.join(' · ')}`)
} else {
  vuSkipped = true
  say('  ⚠ VU skipped — 헤드리스에서 canvas/WebGL 픽셀 직접 캡처 불가.')
  say('    외부 캡처 경로: 브라우저에서 canvas.getImageData() 또는 chrome-devtools')
  say('    take_screenshot 으로 프레임을 떠 JSON 으로 저장 후 --frames <file> 로 주입.')
  say('    (순수 코어는 test-qa-score.mjs 로 완전 검증됨 — 어댑터 경계만 헤드리스 한계.)')
}

// ════════════════════════════════════════════════════════════════════════════
// IA — 요구 스펙 vs 산출물 텍스트
// ════════════════════════════════════════════════════════════════════════════
say('')
say('## IA (Intent Alignment) — 요구 스펙 vs 산출물')

// 산출물 텍스트: game.js + index.html(있으면) 이어붙임.
const artifactParts = [readFileSync(gameJs, 'utf8')]
if (existsSync(indexHtml)) artifactParts.push(readFileSync(indexHtml, 'utf8'))

// 스펙 소스 우선순위: --spec > --require > 바이블(STORY/STYLE/AUDIO.md) > 없음(중립).
let spec = { require: [] }
let specSource = 'none'
if (specFile) {
  try {
    const s = JSON.parse(readFileSync(resolve(specFile), 'utf8'))
    spec = { require: Array.isArray(s.require) ? s.require : [], optional: Array.isArray(s.optional) ? s.optional : [] }
    specSource = `spec:${basename(specFile)}`
  } catch (e) {
    bail(`--spec 파일 파싱 실패: ${e.message}`)
  }
} else if (requireInline) {
  spec = { require: requireInline.split(',').map(s => s.trim()).filter(Boolean) }
  specSource = 'require(inline)'
} else {
  // 바이블 자동 탐지(드묾): STORY.md > STYLE.md > AUDIO.md.
  const bibleNames = ['STORY.md', 'STYLE.md', 'AUDIO.md']
  for (const name of bibleNames) {
    const p = join(gameDir, name)
    if (existsSync(p)) {
      spec = specFromBible(readFileSync(p, 'utf8'))
      specSource = `bible:${name}`
      break
    }
  }
}

const ia = iaScore(spec, artifactParts)
say(`  스펙 소스: ${specSource} · 요구 ${ia.total}개`)
if (ia.total > 0) {
  say(`  충족 ${ia.matched.length}/${ia.total} · 누락 ${ia.missing.length}`)
  if (ia.missing.length) say(`  누락 항목: ${ia.missing.join(', ')}`)
} else {
  say('  요구 스펙 미주입 — IA 중립(100). --require/--spec/바이블로 의도 대조 활성화.')
}
say(`  → IA ${ia.ia}/100`)

// ════════════════════════════════════════════════════════════════════════════
// 3축 합성 + 출력 계약
// ════════════════════════════════════════════════════════════════════════════
// VU skipped 처리:
//   기본(--require-vu 없음): ok 게이트에서 VU 를 중립(임계 충족)으로 처리 — 거짓 실패 방지.
//   --require-vu 모드:       VU skipped 를 게이트 실패(ok:false)로 간주 — 시각 미검증을 차단.
const vuForGate = vuSkipped
  ? (requireVu ? { vu: -1 } : { vu: threshold })  // -1 은 임계 미달을 확실히 보장
  : vu
const report = composeReport({ bh, vu: vuForGate, ia }, { threshold })

say('')
say('## 종합')
if (vuSkipped) {
  say('  ⚠ VU 미검증 — 시각 통과 보장 안 함. --frames <file> 로 픽셀 주입해야 VU 게이트 활성화.')
  if (requireVu) say('  ✗ --require-vu 모드: VU skipped → 게이트 실패(ok:false) 처리')
}
say(`  BH ${bh.bh} · VU ${vuSkipped ? 'skipped' : vu.vu} · IA ${ia.ia}  (임계 ${threshold})`)
say(`  ${report.ok ? '✓ 통과' : '✗ 미달'} — 3축${vuSkipped && !requireVu ? '(VU 미검증 중립)' : ''} 모두 임계 이상이어야 통과`)

// 마지막 줄 단일 JSON — vu 는 skipped 면 null.
const out = {
  ok: report.ok,
  bh: bh.bh,
  vu: vuSkipped ? null : vu.vu,
  ia: ia.ia,
  threshold,
  slug,
  vuSkipped,
  specSource,
  detail: {
    bh: { lintTerm: bh.lintTerm, consoleTerm: bh.consoleTerm, crashTerm: bh.crashTerm, failedLints: bh.failedLints, flags: bh.flags },
    vu: vuSkipped ? null : { avgEntropy: vu.avgEntropy, motionRatio: vu.motionRatio, blackRatio: vu.blackRatio, frames: vu.frames, flags: vu.flags },
    ia: { matched: ia.matched.length, missing: ia.missing, total: ia.total, flags: ia.flags }
  }
}
console.log(JSON.stringify(out))
process.exit(report.ok ? 0 : 1)
