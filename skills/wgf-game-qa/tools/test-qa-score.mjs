#!/usr/bin/env node
// test-qa-score.mjs — qa-score-core 순수 코어 단위테스트 (합성 fixture 점수 차등 실증)
// ─────────────────────────────────────────────────────────────────────────────
// qa-score-core.mjs 의 VU/BH/IA 점수 함수를, 외부 의존(Phaser/DOM/네트워크) 없이
// 합성 fixture 로 검증한다. 핵심은 "점수 차등의 방향성" 을 수치로 박는 것:
//
//   VU: 정상(엔트로피 높음·모션 있음) = 고점  ↔  검은화면(전 픽셀 0) = 저점
//                                          ↔  정지(두 프레임 동일) = 저점
//   BH: lint 통과·콘솔 0·무크래시 = 고점  ↔  lint 실패/콘솔 에러/크래시 = 저점
//   IA: 스펙 요구 요소 충족 = 고점        ↔  의도 누락(요구 요소 부재) = 저점
//
// 결정성: 모든 fixture 는 고정 값(시각함수·무작위 없음). 같은 실행 → 같은 점수.
//   픽셀 fixture 의 "노이즈 프레임" 도 결정적 패턴(인덱스 기반 의사난수)으로 생성.
//
// 출력 계약: 사람용 라인들 먼저, 마지막 줄 단일 JSON:
//   {"ok":bool,"pass":n,"fail":n,"cases":[...]}
// 종료코드: 전부 통과 → 0, 하나라도 실패 → 1.
// ─────────────────────────────────────────────────────────────────────────────

// 사이드카 순수 코어는 같은 디렉터리의 ESM — 상대 specifier 로 정적 import
// (Windows 절대경로는 file:// URL 이 아니면 ESM 로더가 거부하므로 상대 import 가 정답).
import {
  toLuminance, frameEntropy, isBlackFrame, frameMotion,
  vuScore, bhScore, iaScore, specFromBible, composeReport
} from './qa-score-core.mjs'

// ── 미니 단언 프레임워크 ──────────────────────────────────────────────────────
let pass = 0, fail = 0
const cases = []

function ok(name, cond, detail) {
  if (cond) {
    pass++
    console.log(`✓ ${name}`)
    cases.push({ name, ok: true, detail: detail || '' })
  } else {
    fail++
    console.log(`✗ ${name} — ${detail || '단언 실패'}`)
    cases.push({ name, ok: false, detail: detail || 'assert failed' })
  }
}

/** a > b 를 수치 단서와 함께 단언(점수 차등 검증의 주력). */
function gt(name, a, b, margin) {
  margin = margin || 0
  const cond = a > b + margin
  ok(name, cond, `${a} > ${b}${margin ? ` + ${margin}` : ''}`)
}

// ── 합성 픽셀 fixture 생성기 ──────────────────────────────────────────────────
const W = 16, H = 16, N = W * H   // 작은 16x16 프레임(테스트 빠름·결정적)

/** 전 픽셀 0 (완전 검은화면) RGBA 프레임. */
function blackFrameRGBA() {
  return new Array(N * 4).fill(0)
}

/** 단색(중간 회색) RGBA 프레임 — 엔트로피 0 이지만 검정은 아님(정지 판정용). */
function flatGrayFrameRGBA(v) {
  v = v == null ? 128 : v
  const px = new Array(N * 4)
  for (let i = 0; i < N; i++) {
    px[i * 4] = v; px[i * 4 + 1] = v; px[i * 4 + 2] = v; px[i * 4 + 3] = 255
  }
  return px
}

/**
 * 고엔트로피 RGBA 프레임 — 결정적 의사난수 패턴(시각함수·Math.random 미사용).
 * seed 와 인덱스로 값이 흩어져 휘도 분포가 넓어진다(엔트로피 높음).
 */
