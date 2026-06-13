// qa-score-core.mjs — BH/VU/IA 3축 QA 점수 순수 분석 코어 (Phaser/DOM 무의존)
// ─────────────────────────────────────────────────────────────────────────────
// "3축 품질 점수"의 *순수 계산부*. JuiceKit/RngForge 처럼 외부 상태(DOM·시각·Phaser·
// 파일·네트워크) 의존 0 으로, Node 에서 require/import 만으로 헤드리스 단위테스트가
// 가능하다. 실제 게임 픽셀·lint 결과·스펙을 *뽑아오는* 부분(캡처 어댑터)은 qa-score.mjs
// 가 담당하고, 여기서는 그 입력을 받아 점수만 낸다 — 그래서 합성 fixture 로 점수 차등을
// 결정적으로 실증할 수 있다.
//
// 3축 정의:
//   BH (Build Health)     — 빌드/렌더 무오류. 입력: lint 통과 여부 + 게임 로드 콘솔
//                           에러 수 + game.step N프레임 무크래시. 항목 가중 합(0~100).
//   VU (Visual Usability) — 프레임 엔트로피·프레임간 모션 휴리스틱으로 검은화면
//                           (엔트로피≈0)·정지(프레임간 모션≈0)를 감지. 픽셀 배열 입력.
//                           ⚠ 외부 VLM 미사용 — 순수 통계만.
//   IA (Intent Alignment) — 요구사항 스펙 vs 산출물 텍스트 대조. 스펙이 요구한 요소가
//                           산출물(game.js/index.html 텍스트 등)에 존재하는 비율.
//
// 결정성: Math.random/Date.now/performance.now 미사용. 같은 입력 → 항상 같은 점수.
//   (게임 본체의 결정론 철학과 동형 — 점수도 재현 가능해야 회귀를 잡는다.)
//
// 헤드리스(Node require/import) 가능 — JuiceKit/RngForge 와 동일하게 순수.
// IIFE+global+module.exports 가 아니라 ESM export 인 이유: 이 파일은 engine/ 킷이
//   아니라 tools/ 의 분석 코어다(manifest 등록·BehaviorKit 계약 대상 아님). qa-score.mjs·
//   test-qa-score.mjs 가 import 해서 공유하며, 둘 다 ESM(.mjs)이라 정합한다.
// ─────────────────────────────────────────────────────────────────────────────

// ── 작은 수치 헬퍼 ────────────────────────────────────────────────────────────
/** [lo,hi] 로 clamp. */
export function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo
  return v < lo ? lo : v > hi ? hi : v
}

/** 내부: 소수 4자리 반올림(직렬화 안정·결정성). */
export function round4(v) {
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 10000) / 10000
}

/** 0~1 점수 → 0~100 정수(반올림). 점수 합성의 단일 라운딩 지점. */
export function pct(score01) {
  return Math.round(clamp(score01, 0, 1) * 100)
}

// ════════════════════════════════════════════════════════════════════════════
// VU — 픽셀 통계 (검은화면·정지 감지)
// ════════════════════════════════════════════════════════════════════════════
//
// 픽셀 입력 규약: 프레임 하나는 0~255 정수 1차원 배열.
//   - RGBA(채널 4) 또는 RGB(채널 3) 또는 grayscale(채널 1) 모두 허용.
//   - channels 인자로 채널 수를 명시(기본 4=RGBA). 알파 채널은 휘도 계산에서 제외.
//   - canvas.getImageData().data(Uint8ClampedArray) 를 그대로 먹일 수 있다.

/** 픽셀 배열 → 휘도(0~255) 배열. RGB→Rec.601 가중 휘도, grayscale 은 그대로. */
export function toLuminance(pixels, channels) {
  channels = channels || 4
  const out = []
  if (channels === 1) {
    for (let i = 0; i < pixels.length; i++) out.push(pixels[i] & 255)
    return out
  }
  for (let i = 0; i + channels - 1 < pixels.length; i += channels) {
    const r = pixels[i] & 255
    const g = pixels[i + 1] & 255
    const b = pixels[i + 2] & 255
    // Rec.601 휘도 — 사람 눈 가중. round 로 정수화(결정성·히스토그램 빈 안정).
    out.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b))
  }
  return out
}

/**
 * 샤논 엔트로피(bits, 0~8) — 휘도 히스토그램(256 bin) 기준.
 * 전 픽셀 동일(단색·검은화면) → 0. 균등 분포(노이즈) → 8 에 근접.
 * 검은화면/단색 정적화면을 "정보량 0" 으로 잡는 핵심 지표.
 */
