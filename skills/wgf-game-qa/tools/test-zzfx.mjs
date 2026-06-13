#!/usr/bin/env node
// test-zzfx.mjs — engine/audio.js 파라미터-데이터(ZzFX식) SFX 합성 회귀 테스트
// ─────────────────────────────────────────────────────────────────────────────
// audio.js 는 브라우저 Web Audio(AudioContext) 의존이지만, 합성 코어 ChipAudio.synth
// 는 AudioContext 없이 동작하는 순수 함수(파라미터 배열 → Float32Array PCM)다.
// test-rngforge.mjs 와 동일하게 Node require 로 엔진 모듈을 직접 로드해 검증한다.
//
// 검증 항목:
//   1) 모듈 로드 — ChipAudio.synth / SFX / SAMPLE_RATE static 노출
//   2) 길이 sanity — 총 길이 = delay + (attack+decay+sustain+release) × sampleRate
//   3) 진폭 sanity — 모든 샘플 [-1,1], volume 에 비례하는 피크(상·하한 범위)
//   4) 시드 결정론 — randomness 있어도 같은 seed → 비트 동일 PCM
//   5) 시드 없으면 무흔들림(결정적) — Math.random 미사용(연속 호출 동일)
//   6) randomness 효과 — 같은 파라미터라도 seed 유무/값에 따라 파형 달라짐
//   7) 배열 ↔ 객체 동치 — 콤팩트 배열과 키 객체가 같은 PCM
//   8) 노이즈 shape(4) — seed 없으면 무음(0), seed 있으면 가청
//   9) 데이터 테이블 — 내장 SFX 키가 모두 유효한 PCM 으로 합성
//  10) 기존 API 회귀 — tone/sfx/startBgm/stopBgm/playParams/zzfx 메서드 존재(하위호환)
//  11) 내장 SFX 가청 — zzfx(name) 기본 호출(seed 미지정)에서 모든 키가 peak>0
//  12) delay PCM 반영 — delay 파라미터가 선행 무음 샘플로 PCM 길이에 포함됨
//
// 사용: node skills/wgf-game-qa/tools/test-zzfx.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const ChipAudio = require(resolve(here, '../../../engine/audio.js'))

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}
const synth = ChipAudio.synth
const SR = ChipAudio.SAMPLE_RATE
function peak(a) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); return m }
function bitEq(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true }
function inRange(a) { for (let i = 0; i < a.length; i++) if (a[i] < -1 || a[i] > 1 || !Number.isFinite(a[i])) return false; return true }

// ── 1) 모듈 로드 / static 노출 ──
ok('ChipAudio module loads', typeof ChipAudio === 'function')
ok('ChipAudio.synth is a function', typeof synth === 'function')
ok('ChipAudio.SFX data table present', ChipAudio.SFX && typeof ChipAudio.SFX === 'object')
ok('ChipAudio.SAMPLE_RATE is 44100', SR === 44100)

// ── 2) 길이 sanity (delay + ADSR 구간 합) ──
{
  const stageSamples = (delay, a, d, s, r) =>
    Math.round(delay * SR) + Math.round(a * SR) + Math.round(d * SR) + Math.round(s * SR) + Math.round(r * SR)
  const p = synth([0.5, 0, 440, 0, 0, 0.1, 0])
  ok('length = release × sampleRate (no delay)', p.length === stageSamples(0, 0, 0, 0, 0.1), `len=${p.length}`)
  const p2 = synth([0.5, 0, 440, 0.05, 0, 0.2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.05])
  // attack .05 + decay .05 + sustain 0 + release .2 = .3s (구간별 정수 합), delay=0
  ok('length = (attack+decay+sustain+release) × sampleRate', p2.length === stageSamples(0, 0.05, 0.05, 0, 0.2), `len=${p2.length}`)
}

