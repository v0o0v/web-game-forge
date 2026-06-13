#!/usr/bin/env node
// test-shockwave.mjs — engine/screenfx.js 의 ScreenFX.shockwave(화면공간 충격파) 결정성·가드 회귀 테스트
// ─────────────────────────────────────────────────────────────────────────────
// (무의존성, Node 빌트인만. ScreenFX 는 WebGL Filter 래퍼라 시각 자체는 헤드리스 검증
//  불가 — 그래서 "순수 계산"을 분리해 검증한다: (1)변위맵 픽셀값 순수함수, (2)시간
//  감쇠/전파 봉투 순수함수. 추가로 Phaser/document 를 모킹해 (3)supported 가드(=non-WebGL
//  → null), (4)handle 생명주기(update 가 반경 전파·strength 감쇠·소멸)를 검증한다.)
//
// 검증 항목:
//   1) 변위맵 순수함수 shockwaveDisplacement — 링 중심 마루=1, ±경계=0, 두께 밖=0, wl<=0=0,
//      안↔밖 대칭, 마루 단조 감쇠(중심→경계).
//   2) 시간 감쇠 순수함수 shockwaveDecay — radius 0→1 단조 증가(speed 배율·1 clamp),
//      strength 1→0 단조 감소(끝에서 정확히 0), t<0/t>dur 경계, 결정성(같은 t→같은 값).
//   3) supported 가드 — non-WebGL(Canvas) 카메라면 shockwave=null(graceful no-op).
//   4) handle 생명주기(Phaser+document 모킹) — addDisplacement 1회 호출, update(dt) 가
//      반경 확장·strength 감쇠, duration 경과 시 자동 소멸(텍스처/필터 정리, false 반환),
//      destroy() 즉시 정리, update 의 NaN/음수/Infinity dt 가드.
//   5) 결정성 — Math.random/Date.now/performance.now 미사용(소스 정적 검사) + 같은 dt
//      시퀀스 → 동일한 (radius,strength) 수열.
//
// 사용: node skills/wgf-game-qa/tools/test-shockwave.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const SCREENFX_PATH = resolve(here, '../../../engine/screenfx.js')

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}
const approx = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-9 : eps)

// ScreenFX 는 IIFE 로 global(=globalThis) 에 노출 + module.exports 도 함께. require 로 적재.
const ScreenFX = require(SCREENFX_PATH)

// ── 1) 변위맵 순수함수 shockwaveDisplacement ──────────────────────────────────
{
  const wl = 0.12, ring = 0.5
  const center = ScreenFX.shockwaveDisplacement(ring, ring, wl)
  ok('displacement peaks (=1) at ring center', approx(center, 1), `center=${center}`)

  const edgeHi = ScreenFX.shockwaveDisplacement(ring + wl, ring, wl)
  const edgeLo = ScreenFX.shockwaveDisplacement(ring - wl, ring, wl)
  ok('displacement is 0 at +wavelength boundary', approx(edgeHi, 0), `+edge=${edgeHi}`)
  ok('displacement is 0 at -wavelength boundary', approx(edgeLo, 0), `-edge=${edgeLo}`)

  const outsideHi = ScreenFX.shockwaveDisplacement(ring + wl + 0.05, ring, wl)
  const outsideLo = ScreenFX.shockwaveDisplacement(ring - wl - 0.05, ring, wl)
  ok('displacement is exactly 0 outside ring thickness', outsideHi === 0 && outsideLo === 0,
    `hi=${outsideHi} lo=${outsideLo}`)

  ok('displacement is 0 for wavelength<=0 (guard)',
    ScreenFX.shockwaveDisplacement(ring, ring, 0) === 0 &&
    ScreenFX.shockwaveDisplacement(ring, ring, -1) === 0)

  // 안↔밖 대칭: 링 중심 기준 같은 거리면 같은 값.
  const inHalf = ScreenFX.shockwaveDisplacement(ring - wl * 0.5, ring, wl)
  const outHalf = ScreenFX.shockwaveDisplacement(ring + wl * 0.5, ring, wl)
  ok('displacement symmetric inside/outside ring center', approx(inHalf, outHalf),
    `in=${inHalf} out=${outHalf}`)

  // 마루 단조 감쇠: 중심→경계로 갈수록 값이 줄어든다.
  let monotonic = true, prev = ScreenFX.shockwaveDisplacement(ring, ring, wl)
  for (let k = 1; k <= 20; k++) {
    const d = ring + (wl * k / 20)
    const v = ScreenFX.shockwaveDisplacement(d, ring, wl)
    if (v > prev + 1e-12) monotonic = false
    prev = v
  }
  ok('displacement decays monotonically from center to edge', monotonic)

  // 값 범위 ∈ [0,1] (이 공식은 비음수 마루).
  let inRange = true
  for (let d = ring - wl; d <= ring + wl + 1e-9; d += wl / 50) {
    const v = ScreenFX.shockwaveDisplacement(d, ring, wl)
    if (v < -1e-9 || v > 1 + 1e-9) inRange = false
  }
  ok('displacement stays within [0,1]', inRange)
}

