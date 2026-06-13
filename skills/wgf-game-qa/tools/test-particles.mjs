#!/usr/bin/env node
// test-particles.mjs — 파티클 프리셋 데이터 로드 + burstPreset 결정론 회귀 테스트
// ─────────────────────────────────────────────────────────────────────────────
// (무의존성, Node 빌트인만. RngForge 를 주입해 결정론을 검증한다.)
// engine/particles.json 을 JuiceKit.loadPresets 로 적재하고, burstPreset 이 동일 opts
// 직접 burst() 호출과 **비트 동일** 결과를 내는지(시드 고정 결정론) 검증한다.
//
// 검증 항목:
//   1) loadPresets — particles.json 의 프리셋이 모두 적재되고 color 가 정수로 정규화
//   2) burstPreset == 직접 burst — 같은 시드·같은 정규화 opts 면 입자 수열 비트 동일
//   3) burstPreset 결정론 — 같은 시드 두 인스턴스의 burstPreset 결과 동일
//   4) overrides 병합 — overrides 가 프리셋 필드를 덮어쓰고 미지정은 유지(color 문자열도 정규화)
//   5) 미등록 프리셋 — 빈 배열 반환(graceful), 입자 미생성
//   6) 좌표 적용 — burstPreset(name, x, y) 의 입자 시작 위치가 (x,y)
//   7) lint 통과 — 실제 particles.json 이 lint-particles 를 통과(error 0)
//
// 사용: node skills/wgf-game-qa/tools/test-particles.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const RngForge = require(resolve(here, '../../../engine/rngforge.js'))
const JuiceKit = require(resolve(here, '../../../engine/juicekit.js'))
const PRESETS_PATH = resolve(here, '../../../engine/particles.json')
const presetsJson = JSON.parse(readFileSync(PRESETS_PATH, 'utf8'))

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}
const approx = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-12 : eps)

// 두 파티클 배열이 핵심 필드(좌표·속도·수명·색·크기) 기준으로 동일한지.
function particlesEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = b[i]
    if (p.x !== q.x || p.y !== q.y) return false
    if (p.vx !== q.vx || p.vy !== q.vy) return false
    if (!approx(p.life, q.life)) return false
    if (p.color !== q.color || p.size !== q.size || p.gravity !== q.gravity) return false
  }
  return true
}

// ── 1) loadPresets — 적재·color 정규화 ───────────────────────────────────────
{
  const jk = new JuiceKit(RngForge.create(1))
  jk.loadPresets(presetsJson)
  const names = Object.keys(presetsJson.presets)
  ok('loadPresets adds all presets', names.every(n => !!jk.getPreset(n)) && Object.keys(jk.presets).length === names.length,
    `loaded=${Object.keys(jk.presets).join(',')}`)
  ok('color normalized to integer (coin-spark)', jk.getPreset('coin-spark').color === 0xffe23f,
    `color=${jk.getPreset('coin-spark').color}`)
  ok('desc stripped from opts', jk.getPreset('coin-spark').desc === undefined)
}

// ── 2) burstPreset == 동일 opts 직접 burst (시드 고정 결정론, 비트 동일) ──────
{
  const names = Object.keys(presetsJson.presets)
  let allEqual = true, firstFail = ''
  for (const name of names) {
    // 직접 burst 용 opts: 프리셋과 동일하되 color 를 정규화(데이터와 같은 입력으로 맞춤), desc 제거
    const raw = presetsJson.presets[name]
    const directOpts = {}
    for (const k of Object.keys(raw)) {
      if (k === 'desc') continue
      directOpts[k] = (k === 'color' && typeof raw[k] === 'string')
        ? parseInt(raw[k].replace('#', ''), 16) : raw[k]
    }
    const jkP = new JuiceKit(RngForge.create(2026)); jkP.loadPresets(presetsJson)
    const viaPreset = jkP.burstPreset(name, 30, 40)
    const jkD = new JuiceKit(RngForge.create(2026))
    const viaDirect = jkD.burst(30, 40, directOpts)
    if (!particlesEqual(viaPreset, viaDirect)) { allEqual = false; firstFail = name; break }
  }
  ok('burstPreset matches direct burst bit-for-bit (same seed)', allEqual, firstFail ? `mismatch at '${firstFail}'` : '')
}

// ── 3) burstPreset 결정론 — 같은 시드 두 인스턴스 동일 ────────────────────────
{
  const a = new JuiceKit(RngForge.create(7)); a.loadPresets(presetsJson)
  const b = new JuiceKit(RngForge.create(7)); b.loadPresets(presetsJson)
  const pa = a.burstPreset('explosion', 0, 0)
  const pb = b.burstPreset('explosion', 0, 0)
  ok('burstPreset deterministic across instances (same seed)', particlesEqual(pa, pb), `lenA=${pa.length} lenB=${pb.length}`)

  const c = new JuiceKit(RngForge.create(8)); c.loadPresets(presetsJson)
  const pc = c.burstPreset('explosion', 0, 0)
  ok('different seed → different burstPreset result', !particlesEqual(pa, pc))
}

// ── 4) overrides 병합 — 덮어쓰기 + 미지정 유지 + color 문자열 정규화 ─────────
{
  const jk = new JuiceKit(RngForge.create(3)); jk.loadPresets(presetsJson)
  const base = jk.getPreset('coin-spark')
  // count override → 개수 반영, color 문자열 override → 정수 정규화, gravity 미지정 → 프리셋 유지
  const out = jk.burstPreset('coin-spark', 0, 0, { count: 3, color: '#00ff00' })
  ok('overrides.count applied', out.length === 3, `len=${out.length}`)
  ok('overrides.color string normalized', out.every(p => p.color === 0x00ff00), `color0=${out[0] && out[0].color}`)
  ok('non-overridden gravity retained from preset', out.every(p => p.gravity === base.gravity), `g=${out[0] && out[0].gravity} base=${base.gravity}`)

  // overrides 가 프리셋 원본을 변형하지 않아야(사본 사용)
  ok('preset not mutated by overrides', jk.getPreset('coin-spark').count === base.count && base.count !== 3)

  // overrides 정수 color 도 그대로
  const out2 = jk.burstPreset('coin-spark', 0, 0, { count: 2, color: 0x123456 })
  ok('overrides.color integer passthrough', out2.every(p => p.color === 0x123456))
}

