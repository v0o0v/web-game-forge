#!/usr/bin/env node
// lint-juice.mjs — juicekit intensity cap 정적 린터 (광과민·모바일 성능 가드)
// ─────────────────────────────────────────────────────────────────────────────
// games/**/*.js 등 juicekit 사용 코드를 정적 스캔해 game-feel "juice" 강도 초과를 검출한다.
//
// 검사 룰:
//   JUICE-TRAUMA-RANGE      addTrauma(x) x > 1.0  → trauma 범위 초과·과다 누적        [error]
//   JUICE-BURST-COUNT       burst(..., {count:x}) x > 200  → 모바일 60fps 파티클 예산 [error]
//   JUICE-FREEZE-DURATION   freeze(x) x > 30  → 0.5s 이상 게임 정지(UX 파괴)         [error]
//   JUICE-SHAKE-OFFSET      maxOffset = x, x > 60  → 광과민·멀미 위험                [warn / 안전 룰]
//   JUICE-SHAKE-ROTATION    maxRotation = x, x > 0.25  → 과도한 화면 회전(멀미)      [warn / 안전 룰]
//
// 임계값 근거:
//   - addTrauma: JuiceKit API 명세상 [0,1] clamp — 1.0 초과는 계산 의미 없음(error)
//   - burst count > 200: 모바일 Safari/WebView 60fps 유지 예산. 파티클 1개당 JS obj+draw 비용
//     합산 시 200개 이상이면 단일 프레임 스파이크 위험(iOS/Android 실기 측정 기반 경험값)
//   - freeze > 30frames: 30프레임 = 0.5s @60fps. WCAG 2.3.3 Animation from Interactions
//     권고(0.5s 이상 완전 정지는 접근성·UX 위반 수준)
//   - maxOffset > 60px: W3C WCAG 2.3 광과민 가이드(Flash/motion 임계). 24px 기본값 기준
//     2.5배(60px) 초과 시 멀미·광과민 위험 구간 진입  ← 안전 룰
//   - maxRotation > 0.25rad (≈14.3°): 평형 감각 자극 임계. 화면 회전 0.08rad 기본의 3배
//     이상은 멀미 유발 가능성 높음  ← 안전 룰
//
// 억제(suppresssion) 규칙:
//   juice-ok:<RULE-ID>  형태만 해당 단일 룰을 억제한다.
//     예) jk.burst(0, 0, { count: 300 }); // juice-ok:JUICE-BURST-COUNT
//   룰 ID 없는 `juice-ok` 단독 주석은 비안전 warn 룰만 억제하지 않으며,
//   error 룰 및 광과민 안전 룰(JUICE-SHAKE-OFFSET, JUICE-SHAKE-ROTATION)은 절대 억제되지 않는다.
//   이유: 광과민·접근성 룰을 라인 하나로 전체 무력화해 안전 심사를 우회하는 것을 방지.
//
// 한계(정적 분석 한계):
//   - 멀티라인 인자(burst(x,y,{\n  count:250\n})), 변수 경유, 동적 계산은 검출 불가.
//     단일 라인 숫자 리터럴만 대상. 멀티라인·변수 경유 위반은 헤드리스 런타임 검증으로 보완.
//   - 동일 프레임 반복 addTrauma 폭주(addTrauma 여러 번 연속 호출)는 라인 단위 스캔이므로
//     단일 호출 값만 체크. 누적 합산 검사는 런타임 검증 범위.
//
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
// --self-test 는 사람용 요약으로 끝남(JSON 출력 계약 예외 — 마지막 줄 비-JSON).
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

// ── 억제 판단 ─────────────────────────────────────────────────────────────────
// 안전 룰(SAFE_RULES): juice-ok 단독으로 억제 불가. juice-ok:<RULE-ID> 형태만 허용.
// 비안전 룰: juice-ok:<RULE-ID> 형태만 허용(단독 juice-ok는 어떤 룰도 억제 안 함).
// 설계 의도: 모든 억제는 룰 ID 명시 필수. 단독 juice-ok는 효과 없음(문서화된 "lint-rng 방식"과의
//   차별점 — juice 는 광과민 안전 룰이 포함되므로 더 엄격한 억제 문법 적용).
const SAFE_RULES = new Set(['JUICE-SHAKE-OFFSET', 'JUICE-SHAKE-ROTATION'])