// ── 2) 시간 감쇠/전파 순수함수 shockwaveDecay ─────────────────────────────────
{
  const dur = 0.6, speed = 1.5
  const at0 = ScreenFX.shockwaveDecay(0, dur, speed)
  ok('decay at t=0 → radius 0, strength 1', at0.radius === 0 && approx(at0.strength, 1),
    JSON.stringify(at0))

  const atEnd = ScreenFX.shockwaveDecay(dur, dur, speed)
  ok('decay at t=duration → strength exactly 0 (소멸)', atEnd.strength === 0 && atEnd.progress === 1,
    JSON.stringify(atEnd))
  ok('decay radius clamps to 1 (speed>1, 화면 밖까지)', atEnd.radius === 1, `radius=${atEnd.radius}`)

  // radius 단조 증가, strength 단조 감소.
  let rPrev = -1, sPrev = 2, rMono = true, sMono = true
  for (let i = 0; i <= 60; i++) {
    const t = (dur * i) / 60
    const e = ScreenFX.shockwaveDecay(t, dur, speed)
    if (e.radius < rPrev - 1e-12) rMono = false
    if (e.strength > sPrev + 1e-12) sMono = false
    rPrev = e.radius; sPrev = e.strength
  }
  ok('decay radius increases monotonically', rMono)
  ok('decay strength decreases monotonically', sMono)

  // 경계: t<0 → progress 0, t>dur → progress 1(clamp).
  const neg = ScreenFX.shockwaveDecay(-1, dur, speed)
  const over = ScreenFX.shockwaveDecay(dur * 10, dur, speed)
  ok('decay clamps t<0 to start', neg.progress === 0 && neg.strength === 1)
  ok('decay clamps t>duration to end', over.progress === 1 && over.strength === 0)

  // duration<=0 가드(분모 0 회피) — NaN/Infinity 안 나옴.
  const z = ScreenFX.shockwaveDecay(0.1, 0, speed)
  ok('decay guards duration<=0 (no NaN/Inf)', Number.isFinite(z.radius) && Number.isFinite(z.strength),
    JSON.stringify(z))

  // 결정성: 같은 (t,dur,speed) → 같은 값.
  const a = ScreenFX.shockwaveDecay(0.27, dur, speed)
  const b = ScreenFX.shockwaveDecay(0.27, dur, speed)
  ok('decay is deterministic for same inputs',
    a.radius === b.radius && a.strength === b.strength && a.progress === b.progress)
}

// ── 모킹 유틸: Phaser(전역) + document(캔버스) ───────────────────────────────
// ScreenFX.supported 는 globalThis.Phaser.WEBGL 과 renderer.type 비교. WebGL 모킹 시
// addDisplacement 등 FilterList 를 흉내내 handle 생명주기를 검증한다.
function installPhaser(rendererType) {
  globalThis.Phaser = { WEBGL: 2, CANVAS: 1, BlendModes: { ADD: 1 } }
  return rendererType
}
function uninstallPhaser() { delete globalThis.Phaser }