// ── 5) 미등록 프리셋 — graceful 빈 배열 ──────────────────────────────────────
{
  const jk = new JuiceKit(RngForge.create(9)); jk.loadPresets(presetsJson)
  const out = jk.burstPreset('does-not-exist', 0, 0)
  ok('unknown preset returns empty array', Array.isArray(out) && out.length === 0)
  ok('unknown preset emits no particles', jk.particleCount() === 0)
}

// ── 6) 좌표 적용 — 입자 시작 위치 ─────────────────────────────────────────────
{
  const jk = new JuiceKit(RngForge.create(4)); jk.loadPresets(presetsJson)
  const out = jk.burstPreset('dust', 123, 456)
  ok('burstPreset positions particles at (x,y)', out.length > 0 && out.every(p => p.x === 123 && p.y === 456))
}

// ── 7) getPreset 사본 격리 — 반환값 변형이 내부 프리셋을 오염시키지 않아야 ─────
{
  const jk = new JuiceKit(RngForge.create(10)); jk.loadPresets(presetsJson)
  const originalCount = jk.getPreset('explosion').count  // 28
  const copy = jk.getPreset('explosion')
  copy.count = 2  // 반환 사본을 변형
  // 후속 burstPreset 은 변형 전 원본 count 를 사용해야 함
  const out = jk.burstPreset('explosion', 0, 0)
  ok('getPreset returns a shallow copy (mutation does not affect internal preset)',
    out.length === originalCount,
    `expected=${originalCount} actual=${out.length}`)
  // getPreset 을 다시 불러도 count 가 원본 그대로
  ok('getPreset still returns original count after copy mutation',
    jk.getPreset('explosion').count === originalCount,
    `count=${jk.getPreset('explosion').count}`)
}

// ── 8) normalizeColor 검증 강화 — 잘못된 hex 폴백 + 오버플로 마스킹 ───────────
{
  const jk = new JuiceKit(RngForge.create(11)); jk.loadPresets(presetsJson)
  // 3자리 hex '#fff' → 폴백 0xffffff
  const out3 = jk.burstPreset('coin-spark', 0, 0, { count: 1, color: '#fff' })
  ok('normalizeColor: 3-digit hex falls back to 0xffffff', out3[0] && out3[0].color === 0xffffff,
    `color=${out3[0] && out3[0].color}`)
  // 8자리 hex '#ffffffff' → 폴백 0xffffff
  const out8 = jk.burstPreset('coin-spark', 0, 0, { count: 1, color: '#ffffffff' })
  ok('normalizeColor: 8-digit hex falls back to 0xffffff', out8[0] && out8[0].color === 0xffffff,
    `color=${out8[0] && out8[0].color}`)
  // 빈 문자열 → 폴백 0xffffff
  const outE = jk.burstPreset('coin-spark', 0, 0, { count: 1, color: '' })
  ok('normalizeColor: empty string falls back to 0xffffff', outE[0] && outE[0].color === 0xffffff,
    `color=${outE[0] && outE[0].color}`)
  // 정수 오버플로 마스킹: 0x1ffffff → & 0xffffff = 0xffffff
  const outOvf = jk.burstPreset('coin-spark', 0, 0, { count: 1, color: 0x1ffffff })
  ok('normalizeColor: integer overflow masked to & 0xffffff', outOvf[0] && outOvf[0].color === 0xffffff,
    `color=${outOvf[0] && outOvf[0].color}`)
}

// ── 9) overrides 화이트리스트 — 미지 키(desc·오타)가 burst 로 새지 않아야 ──────
{
  const jk = new JuiceKit(RngForge.create(12)); jk.loadPresets(presetsJson)
  // desc 를 overrides 로 전달해도 파티클에 desc 필드가 붙지 않아야
  const out = jk.burstPreset('sparkle', 0, 0, { count: 2, desc: 'injected', colour: '#ff0000' })
  ok('overrides whitelist: unknown key desc not passed to particles', out[0] && out[0].desc === undefined,
    `desc=${out[0] && out[0].desc}`)
  ok('overrides whitelist: typo key colour not passed to particles', out[0] && out[0].colour === undefined,
    `colour=${out[0] && out[0].colour}`)
  ok('overrides whitelist: known key count still applied', out.length === 2, `len=${out.length}`)
}

// ── 10) lint 통과 — 실제 particles.json 이 lint-particles 를 통과 ──────────────
{
  let lintOk = false, lastLine = ''
  try {
    const out = execFileSync(process.execPath, [resolve(here, 'lint-particles.mjs'), PRESETS_PATH, '--json'], { encoding: 'utf8' })
    lastLine = out.trim().split('\n').pop()
    lintOk = JSON.parse(lastLine).ok === true
  } catch (e) {
    // lint 가 종료코드 1 이면 execFileSync 가 throw — stdout 에서 JSON 회수
    if (e.stdout) { lastLine = String(e.stdout).trim().split('\n').pop(); try { lintOk = JSON.parse(lastLine).ok === true } catch (_) {} }
  }
  ok('particles.json passes lint-particles (error 0)', lintOk, lastLine)
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
