#!/usr/bin/env node
// test-safe-area.mjs — engine/mobile.js safe-area-inset 순수 계산 함수 회귀 테스트
// ─────────────────────────────────────────────────────────────────────────────
// 검증 항목:
//   1) inset=0 회귀 — 모든 방향 inset 이 0 일 때 버튼 좌표가 원본과 동일
//   2) left-inset — 좌측 버튼(left, right D패드) x 가 left-inset 만큼 증가
//   3) right-inset — 우측 버튼(jump) x 가 right-inset 만큼 감소
//   4) bottom-inset — 하단 버튼(left, right, jump) y 가 bottom-inset 만큼 감소
//   5) top-inset (음소거) — computeMutePosition y 가 top-inset 만큼 증가
//   6) right-inset (음소거) — computeMutePosition x 가 right-inset 만큼 감소
//   7) 복합 inset — 복수 방향 동시 적용 후 각 좌표 정확성
//   8) 원본 배열 불변 — computeSafeAreaLayout 은 입력 배열을 수정하지 않음
//   9) inset=0 음소거 — computeMutePosition 좌표가 원본과 동일
//
// 사용: node skills/wgf-game-qa/tools/test-safe-area.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const MobileHarness = require(resolve(here, '../../../engine/mobile.js'))

const { computeSafeAreaLayout, computeMutePosition } = MobileHarness

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else       { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}

// 테스트용 디자인 해상도
const W = 800, H = 480
const pad = 18, r = 34

// 원본 버튼 좌표 (mobile.js create() 와 동일)
const BASE_BUTTONS = [
  { id: 'left',  x: pad + r + 6,         y: H - pad - r,      r: r,     label: '◀' },
  { id: 'right', x: pad + r * 3 + 16,     y: H - pad - r,      r: r,     label: '▶' },
  { id: 'jump',  x: W - pad - r,          y: H - pad - r,      r: r + 6, label: 'A' }
]
const MUTE_BASE_X = W - 14
const MUTE_BASE_Y = 12

// inset=0 기준 좌표를 미리 계산(회귀 비교용)
const ZERO_INSET = { top: 0, right: 0, bottom: 0, left: 0 }

// ── 1) inset=0 회귀 ──
{
  const result = computeSafeAreaLayout(BASE_BUTTONS, ZERO_INSET, W, H)
  for (const b of BASE_BUTTONS) {
    const got = result.find(r => r.id === b.id)
    ok(`inset=0 회귀: ${b.id}.x === 원본`, got.x === b.x, `got ${got.x}, want ${b.x}`)
    ok(`inset=0 회귀: ${b.id}.y === 원본`, got.y === b.y, `got ${got.y}, want ${b.y}`)
  }
}

// ── 2) left-inset — 좌측 버튼 x 증가 ──
{
  const inset = { top: 0, right: 0, bottom: 0, left: 30 }
  const result = computeSafeAreaLayout(BASE_BUTTONS, inset, W, H)
  const left  = result.find(b => b.id === 'left')
  const right = result.find(b => b.id === 'right')
  const orig_left  = BASE_BUTTONS.find(b => b.id === 'left')
  const orig_right = BASE_BUTTONS.find(b => b.id === 'right')
  ok('left-inset: left 버튼 x += left-inset', left.x === orig_left.x + 30,
    `got ${left.x}, want ${orig_left.x + 30}`)
  ok('left-inset: right 버튼(D패드) x += left-inset', right.x === orig_right.x + 30,
    `got ${right.x}, want ${orig_right.x + 30}`)
}

// ── 3) right-inset — jump(우측) 버튼 x 감소 ──
{
  const inset = { top: 0, right: 44, bottom: 0, left: 0 }
  const result = computeSafeAreaLayout(BASE_BUTTONS, inset, W, H)
  const jump = result.find(b => b.id === 'jump')
  const orig = BASE_BUTTONS.find(b => b.id === 'jump')
  ok('right-inset: jump 버튼 x -= right-inset', jump.x === orig.x - 44,
    `got ${jump.x}, want ${orig.x - 44}`)
}

// ── 4) bottom-inset — 하단 버튼 y 감소 ──
{
  const inset = { top: 0, right: 0, bottom: 34, left: 0 }
  const result = computeSafeAreaLayout(BASE_BUTTONS, inset, W, H)
  for (const b of BASE_BUTTONS) {
    const got = result.find(r => r.id === b.id)
    const orig = b
    ok(`bottom-inset: ${b.id} 버튼 y -= bottom-inset`, got.y === orig.y - 34,
      `got ${got.y}, want ${orig.y - 34}`)
  }
}

