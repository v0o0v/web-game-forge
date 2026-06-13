#!/usr/bin/env node
// lint-juice.mjs — juicekit intensity cap 정적 린터 (광과민·모바일 성능 가드)
// ─────────────────────────────────────────────────────────────────────────────
// games/**/*.js 등 juicekit 사용 코드를 정적 스캔해 game-feel "juice" 강도 초과를 검출한다.
//
// 검사 룰:
//   JUICE-TRAUMA-RANGE      addTrauma(x) x > 1.0  → trauma 범위 초과·과다 누적        [error]
//   JUICE-BURST-COUNT       burst(..., {count:x}) x > 200  → 모바일 60fps 파티클 예산 [error]
//   JUICE-FREEZE-DURATION   freeze(x) x > 30  → 0.5s 이상 게임 정지(UX 파괴)         [error]
//   JUICE-SHAKE-OFFSET      maxOffset = x, x > 60  → 광과민·멀미 위험                [warn]
//   JUICE-SHAKE-ROTATION    maxRotation = x, x > 0.25  → 과도한 화면 회전(멀미)      [warn]
//
// 임계값 근거:
//   - addTrauma: JuiceKit API 명세상 [0,1] clamp — 1.0 초과는 계산 의미 없음(error)
//   - burst count > 200: 모바일 Safari/WebView 60fps 유지 예산. 파티클 1개당 JS obj+draw 비용
//     합산 시 200개 이상이면 단일 프레임 스파이크 위험(iOS/Android 실기 측정 기반 경험값)
//   - freeze > 30frames: 30프레임 = 0.5s @60fps. WCAG 2.3.3 Animation from Interactions
//     권고(0.5s 이상 완전 정지는 접근성·UX 위반 수준)
//   - maxOffset > 60px: W3C WCAG 2.3 광과민 가이드(Flash/motion 임계). 24px 기본값 기준
//     2.5배(60px) 초과 시 멀미·광과민 위험 구간 진입
//   - maxRotation > 0.25rad (≈14.3°): 평형 감각 자극 임계. 화면 회전 0.08rad 기본의 3배
//     이상은 멀미 유발 가능성 높음
//
// 억제: 해당 라인에 `juice-ok` 주석을 달면 그 라인은 건너뛴다.
// 주석(// 와 /* */)은 매칭에서 제외한다.
//
// 사용:
//   node skills/wgf-game-qa/tools/lint-juice.mjs games/<slug>/game.js
//   node skills/wgf-game-qa/tools/lint-juice.mjs <file> --json
//   node skills/wgf-game-qa/tools/lint-juice.mjs <file> --strict   (warn 도 실패로)
//   node skills/wgf-game-qa/tools/lint-juice.mjs --self-test
//
// 출력 계약: 사람용 라인들을 먼저 출력하고, **stdout 마지막 줄은 단일 JSON**:
//   {"ok":bool,"counts":{"error":n,"warn":n},"findings":[{rule,severity,line,col,message,text}],"file":path}
// 종료코드: error 0건이면 0, 있으면 1 (--strict 면 warn 도 1).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

const argv = process.argv.slice(2)
let file = null
let jsonOnly = false
let strict = false
let selfTest = false
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--json') jsonOnly = true
  else if (a === '--strict') strict = true
  else if (a === '--self-test') selfTest = true
  else if (a === '--file') file = argv[++i]
  else if (!a.startsWith('--')) file = a
}

const findings = []
const add = (rule, severity, line, col, message, text) =>
  findings.push({ rule, severity, line, col, message, text })

function emit(overrideFile) {
  const f = overrideFile !== undefined ? overrideFile : file
  const counts = { error: 0, warn: 0 }
  for (const fi of findings) counts[fi.severity] = (counts[fi.severity] || 0) + 1
  const ok = counts.error === 0 && (!strict || counts.warn === 0)
  if (!jsonOnly) {
    const icon = { error: '✗', warn: '⚠' }
    if (findings.length === 0) console.log('✓ lint-juice: intensity cap 위반 없음')
    else for (const fi of findings)
      console.log(`${icon[fi.severity] || '·'} [${fi.rule}] ${f}:${fi.line}:${fi.col} — ${fi.message}`)
    console.log(`— error ${counts.error} · warn ${counts.warn}`)
  }
  console.log(JSON.stringify({ ok, counts, findings, file: f || null }))
  process.exit(ok ? 0 : 1)
}

// ── self-test ────────────────────────────────────────────────────────────────
if (selfTest) {
  runSelfTest()
  process.exit(0)
}

if (!file) {
  add('schema', 'error', 0, 0, '입력 파일 경로가 없습니다. 사용: node lint-juice.mjs games/<slug>/game.js')
  emit()
}

let src
try { src = readFileSync(resolve(file), 'utf8') }
catch (e) { add('schema', 'error', 0, 0, `파일 읽기 실패: ${e.message}`); emit() }