export function frameEntropy(luminance) {
  const n = luminance.length
  if (n === 0) return 0
  const hist = new Array(256).fill(0)
  for (let i = 0; i < n; i++) hist[luminance[i] & 255]++
  let H = 0
  for (let b = 0; b < 256; b++) {
    if (hist[b] === 0) continue
    const p = hist[b] / n
    H -= p * Math.log2(p)
  }
  return H
}

/**
 * 검은화면 판정 — 평균 휘도가 임계 이하면 true.
 * 전 픽셀 0(완전 검정) 뿐 아니라 거의 검은 화면(blackLevel 기본 8)도 잡는다.
 */
export function isBlackFrame(luminance, blackLevel) {
  blackLevel = blackLevel == null ? 8 : blackLevel
  const n = luminance.length
  if (n === 0) return true
  let sum = 0
  for (let i = 0; i < n; i++) sum += luminance[i]
  return (sum / n) <= blackLevel
}

/**
 * 두 프레임 사이 모션(0~1) — 휘도 평균절대차 / 255.
 * 두 프레임이 픽셀 동일(정지) → 0. 화면 전체가 바뀜 → 1 에 근접.
 * 길이가 다르면 짧은 쪽 기준(캡처 해상도 변동 방어).
 */
export function frameMotion(lumA, lumB) {
  const n = Math.min(lumA.length, lumB.length)
  if (n === 0) return 0
  let acc = 0
  for (let i = 0; i < n; i++) acc += Math.abs(lumA[i] - lumB[i])
  return clamp((acc / n) / 255, 0, 1)
}

/**
 * VU 점수 계산 — 프레임 시퀀스(휘도 배열들의 배열)를 받아 0~100.
 *
 * 입력: frames = [ luminance[], luminance[], ... ]  (toLuminance 결과들; 시간순)
 * 옵션: { blackLevel, motionEps, entropyTarget }
 *
 * 판정 로직(휴리스틱):
 *   - 검은화면 비율(blackRatio): 검은 프레임 / 전체. 높을수록 감점(가중 0.45).
 *   - 평균 엔트로피(avgEntropy): 0~8 → 0~1 정규화(entropyTarget=6 에서 만점). 가중 0.30.
 *   - 모션 활성도(motionRatio): 인접 프레임 중 모션>motionEps 인 비율. 정지화면 감점.
 *                              가중 0.25. (프레임 1장뿐이면 모션 평가 불가 → 중립 1.0)
 *
 * 합성: vu01 = 0.30*entropyTerm + 0.25*motionTerm + 0.45*(1-blackRatio)
 *   → 검은화면 전부면 blackRatio=1·entropy≈0 → 저점. 정지면 motionTerm=0 → 감점.
 *
 * flags 에 어떤 항목이 깎였는지 사람이 읽을 단서를 담아 반환.
 */
export function vuScore(frames, opts) {
  opts = opts || {}
  const blackLevel = opts.blackLevel == null ? 8 : opts.blackLevel
  const motionEps = opts.motionEps == null ? 0.01 : opts.motionEps   // 1% 휘도 변화 미만 = 정지
  const entropyTarget = opts.entropyTarget == null ? 6 : opts.entropyTarget

  const frameCount = frames.length
  if (frameCount === 0) {
    return { vu: 0, blackRatio: 1, avgEntropy: 0, motionRatio: 0, avgMotion: null, frames: 0, flags: ['no-frames'] }
  }

  // 검은화면 비율 + 평균 엔트로피
  let blackCount = 0
  let entSum = 0
  for (let i = 0; i < frameCount; i++) {
    if (isBlackFrame(frames[i], blackLevel)) blackCount++
    entSum += frameEntropy(frames[i])
  }
  const blackRatio = blackCount / frameCount
  const avgEntropy = entSum / frameCount

  // 인접 프레임 모션 활성도
  let motionRatio = 1   // 프레임 1장이면 모션 평가 불가 → 중립(감점 안 함)
  let avgMotion = null
  if (frameCount >= 2) {
    let active = 0
    let motSum = 0
    for (let i = 1; i < frameCount; i++) {
      const m = frameMotion(frames[i - 1], frames[i])
      motSum += m
      if (m > motionEps) active++
    }
    motionRatio = active / (frameCount - 1)
    avgMotion = motSum / (frameCount - 1)
  }

  // 항목별 0~1 term
  const entropyTerm = clamp(avgEntropy / entropyTarget, 0, 1)
  const motionTerm = clamp(motionRatio, 0, 1)
  const blackTerm = clamp(1 - blackRatio, 0, 1)

  const vu01 = 0.30 * entropyTerm + 0.25 * motionTerm + 0.45 * blackTerm

  // 사람용 단서 플래그
  const flags = []
  if (blackRatio >= 0.5) flags.push('black-screen')        // 절반 이상 검은 프레임
  if (frameCount >= 2 && motionRatio <= 0.05) flags.push('frozen')  // 거의 모든 프레임이 정지
  if (avgEntropy < 1) flags.push('low-entropy')            // 단색에 가까움

  return {
    vu: pct(vu01),
    blackRatio: round4(blackRatio),
    avgEntropy: round4(avgEntropy),
    motionRatio: round4(motionRatio),
    avgMotion: avgMotion == null ? null : round4(avgMotion),
    frames: frameCount,
    flags
  }
}