// ── 5) top-inset (음소거) — y 증가 ──
{
  const inset = { top: 50, right: 0, bottom: 0, left: 0 }
  const pos = computeMutePosition(MUTE_BASE_X, MUTE_BASE_Y, inset)
  ok('top-inset: 음소거 y += top-inset', pos.y === MUTE_BASE_Y + 50,
    `got ${pos.y}, want ${MUTE_BASE_Y + 50}`)
  ok('top-inset: 음소거 x 변화 없음', pos.x === MUTE_BASE_X,
    `got ${pos.x}, want ${MUTE_BASE_X}`)
}

// ── 6) right-inset (음소거) — x 감소 ──
{
  const inset = { top: 0, right: 20, bottom: 0, left: 0 }
  const pos = computeMutePosition(MUTE_BASE_X, MUTE_BASE_Y, inset)
  ok('right-inset: 음소거 x -= right-inset', pos.x === MUTE_BASE_X - 20,
    `got ${pos.x}, want ${MUTE_BASE_X - 20}`)
  ok('right-inset: 음소거 y 변화 없음', pos.y === MUTE_BASE_Y,
    `got ${pos.y}, want ${MUTE_BASE_Y}`)
}

// ── 7) 복합 inset ──
{
  const inset = { top: 50, right: 44, bottom: 34, left: 30 }
  const result = computeSafeAreaLayout(BASE_BUTTONS, inset, W, H)
  const mutePos = computeMutePosition(MUTE_BASE_X, MUTE_BASE_Y, inset)

  const left  = result.find(b => b.id === 'left')
  const right = result.find(b => b.id === 'right')
  const jump  = result.find(b => b.id === 'jump')
  const origL = BASE_BUTTONS.find(b => b.id === 'left')
  const origR = BASE_BUTTONS.find(b => b.id === 'right')
  const origJ = BASE_BUTTONS.find(b => b.id === 'jump')

  ok('복합: left 버튼 x += left-inset', left.x === origL.x + 30,
    `got ${left.x}, want ${origL.x + 30}`)
  ok('복합: left 버튼 y -= bottom-inset', left.y === origL.y - 34,
    `got ${left.y}, want ${origL.y - 34}`)
  ok('복합: right D패드 x += left-inset', right.x === origR.x + 30,
    `got ${right.x}, want ${origR.x + 30}`)
  ok('복합: right D패드 y -= bottom-inset', right.y === origR.y - 34,
    `got ${right.y}, want ${origR.y - 34}`)
  ok('복합: jump x -= right-inset', jump.x === origJ.x - 44,
    `got ${jump.x}, want ${origJ.x - 44}`)
  ok('복합: jump y -= bottom-inset', jump.y === origJ.y - 34,
    `got ${jump.y}, want ${origJ.y - 34}`)
  ok('복합: 음소거 x -= right-inset', mutePos.x === MUTE_BASE_X - 44,
    `got ${mutePos.x}, want ${MUTE_BASE_X - 44}`)
  ok('복합: 음소거 y += top-inset', mutePos.y === MUTE_BASE_Y + 50,
    `got ${mutePos.y}, want ${MUTE_BASE_Y + 50}`)
}

// ── 8) 원본 배열 불변 ──
{
  const inset = { top: 10, right: 10, bottom: 10, left: 10 }
  const origX0 = BASE_BUTTONS[0].x
  const origY0 = BASE_BUTTONS[0].y
  computeSafeAreaLayout(BASE_BUTTONS, inset, W, H)
  ok('원본 배열 불변: 입력 배열 수정 없음',
    BASE_BUTTONS[0].x === origX0 && BASE_BUTTONS[0].y === origY0,
    `x=${BASE_BUTTONS[0].x} y=${BASE_BUTTONS[0].y}`)
}

// ── 9) inset=0 음소거 회귀 ──
{
  const pos = computeMutePosition(MUTE_BASE_X, MUTE_BASE_Y, ZERO_INSET)
  ok('inset=0 음소거 회귀: x === 원본', pos.x === MUTE_BASE_X,
    `got ${pos.x}, want ${MUTE_BASE_X}`)
  ok('inset=0 음소거 회귀: y === 원본', pos.y === MUTE_BASE_Y,
    `got ${pos.y}, want ${MUTE_BASE_Y}`)
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