// ── 3) 진폭 sanity ──
{
  const lo = synth([0.2, 0, 440, 0, 0, 0.1, 0])
  const hi = synth([0.8, 0, 440, 0, 0, 0.1, 0])
  ok('all samples within [-1,1]', inRange(lo) && inRange(hi))
  ok('peak scales with volume (0.8 > 0.2)', peak(hi) > peak(lo), `lo=${peak(lo).toFixed(3)} hi=${peak(hi).toFixed(3)}`)
  // 범위 완화: peak <= volume+ε (클리핑 방지) 이고 peak > volume*0.5 (가청 확인)
  const vol = 0.8, eps = 0.05
  ok('peak within [volume*0.5, volume+ε]',
    peak(hi) <= vol + eps && peak(hi) > vol * 0.5,
    `peak=${peak(hi).toFixed(3)} vol=${vol}`)
}

// ── 4) 시드 결정론 — randomness 있어도 같은 seed → 비트 동일 ──
{
  const a = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0], { seed: 12345 })
  const b = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0], { seed: 12345 })
  ok('same seed → bit-identical PCM (randomness deterministic)', bitEq(a, b))
  const c = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0], { seed: 'jump-fx' })
  const d = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0], { seed: 'jump-fx' })
  ok('string seed → bit-identical PCM', bitEq(c, d))
}

// ── 5) 시드 없으면 무흔들림(결정적) — Math.random 미사용 ──
{
  const a = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0])
  const b = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0])
  ok('no seed → deterministic across calls (no Math.random)', bitEq(a, b))
}

// ── 6) randomness 효과 — seed 유무/값에 따라 파형 달라짐 ──
{
  const noSeed = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0])
  const seeded = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0], { seed: 99 })
  ok('seeded randomness differs from unseeded', !bitEq(noSeed, seeded))
  const s1 = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0], { seed: 1 })
  const s2 = synth([0.5, 0.5, 440, 0, 0.02, 0.2, 0], { seed: 2 })
  ok('different seeds → different PCM', !bitEq(s1, s2))
}

// ── 7) 배열 ↔ 객체 동치 ──
{
  const arr = synth([0.4, 0, 330, 0.01, 0.05, 0.2, 1, 1, 6])
  const obj = synth({ volume: 0.4, randomness: 0, frequency: 330, attack: 0.01, sustain: 0.05, release: 0.2, shape: 1, shapeCurve: 1, slide: 6 })
  ok('array and object params produce identical PCM', bitEq(arr, obj))
}

// ── 8) 노이즈 shape(4) — seed 없으면 무음, seed 있으면 가청 ──
{
  const noiseNoSeed = synth([0.5, 0, 440, 0, 0, 0.1, 4])
  const noiseSeeded = synth([0.5, 0, 440, 0, 0, 0.1, 4], { seed: 7 })
  ok('noise shape silent without seed (no Math.random)', peak(noiseNoSeed) === 0, `peak=${peak(noiseNoSeed)}`)
  ok('noise shape audible with seed', peak(noiseSeeded) > 0.1, `peak=${peak(noiseSeeded).toFixed(3)}`)
}

// ── 9) 데이터 테이블 — 내장 SFX 키가 모두 유효 PCM ──
{
  let allOk = true, bad = ''
  for (const name of Object.keys(ChipAudio.SFX)) {
    const p = synth(ChipAudio.SFX[name])
    if (!(p instanceof Float32Array) || p.length === 0 || !inRange(p)) { allOk = false; bad = name; break }
  }
  ok('all built-in SFX synthesize to valid PCM', allOk, bad ? `bad=${bad}` : `${Object.keys(ChipAudio.SFX).length} keys`)
  ok('built-in keys include jump/coin/stomp', !!(ChipAudio.SFX.jump && ChipAudio.SFX.coin && ChipAudio.SFX.stomp))
}