function noisyFrameRGBA(seed) {
  seed = (seed | 0) || 1
  const px = new Array(N * 4)
  let s = seed >>> 0
  for (let i = 0; i < N; i++) {
    // xorshift 류 결정적 정수 해시(인덱스+seed) — 외부 무작위 0.
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    const r = (s) & 255
    const g = (s >> 8) & 255
    const b = (s >> 16) & 255
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255
  }
  return px
}

// ════════════════════════════════════════════════════════════════════════════
// 1) VU — 검은화면·정지 vs 정상
// ════════════════════════════════════════════════════════════════════════════

// 휘도 변환·기본 지표 sanity
{
  const blackLum = toLuminance(blackFrameRGBA(), 4)
  const noisyLum = toLuminance(noisyFrameRGBA(12345), 4)
  ok('toLuminance 길이 = 픽셀 수', blackLum.length === N && noisyLum.length === N,
    `black=${blackLum.length} noisy=${noisyLum.length} expected=${N}`)
  ok('검은 프레임 엔트로피 ≈ 0', frameEntropy(blackLum) === 0, `H=${frameEntropy(blackLum)}`)
  gt('노이즈 프레임 엔트로피 > 검은 프레임', frameEntropy(noisyLum), frameEntropy(blackLum), 1)
  ok('isBlackFrame: 검은 프레임 true', isBlackFrame(blackLum) === true)
  ok('isBlackFrame: 노이즈 프레임 false', isBlackFrame(noisyLum) === false)
}

// 모션: 동일 프레임=0, 다른 프레임>0
{
  const a = toLuminance(noisyFrameRGBA(111), 4)
  const b = toLuminance(noisyFrameRGBA(111), 4)   // 같은 seed → 동일
  const c = toLuminance(noisyFrameRGBA(222), 4)   // 다른 seed → 차이
  ok('frameMotion 동일 프레임 = 0', frameMotion(a, b) === 0, `motion=${frameMotion(a, b)}`)
  gt('frameMotion 다른 프레임 > 0', frameMotion(a, c), 0)
}

// VU 점수 차등 — 정상 ↔ 검은화면 ↔ 정지
let vuNormal, vuBlack, vuFrozen
{
  // 정상: 매 프레임 다른 노이즈(엔트로피 높음 + 모션 있음)
  const normalFrames = []
  for (let i = 0; i < 8; i++) normalFrames.push(toLuminance(noisyFrameRGBA(1000 + i * 7), 4))
  vuNormal = vuScore(normalFrames)

  // 검은화면: 전 픽셀 0 인 프레임만(엔트로피 0 + 검은화면)
  const blackFrames = []
  for (let i = 0; i < 8; i++) blackFrames.push(toLuminance(blackFrameRGBA(), 4))
  vuBlack = vuScore(blackFrames)

  // 정지: 같은 비검정 프레임 반복(모션 0 + 엔트로피 0 이지만 검정 아님)
  const frozenFrames = []
  const frozen = toLuminance(flatGrayFrameRGBA(128), 4)
  for (let i = 0; i < 8; i++) frozenFrames.push(frozen)
  vuFrozen = vuScore(frozenFrames)

  console.log(`  [VU] normal=${vuNormal.vu} black=${vuBlack.vu} frozen=${vuFrozen.vu}`)

  gt('VU 정상 > 검은화면', vuNormal.vu, vuBlack.vu, 20)
  gt('VU 정상 > 정지', vuNormal.vu, vuFrozen.vu, 10)
  ok('VU 검은화면 flag=black-screen', vuBlack.flags.includes('black-screen'),
    `flags=${JSON.stringify(vuBlack.flags)}`)
  ok('VU 정지 flag=frozen', vuFrozen.flags.includes('frozen'),
    `flags=${JSON.stringify(vuFrozen.flags)}`)
  ok('VU 정상 점수 충분히 높음(≥60)', vuNormal.vu >= 60, `vu=${vuNormal.vu}`)
  ok('VU 검은화면 점수 낮음(<40)', vuBlack.vu < 40, `vu=${vuBlack.vu}`)
  // 빈 프레임 시퀀스 방어
  ok('VU 빈 시퀀스 = 0 + no-frames', vuScore([]).vu === 0 && vuScore([]).flags.includes('no-frames'))
}

