#!/usr/bin/env node
// lint-kit-deps.mjs — 엔진 킷 의존 매니페스트 vs 실제 코드 참조 정적 대조 린터
// ─────────────────────────────────────────────────────────────────────────────
// engine/manifest.json 이 선언한 킷별 의존(다른 엔진 킷 + 외부 라이브러리)을, 각
// 킷 소스(engine/<file>.js)가 *실제로 참조하는 전역 심볼* 과 대조한다. BehaviorKit
// (engine/behaviorkit.js) 계약의 "결정론" 항목을 정적으로 강제하기도 한다.
//
// 매니페스트 형식(engine/manifest.json):
//   { externalGlobals:{ key:GlobalSymbol }, kits:{ id:{ file, global, engine:[id],
//     softEngine?:[id], external:[key], softExternal?:[key], contract:[id] } } }
//   engine = 하드 의존(없으면 동작 불가), softEngine = graceful-optional(없으면 폴백).
//
// 검사 룰:
//   KITDEP-SCHEMA        매니페스트 누락/파싱 실패/필수 필드 누락/파일 부재        [error]
//   KITDEP-MISSING       코드가 다른 킷 global 을 참조하는데 engine∪softEngine 에   [error]
//                        선언 안 됨(의존 누락)
//   KITDEP-EXT-MISSING   코드가 외부 전역 심볼(Phaser/Matter/Tone)을 *직접* 참조하  [error]
//                        는데 external∪softExternal 에 선언 안 됨(직접 참조만)
//   KITDEP-CYCLE         하드 engine 그래프에 순환(A→B→A)                            [error]
//   KITDEP-NONDET        킷 코드에 Math.random/Date.now/performance.now              [error]
//                        (BehaviorKit determinism 계약 위반). 라인에 `kitdep-ok`
//                        주석이 있으면 그 라인은 억제(불가피한 DOM/시각 전용 등).
//   KITDEP-UNKNOWN-DEP   engine/softEngine/external 에 매니페스트 미정의 의존       [error]
//   KITDEP-UNUSED-HARD   engine(하드)에 선언했으나 코드가 참조 안 함                [error]
//   KITDEP-UNUSED-SOFT   softEngine 선언했으나 코드가 참조 안 함                    [warn]
//   KITDEP-CONTRACT-DRIFT contract 배열 항목 vs 실제 메서드 존재 불일치             [error]
//                        (update-guard → updateMethod 메서드, reset → reset 메서드)
//
// 참조 검출(comment-strip 후 텍스트):
//   - 킷 참조: 다른 킷의 global 심볼이 코드(주석 제외)에 단어 경계로 등장하면 그 킷에
//     의존하는 것으로 본다. 킷끼리는 항상 `global.X`(예 global.RngForge) 로 참조하므로
//     검출이 안정적. 자기 자신 global 은 제외(export 라인).
//   - 외부 참조: external 은 *author-declared* 정보다. 이 코드베이스는 Phaser 를 주로
//     `scene.add.*`·`this.matter.*` 처럼 *접근자 경유* 로 쓰므로 bare 심볼 스캔으로
//     "미사용"을 판정하면 오탐이 크다(vectorforge·audio 는 bare 심볼 0 이나 실사용).
//     따라서 external "미사용" 은 검사하지 않고, bare 외부 심볼이 코드에 *직접* 박혀
//     있는데(예 `new Phaser.Math.Vector2`) 선언 안 됐을 때만 EXT-MISSING 으로 잡는다
//     (직접 참조는 오탐 0).
//   - 주석(// 및 /* */)·문자열 리터럴은 매칭에서 제외(오탐 방지).
//
// 사용:
//   node skills/wgf-game-qa/tools/lint-kit-deps.mjs                 (기본 engine/manifest.json)
//   node skills/wgf-game-qa/tools/lint-kit-deps.mjs <manifest.json>
//   node skills/wgf-game-qa/tools/lint-kit-deps.mjs --json
//   node skills/wgf-game-qa/tools/lint-kit-deps.mjs --strict        (warn 도 실패로)
//   node skills/wgf-game-qa/tools/lint-kit-deps.mjs --self-test
//
// 출력 계약: 사람용 라인들을 먼저 출력하고, **stdout 마지막 줄은 단일 JSON**:
//   {"ok":bool,"counts":{"error":n,"warn":n},"findings":[{rule,severity,kit,message}],"file":path}
// 종료코드: error 0건이면 0, 있으면 1 (--strict 면 warn 도 1).
// --self-test 는 사람용 요약으로 끝남(JSON 출력 계약 예외 — 마지막 줄 비-JSON).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 기본 매니페스트: tools 에서 ../../../engine/manifest.json (test-fsm.mjs 와 동일 경로 규약).
const DEFAULT_MANIFEST = resolve(__dirname, '../../../engine/manifest.json')