// ════════════════════════════════════════════════════════════════════════════
// BH — 빌드 헬스 (lint·콘솔·크래시)
// ════════════════════════════════════════════════════════════════════════════
//
// 입력 규약(bhInput):
//   {
//     lints: [{ id:'rng', ok:bool, errors:n, warnings:n }, ...],   // lint 도구 결과들
//     consoleErrors: n,        // 게임 로드 중 콘솔 에러(TypeError/Uncaught 등) 수
//     stepFrames: n,           // game.step 으로 무크래시 전진한 프레임 수(목표 대비)
//     stepTarget: n,           // 목표 프레임 수(예 120). stepFrames>=stepTarget 면 만점.
//     stepCrashed: bool        // step 중 throw 가 났는가
//   }
//
// 가중(0~1 합):
//   lintTerm  0.40 — 모든 lint error 0 이면 1, 아니면 통과 lint 비율로 부분점수.
//   consoleTerm 0.30 — 콘솔 에러 0 이면 1, 1건당 0.25 감점(4건이면 0).
//   crashTerm 0.30 — 무크래시 + stepFrames/stepTarget 도달률. 크래시 시 0.

/** BH 점수 — bhInput → {bh, lintTerm, consoleTerm, crashTerm, failedLints, flags}. */
export function bhScore(bhInput) {
  const inp = bhInput || {}
  const lints = Array.isArray(inp.lints) ? inp.lints : []
  const consoleErrors = Math.max(0, inp.consoleErrors | 0)
  const stepTarget = inp.stepTarget > 0 ? inp.stepTarget : 1
  const stepFrames = Math.max(0, inp.stepFrames | 0)
  const stepCrashed = !!inp.stepCrashed

  // lintTerm: lint 가 하나도 없으면 평가 불가 → 중립 1.0(감점 안 함).
  //   있으면 (통과 lint 수 / 전체) — 단 error 가 하나라도 있는 lint 는 실패로.
  let lintTerm = 1
  const failedLints = []
  if (lints.length > 0) {
    let passed = 0
    for (const l of lints) {
      const lintOk = l && (l.ok === true || ((l.errors | 0) === 0 && l.ok !== false))
      if (lintOk) passed++
      else failedLints.push(l && l.id ? l.id : 'unknown')
    }
    lintTerm = passed / lints.length
  }

  // consoleTerm: 에러 1건당 0.25 감점(4건+ → 0).
  const consoleTerm = clamp(1 - consoleErrors * 0.25, 0, 1)

  // crashTerm: 크래시면 0. 아니면 프레임 도달률(stepFrames/stepTarget, 1 cap).
  const reach = clamp(stepFrames / stepTarget, 0, 1)
  const crashTerm = stepCrashed ? 0 : reach

  const bh01 = 0.40 * lintTerm + 0.30 * consoleTerm + 0.30 * crashTerm

  const flags = []
  if (failedLints.length > 0) flags.push('lint-fail:' + failedLints.join(','))
  if (consoleErrors > 0) flags.push('console-errors:' + consoleErrors)
  if (stepCrashed) flags.push('step-crash')
  else if (reach < 1) flags.push('step-short:' + stepFrames + '/' + stepTarget)

  return {
    bh: pct(bh01),
    lintTerm: round4(lintTerm),
    consoleTerm: round4(consoleTerm),
    crashTerm: round4(crashTerm),
    failedLints,
    flags
  }
}

// ════════════════════════════════════════════════════════════════════════════
// IA — 의도 정합 (요구사항 스펙 vs 산출물)
// ════════════════════════════════════════════════════════════════════════════
//
// 입력 규약:
//   spec     = { require: [ "코인", "점프", ... ], optional?: [ ... ] }
//              각 항목은 산출물 텍스트에서 찾을 키워드/구. (바이블 파싱 결과도 동형)
//   artifact = 산출물 전체 텍스트(game.js + index.html + STYLE.md 등 이어붙인 한 덩어리)
//              또는 문자열 배열(여러 파일) — 합쳐서 대조.
//
// 판정: require 항목 중 산출물에 (대소문자 무시) 부분일치하는 비율 = 핵심 점수.
//   optional 은 보너스(있으면 가산, 없어도 감점 X).
//
// 가중: iaCore = (matched require / total require).  optional 은 최대 +0.15 보너스.
//   require 가 비면(스펙 미주입) 평가 불가 → 중립 1.0 + flag('no-spec').