// ════════════════════════════════════════════════════════════════════════════
// 2) BH — lint·콘솔·크래시
// ════════════════════════════════════════════════════════════════════════════
let bhHealthy, bhLintFail, bhConsole, bhCrash
{
  const lintsPass = [
    { id: 'rng', ok: true, errors: 0, warnings: 0 },
    { id: 'juice', ok: true, errors: 0, warnings: 0 },
    { id: 'particles', ok: true, errors: 0, warnings: 0 },
    { id: 'kit-deps', ok: true, errors: 0, warnings: 0 }
  ]

  // 건강: lint 전부 통과 + 콘솔 0 + 120/120 무크래시
  bhHealthy = bhScore({ lints: lintsPass, consoleErrors: 0, stepFrames: 120, stepTarget: 120, stepCrashed: false })

  // lint 실패: rng lint 에러
  const lintsFail = [
    { id: 'rng', ok: false, errors: 3, warnings: 0 },
    { id: 'juice', ok: true, errors: 0, warnings: 0 },
    { id: 'particles', ok: true, errors: 0, warnings: 0 },
    { id: 'kit-deps', ok: true, errors: 0, warnings: 0 }
  ]
  bhLintFail = bhScore({ lints: lintsFail, consoleErrors: 0, stepFrames: 120, stepTarget: 120, stepCrashed: false })

  // 콘솔 에러: 통과 lint + 콘솔 에러 4건
  bhConsole = bhScore({ lints: lintsPass, consoleErrors: 4, stepFrames: 120, stepTarget: 120, stepCrashed: false })

  // 크래시: step 중 throw
  bhCrash = bhScore({ lints: lintsPass, consoleErrors: 0, stepFrames: 12, stepTarget: 120, stepCrashed: true })

  console.log(`  [BH] healthy=${bhHealthy.bh} lintFail=${bhLintFail.bh} console=${bhConsole.bh} crash=${bhCrash.bh}`)

  ok('BH 건강 = 100', bhHealthy.bh === 100, `bh=${bhHealthy.bh}`)
  gt('BH 건강 > lint실패', bhHealthy.bh, bhLintFail.bh, 5)
  gt('BH 건강 > 콘솔에러', bhHealthy.bh, bhConsole.bh, 5)
  gt('BH 건강 > 크래시', bhHealthy.bh, bhCrash.bh, 20)
  ok('BH lint실패 flag', bhLintFail.flags.some(f => f.startsWith('lint-fail:')) && bhLintFail.failedLints.includes('rng'),
    `flags=${JSON.stringify(bhLintFail.flags)}`)
  ok('BH 콘솔에러 4건 → consoleTerm=0', bhConsole.consoleTerm === 0, `consoleTerm=${bhConsole.consoleTerm}`)
  ok('BH 크래시 → crashTerm=0', bhCrash.crashTerm === 0, `crashTerm=${bhCrash.crashTerm}`)
  ok('BH lint 없으면 중립(감점 안 함)', bhScore({ consoleErrors: 0, stepFrames: 1, stepTarget: 1 }).lintTerm === 1)
}

