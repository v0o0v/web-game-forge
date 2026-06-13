#!/usr/bin/env node
// lint-rng.mjs — 게임 결정론 위반(비시드 무작위·시각함수) 정적 린터
// ─────────────────────────────────────────────────────────────────────────────
// 게임 로직 파일(games/<slug>/game.js 등)을 스캔해, game-qa 헤드리스 step 하니스의
// 재현성을 깨뜨리는 호출을 검출한다. 무작위는 RngForge(engine/rngforge.js)로만,
// 시간은 game.step 의 주입 인자로만 다뤄야 결정적 검증이 성립한다.
//
// 검사 룰:
//   RNG-NO-MATH-RANDOM   Math.random(      → 시드 없는 무작위(결정론 파괴)        [error]
//   RNG-NO-DATE-NOW      Date.now(          → 월클럭(프레임마다 값 달라짐)         [error]
//   RNG-NO-PERF-NOW      performance.now(   → 월클럭                                [error]
//   RNG-NO-NEW-DATE      new Date()         → 현재시각 의존                         [warn]
//
// 억제: 해당 라인에 `rng-ok` 주석을 달면 그 라인은 건너뛴다(불가피한 시각 전용 등).
// 주석(// 와 /* */)은 매칭에서 제외한다.
//
// 사용:
//   node skills/wgf-game-qa/tools/lint-rng.mjs games/<slug>/game.js
//   node skills/wgf-game-qa/tools/lint-rng.mjs <file> --json
//   node skills/wgf-game-qa/tools/lint-rng.mjs <file> --strict   (warn 도 실패로)
//
// 출력 계약: 사람용 라인들을 먼저 출력하고, **stdout 마지막 줄은 단일 JSON**:
//   {"ok":bool,"counts":{"error":n,"warn":n},"findings":[{rule,severity,line,col,message,text}],"file":path}
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
const add = (rule, severity, line, col, message, text) =>
  findings.push({ rule, severity, line, col, message, text })

function emit() {
  const counts = { error: 0, warn: 0 }
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1
  const ok = counts.error === 0 && (!strict || counts.warn === 0)
  if (!jsonOnly) {
    const icon = { error: '✗', warn: '⚠' }
    if (findings.length === 0) console.log('✓ lint-rng: 결정론 위반 없음')
    else for (const f of findings)
      console.log(`${icon[f.severity] || '·'} [${f.rule}] ${file}:${f.line}:${f.col} — ${f.message}`)
    console.log(`— error ${counts.error} · warn ${counts.warn}`)
  }
  console.log(JSON.stringify({ ok, counts, findings, file: file || null }))
  process.exit(ok ? 0 : 1)
}

if (!file) {
  add('schema', 'error', 0, 0, '입력 파일 경로가 없습니다. 사용: node lint-rng.mjs games/<slug>/game.js')
  emit()
}

let src
try { src = readFileSync(resolve(file), 'utf8') }
catch (e) { add('schema', 'error', 0, 0, `파일 읽기 실패: ${e.message}`); emit() }

// 주석 제거(공백으로 치환해 컬럼 보존). 블록주석은 줄 경계를 넘어 추적한다.
// 문자열 리터럴 내부까지 완벽 파싱하진 않으나, 게임 로직 검출엔 충분.
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

const RULES = [
  { rule: 'RNG-NO-MATH-RANDOM', severity: 'error', re: /Math\s*\.\s*random\s*\(/g, message: '시드 없는 무작위 — RngForge.create(seed) 로 대체하세요(예: rng() / rng.int(a,b)).' },
  { rule: 'RNG-NO-DATE-NOW', severity: 'error', re: /Date\s*\.\s*now\s*\(/g, message: '월클럭 — 시간은 game.step(time, delta) 주입 인자만 쓰세요.' },
  { rule: 'RNG-NO-PERF-NOW', severity: 'error', re: /performance\s*\.\s*now\s*\(/g, message: '월클럭 — 시간은 game.step 주입 인자만 쓰세요.' },
  { rule: 'RNG-NO-NEW-DATE', severity: 'warn', re: /new\s+Date\s*\(\s*\)/g, message: '현재시각 의존 — 시드/날짜키를 명시 인자로 넘기세요(예: new Date(2026,0,1)).' }
]

const cleaned = stripComments(src)
const lines = cleaned.split('\n')
const rawLines = src.split('\n')
for (let li = 0; li < lines.length; li++) {
  if (/rng-ok/i.test(rawLines[li] || '')) continue   // 라인 억제
  for (const r of RULES) {
    r.re.lastIndex = 0
    let m
    while ((m = r.re.exec(lines[li])) !== null) {
      add(r.rule, r.severity, li + 1, m.index + 1, r.message, (rawLines[li] || '').trim().slice(0, 120))
    }
  }
}

emit()