// rawLine 에서 억제된 룰 ID 집합을 반환한다.
// juice-ok:<RULE-ID> 형태만 인식. 단독 juice-ok 는 빈 Set 반환(어떤 룰도 억제 안 함).
function getSuppressedRules(rawLine) {
  const suppressed = new Set()
  // juice-ok:RULE-ID 패턴 — 대소문자 무관(룰 ID는 대문자지만 관용적 허용)
  const ruleIdRe = /juice-ok\s*:\s*([A-Za-z][A-Za-z0-9-]*)/gi
  let m
  while ((m = ruleIdRe.exec(rawLine)) !== null) {
    suppressed.add(m[1].toUpperCase())
  }
  return suppressed
}

// ── 규칙 정의 ────────────────────────────────────────────────────────────────
// 각 규칙은 { rule, severity, re, extract(match) → number|null, threshold, message } 형태.
// extract 가 함수면 캡처 값이 threshold 초과 시 위반.
// \b 단어 경계로 부분단어 오탐(fooaddTrauma, myObj.freezeState 등) 방지.

const RULES = [
  {
    rule: 'JUICE-TRAUMA-RANGE',
    severity: 'error',
    // \b 로 부분단어 오탐 방지. 숫자 리터럴(정수·소수) 캡처.
    re: /\baddTrauma\s*\(\s*([\d.]+)\s*\)/g,
    extract: (m) => parseFloat(m[1]),
    threshold: 1.0,
    message: (v) => `addTrauma(${v}) — trauma 는 [0,1] 범위. 1.0 초과 누적은 무의미하며 연속 호출 시 과다 셰이크 유발.`
  },
  {
    rule: 'JUICE-BURST-COUNT',
    severity: 'error',
    // burst(x, y, { count: N, ... }) — count 키 캡처. \b 단어 경계 + 정수 리터럴.
    re: /\bburst\s*\([^)]*\bcount\s*:\s*([\d]+)/g,
    extract: (m) => parseInt(m[1], 10),
    threshold: 200,
    message: (v) => `burst count:${v} — 200 초과 파티클은 모바일 60fps 단일 프레임 예산 초과(JS+draw 스파이크).`
  },
  {
    rule: 'JUICE-FREEZE-DURATION',
    severity: 'error',
    // freeze( N ) — 숫자 리터럴(정수·소수) 캡처. parseFloat 사용으로 freeze(40.5) 도 검출.
    re: /\bfreeze\s*\(\s*([\d.]+)\s*\)/g,
    extract: (m) => parseFloat(m[1]),
    threshold: 30,
    message: (v) => `freeze(${v}) — ${v}프레임 정지(${(v/60).toFixed(2)}s). 30프레임(0.5s) 초과는 WCAG 2.3 접근성 위반 수준.`
  },
  {
    rule: 'JUICE-SHAKE-OFFSET',
    severity: 'warn',
    // jk.maxOffset = N 또는 this.maxOffset = N. \b 단어 경계.
    re: /\bmaxOffset\s*=\s*([\d.]+)/g,
    extract: (m) => parseFloat(m[1]),
    threshold: 60,
    message: (v) => `maxOffset=${v} — 60px 초과 셰이크는 광과민(WCAG 2.3)·멀미 위험 구간. 기본값 24px 권장.`
  },
  {
    rule: 'JUICE-SHAKE-ROTATION',
    severity: 'warn',
    // jk.maxRotation = N. \b 단어 경계.
    re: /\bmaxRotation\s*=\s*([\d.]+)/g,
    extract: (m) => parseFloat(m[1]),
    threshold: 0.25,
    message: (v) => `maxRotation=${v}rad(≈${(v*180/Math.PI).toFixed(1)}°) — 0.25rad 초과 화면 회전은 멀미 유발 가능. 기본값 0.08rad 권장.`
  }
]

