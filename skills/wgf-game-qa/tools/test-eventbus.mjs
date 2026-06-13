#!/usr/bin/env node
// test-eventbus.mjs — engine/eventbus.js 결정성·누수·격리 회귀 테스트(무의존성, Node 빌트인만)
// ─────────────────────────────────────────────────────────────────────────────
// 검증 항목:
//   1) 등록순 동기 디스패치 — on() 순서대로, emit 반환 시점에 모두 완료(동기)
//   2) 인자 전달 — emit(event, ...args) 가 핸들러에 그대로 전달
//   3) ctx 바인딩 — on(event, fn, ctx) 의 this 가 ctx 로 바인딩
//   4) once 1회 — once 핸들러는 1회 호출 후 자동 해제
//   5) off 정확 해제 — off(event, fn) 은 그 fn 만, off(event) 는 이벤트 전체
//   6) clear — clear(event) 는 1종, clear() 는 전체 비움
//   7) emit 중 on/off 비오염 — 디스패치 루프는 호출 시점 스냅샷 기준(현재 루프 오염 X)
//   8) 미등록 이벤트 emit — no-op(0 반환, throw 없음)
//   9) 에러 격리 — 한 핸들러 throw 가 나머지 디스패치를 막지 않음 / rethrow=true 면 재던짐
//  10) 씬↔HUD 디커플 시나리오 — 씬은 HUD 참조 없이 emit, HUD 는 on 으로 상태 갱신
//  [A] once + 동일fn on() 공존 — once 발화 후 영속 on() 핸들러 보존(once 가 on 을 지우지 않음)
//  [C] emit 재진입 가드 — 핸들러 안에서 같은 이벤트 emit 시 큐 직렬화(영속 핸들러 1회만)
//  [G] 프로토타입 이벤트명 — constructor/hasOwnProperty/__proto__ 를 이벤트명으로 on/emit 정상
//
// 사용: node skills/wgf-game-qa/tools/test-eventbus.mjs
// 출력 계약: 사람용 라인 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const EventBus = require(resolve(here, '../../../engine/eventbus.js'))