const argv = process.argv.slice(2)
let manifestPath = null
let jsonOnly = false
let strict = false
let selfTest = false
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--json') jsonOnly = true
  else if (a === '--strict') strict = true
  else if (a === '--self-test') selfTest = true
  else if (a === '--file') manifestPath = argv[++i]
  else if (!a.startsWith('--')) manifestPath = a
}

const findings = []
const add = (rule, severity, kit, message) =>
  findings.push({ rule, severity, kit, message })

function emit(filePath) {
  const counts = { error: 0, warn: 0 }
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1
  const ok = counts.error === 0 && (!strict || counts.warn === 0)
  if (!jsonOnly) {
    const icon = { error: '✗', warn: '⚠' }
    if (findings.length === 0) console.log('✓ lint-kit-deps: 매니페스트와 코드 의존 일치(누락·순환·미사용 없음)')
    else for (const f of findings)
      console.log(`${icon[f.severity] || '·'} [${f.rule}]${f.kit ? ' ' + f.kit : ''} — ${f.message}`)
    console.log(`— error ${counts.error} · warn ${counts.warn}`)
  }
  console.log(JSON.stringify({ ok, counts, findings, file: filePath || null }))
  process.exit(ok ? 0 : 1)
}

// ── self-test ────────────────────────────────────────────────────────────────
if (selfTest) {
  runSelfTest()
  process.exit(0)
}

// ── 주석/문자열 제거(컬럼 보존) — lint-rng/lint-juice 와 동일 알고리즘 ──────────
// stripComments: 주석만 제거(문자열 내용 보존). 킷 참조 검출(다른 킷 global 심볼)에 사용.
//   문자열 속 심볼 참조는 실제 런타임 호출이 아니므로 오탐이 아님(킷끼리는 global 로만 참조).
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

// stripCommentsAndStrings: 주석 + 문자열 리터럴 내용 모두 공백 치환.
//   NONDET(Math.random/Date.now 등) 및 외부 전역 심볼 직접 참조 검출에 사용.
//   CONTRACT 설명 문자열 속 'Math.random()' 같은 예시 텍스트가 오탐되지 않도록 막는다.
function stripCommentsAndStrings(text) {
  let out = ''
  let inBlock = false, inLine = false
  let inStr = false, quote = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1], prev = text[i - 1]
    if (inLine) { if (c === '\n') { inLine = false; out += c } else out += ' '; continue }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; out += '  '; i++ } else out += (c === '\n' ? '\n' : ' '); continue }
    if (inStr) {
      // 문자열 내용은 공백으로 치환(따옴표 자체는 보존해 닫힘 추적)
      if (c === quote && prev !== '\\') { inStr = false; out += c } else out += (c === '\n' ? '\n' : ' ')
      continue
    }
    if (c === '/' && n === '/') { inLine = true; out += ' '; continue }
    if (c === '/' && n === '*') { inBlock = true; out += ' '; continue }
    if (c === '"' || c === "'" || c === '`') { inStr = true; quote = c; out += c; continue }
    out += c
  }
  return out
}