const cleaned = stripComments(src)
const lines = cleaned.split('\n')
const rawLines = src.split('\n')

for (let li = 0; li < lines.length; li++) {
  const rawLine = rawLines[li] || ''
  const suppressed = getSuppressedRules(rawLine)

  for (const r of RULES) {
    // 억제 적용: juice-ok:<RULE-ID> 로 명시된 경우에만 해당 룰 건너뜀.
    // 안전 룰(SAFE_RULES)은 룰 ID 명시 없이는 절대 억제되지 않음.
    if (suppressed.has(r.rule)) continue

    r.re.lastIndex = 0
    let m
    while ((m = r.re.exec(lines[li])) !== null) {
      const val = r.extract(m)
      if (val === null || val <= r.threshold) continue
      add(r.rule, r.severity, li + 1, m.index + 1, r.message(val), rawLine.trim().slice(0, 120))
    }
  }
}

emit()

// ── self-test ────────────────────────────────────────────────────────────────
function runSelfTest() {
  const LINTER = resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
  const node = process.execPath

  // ── fixture 소스 ────────────────────────────────────────────────────────────

  // 위반 fixture — error 3건 + warn 2건
  const VIOLATION_SRC = `
// 위반 fixture — 모든 규칙이 경고/에러를 내야 한다
jk.addTrauma(1.5);                        // JUICE-TRAUMA-RANGE: 1.5 > 1.0
jk.burst(100, 200, { count: 250 });       // JUICE-BURST-COUNT: 250 > 200
jk.freeze(45);                            // JUICE-FREEZE-DURATION: 45 > 30
jk.maxOffset = 80;                        // JUICE-SHAKE-OFFSET: 80 > 60  [warn]
jk.maxRotation = 0.5;                     // JUICE-SHAKE-ROTATION: 0.5 > 0.25  [warn]
`

  // 정상 fixture — 임계값 이하
  const OK_SRC = `
// 정상 fixture — 임계값 이하, 위반 없어야 한다
jk.addTrauma(0.8);                        // OK: 0.8 <= 1.0
jk.burst(100, 200, { count: 150 });       // OK: 150 <= 200
jk.freeze(10);                            // OK: 10 <= 30
jk.maxOffset = 24;                        // OK: 24 <= 60
jk.maxRotation = 0.08;                    // OK: 0.08 <= 0.25
`

  // 억제(룰ID 명시) fixture — juice-ok:<RULE-ID> 형태만 억제
  const SUPPRESSED_RULEID_SRC = `
// 억제 fixture — juice-ok:<RULE-ID> 형태로 각 룰 억제
jk.addTrauma(2.0); // juice-ok:JUICE-TRAUMA-RANGE
jk.burst(100, 200, { count: 999 }); // juice-ok:JUICE-BURST-COUNT
jk.freeze(60); // juice-ok:JUICE-FREEZE-DURATION
`

  // 단독 juice-ok 안전 룰 미억제 fixture — 광과민 룰은 단독 juice-ok 로 꺼지면 안 됨
  // maxOffset=999 에 단독 juice-ok → warn 이 남아야 함(exit 0, counts.warn >= 1)
  const NAKED_JUICEOK_SAFE_SRC = `
// 단독 juice-ok 는 안전 룰(광과민) 을 억제하지 못한다
jk.maxOffset = 999; // juice-ok
jk.maxRotation = 0.9; // juice-ok
`

  // 단독 juice-ok error 룰 미억제 fixture — error 룰도 단독 juice-ok 로 꺼지면 안 됨
  const NAKED_JUICEOK_ERROR_SRC = `
// 단독 juice-ok 는 error 룰도 억제하지 못한다
jk.addTrauma(1.5); // juice-ok
jk.freeze(45); // juice-ok
`

  // 소수 freeze 위반 fixture — freeze(40.5) 가 검출돼야 함(MEDIUM fix 검증)
  const FLOAT_FREEZE_SRC = `
jk.freeze(40.5);   // JUICE-FREEZE-DURATION: 40.5 > 30 (소수 인자)
jk.freeze(0.5);    // OK: 0.5 <= 30 (정상 소수)
`

  // warn-only fixture (--strict 검증용)
  const WARN_SRC = `jk.maxOffset = 80;\njk.maxRotation = 0.5;\n`

  const dir = join(tmpdir(), 'lint-juice-selftest-' + Date.now())
  mkdirSync(dir, { recursive: true })

  const vFile    = join(dir, 'violation.js')
  const oFile    = join(dir, 'ok.js')
  const sFile    = join(dir, 'suppressed-ruleid.js')
  const nsFile   = join(dir, 'naked-ok-safe.js')
  const neFile   = join(dir, 'naked-ok-error.js')
  const ffFile   = join(dir, 'float-freeze.js')
  const wFile    = join(dir, 'warn-only.js')
  writeFileSync(vFile,  VIOLATION_SRC,           'utf8')
  writeFileSync(oFile,  OK_SRC,                  'utf8')
  writeFileSync(sFile,  SUPPRESSED_RULEID_SRC,   'utf8')
  writeFileSync(nsFile, NAKED_JUICEOK_SAFE_SRC,  'utf8')
  writeFileSync(neFile, NAKED_JUICEOK_ERROR_SRC, 'utf8')
  writeFileSync(ffFile, FLOAT_FREEZE_SRC,        'utf8')
  writeFileSync(wFile,  WARN_SRC,                'utf8')

  let pass = true
  const results = []

  function run(label, filePath, expectExit, extraArgs) {
    const args = extraArgs || '--json'
    let exitCode = 0
    let output = ''
    try {
      output = execSync(
        `${JSON.stringify(node)} ${JSON.stringify(LINTER)} ${JSON.stringify(filePath)} ${args}`,
        { encoding: 'utf8' }
      )
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

  // 3) 룰ID 명시 억제 fixture → exit 0 (각 룰이 juice-ok:RULE-ID 로 억제됨)
  run('억제-ruleid-fixture', sFile, 0)

  // 4) 단독 juice-ok + 광과민 룰 → warn 남아야 함 (exit 0, warn >= 1)
  {
    let exitCode = 0; let output = ''
    try {
      output = execSync(`${JSON.stringify(node)} ${JSON.stringify(LINTER)} ${JSON.stringify(nsFile)} --json`, { encoding: 'utf8' })
    } catch (e) { exitCode = e.status || 1; output = e.stdout || '' }
    const lastLine = output.trim().split('\n').pop()
    let parsed = null; try { parsed = JSON.parse(lastLine) } catch (_) {}
    // exit 0(warn 은 error 아님) + warn >= 1(광과민 룰이 억제 안 됨)
    const ok = exitCode === 0 && (parsed?.counts?.warn || 0) >= 1
    if (!ok) pass = false
    results.push({ label: '단독juice-ok-광과민-미억제', expectExit: 0, actualExit: exitCode, ok, counts: parsed?.counts ?? null })
    console.log(`${ok ? '✓' : '✗'} [self-test] 단독juice-ok-광과민-미억제: exit=${exitCode} warn=${parsed?.counts?.warn}(expected exit=0, warn>=1)`)
  }

  // 5) 단독 juice-ok + error 룰 → error 남아야 함 (exit 1)
  run('단독juice-ok-error-미억제', neFile, 1)

  // 6) 소수 freeze(40.5) → error 검출 (exit 1)
  run('소수-freeze-위반', ffFile, 1)

  // 7) --strict 모드: 정상 fixture(warn 없음) → exit 0
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

  // 8) --strict 모드: warn-only → exit 1
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

  const passed = results.filter(r => r.ok).length
  console.log(`\n— self-test ${pass ? '전체 통과' : '실패 있음'}: ${passed}/${results.length}`)
  // --self-test 는 JSON 출력 계약 예외 — 마지막 줄이 사람용 요약
  process.exit(pass ? 0 : 1)
}