// 가짜 FilterList — add* 호출을 기록. addDisplacement 만 핸들 반환(x/y 갱신 추적).
function makeFilterList(log) {
  return {
    addDisplacement(texture, x, y) {
      const f = { __type: 'displacement', texture, x, y, removed: false }
      log.displacementFilters.push(f)
      return f
    },
    remove(f) { if (f) f.removed = true; log.removeCalls++ },
    addVignette() { return {} }, addBarrel() { return {} }, addPixelate() { return {} }
  }
}

// 가짜 카메라(scene + textures + filters). external/internal 둘 다 같은 list 공유.
function makeCamera(rendererType, log) {
  const internal = makeFilterList(log)
  const external = makeFilterList(log)
  const textureStore = new Set()
  const scene = {
    sys: { renderer: { type: rendererType } },
    textures: {
      exists: (k) => textureStore.has(k),
      remove: (k) => { textureStore.delete(k); log.textureRemoves++ },
      addCanvas: (k) => { textureStore.add(k); log.textureAdds++; return { add() {} } }
    }
  }
  return { scene, filters: { internal, external }, _store: textureStore }
}

// 가짜 document — createElement('canvas') → 최소 2d 컨텍스트(createImageData/putImageData).
function installDocument(log) {
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') return {}
      log.canvasCreated++
      return {
        width: 0, height: 0,
        getContext() {
          return {
            createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
            putImageData() {}
          }
        }
      }
    }
  }
}
function uninstallDocument() { delete globalThis.document }

// ── 3) supported 가드 — non-WebGL 이면 shockwave=null ─────────────────────────
{
  installPhaser()
  installDocument({ canvasCreated: 0 })
  const log = { displacementFilters: [], removeCalls: 0, textureAdds: 0, textureRemoves: 0, canvasCreated: 0 }
  const camCanvas = makeCamera(globalThis.Phaser.CANVAS, log) // renderer.type = CANVAS
  const res = ScreenFX.shockwave(camCanvas, { duration: 0.5 })
  ok('shockwave returns null on non-WebGL (Canvas) — supported guard', res === null, `res=${res}`)
  ok('shockwave (Canvas) adds no displacement filter', log.displacementFilters.length === 0)

  // supported() 자체도 false 여야 함.
  ok('ScreenFX.supported is false for Canvas renderer', ScreenFX.supported(camCanvas) === false)
  uninstallDocument()
  uninstallPhaser()
}

// ── 4) handle 생명주기 — WebGL+document 모킹 ─────────────────────────────────
{
  installPhaser()
  const log = { displacementFilters: [], removeCalls: 0, textureAdds: 0, textureRemoves: 0, canvasCreated: 0 }
  installDocument(log)
  const cam = makeCamera(globalThis.Phaser.WEBGL, log)

  const dur = 0.6, speed = 1.5, amp = 0.02
  const sw = ScreenFX.shockwave(cam, { duration: dur, speed, amplitude: amp, size: 16 })
  ok('shockwave returns a handle on WebGL', sw && typeof sw.update === 'function', `sw=${!!sw}`)
  ok('shockwave adds exactly one displacement filter', log.displacementFilters.length === 1)
  ok('shockwave initial displacement x/y = amplitude', log.displacementFilters[0] &&
    approx(log.displacementFilters[0].x, amp) && approx(log.displacementFilters[0].y, amp))
  ok('shockwave bakes a displacement canvas at init', log.canvasCreated >= 1 && log.textureAdds >= 1)

  const DT = 1 / 60
  // 절반(t≈dur/2)까지 진행 → strength 감쇠·radius 확장.
  let alive = true, steps = 0
  while (alive && steps < 30) { alive = sw.update(DT); steps++ } // 30프레임=0.5s < 0.6s
  ok('handle alive mid-flight (t<duration)', alive === true, `steps=${steps} t=${sw.t.toFixed(3)}`)
  ok('strength decayed below 1 mid-flight', sw.strength < 1 && sw.strength > 0, `strength=${sw.strength}`)
  ok('radius expanded above 0 mid-flight', sw.radius > 0, `radius=${sw.radius}`)
  ok('displacement x/y scaled down by strength', approx(log.displacementFilters[0].x, amp * sw.strength),
    `x=${log.displacementFilters[0].x} expected=${amp * sw.strength}`)
  ok('displacement map re-baked each update', log.canvasCreated > 1, `canvasCreated=${log.canvasCreated}`)

  // duration 경과까지 → 자동 소멸(false 반환, 필터/텍스처 정리).
  let died = false
  for (let i = 0; i < 30 && !died; i++) { if (sw.update(DT) === false) died = true }
  ok('handle returns false after duration elapses (소멸)', died === true)
  ok('handle marked done after expiry', sw.done === true)
  ok('displacement filter removed on expiry', log.displacementFilters[0].removed === true || log.removeCalls >= 1)
  ok('shockwave texture removed on expiry', cam._store.size === 0, `store=${cam._store.size}`)
  ok('update after done returns false (idempotent)', sw.update(DT) === false)

  uninstallDocument()
  uninstallPhaser()
}