// ════════════════════════════════════════════════════════════════════════════
// 3) IA — 스펙 충족 vs 의도 누락
// ════════════════════════════════════════════════════════════════════════════
let iaFull, iaMissing, iaNoSpec
{
  // 산출물 텍스트(game.js/index.html 발췌 모사)
  const artifact = `
    var GAME_INPUT = { left: false, right: false, up: false };
    this.coinTxt.setText('x' + coins);
    this.scoreTxt.setText('SCORE ' + score);
    function jump() { hero.body.velocity.y = -JUMP; }
    this.banner.setText('스테이지 클리어');
  `
  // 충족: 산출물에 모두 존재하는 요구
  const specFull = { require: ['coin', 'score', 'jump', '스테이지'] }
  iaFull = iaScore(specFull, artifact)

  // 누락: 산출물에 없는 요구 다수(double-jump·인벤토리·보스)
  const specMissing = { require: ['coin', 'double-jump', '인벤토리', '보스전', 'leaderboard'] }
  iaMissing = iaScore(specMissing, artifact)

  // 스펙 미주입: require 빈 배열 → 중립
  iaNoSpec = iaScore({ require: [] }, artifact)

  console.log(`  [IA] full=${iaFull.ia} missing=${iaMissing.ia} noSpec=${iaNoSpec.ia}`)

  ok('IA 충족 = 100', iaFull.ia === 100, `ia=${iaFull.ia} matched=${JSON.stringify(iaFull.matched)}`)
  gt('IA 충족 > 의도누락', iaFull.ia, iaMissing.ia, 30)
  ok('IA 누락 항목 보고', iaMissing.missing.length === 4 && iaMissing.flags.some(f => f.startsWith('intent-missing:')),
    `missing=${JSON.stringify(iaMissing.missing)}`)
  ok('IA 누락 점수 낮음(<40)', iaMissing.ia < 40, `ia=${iaMissing.ia}`)
  ok('IA 스펙 미주입 → 중립 100 + no-spec', iaNoSpec.ia === 100 && iaNoSpec.flags.includes('no-spec'),
    `ia=${iaNoSpec.ia} flags=${JSON.stringify(iaNoSpec.flags)}`)

  // optional 보너스: 코어 부분점수 + optional 일치 시 가산
  const specOpt = { require: ['coin', 'boss'], optional: ['score', 'jump'] }
  const iaOpt = iaScore(specOpt, artifact)
  // require 2개 중 coin 만 일치(0.5) + optional 2개 다 일치(+0.15) = 0.65 → 65
  ok('IA optional 보너스 가산', iaOpt.ia === 65 && iaOpt.matchedOptional.length === 2,
    `ia=${iaOpt.ia} bonus=${iaOpt.bonus} matchedOpt=${JSON.stringify(iaOpt.matchedOptional)}`)
}

// ════════════════════════════════════════════════════════════════════════════
// 4) 바이블 파싱 + 3축 합성
// ════════════════════════════════════════════════════════════════════════════
{
  const md = [
    '# 게임 제목',
    '## 코어 동사',
    '플레이어는 **점프** 와 **대시** 로 이동한다.',
    '### 적',
    '**슬라임** 이 등장한다.'
  ].join('\n')
  const spec = specFromBible(md)
  ok('specFromBible 헤딩+굵게 추출', spec.require.includes('점프') && spec.require.includes('대시') && spec.require.includes('슬라임') && spec.require.includes('코어 동사'),
    `require=${JSON.stringify(spec.require)}`)
  // 같은 입력 → 같은 출력(결정성)
  ok('specFromBible 결정적', JSON.stringify(specFromBible(md)) === JSON.stringify(spec))

  // 3축 합성 — ok 게이트
  const good = composeReport({ bh: bhHealthy, vu: vuNormal, ia: iaFull })
  ok('합성 정상 ok=true (3축 모두 ≥60)', good.ok === true && good.bh > 0 && good.vu > 0 && good.ia > 0,
    `ok=${good.ok} bh=${good.bh} vu=${good.vu} ia=${good.ia}`)

  const bad = composeReport({ bh: bhHealthy, vu: vuBlack, ia: iaFull })
  ok('합성 검은화면 ok=false (VU 미달)', bad.ok === false, `vu=${bad.vu} ok=${bad.ok}`)
}

// ── 출력 계약: 마지막 줄 단일 JSON ───────────────────────────────────────────
console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, cases }))
process.exit(fail === 0 ? 0 : 1)