/** 산출물 입력(문자열 또는 배열) → 소문자 단일 텍스트. */
function normalizeArtifact(artifact) {
  if (Array.isArray(artifact)) return artifact.join('\n').toLowerCase()
  return String(artifact || '').toLowerCase()
}

/** 한 요구 항목이 산출물에 존재하는가(대소문자 무시 부분일치). */
function specItemPresent(item, hayLower) {
  const needle = String(item == null ? '' : item).toLowerCase().trim()
  if (needle === '') return true   // 빈 항목은 무의미 → 충족으로(스펙 작성자 의도 보존)
  return hayLower.indexOf(needle) !== -1
}

/** IA 점수 — (spec, artifact) → {ia, matched, missing, matchedOptional, total, bonus, flags}. */
export function iaScore(spec, artifact) {
  const s = spec || {}
  const required = Array.isArray(s.require) ? s.require : []
  const optional = Array.isArray(s.optional) ? s.optional : []
  const hay = normalizeArtifact(artifact)

  const flags = []

  // require 평가
  let coreTerm = 1   // 스펙 미주입이면 중립(감점 안 함)
  const matched = []
  const missing = []
  if (required.length > 0) {
    for (const item of required) {
      if (specItemPresent(item, hay)) matched.push(item)
      else missing.push(item)
    }
    coreTerm = matched.length / required.length
  } else {
    flags.push('no-spec')
  }

  // optional 보너스(최대 +0.15)
  let bonus = 0
  const matchedOptional = []
  if (optional.length > 0) {
    let hit = 0
    for (const item of optional) {
      if (specItemPresent(item, hay)) { hit++; matchedOptional.push(item) }
    }
    bonus = 0.15 * (hit / optional.length)
  }

  const ia01 = clamp(coreTerm + bonus, 0, 1)

  if (missing.length > 0) flags.push('intent-missing:' + missing.length)

  return {
    ia: pct(ia01),
    matched,
    missing,
    matchedOptional,
    total: required.length,
    bonus: round4(bonus),
    flags
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 바이블 파싱 (STORY.md/STYLE.md/AUDIO.md 류 → spec.require)
// ════════════════════════════════════════════════════════════════════════════
//
// 게임 의도 바이블은 드물지만(cozy-crypt STYLE.md·sound-lab AUDIO.md 정도), 있으면
// 마크다운에서 요구 요소 후보를 뽑는다. 휴리스틱: 헤딩(`#`) 텍스트 + 굵게(`**...**`)
// 강조 토큰을 요구 키워드 후보로 수집(과수집 방지로 상위 N 개 + 중복 제거).
// 점수 자체는 iaScore 가 내므로, 여기서는 require 배열만 만든다(결정적·시각함수 무).

/** 마크다운 텍스트 → { require:[...] } 추정 스펙. */
export function specFromBible(markdown, opts) {
  opts = opts || {}
  const maxItems = opts.maxItems == null ? 20 : opts.maxItems
  const text = String(markdown || '')
  const candidates = []
  const seen = Object.create(null)

  const push = (raw) => {
    const t = String(raw || '').trim()
    if (t.length < 2 || t.length > 40) return        // 너무 짧/긴 토큰 제외
    const key = t.toLowerCase()
    if (seen[key]) return
    seen[key] = true
    candidates.push(t)
  }

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    // 헤딩 텍스트
    const h = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (h) push(h[1])
    // 굵게 강조 토큰(여러 개 가능)
    const boldRe = /\*\*(.+?)\*\*/g
    let m
    while ((m = boldRe.exec(line)) !== null) push(m[1])
    if (candidates.length >= maxItems) break
  }

  return { require: candidates.slice(0, maxItems) }
}

// ════════════════════════════════════════════════════════════════════════════
// 3축 합성
// ════════════════════════════════════════════════════════════════════════════

/**
 * 3축 점수를 하나의 리포트 객체로 합성.
 * 입력: { vu, bh, ia } — 각각 vuScore/bhScore/iaScore 의 반환 객체.
 * ok 판정: 세 축 모두 임계(기본 60) 이상이면 true.
 */
export function composeReport(parts, opts) {
  opts = opts || {}
  const threshold = opts.threshold == null ? 60 : opts.threshold
  const bh = parts.bh || { bh: 0 }
  const vu = parts.vu || { vu: 0 }
  const ia = parts.ia || { ia: 0 }

  const ok = (bh.bh >= threshold) && (vu.vu >= threshold) && (ia.ia >= threshold)

  return {
    ok,
    bh: bh.bh,
    vu: vu.vu,
    ia: ia.ia,
    threshold,
    detail: { bh, vu, ia }
  }
}