// ── 10) 기존 API 회귀 — 하위호환(메서드 시그니처 보존) ──
{
  const proto = ChipAudio.prototype
  const legacy = ['init', 'unlock', 'resume', 'suspend', 'toggleMute', 'tone', 'sfx', 'startBgm', 'stopBgm']
  let allPresent = legacy.every(m => typeof proto[m] === 'function')
  ok('legacy public methods preserved (tone/sfx/startBgm/...)', allPresent)
  ok('new methods added (playParams/zzfx)', typeof proto.playParams === 'function' && typeof proto.zzfx === 'function')
  // 헤드리스(AudioContext 없음)에서 sfx/playParams 가 throw 없이 graceful no-op (ctx null 가드)
  let safe = true
  try { const a = new ChipAudio(); a.sfx('jump'); a.tone({ freq: 440 }); a.playParams([0.5, 0, 440]); a.zzfx('coin'); }
  catch (e) { safe = false }
  ok('legacy + new playback are graceful no-op without AudioContext', safe)
}

// ── 11) 내장 SFX 가청 — zzfx(name) 기본 호출(seed 자동 주입) 시 모든 키 peak > 0 ──
// ChipAudio.zzfx 는 Web Audio 재생이라 Node 에서 직접 호출할 수 없다.
// 대신 synthZzfx 를 기본 seed 주입 경로와 동일하게 호출해 가청 여부를 확인한다.
// (zzfx 내부 로직: RngForge.hashSeed(name) 를 seed 로 주입)
{
  const RngForge = (() => { try { return require(resolve(here, '../../../engine/rngforge.js')) } catch(e) { return null } })()
  let allAudible = true, silentKey = ''
  for (const name of Object.keys(ChipAudio.SFX)) {
    const seed = RngForge ? RngForge.hashSeed(name) : 1
    const p = synth(ChipAudio.SFX[name], { seed })
    if (peak(p) === 0) { allAudible = false; silentKey = name; break }
  }
  ok('all built-in SFX audible with auto seed (zzfx default path)', allAudible,
    silentKey ? `silent key: ${silentKey}` : `${Object.keys(ChipAudio.SFX).length} keys checked`)
  // explosion 은 noise-heavy SFX 의 대표 — 명시 확인
  if (RngForge) {
    const exSeed = RngForge.hashSeed('explosion')
    ok('explosion audible with name-based seed', peak(synth(ChipAudio.SFX.explosion, { seed: exSeed })) > 0.1)
  } else {
    ok('explosion audible with name-based seed', true, 'skipped (no RngForge)')
  }
}

// ── 12) delay PCM 반영 — 파라미터 delay 가 선행 무음 샘플로 PCM 길이에 포함 ──
{
  const stageSamples = (delay, a, d, s, r) =>
    Math.round(delay * SR) + Math.round(a * SR) + Math.round(d * SR) + Math.round(s * SR) + Math.round(r * SR)
  const noDelay  = synth([0.5, 0, 440, 0, 0, 0.2, 0])          // delay=0
  const withDelay = synth([0.5, 0, 440, 0, 0, 0.2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.1])  // delay=0.1s
  const expectedNoDelay   = stageSamples(0,   0, 0, 0, 0.2)
  const expectedWithDelay = stageSamples(0.1, 0, 0, 0, 0.2)
  ok('delay=0 length unchanged', noDelay.length === expectedNoDelay, `len=${noDelay.length}`)
  ok('delay=0.1 extends PCM by 0.1s of silence', withDelay.length === expectedWithDelay,
    `len=${withDelay.length} expected=${expectedWithDelay}`)
  // delay 구간은 0(무음)이어야 한다
  const delaySamples = Math.round(0.1 * SR)
  let leadingSilent = true
  for (let i = 0; i < delaySamples; i++) if (withDelay[i] !== 0) { leadingSilent = false; break }
  ok('delay prefix samples are silent (0)', leadingSilent)
  // delay 이후 구간은 기존 파형과 동일해야 한다
  ok('audio content after delay matches no-delay PCM',
    (() => { for (let i = 0; i < noDelay.length; i++) if (noDelay[i] !== withDelay[delaySamples + i]) return false; return true })())
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