// ── 4-b) update dt 가드(NaN/음수/Infinity) + destroy() 즉시 정리 ──────────────
{
  installPhaser()
  const log = { displacementFilters: [], removeCalls: 0, textureAdds: 0, textureRemoves: 0, canvasCreated: 0 }
  installDocument(log)
  const cam = makeCamera(globalThis.Phaser.WEBGL, log)
  const sw = ScreenFX.shockwave(cam, { duration: 0.6, size: 16 })

  const t0 = sw.t
  sw.update(NaN)
  ok('update(NaN): t unchanged (guard)', sw.t === t0, `t=${sw.t}`)
  sw.update(-0.5)
  ok('update(negative): t unchanged (guard)', sw.t === t0, `t=${sw.t}`)
  sw.update(Infinity)
  ok('update(Infinity): t unchanged + still finite', sw.t === t0 && Number.isFinite(sw.t), `t=${sw.t}`)
  // 정상 dt 면 진행.
  sw.update(1 / 60)
  ok('update(valid dt): t advances', sw.t > t0, `t=${sw.t}`)

  // destroy(): 즉시 정리 + 이후 update false.
  sw.destroy()
  ok('destroy() marks done', sw.done === true)
  ok('destroy() removes texture', cam._store.size === 0)
  ok('update after destroy returns false', sw.update(1 / 60) === false)

  uninstallDocument()
  uninstallPhaser()
}

// ── 5) 결정성 — 소스 정적 검사(시각함수 0) + handle (radius,strength) 수열 동일 ──
{
  const src = readFileSync(SCREENFX_PATH, 'utf8')
  // 주석/문자열 속 'Date.now()' 언급은 제거 후 검사(lint-kit-deps 와 동일 정신).
  // 간단 검사: 실제 호출 패턴만 — 소스에서 주석(// , /* */) 제거 후 매칭.
  const noComments = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
  const hasRandom = /Math\s*\.\s*random\s*\(/.test(noComments)
  const hasDateNow = /Date\s*\.\s*now\s*\(/.test(noComments)
  const hasPerfNow = /performance\s*\.\s*now\s*\(/.test(noComments)
  ok('screenfx.js uses no Math.random() (determinism)', !hasRandom)
  ok('screenfx.js uses no Date.now() (determinism)', !hasDateNow)
  ok('screenfx.js uses no performance.now() (determinism)', !hasPerfNow)

  // handle (radius,strength) 수열 결정성: 같은 파라미터·같은 dt 시퀀스 → 동일.
  installPhaser()
  function runSeq() {
    const log = { displacementFilters: [], removeCalls: 0, textureAdds: 0, textureRemoves: 0, canvasCreated: 0 }
    installDocument(log)
    const cam = makeCamera(globalThis.Phaser.WEBGL, log)
    const sw = ScreenFX.shockwave(cam, { duration: 0.6, speed: 1.5, size: 16 })
    const seq = []
    for (let i = 0; i < 40; i++) {
      const alive = sw.update(1 / 60)
      seq.push(sw.radius, sw.strength)
      if (!alive) break
    }
    uninstallDocument()
    return seq
  }
  const s1 = runSeq(), s2 = runSeq()
  ok('handle (radius,strength) sequence is deterministic',
    s1.length === s2.length && s1.every((v, i) => v === s2[i]),
    `len=${s1.length} vs ${s2.length}`)
  uninstallPhaser()
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