// 주석 제거(공백으로 치환해 컬럼 보존). 블록주석은 줄 경계를 넘어 추적한다.
function stripComments(text) {
  let out = ''
  let inBlock = false, inLine = false
  let inStr = false, quote = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1], prev = text[i - 1]
    if (inLine) { if (c === '\n') { inLine = false; out += c } else out += ' '; continue }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; out += '  '; i++ } else out += (c === '\n' ? '\n' : ' '); continue }
    if (inStr) { out += c; if (c === quote && prev !== '\\') inStr = false; continue }
    if (c === '/' && n === '/') { inLine = true; out += ' '; continue }
    if (c === '/' && n === '*') { inBlock = true; out += ' '; continue }
    if (c === '"' || c === "'" || c === '`') { inStr = true; quote = c; out += c; continue }
    out += c
  }
  return out
}

// ── 규칙 정의 ────────────────────────────────────────────────────────────────
// 각 규칙은 { rule, severity, re, extract(match) → number|null, threshold, message } 형태.
// extract 가 null 이면 패턴 매칭 자체가 위반(threshold 무관).
// extract 가 함수면 캡처 값이 threshold 초과 시 위반.

const RULES = [
  {
    rule: 'JUICE-TRAUMA-RANGE',
    severity: 'error',
    // addTrauma( 다음 숫자 리터럴 캡처. 변수 참조는 정적 검출 불가라 리터럴만 대상.
    re: /addTrauma\s*\(\s*([\d.]+)\s*\)/g,
    extract: (m) => parseFloat(m[1]),
    threshold: 1.0,
    message: (v) => `addTrauma(${v}) — trauma 는 [0,1] 범위. 1.0 초과 누적은 무의미하며 연속 호출 시 과다 셰이크 유발.`
  },
  {
    rule: 'JUICE-BURST-COUNT',
    severity: 'error',
    // burst(x, y, { count: N, ... }) — count 키 캡처. 쉼표/공백 허용.
    re: /burst\s*\([^)]*\bcount\s*:\s*([\d]+)/g,
    extract: (m) => parseInt(m[1], 10),
    threshold: 200,
    message: (v) => `burst count:${v} — 200 초과 파티클은 모바일 60fps 단일 프레임 예산 초과(JS+draw 스파이크).`
  },
  {
    rule: 'JUICE-FREEZE-DURATION',
    severity: 'error',
    // freeze( N ) — 숫자 리터럴 캡처.
    re: /freeze\s*\(\s*([\d]+)\s*\)/g,
    extract: (m) => parseInt(m[1], 10),
    threshold: 30,
    message: (v) => `freeze(${v}) — ${v}프레임 정지(${(v/60).toFixed(2)}s). 30프레임(0.5s) 초과는 WCAG 2.3 접근성 위반 수준.`
  },
  {
    rule: 'JUICE-SHAKE-OFFSET',
    severity: 'warn',
    // jk.maxOffset = N  또는 this.maxOffset = N (juicekit 인스턴스 프로퍼티 직접 설정)
    re: /maxOffset\s*=\s*([\d.]+)/g,
    extract: (m) => parseFloat(m[1]),
    threshold: 60,
    message: (v) => `maxOffset=${v} — 60px 초과 셰이크는 광과민(WCAG 2.3)·멀미 위험 구간. 기본값 24px 권장.`
  },
  {
    rule: 'JUICE-SHAKE-ROTATION',
    severity: 'warn',
    // jk.maxRotation = N
    re: /maxRotation\s*=\s*([\d.]+)/g,
    extract: (m) => parseFloat(m[1]),
    threshold: 0.25,
    message: (v) => `maxRotation=${v}rad(≈${(v*180/Math.PI).toFixed(1)}°) — 0.25rad 초과 화면 회전은 멀미 유발 가능. 기본값 0.08rad 권장.`
  }
]

const cleaned = stripComments(src)
const lines = cleaned.split('\n')
const rawLines = src.split('\n')

for (let li = 0; li < lines.length; li++) {
  if (/juice-ok/i.test(rawLines[li] || '')) continue   // 라인 억제
  for (const r of RULES) {
    r.re.lastIndex = 0
    let m
    while ((m = r.re.exec(lines[li])) !== null) {
      const val = r.extract(m)
      if (val === null || val <= r.threshold) continue
      add(r.rule, r.severity, li + 1, m.index + 1, r.message(val), (rawLines[li] || '').trim().slice(0, 120))
    }
  }
}

emit()