// 식별자 경계 정규식 — SYMBOL 이 단어 경계로 등장(부분단어 오탐 방지).
function symbolRefRe(sym) {
  // \b 로 양쪽 경계. JS 식별자 문맥에서 SYMBOL 자체의 출현을 잡는다.
  return new RegExp('\\b' + sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
}

// 결정론 위반 패턴(BehaviorKit determinism 계약 — lint-rng 와 동일 강도).
const NONDET_RULES = [
  { re: /Math\s*\.\s*random\s*\(/g, what: 'Math.random()' },
  { re: /Date\s*\.\s*now\s*\(/g, what: 'Date.now()' },
  { re: /performance\s*\.\s*now\s*\(/g, what: 'performance.now()' }
]

// ── 매니페스트 로드 + 검증 ──────────────────────────────────────────────────
// runLint(manifestFile): 매니페스트를 읽어 모든 룰을 평가하고 findings 에 적재.
//   매니페스트와 같은 디렉터리 기준으로 킷 파일을 찾는다.
function runLint(manifestFile) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8').replace(/^﻿/, ''))
  } catch (e) {
    add('KITDEP-SCHEMA', 'error', null, `매니페스트 읽기/파싱 실패: ${e.message}`)
    return
  }
  if (!manifest || typeof manifest !== 'object' || !manifest.kits || typeof manifest.kits !== 'object') {
    add('KITDEP-SCHEMA', 'error', null, 'kits 객체가 없습니다(매니페스트 형식 오류).')
    return
  }

  const engineDir = dirname(manifestFile)
  const externalGlobals = manifest.externalGlobals && typeof manifest.externalGlobals === 'object'
    ? manifest.externalGlobals : {}
  // 외부 전역 심볼 집합(값) + 키 검증용 역맵.
  const extGlobalSymbols = Object.values(externalGlobals)
  const kits = manifest.kits
  const kitIds = Object.keys(kits)

  // global 심볼 → 킷 id 역맵(킷 참조 검출용).
  const globalToId = {}
  for (const id of kitIds) {
    const g = kits[id] && kits[id].global
    if (g) globalToId[g] = id
  }

  // 각 킷 소스 로드 + comment-strip 캐시.
  //   srcCache[id] = { stripped, strippedLines, rawLines }  (또는 null = 읽기 실패)
  const srcCache = {}
  for (const id of kitIds) {
    const k = kits[id]
    if (!k || typeof k !== 'object') { add('KITDEP-SCHEMA', 'error', id, '킷 정의가 객체가 아닙니다.'); continue }
    if (!k.file) { add('KITDEP-SCHEMA', 'error', id, 'file 필드가 없습니다.'); continue }
    if (!k.global) { add('KITDEP-SCHEMA', 'error', id, 'global(전역 심볼) 필드가 없습니다.'); continue }
    let raw
    try { raw = readFileSync(resolve(engineDir, k.file), 'utf8') }
    catch (e) { add('KITDEP-SCHEMA', 'error', id, `킷 파일 읽기 실패(${k.file}): ${e.message}`); srcCache[id] = null; continue }
    const stripped = stripComments(raw)
    // strippedForMatch: 주석 + 문자열 리터럴 내용 모두 제거(NONDET·외부 심볼 직접참조 오탐 방지).
    const strippedForMatch = stripCommentsAndStrings(raw)
    srcCache[id] = { stripped, strippedLines: strippedForMatch.split('\n'), rawLines: raw.split('\n') }
  }

  // 의존 배열 정규화 헬퍼.
  const asArr = (v) => Array.isArray(v) ? v : []

  // ── 킷별 룰 평가 ────────────────────────────────────────────────────────
  for (const id of kitIds) {
    const k = kits[id]
    if (!k || !k.file || !k.global) continue
    const cache = srcCache[id]
    if (cache == null) continue   // 파일 못 읽음(이미 SCHEMA error)
    const src = cache.strippedLines.join('\n')  // 주석+문자열 모두 제거(킷 참조·NONDET·외부심볼 오탐 방지)
    const srcMatch = src  // 동일 뷰 사용

    const hardEngine = asArr(k.engine)
    const softEngine = asArr(k.softEngine)
    const declaredEngine = new Set([...hardEngine, ...softEngine])
    const ext = asArr(k.external)
    const softExt = asArr(k.softExternal)
    const declaredExt = new Set([...ext, ...softExt])

    // (0) UNKNOWN-DEP: 선언한 의존 id 가 매니페스트에 정의돼 있는지.
    for (const dep of declaredEngine) {
      if (!kits[dep]) add('KITDEP-UNKNOWN-DEP', 'error', id, `engine 의존 '${dep}' 가 매니페스트에 정의되지 않았습니다.`)
      if (dep === id) add('KITDEP-SCHEMA', 'error', id, `자기 자신('${id}')을 engine 의존으로 선언할 수 없습니다.`)
    }
    for (const e of declaredExt) {
      if (!externalGlobals[e]) add('KITDEP-UNKNOWN-DEP', 'error', id, `external 의존 '${e}' 가 externalGlobals 에 정의되지 않았습니다.`)
    }

    // (1) 실제 코드의 킷 참조 검출 — 자기 자신 제외. 킷끼리는 bare global 심볼로만 참조.
    const usedKits = new Set()
    for (const otherId of kitIds) {
      if (otherId === id) continue
      const sym = kits[otherId].global
      if (sym && symbolRefRe(sym).test(src)) usedKits.add(otherId)
    }

    // (2) 외부 전역 *직접* 참조 검출 — bare 심볼(Phaser/Matter/Tone)이 코드에 박혀 있는지.
    //     문자열 리터럴 내용 제거 후 매칭(CONTRACT 설명 문자열 속 심볼명 오탐 방지).
    //     (접근자 경유 사용은 검출하지 않음 — 미사용 판정 안 하므로 오탐 문제 없음.)
    const directExt = new Set()
    for (const key of Object.keys(externalGlobals)) {
      const sym = externalGlobals[key]
      if (sym && symbolRefRe(sym).test(srcMatch)) directExt.add(key)
    }

    // (3) MISSING: 코드가 쓰는데 engine∪softEngine 에 없음.
    for (const u of usedKits) {
      if (!declaredEngine.has(u)) {
        add('KITDEP-MISSING', 'error', id,
          `코드가 '${u}'(${kits[u].global})를 참조하지만 engine/softEngine 에 선언되지 않았습니다.`)
      }
    }
    // (3-b) EXT-MISSING: 외부 전역을 *직접* 참조하는데 external∪softExternal 에 없음.
    for (const u of directExt) {
      if (!declaredExt.has(u)) {
        add('KITDEP-EXT-MISSING', 'error', id,
          `코드가 외부 전역 '${externalGlobals[u]}'(${u})를 직접 참조하지만 external/softExternal 에 선언되지 않았습니다.`)
      }
    }

    // (4) UNUSED(킷만): 선언했으나 코드 미참조. external 은 접근자 경유라 미사용 판정 안 함.
    for (const dep of hardEngine) {
      if (kits[dep] && !usedKits.has(dep)) {
        add('KITDEP-UNUSED-HARD', 'error', id, `engine(하드) '${dep}' 선언했으나 코드가 참조하지 않습니다.`)
      }
    }
    for (const dep of softEngine) {
      if (kits[dep] && !usedKits.has(dep)) {
        add('KITDEP-UNUSED-SOFT', 'warn', id, `softEngine '${dep}' 선언했으나 코드가 참조하지 않습니다.`)
      }
    }

    // (5) NONDET: 결정론 위반(Math.random/Date.now/performance.now). 라인 단위 + kitdep-ok 억제.
    //     억제 근거: mobile.js 의 더블탭 줌 차단(DOM touchend 핸들러)처럼 게임 step 루프
    //     바깥의 불가피한 시각 코드(헤드리스 결정성에 무관)는 라인 주석으로 면제(lint-rng 선례).
    //     strippedLines 는 주석+문자열 모두 제거(CONTRACT 설명 속 'Math.random()' 오탐 방지).
    const sLines = cache.strippedLines
    const rLines = cache.rawLines
    for (let li = 0; li < sLines.length; li++) {
      if (/kitdep-ok/i.test(rLines[li] || '')) continue   // 라인 억제
      for (const r of NONDET_RULES) {
        r.re.lastIndex = 0
        if (r.re.test(sLines[li])) {
          add('KITDEP-NONDET', 'error', id,
            `${k.file}:${li + 1} ${r.what} 사용 — BehaviorKit determinism 계약 위반(RngForge·dt 주입으로 대체. 불가피하면 라인에 kitdep-ok).`)
        }
      }
    }

    // (6) KITDEP-CONTRACT-DRIFT: contract 배열 선언 항목 vs 실제 메서드 존재 교차검증.
    //     contract 에 'update-guard' 가 있으면 updateMethod(기본 'update') 메서드가 소스에 있어야 함.
    //     contract 에 'reset' 이 있으면 'reset' 메서드가 소스에 있어야 함.
    //     목적: manifest 가 코드와 달라지는 것을 영구 방지(abilitykit 선례: update/reset 없음인데 선언).
    const contractItems = Array.isArray(k.contract) ? k.contract : []
    const updateMethodName = (k.updateMethod && typeof k.updateMethod === 'string') ? k.updateMethod : 'update'
    if (contractItems.includes('update-guard')) {
      // 메서드 이름이 소스 코드에 함수/메서드로 정의돼 있는지 확인.
      // prototype.METHOD = function 또는 METHOD: function 또는 METHOD(dt 형태.
      const methodRe = new RegExp(
        '\\b' + updateMethodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '\\s*[=:(]|prototype\\.' +
        updateMethodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*='
      )
      if (!methodRe.test(src)) {
        add('KITDEP-CONTRACT-DRIFT', 'error', id,
          `contract 에 'update-guard' 선언했으나 ${k.file} 에 '${updateMethodName}' 메서드가 없습니다(updateMethod:"${updateMethodName}"). contract 배열에서 제거하거나 메서드를 추가하세요.`)
      }
    }
    if (contractItems.includes('reset')) {
      const resetRe = /\breset\s*[=:(]|prototype\.reset\s*=/
      if (!resetRe.test(src)) {
        add('KITDEP-CONTRACT-DRIFT', 'error', id,
          `contract 에 'reset' 선언했으나 ${k.file} 에 'reset' 메서드가 없습니다. contract 배열에서 제거하거나 메서드를 추가하세요.`)
      }
    }
  }

  // ── (7) CYCLE: 하드 engine 그래프 순환 검출(DFS 3색). softEngine 은 제외. ──
  detectCycles(kits)
}

// 하드 engine 그래프에서 순환을 찾아 KITDEP-CYCLE 으로 보고. softEngine 은 그래프에 넣지 않는다
// (graceful-optional 은 강결합 아님 — 순환이어도 부팅 데드락 없음).
function detectCycles(kits) {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = {}
  const ids = Object.keys(kits)
  for (const id of ids) color[id] = WHITE
  const stack = []
  const reported = new Set()

  function dfs(id) {
    color[id] = GRAY
    stack.push(id)
    const deps = (kits[id] && Array.isArray(kits[id].engine)) ? kits[id].engine : []
    for (const dep of deps) {
      if (!kits[dep]) continue            // UNKNOWN-DEP 가 별도 보고. 그래프에선 무시.
      if (dep === id) continue            // self 는 SCHEMA 가 보고.
      if (color[dep] === GRAY) {
        // 순환 발견 — stack 에서 dep..현재 까지 추출.
        const i = stack.indexOf(dep)
        const cyc = stack.slice(i).concat(dep)
        const key = [...cyc].sort().join('|')   // 동일 순환 중복 보고 방지
        if (!reported.has(key)) {
          reported.add(key)
          add('KITDEP-CYCLE', 'error', cyc[0], `하드 engine 순환 의존: ${cyc.join(' → ')}`)
        }
      } else if (color[dep] === WHITE) {
        dfs(dep)
      }
    }
    stack.pop()
    color[id] = BLACK
  }

  for (const id of ids) if (color[id] === WHITE) dfs(id)
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const targetManifest = manifestPath ? resolve(manifestPath) : DEFAULT_MANIFEST
runLint(targetManifest)
emit(targetManifest)

// ── self-test ────────────────────────────────────────────────────────────────
function runSelfTest() {
  const LINTER = resolve(fileURLToPath(import.meta.url))
  const node = process.execPath
  const dir = join(tmpdir(), 'lint-kit-deps-selftest-' + Date.now())
  mkdirSync(dir, { recursive: true })

  // 가짜 킷 소스(comment-strip·참조 검출 검증용). 실제 엔진과 무관한 미니 픽스처.
  function writeKit(name, body) {
    const file = join(dir, name + '.js')
    writeFileSync(file, body, 'utf8')
    return name + '.js'
  }

  // ── 픽스처 1: 정상(누락·순환·미사용·결정론 위반 없음) ──────────────────────
  // a → (hard) b,  b → [],  c → (soft) a.  외부 Phaser 사용 선언.
  writeKit('a', `(function(g){'use strict';
    var x = g.B; g.A = {}; if (typeof module!=='undefined') module.exports = g.A;
  })(this);`)
  writeKit('b', `(function(g){'use strict'; g.B = {}; if (typeof module!=='undefined') module.exports = g.B; })(this);`)
  writeKit('c', `(function(g){'use strict';
    if (g.A) {} var p = Phaser.Scene; g.C = {}; if (typeof module!=='undefined') module.exports = g.C;
  })(this);`)
  const goodManifest = join(dir, 'good.json')
  writeFileSync(goodManifest, JSON.stringify({
    externalGlobals: { phaser: 'Phaser' },
    kits: {
      a: { file: 'a.js', global: 'A', engine: ['b'], external: [] },
      b: { file: 'b.js', global: 'B', engine: [], external: [] },
      c: { file: 'c.js', global: 'C', engine: [], softEngine: ['a'], external: ['phaser'] }
    }
  }), 'utf8')

  // ── 픽스처 2: 위반 — 순환(x→y→x) + 누락(쓰는데 미선언) + 미사용 하드 + 결정론 ──
  writeKit('x', `(function(g){'use strict';
    var u = g.Y;            // x 가 y 참조 → engine 선언함(정상)
    var z = g.Z;            // x 가 z 참조하지만 선언 안 함 → MISSING
    var r = Math.random();  // 결정론 위반 → NONDET
    g.X = {}; if (typeof module!=='undefined') module.exports = g.X;
  })(this);`)
  writeKit('y', `(function(g){'use strict';
    var u = g.X;   // y 가 x 참조 → 순환 x→y→x
    g.Y = {}; if (typeof module!=='undefined') module.exports = g.Y;
  })(this);`)
  writeKit('z', `(function(g){'use strict'; g.Z = {}; if (typeof module!=='undefined') module.exports = g.Z; })(this);`)
  writeKit('w', `(function(g){'use strict'; g.W = {}; if (typeof module!=='undefined') module.exports = g.W; })(this);`)
  const badManifest = join(dir, 'bad.json')
  writeFileSync(badManifest, JSON.stringify({
    externalGlobals: { phaser: 'Phaser' },
    kits: {
      // x engine:[y,w] — y 는 쓰지만 순환, w 는 미사용(UNUSED-HARD). z 는 쓰는데 미선언(MISSING).
      x: { file: 'x.js', global: 'X', engine: ['y', 'w'], external: [] },
      y: { file: 'y.js', global: 'Y', engine: ['x'], external: [] },
      z: { file: 'z.js', global: 'Z', engine: [], external: [] },
      w: { file: 'w.js', global: 'W', engine: [], external: [] }
    }
  }), 'utf8')

  // ── 픽스처 3: 미사용 soft(warn) — exit 0, --strict 시 exit 1 ────────────────
  writeKit('s', `(function(g){'use strict'; g.S = {}; if (typeof module!=='undefined') module.exports = g.S; })(this);`)
  writeKit('t', `(function(g){'use strict'; g.T = {}; if (typeof module!=='undefined') module.exports = g.T; })(this);`)

  // ── 픽스처 4: CONTRACT-DRIFT — contract 선언은 있으나 메서드 부재 → exit 1 ──
  // drift_a: contract=['update-guard','reset'] 이지만 실제 update/reset 메서드 없음.
  writeKit('drift_a', `(function(g){'use strict';
    g.DriftA = {};
    if (typeof module!=='undefined') module.exports = g.DriftA;
  })(this);`)
  // drift_b: contract=['update-guard'] 이고 updateMethod='tick', tick 메서드 없음.
  writeKit('drift_b', `(function(g){'use strict';
    g.DriftB = {};
    if (typeof module!=='undefined') module.exports = g.DriftB;
  })(this);`)
  // drift_ok: contract=['update-guard','reset'] 이고 메서드 둘 다 있음 → 통과.
  writeKit('drift_ok', `(function(g){'use strict';
    function DriftOk() {}
    DriftOk.prototype.update = function(dt) { if (!Number.isFinite(dt)||dt<0) dt=0; };
    DriftOk.prototype.reset = function() {};
    g.DriftOk = DriftOk;
    if (typeof module!=='undefined') module.exports = g.DriftOk;
  })(this);`)
  const driftManifest = join(dir, 'drift.json')
  writeFileSync(driftManifest, JSON.stringify({
    externalGlobals: {},
    kits: {
      drift_a: { file: 'drift_a.js', global: 'DriftA', engine: [], external: [], contract: ['update-guard', 'reset'] },
      drift_b: { file: 'drift_b.js', global: 'DriftB', engine: [], external: [], updateMethod: 'tick', contract: ['update-guard'] },
      drift_ok: { file: 'drift_ok.js', global: 'DriftOk', engine: [], external: [], contract: ['update-guard', 'reset'] }
    }
  }), 'utf8')

  // ── 픽스처 5: 문자열 리터럴 NONDET 오탐 없음 ──────────────────────────────────
  // nofalse_a: 문자열 리터럴 속 'Math.random()' / 'Date.now()' 만 있음(실제 호출 아님).
  //            → NONDET 미검출, exit 0 이어야 함.
  writeKit('nofalse_a', `(function(g){'use strict';
    // CONTRACT 설명: 'Math.random() 금지, Date.now() 금지'
    var rule = 'Math.random() 는 결정론 위반 금지 함수입니다. Date.now() 도 금지.';
    g.NofA = {};
    if (typeof module!=='undefined') module.exports = g.NofA;
  })(this);`)
  const nofaManifest = join(dir, 'nofa.json')
  writeFileSync(nofaManifest, JSON.stringify({
    externalGlobals: {},
    kits: {
      nofalse_a: { file: 'nofalse_a.js', global: 'NofA', engine: [], external: [], contract: [] }
    }
  }), 'utf8')
  const softManifest = join(dir, 'soft.json')
  writeFileSync(softManifest, JSON.stringify({
    externalGlobals: {},
    kits: {
      // s 가 t 를 softEngine 선언하지만 코드에서 안 씀 → UNUSED-SOFT (warn)
      s: { file: 's.js', global: 'S', engine: [], softEngine: ['t'], external: [] },
      t: { file: 't.js', global: 'T', engine: [], external: [] }
    }
  }), 'utf8')

  let pass = true
  const results = []

  function run(label, args, expectExit) {
    let exitCode = 0, output = ''
    try {
      output = execSync(`${JSON.stringify(node)} ${JSON.stringify(LINTER)} ${args}`, { encoding: 'utf8' })
    } catch (e) { exitCode = e.status || 1; output = e.stdout || '' }
    const lastLine = output.trim().split('\n').pop()
    let parsed = null
    try { parsed = JSON.parse(lastLine) } catch (_) {}
    const ok = exitCode === expectExit
    if (!ok) pass = false
    results.push({ label, expectExit, actualExit: exitCode, ok, parsed })
    console.log(`${ok ? '✓' : '✗'} [self-test] ${label}: exit=${exitCode}(expected ${expectExit})${parsed ? ` counts=${JSON.stringify(parsed.counts)}` : ''}`)
    return parsed
  }

  // 1) 정상 픽스처 → exit 0
  run('정상-fixture', `${JSON.stringify(goodManifest)} --json`, 0)

  // 2) 위반 픽스처 → exit 1, 그리고 기대 룰들이 실제로 검출됐는지 검증
  {
    const parsed = run('위반-fixture', `${JSON.stringify(badManifest)} --json`, 1)
    const rules = new Set((parsed?.findings || []).map(f => f.rule))
    const expects = ['KITDEP-CYCLE', 'KITDEP-MISSING', 'KITDEP-UNUSED-HARD', 'KITDEP-NONDET']
    for (const r of expects) {
      const has = rules.has(r)
      if (!has) pass = false
      console.log(`${has ? '✓' : '✗'} [self-test]   위반-fixture 가 ${r} 검출`)
      results.push({ label: `위반-검출-${r}`, ok: has })
    }
  }

  // 3) 미사용 soft 픽스처 → exit 0(warn), --strict → exit 1
  {
    const parsed = run('미사용-soft(warn)', `${JSON.stringify(softManifest)} --json`, 0)
    const hasSoftWarn = (parsed?.counts?.warn || 0) >= 1
    if (!hasSoftWarn) pass = false
    console.log(`${hasSoftWarn ? '✓' : '✗'} [self-test]   미사용-soft 가 warn>=1`)
    results.push({ label: '미사용-soft-warn', ok: hasSoftWarn })
  }
  run('미사용-soft+strict', `${JSON.stringify(softManifest)} --strict --json`, 1)

  // 4) 매니페스트 부재 → SCHEMA error, exit 1
  run('부재-매니페스트', `${JSON.stringify(join(dir, 'nope.json'))} --json`, 1)

  // 5) CONTRACT-DRIFT 픽스처 → exit 1, KITDEP-CONTRACT-DRIFT 검출
  {
    const parsed = run('contract-drift-fixture', `${JSON.stringify(driftManifest)} --json`, 1)
    const rules = (parsed?.findings || []).map(f => f.rule)
    const driftCount = rules.filter(r => r === 'KITDEP-CONTRACT-DRIFT').length
    // drift_a: update-guard + reset 미검출 → 2건, drift_b: tick 미검출 → 1건, drift_ok: 통과.
    const hasDrift = driftCount >= 3
    if (!hasDrift) pass = false
    console.log(`${hasDrift ? '✓' : '✗'} [self-test]   contract-drift 가 KITDEP-CONTRACT-DRIFT >= 3 건 검출(실제 ${driftCount}건)`)
    results.push({ label: 'contract-drift-검출', ok: hasDrift })
  }

  // 6) 문자열 리터럴 NONDET 오탐 없음 → exit 0
  {
    const parsed = run('문자열-NONDET-오탐없음', `${JSON.stringify(nofaManifest)} --json`, 0)
    const nondetCount = (parsed?.findings || []).filter(f => f.rule === 'KITDEP-NONDET').length
    const noFalsePos = nondetCount === 0
    if (!noFalsePos) pass = false
    console.log(`${noFalsePos ? '✓' : '✗'} [self-test]   문자열 리터럴 속 Math.random/Date.now 오탐 0(실제 ${nondetCount}건)`)
    results.push({ label: '문자열-NONDET-오탐없음', ok: noFalsePos })
  }

  // 7) 실제 엔진 매니페스트 → exit 0(현재 엔진이 계약 통과해야 함)
  run('실제-엔진-매니페스트', `${JSON.stringify(DEFAULT_MANIFEST)} --json`, 0)

  const passed = results.filter(r => r.ok).length
  console.log(`\n— self-test ${pass ? '전체 통과' : '실패 있음'}: ${passed}/${results.length}`)
  process.exit(pass ? 0 : 1)
}