const checks = []
let pass = 0, fail = 0
function ok(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail: detail || '' })
  if (cond) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`) }
}

// ── 1) 등록순 동기 디스패치 ──
{
  const bus = new EventBus()
  const order = []
  bus.on('tick', () => order.push('a'))
  bus.on('tick', () => order.push('b'))
  bus.on('tick', () => order.push('c'))
  const dispatched = bus.emit('tick')
  ok('handlers fire in registration order', order.join('') === 'abc', `got ${order.join('')}`)
  ok('emit completes synchronously (all done on return)', order.length === 3)
  ok('emit returns dispatched count', dispatched === 3, `got ${dispatched}`)
}

// ── 2) 인자 전달 ──
{
  const bus = new EventBus()
  let received = null
  bus.on('score', (...args) => { received = args })
  bus.emit('score', 1200, 'gold', { combo: 3 })
  ok('emit forwards all args to handler', received && received[0] === 1200 && received[1] === 'gold' && received[2].combo === 3,
    JSON.stringify(received))
}

// ── 3) ctx 바인딩 ──
{
  const bus = new EventBus()
  const hud = { score: 0, set(v) { this.score = v } }
  bus.on('score', function (v) { this.set(v) }, hud)
  bus.emit('score', 999)
  ok('ctx binds `this` in handler', hud.score === 999, `score=${hud.score}`)
  // ctx 없으면 this 는 null(strict) — throw 없이 동작
  let okNoCtx = false
  bus.on('plain', function () { okNoCtx = (this === null || this === undefined) })
  bus.emit('plain')
  ok('no-ctx handler runs (this null/undefined)', okNoCtx)
}

// ── 4) once 1회 ──
{
  const bus = new EventBus()
  let n = 0
  bus.once('boom', () => n++)
  bus.emit('boom'); bus.emit('boom'); bus.emit('boom')
  ok('once handler fires exactly once', n === 1, `n=${n}`)
  ok('once handler auto-removed after fire', bus.listenerCount('boom') === 0)
}

// ── 5) off 정확 해제 ──
{
  const bus = new EventBus()
  let aN = 0, bN = 0
  const fnA = () => aN++
  const fnB = () => bN++
  bus.on('e', fnA); bus.on('e', fnB)
  bus.off('e', fnA)            // fnA 만 제거
  bus.emit('e')
  ok('off(event, fn) removes only that fn', aN === 0 && bN === 1, `aN=${aN} bN=${bN}`)
  ok('off(event, fn) leaves other handler registered', bus.listenerCount('e') === 1)
  bus.off('e')                 // 이벤트 전체 제거
  bus.emit('e')
  ok('off(event) removes all handlers of event', bN === 1 && bus.listenerCount('e') === 0)
  // 같은 fn 중복 등록 시 off 는 *모든* 등록 제거
  let cN = 0
  const fnC = () => cN++
  bus.on('e2', fnC); bus.on('e2', fnC)
  bus.off('e2', fnC)
  bus.emit('e2')
  ok('off(event, fn) removes all duplicate registrations of fn', cN === 0 && bus.listenerCount('e2') === 0)
}

// ── 6) clear ──
{
  const bus = new EventBus()
  bus.on('a', () => {}); bus.on('b', () => {}); bus.on('a', () => {})
  bus.clear('a')
  ok('clear(event) removes only that event', bus.listenerCount('a') === 0 && bus.listenerCount('b') === 1)
  bus.clear()
  ok('clear() removes everything', bus.eventNames().length === 0)
}

// ── 7) emit 중 on/off 비오염 (스냅샷 격리) ──
{
  // (a) 디스패치 중 새 on 이 현재 emit 루프에 끼어들지 않음
  const bus = new EventBus()
  const fired = []
  bus.on('x', () => {
    fired.push('h1')
    bus.on('x', () => fired.push('late'))   // 현재 emit 에는 반영 안 됨
  })
  bus.on('x', () => fired.push('h2'))
  bus.emit('x')
  ok('on() during emit does NOT run in current loop', fired.join(',') === 'h1,h2', `got ${fired.join(',')}`)
  // 다음 emit 부터는 반영
  bus.emit('x')
  ok('on() during emit applies to NEXT emit', fired.filter(f => f === 'late').length === 1, `fired=${fired.join(',')}`)

  // (b) 디스패치 중 off 가 현재 루프의 후속 핸들러 호출을 막지 않음(스냅샷)
  const bus2 = new EventBus()
  const seen = []
  const h2 = () => seen.push('h2')
  bus2.on('y', () => { seen.push('h1'); bus2.off('y', h2) })  // h2 를 제거 시도
  bus2.on('y', h2)
  bus2.emit('y')
  ok('off() during emit does not skip already-snapshotted handler', seen.join(',') === 'h1,h2', `got ${seen.join(',')}`)
  ok('off() during emit applies to next emit', bus2.listenerCount('y') === 1)
}

// ── 8) 미등록 이벤트 emit (no-op) ──
{
  const bus = new EventBus()
  let threw = false
  let ret = -1
  try { ret = bus.emit('never-registered', 1, 2, 3) } catch (e) { threw = true }
  ok('emit on unregistered event is no-op (no throw)', !threw)
  ok('emit on unregistered event returns 0', ret === 0, `ret=${ret}`)
}

// ── 9) 에러 격리 ──
{
  // (a) 기본 격리: 한 핸들러 throw 가 나머지를 막지 않음 + onError 통지
  const errs = []
  const bus = new EventBus({ onError: (e, ev) => errs.push(ev + ':' + e.message) })
  const after = []
  bus.on('go', () => { throw new Error('boom1') })
  bus.on('go', () => after.push('survivor'))
  let threw = false
  try { bus.emit('go') } catch (e) { threw = true }
  ok('handler throw is isolated (others still dispatch)', !threw && after.join('') === 'survivor')
  ok('onError receives the thrown error', errs.length === 1 && errs[0] === 'go:boom1', JSON.stringify(errs))

  // (b) rethrow=true: 첫 throw 에서 즉시 중단·재던짐
  const bus2 = new EventBus({ rethrow: true })
  const reached = []
  bus2.on('go', () => { throw new Error('boom2') })
  bus2.on('go', () => reached.push('should-not-run'))
  let caught = null
  try { bus2.emit('go') } catch (e) { caught = e }
  ok('rethrow=true re-throws first error', caught instanceof Error && caught.message === 'boom2')
  ok('rethrow=true halts dispatch at first throw', reached.length === 0)
}

// ── 10) 씬↔HUD 디커플 시나리오 ──
{
  // 씬은 HUD 를 직접 참조하지 않는다 — bus 로만 사실을 알린다.
  const bus = new EventBus()

  // HUD(UIScene 흉내): bus 구독으로만 상태를 받는다.
  const hud = {
    score: 0, lives: 3, time: 300, gameOver: false,
    bind(bus) {
      bus.on('score', function (v) { this.score = v }, this)
      bus.on('lives', function (v) { this.lives = v }, this)
      bus.on('time', function (v) { this.time = v }, this)
      bus.once('gameover', function () { this.gameOver = true }, this)
    }
  }
  hud.bind(bus)

  // 씬(GameScene 흉내): HUD 참조 0, emit 만 한다.
  const scene = {
    score: 0, lives: 3,
    addScore(bus, d) { this.score += d; bus.emit('score', this.score) },
    loseLife(bus) { this.lives--; bus.emit('lives', this.lives); if (this.lives <= 0) bus.emit('gameover') }
  }

  scene.addScore(bus, 100)
  scene.addScore(bus, 250)
  bus.emit('time', 299)
  scene.loseLife(bus); scene.loseLife(bus); scene.loseLife(bus)  // 3 → 0 → gameover

  ok('scene→HUD: score synced via bus', hud.score === 350, `hud.score=${hud.score}`)
  ok('scene→HUD: lives synced via bus', hud.lives === 0, `hud.lives=${hud.lives}`)
  ok('scene→HUD: time synced via bus', hud.time === 299)
  ok('scene→HUD: gameover once fired', hud.gameOver === true && bus.listenerCount('gameover') === 0)

  // 디커플 증명: 씬 객체는 hud 를 키로도 참조하지 않는다.
  ok('scene holds NO reference to hud (decoupled)', !('hud' in scene) && Object.values(scene).every(v => v !== hud))
}

// ── [A] once + 동일fn on() 공존 — once 발화가 영속 on() 엔트리를 지우지 않음 ──
{
  // 버그 재현 케이스: 이전 구현은 once 발화 시 off(event, fn) 을 써서
  // 동일 fn 의 *모든* 등록(once + 영속 on 포함)을 제거했다.
  // 수정 후: _removeEntry(event, entry) 로 그 레코드 객체 1개만 제거하므로
  // 영속 on() 엔트리는 살아남는다.
  //
  // 카운터 설계:
  //   onceCount  — once 전용 fn 이 발화된 횟수
  //   persistCount — on() 전용 fn 이 발화된 횟수
  //   둘이 sharedFn 을 공유하면 두 엔트리가 모두 호출되므로 별도 fn 으로 분리.
  const bus = new EventBus()
  let onceCount = 0, persistCount = 0
  const onceFn   = () => onceCount++     // once 전용
  const persistFn = () => persistCount++ // on() 전용(동일 함수 객체가 아님)

  // 동일 fn 이 아닌 별도 fn — 핵심은 "once 발화가 fn 식별이 아닌 엔트리 식별로 제거"
  // 이 테스트는 fn 이 다르지만, 아래에서 sharedFn 을 쓰는 케이스도 추가한다.
  bus.once('e', onceFn)
  bus.on('e', persistFn)

  // 첫 emit: once(onceFn) 발화 1회 + on(persistFn) 발화 1회
  bus.emit('e')
  ok('[A] once fn fires on first emit', onceCount === 1, `onceCount=${onceCount}`)
  ok('[A] persistent fn fires on first emit', persistCount === 1, `persistCount=${persistCount}`)
  ok('[A] once removed, persistent on() survives (listenerCount===1)', bus.listenerCount('e') === 1,
    `listenerCount=${bus.listenerCount('e')}`)

  // 두 번째 emit: 영속 on() 만 남아 있으므로 once fn 0회, persist fn +1
  const onceCountBefore = onceCount
  bus.emit('e')
  ok('[A] once fn does NOT fire on second emit', onceCount === onceCountBefore,
    `onceCount went ${onceCountBefore}→${onceCount}`)
  ok('[A] persistent fn fires on second emit', persistCount === 2, `persistCount=${persistCount}`)

  // 핵심 케이스: 동일 fn 을 once + on 으로 등록 — once 발화가 on() 엔트리를 건드리지 않음
  const bus2 = new EventBus()
  let sharedCalls = 0
  const sharedFn = () => sharedCalls++
  bus2.once('x', sharedFn)  // 엔트리 A (once)
  bus2.on('x', sharedFn)    // 엔트리 B (on, 영속)

  // 첫 emit: 엔트리 A(once) + 엔트리 B(on) 모두 발화 → 2회
  bus2.emit('x')
  ok('[A] shared fn: both once and on() fire on first emit', sharedCalls === 2,
    `sharedCalls=${sharedCalls}`)
  // once 엔트리(A)만 제거됐으므로 on() 엔트리(B)가 남아 있어야 함
  ok('[A] shared fn: once entry removed, on() entry survives (listenerCount===1)',
    bus2.listenerCount('x') === 1, `listenerCount=${bus2.listenerCount('x')}`)

  // 두 번째 emit: 엔트리 B(on) 만 남아 +1
  bus2.emit('x')
  ok('[A] shared fn: on() entry fires on second emit', sharedCalls === 3,
    `sharedCalls=${sharedCalls}`)
}

// ── [C] emit 재진입 가드 — 핸들러 안에서 같은 이벤트 emit → 큐 직렬화 ──
{
  // 핸들러가 같은 이벤트를 재-emit 해도 영속 핸들러가 1회씩만 발화하고
  // 전체 순서가 결정적(큐 적재 → flush)임을 검증.
  const bus = new EventBus()
  const log = []

  // h1: 첫 번째 핸들러. 안에서 'e' 를 재-emit — 가드 없으면 즉시 재진입해 h1·h2 가 중복 발화.
  bus.on('e', (depth) => {
    log.push('h1:' + depth)
    if (depth === 0) bus.emit('e', 1)   // 재진입 emit — 큐에 적재돼야 함
  })
  bus.on('e', (depth) => {
    log.push('h2:' + depth)
  })

  bus.emit('e', 0)
  // 기대 순서(가드 적용): h1:0 → h2:0 (depth=0 루프 완료) → h1:1 → h2:1 (flush)
  ok('[C] reentrant emit is queued (no interleaving)', log.join(',') === 'h1:0,h2:0,h1:1,h2:1',
    `log=${log.join(',')}`)
  ok('[C] each handler fires exactly once per emit call', log.filter(s => s.startsWith('h1')).length === 2)
}

// ── [G] 프로토타입 이벤트명 — constructor/hasOwnProperty/__proto__ 정상 동작 ──
{
  // Object.prototype 에 존재하는 키를 이벤트명으로 써도 크래시·비결정 없이 동작해야 한다.
  // 이전 구현은 _handlers = {} 이므로 이런 키 접근 시 Object.prototype 프로퍼티와
  // 충돌해 예기치 않은 동작(또는 크래시)이 발생할 수 있었다.
  const protoKeys = ['constructor', 'hasOwnProperty', '__proto__', 'toString', 'valueOf', 'isPrototypeOf']
  for (const key of protoKeys) {
    const bus = new EventBus()
    let fired = 0
    let threw = false
    try {
      bus.on(key, () => fired++)
      bus.emit(key)
    } catch (e) {
      threw = true
    }
    ok(`[G] prototype key "${key}" on/emit safe (no throw, fires once)`,
      !threw && fired === 1, `threw=${threw} fired=${fired}`)
  }
}

console.log(`— pass ${pass} · fail ${fail}`)
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }))
process.exit(fail === 0 ? 0 : 1)