// ── self-test ────────────────────────────────────────────────────────────────
function runSelfTest() {
  const LINTER = resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
  const node = process.execPath

  // fixture 소스
  const VIOLATION_SRC = `
// 위반 fixture — 모든 규칙이 경고/에러를 내야 한다
jk.addTrauma(1.5);                        // JUICE-TRAUMA-RANGE: 1.5 > 1.0
jk.burst(100, 200, { count: 250 });       // JUICE-BURST-COUNT: 250 > 200
jk.freeze(45);                            // JUICE-FREEZE-DURATION: 45 > 30
jk.maxOffset = 80;                        // JUICE-SHAKE-OFFSET: 80 > 60  [warn]
jk.maxRotation = 0.5;                     // JUICE-SHAKE-ROTATION: 0.5 > 0.25  [warn]
`

  const OK_SRC = `
// 정상 fixture — 임계값 이하, 위반 없어야 한다
jk.addTrauma(0.8);                        // OK: 0.8 <= 1.0
jk.burst(100, 200, { count: 150 });       // OK: 150 <= 200
jk.freeze(10);                            // OK: 10 <= 30
jk.maxOffset = 24;                        // OK: 24 <= 60  [warn 아님]
jk.maxRotation = 0.08;                    // OK: 0.08 <= 0.25  [warn 아님]
`

  const SUPPRESSED_SRC = `
// 억제 fixture — juice-ok 주석이 있으면 무시
jk.addTrauma(2.0); // juice-ok
jk.burst(100, 200, { count: 999 }); // juice-ok
jk.freeze(60); // juice-ok
`

  const dir = join(tmpdir(), 'lint-juice-selftest-' + Date.now())
  mkdirSync(dir, { recursive: true })

  const vFile = join(dir, 'violation.js')
  const oFile = join(dir, 'ok.js')
  const sFile = join(dir, 'suppressed.js')
  writeFileSync(vFile, VIOLATION_SRC, 'utf8')
  writeFileSync(oFile, OK_SRC, 'utf8')
  writeFileSync(sFile, SUPPRESSED_SRC, 'utf8')

  let pass = true
  const results = []

  function run(label, filePath, expectExit) {
    let exitCode = 0
    let output = ''
    try {
      output = execSync(`${JSON.stringify(node)} ${JSON.stringify(LINTER)} ${JSON.stringify(filePath)} --json`, { encoding: 'utf8' })
    } catch (e) {
      exitCode = e.status || 1
      output = e.stdout || ''
    }
    // stdout 마지막 줄에서 JSON 추출
    const lastLine = output.trim().split('\n').pop()
    let parsed = null
    try { parsed = JSON.parse(lastLine) } catch (_) {}

    const ok = exitCode === expectExit
    if (!ok) pass = false
    results.push({ label, expectExit, actualExit: exitCode, ok, counts: parsed?.counts ?? null })
    console.log(`${ok ? '✓' : '✗'} [self-test] ${label}: exit=${exitCode}(expected ${expectExit})${parsed ? ` counts=${JSON.stringify(parsed.counts)}` : ''}`)
    return { exitCode, parsed }
  }

  // 1) 위반 fixture → exit 1 (error 있음)
  run('위반-fixture', vFile, 1)

  // 2) 정상 fixture → exit 0
  run('정상-fixture', oFile, 0)

  // 3) 억제(juice-ok) fixture → exit 0
  run('억제-fixture', sFile, 0)

  // 4) --strict 모드: 정상 fixture(warn 없음) → exit 0
  {
    let exitCode = 0
    try {
      execSync(`${JSON.stringify(node)} ${JSON.stringify(LINTER)} ${JSON.stringify(oFile)} --strict --json`, { encoding: 'utf8' })
    } catch (e) { exitCode = e.status || 1 }
    const ok = exitCode === 0
    if (!ok) pass = false
    results.push({ label: '--strict-정상', expectExit: 0, actualExit: exitCode, ok })
    console.log(`${ok ? '✓' : '✗'} [self-test] --strict-정상: exit=${exitCode}(expected 0)`)
  }

  // 5) --strict 모드: warn-only fixture → exit 1
  const WARN_SRC = `jk.maxOffset = 80;\njk.maxRotation = 0.5;\n`
  const wFile = join(dir, 'warn-only.js')
  writeFileSync(wFile, WARN_SRC, 'utf8')
  {
    let exitCode = 0
    try {
      execSync(`${JSON.stringify(node)} ${JSON.stringify(LINTER)} ${JSON.stringify(wFile)} --strict --json`, { encoding: 'utf8' })
    } catch (e) { exitCode = e.status || 1 }
    const ok = exitCode === 1
    if (!ok) pass = false
    results.push({ label: '--strict-warn-only', expectExit: 1, actualExit: exitCode, ok })
    console.log(`${ok ? '✓' : '✗'} [self-test] --strict-warn-only: exit=${exitCode}(expected 1)`)
  }

  console.log(`\n— self-test ${pass ? '전체 통과' : '실패 있음'}: ${results.filter(r=>r.ok).length}/${results.length}`)
  process.exit(pass ? 0 : 1)
}
