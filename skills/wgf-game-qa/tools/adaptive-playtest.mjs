#!/usr/bin/env node
// adaptive-playtest.mjs — 적응형 입력 playtest 에이전트 (상태요약 → 결정적 액션선택 루프)
// ─────────────────────────────────────────────────────────────────────────────
// 정적 step 시퀀스(미리 짠 입력)를 넘어, **게임 현재상태(뷰)를 요약 → '다음 입력
// 액션'을 제한된 구조화 액션 집합 중 결정적으로 선택 → 적응형 플레이**하는 검증 도구.
// replay-determinism.mjs 의 헤드리스 step 현실(실게임 runeburst 는 Phaser scene-bound
// 라 Node headless step 불가 → 합성 미니게임으로 실증)을 그대로 따른다.
//
// 매 N프레임마다 3단계 루프:
//   1) 상태요약(summarizeView): scene.registry 상태(score/lives) + 주인공 좌표 +
//      (가능하면 ① qa-score-core VU 휴리스틱: frameEntropy/isBlackFrame) 으로 현재
//      뷰를 한 객체로 요약. 진행 정체(stagnation)·막힘(blocked) 신호를 함께 계산.
//   2) 액션선택(chooseAction): 제한된 구조화 액션 집합 {left,right,jump,idle} 중
//      '다음 액션'을 **결정적 정책**으로 선택. 휴리스틱(정체 감지 시 방향전환·점프,
//      벽/막힘 감지) + RngForge 시드 탐험 흔들기. **LLM 호출 0**(헤드리스 결정적).
//   3) 선택 액션을 input 플래그로 주입 → step 계속.
//
// 실증 2종:
//   (A) 적응형 vs 정적 대비: 같은 게임/시드에서 (a) 고정 정적 시퀀스(예: 계속 right)
//       와 (b) 적응형 루프를 돌려, 적응형이 **정적이 못 닿는 상태**(더 높은 점수·더
//       먼 위치·특정 영역)에 도달함을 수치로 보인다.
//   (B) 결정론: 시드 고정 시 적응형 루프가 2회 동일 궤적(상태 시퀀스 해시 동일).
//       Math.random/Date.now/performance.now 미사용(RngForge 만 엔트로피원).
//
// 합성 게임 — corridor-climb:
//   좁은 통로(벽)와 구덩이(gap)가 있는 횡스크롤 코스. 주인공은 left/right 로 이동,
//   jump 로 점프(중력 적용). 진행하려면 **벽에 막히면 점프**, **구덩이 앞에서 점프**해야
//   한다. "무작정 right 만 누르는" 정적 시퀀스는 첫 벽·구덩이에서 막혀 더 못 간다.
//   상태(좌표·정체·body.blocked)를 읽는 적응형 정책만이 끝까지 도달해 점수를 더 번다.
//   실게임 runeburst 의 "rng 하나가 진실" 결정론 모델과 동형(모든 무작위=주입 RngForge).
//
// 모드:
//   node skills/wgf-game-qa/tools/adaptive-playtest.mjs              기본: 자기검증(적응형>정적 + 결정론 2회)
//   node skills/wgf-game-qa/tools/adaptive-playtest.mjs --json       사람용 라인 생략, JSON 만
//   node skills/wgf-game-qa/tools/adaptive-playtest.mjs --trace      적응형 액션 결정 로그 상세 출력
//
// 출력 계약: 사람용 라인들 먼저, 마지막 줄 단일 JSON:
//   {"ok":bool,"adaptive":{...},"static":{...},"determinism":{...},"checks":[...]}
// 종료코드: 전부 통과 → 0, 하나라도 실패 → 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// ① VU 휴리스틱 재활용 — 같은 디렉터리의 ESM 코어를 상대 specifier 로 import.
//   (Windows 절대경로는 file:// URL 이 아니면 ESM 로더가 거부 → 상대 import 가 정답.
//    test-qa-score.mjs 와 동일 규약.)
import { frameEntropy, isBlackFrame } from './qa-score-core.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const engineDir = resolve(here, '../../../engine')

// ── 엔진 로드(replay-determinism.mjs 와 동일 패턴) ────────────────────────────
const RngForge = require(resolve(engineDir, 'rngforge.js'))

const JSON_ONLY = process.argv.includes('--json')
const TRACE = process.argv.includes('--trace')

// ── 작은 헬퍼 ────────────────────────────────────────────────────────────────
const QUANT = 1000
/** 좌표 양자화 — round(v*1000)/1000 로 부동소수 노이즈 제거(replay-determinism 동형). */
function q(v) { return Math.round(v * QUANT) / QUANT }

/**
 * djb2 + FNV-1a 32-bit 혼합 해시 — 상태 시퀀스(문자열들)를 하나의 지문으로 접는다.
 * replay-determinism.mjs 의 hashSeq 와 동일 알고리즘(결정론 2회 재현 검증에 사용).
 */
function hashSeq(strings) {
  let djb2 = 5381 >>> 0
  let fnv = 2166136261 >>> 0
  for (const s of strings) {
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i)
      djb2 = (Math.imul(djb2, 33) + ch) >>> 0
      fnv ^= ch
      fnv = Math.imul(fnv, 16777619) >>> 0
    }
    djb2 = (Math.imul(djb2, 33) + 0x1f) >>> 0   // 레코드 구분자(경계 충돌 방지)
    fnv ^= 0x1f
    fnv = Math.imul(fnv, 16777619) >>> 0
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0')
  return hex(djb2) + hex(fnv)
}

// ════════════════════════════════════════════════════════════════════════════
// 합성 게임 — corridor-climb (Phaser 미의존, game.step(time,delta) 시그니처 정합)
// ════════════════════════════════════════════════════════════════════════════
//
// 코스 구조(횡스크롤): x 가 커질수록 진행. 곳곳에 벽(wall)과 구덩이(gap)가 있다.
//   - 벽:  [x0,x1] 구간에 높이 wallTop 아래로 솟은 장애물. 지면을 달리면 막힌다 →
//          넘으려면 점프해서 wallTop 위로 올라가야 한다.
//   - 구덩이: [x0,x1] 구간엔 바닥이 없다(y 가 floorY 아래로 떨어짐 = 추락). 앞에서
//          점프해 건너야 한다. 추락하면 직전 안전지대(checkpoint)로 되돌려지고 lives 감소.
//   - 진행 보상: 새로 도달한 최대 x 의 일정 칸마다 score += 10(전진할수록 점수↑).
//   - 골(goal): courseLen 의 끝(goalX)에 도달하면 score += 100 보너스 + reached=true.
//
// 입력 플래그(window.<Game>.input 모사): { left, right, jump }. game-qa SKILL 의
//   left/right/jump 플래그 규약과 동일. registry 는 getScene().registry 모사
//   ({ get(k), set(k,v) }) — score/lives 를 영속화(SKILL 의 scene.registry 패턴).
//
// 결정론: 모든 무작위는 주입 rng(RngForge) 하나에서만(미세 흔들림 vy 지터 등 — 시각/
//   게임플레이 분리 위해 fx 스트림). 시각함수(Date.now/performance.now) 미사용.
function makeCorridorGame(seed, opts) {
  opts = opts || {}
  const W = 320, H = 180
  const floorY = 150          // 지면 y(주인공 발이 닿는 높이)
  const heroH = 12
  const GRAVITY = 0.9
  const MOVE = 2.2            // 좌우 이동 속도
  const JUMP_V = -11          // 점프 초기 속도(위로)
  const courseLen = 1200      // 코스 총 길이(goalX)
  const goalX = courseLen - 20

  // RngForge — 게임플레이는 시드만으로 완전 결정(코스 자체는 고정 배열). fx 는 별도 스트림.
  const rng = RngForge.create(seed)
  const fxRng = rng.stream('fx')

  // 코스 장애물(고정 — 시드 무관 결정적 지형). 벽은 점프로 넘고, 구덩이는 점프로 건넌다.
  //   wall:  { type:'wall', x0, x1, top }  top 위로 올라가야 통과(top 보다 y 작아야 함)
  //   gap:   { type:'gap',  x0, x1 }        구간 위는 바닥 없음(추락)
  const obstacles = [
    { type: 'wall', x0: 180, x1: 200, top: floorY - 34 },
    { type: 'gap', x0: 320, x1: 360 },
    { type: 'wall', x0: 520, x1: 540, top: floorY - 40 },
    { type: 'gap', x0: 680, x1: 720 },
    { type: 'wall', x0: 860, x1: 884, top: floorY - 46 },
    { type: 'gap', x0: 1000, x1: 1044 }
  ]

  // 안전지대(추락 시 되돌릴 체크포인트 x) — 각 구덩이 직전 안전 x.
  function checkpointBefore(x) {
    let cp = 20
    for (const o of obstacles) {
      if (o.type === 'gap' && o.x1 < x) cp = o.x1 + 30
      if (o.type === 'wall' && o.x1 < x) cp = Math.max(cp, o.x1 + 6)
    }
    return cp
  }

  // 주인공 상태.
  const hero = { x: 20, y: floorY, vx: 0, vy: 0, onGround: true, blockedRight: false }

  // registry 모사(SKILL 의 scene.registry — score/lives 영속).
  const reg = { score: 0, lives: 3 }
  const registry = {
    get: (k) => reg[k],
    set: (k, v) => { reg[k] = v; return registry }
  }

  let tick = 0
  let maxX = hero.x            // 도달한 최대 x(진행 보상·궤적 깊이 지표)
  let lastRewardBand = 0       // 점수 보상 밴드(전진 칸 100px 마다 +10)
  let reachedGoal = false

  // 어떤 x 가 구덩이 위인가(바닥 없음).
  function overGap(x) {
    for (const o of obstacles) if (o.type === 'gap' && x >= o.x0 && x <= o.x1) return true
    return false
  }
  // 주인공 발 앞(진행 방향)에 벽이 막고 있는가(지면 높이에서). 통과하려면 점프 필요.
  function wallAhead(x, y) {
    for (const o of obstacles) {
      if (o.type !== 'wall') continue
      // 벽 구간에 진입했거나 막 닿는데, 아직 top 위로 못 올라갔으면 막힘.
      if (x >= o.x0 - 2 && x <= o.x1 && y > o.top) return o
    }
    return null
  }
  // 진행 방향 lookAhead px 안에 구덩이 *시작점*이 있는가(바로 코앞 추락 위험).
  //   상태요약이 노출하는 "센서" — 적응형 정책이 구덩이 직전 도약 타이밍을 잡게 한다.
  //   바로 위(이미 구덩이 안)는 제외(그건 추락 처리). 발 디딜 곳 직전만.
  function gapDistAhead(x, lookAhead) {
    lookAhead = lookAhead == null ? 26 : lookAhead
    let best = -1
    for (const o of obstacles) {
      if (o.type !== 'gap') continue
      const d = o.x0 - x
      if (d > 0 && d <= lookAhead) { if (best < 0 || d < best) best = d }
    }
    return best   // -1 = 코앞에 구덩이 없음. >=0 = 구덩이 시작까지 거리(px).
  }

  // game.step(time, delta) — Phaser game.step 시그니처 정합(로직은 dt 비의존이지만
  //   시그니처를 맞춰, 추후 실게임 step 으로 갈아끼울 때 호출부가 동일하도록).
  function step(time, delta, input) {
    tick++
    input = input || {}
    hero.blockedRight = false

    // 좌우 이동(공중에서도 약하게 제어 가능 — 점프 궤도 조정).
    const ax = input.left ? -1 : input.right ? 1 : 0
    hero.vx = ax * MOVE

    // 점프(지면에 있을 때만 — game-qa "점프 중 재점프 금지" 교훈 반영: onGround 체크).
    if (input.jump && hero.onGround) {
      hero.vy = JUMP_V + fxRng.float(-0.2, 0.2)   // fx 스트림 미세 지터(게임플레이 RNG 불변)
      hero.onGround = false
    }

    // 수평 이동 + 벽 충돌(지면에서 벽에 닿으면 막힘 — 넘으려면 점프).
    const nextX = hero.x + hero.vx
    const w = wallAhead(nextX, hero.y)
    if (w && hero.vx > 0 && hero.y > w.top) {
      // 지면 높이에서 벽 정면 → 전진 막힘(x 고정), blockedRight 신호.
      hero.x = Math.min(hero.x, w.x0 - 2)
      hero.blockedRight = true
    } else {
      hero.x = hero.x + hero.vx
    }
    if (hero.x < 0) hero.x = 0
    if (hero.x > goalX) hero.x = goalX

    // 중력 + 수직 이동.
    hero.vy = hero.vy + GRAVITY
    hero.y = hero.y + hero.vy

    // 착지 판정 — 구덩이 위가 아니면 floorY 에 착지. 구덩이 위면 계속 낙하(추락).
    if (!overGap(hero.x)) {
      if (hero.y >= floorY) { hero.y = floorY; hero.vy = 0; hero.onGround = true }
      else hero.onGround = false
    } else {
      hero.onGround = false
    }

    // 추락(구덩이로 떨어짐) — 화면 아래로 빠지면 체크포인트로 복귀 + lives 감소.
    if (hero.y > H + 40) {
      const cp = checkpointBefore(hero.x)
      hero.x = cp; hero.y = floorY; hero.vx = 0; hero.vy = 0; hero.onGround = true
      reg.lives = Math.max(0, reg.lives - 1)
    }

    // 진행 보상 — 새 최대 x 의 100px 밴드를 넘을 때마다 +10.
    if (hero.x > maxX) maxX = hero.x
    const band = Math.floor(maxX / 100)
    if (band > lastRewardBand) {
      reg.score += 10 * (band - lastRewardBand)
      lastRewardBand = band
    }

    // 골 도달 — 보너스 1회.
    if (!reachedGoal && hero.x >= goalX - 1) {
      reachedGoal = true
      reg.score += 100
    }

    // 좌표 양자화(부동소수 노이즈 흡수).
    hero.x = q(hero.x); hero.y = q(hero.y); hero.vx = q(hero.vx); hero.vy = q(hero.vy)
    return getState()
  }

  function getState() {
    return {
      tick,
      hero: { x: hero.x, y: hero.y, vx: hero.vx, vy: hero.vy, onGround: hero.onGround, blockedRight: hero.blockedRight },
      score: reg.score,
      lives: reg.lives,
      maxX: q(maxX),
      reachedGoal,
      rngState: rng.state()
    }
  }

  // 합성 "프레임 픽셀" — ① VU 휴리스틱(frameEntropy/isBlackFrame) 에 먹일 휘도 배열.
  //   실게임은 canvas.getImageData 로 뽑지만(헤드리스 불가 — qa-score 한계와 동일),
  //   여기서는 주인공/지형/구덩이를 작은 그리드에 결정적으로 래스터화해 "정보있는 뷰"를
  //   합성한다(검은화면=정보0 과 대비되는, 움직임 있는 화면의 엔트로피를 ①로 측정).
  function renderLuma(gw, gh) {
    gw = gw || 32; gh = gh || 18
    const luma = new Array(gw * gh).fill(16)   // 배경(어두운 회색 — 검정 아님)
    // 지면 라인.
    const groundRow = Math.min(gh - 1, Math.round((floorY / H) * gh))
    for (let cx = 0; cx < gw; cx++) {
      const worldX = (cx / gw) * Math.max(maxX + W, courseLen)
      // 구덩이 위는 지면 없음(어둡게 유지 = 정보).
      if (!overGap(worldX)) luma[groundRow * gw + cx] = 120
    }
    // 주인공(밝은 점) — 화면 기준 위치(카메라가 hero 따라간다고 가정 → 중앙 근처).
    const hcx = Math.round((W * 0.4 / W) * gw)
    const hcy = Math.min(gh - 1, Math.round((hero.y / H) * gh))
    if (hcy >= 0 && hcy < gh && hcx >= 0 && hcx < gw) luma[hcy * gw + hcx] = 240
    // 점수에 따라 HUD 픽셀 몇 개 점등(화면 변화 = 모션 유발).
    const hud = Math.min(gw - 1, reg.score % gw)
    luma[hud] = 200
    return luma
  }

  return { step, getState, renderLuma, gapDistAhead, goalX, courseLen, obstacles, W, H, floorY }
}

// ════════════════════════════════════════════════════════════════════════════
// 상태요약 — 게임 현재상태(뷰) → 정책이 읽는 요약 객체
// ════════════════════════════════════════════════════════════════════════════
//
// scene.registry 상태(score/lives) + 주인공 좌표 + ① VU 휴리스틱(frameEntropy/
// isBlackFrame)으로 "지금 화면이 살아있나(정보 있나)" 까지 한 객체로 요약한다.
// 정책(chooseAction)이 이 요약만 보고 결정하므로, 게임 내부 구현과 분리된다.
//
// memo: 정책이 프레임 간 들고 다니는 작은 기억(직전 maxX·정체 카운터). 정체(stagnation)
//   = "여러 프레임 동안 maxX 가 안 늘어남" = 막힘/헛디딤 신호 → 정책이 행동을 바꾼다.
function summarizeView(game, memo) {
  const s = game.getState()
  const luma = game.renderLuma()
  const entropy = frameEntropy(luma)         // ① 화면 정보량(검은화면=0)
  const black = isBlackFrame(luma)           // ① 검은화면 여부

  // 진행 정체 감지 — maxX 가 직전 대비 progressEps 미만 증가하면 stale 카운터 증가.
  const PROGRESS_EPS = 0.5
  const advanced = s.maxX - (memo.lastMaxX == null ? -1 : memo.lastMaxX)
  if (advanced > PROGRESS_EPS) memo.staleFrames = 0
  else memo.staleFrames = (memo.staleFrames || 0) + 1
  memo.lastMaxX = s.maxX

  return {
    tick: s.tick,
    x: s.hero.x,
    y: s.hero.y,
    vy: s.hero.vy,
    onGround: s.hero.onGround,
    blockedRight: s.hero.blockedRight,   // 벽 정면 막힘(게임 제공 신호)
    gapAhead: game.gapDistAhead(s.hero.x), // 코앞 구덩이까지 거리(-1=없음) — 도약 타이밍 센서
    score: s.score,
    lives: s.lives,
    maxX: s.maxX,
    reachedGoal: s.reachedGoal,
    staleFrames: memo.staleFrames,       // 정체 길이(막힘 추정)
    entropy,                              // ① VU: 화면 정보량
    blackScreen: black                    // ① VU: 검은화면(정보 0)이면 비정상
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 액션선택 — 제한된 구조화 액션 집합 {left,right,jump,idle} 중 결정적 선택
// ════════════════════════════════════════════════════════════════════════════
//
// LLM 호출 0. 순수 휴리스틱 + 시드 RNG 탐험. 정책 의도:
//   - 기본 전진(right)으로 진행.
//   - 막힘/정체 감지(blockedRight 또는 staleFrames 누적) → 점프해서 벽/구덩이 돌파.
//   - 점프는 지면(onGround)일 때만 의미(공중 jump 무효 — 게임이 onGround 체크) → 막혔는데
//     공중이면 right 유지하며 착지 대기.
//   - 시드 RNG 로 "정체가 길어지면" 가끔 약하게 후퇴(left) 후 재도약 — 모서리에 끼는
//     국소 최적 탈출(시드 고정이므로 결정적). RngForge 만 사용(Math.random 금지).
//
// 반환: { action:'right'|'left'|'jump'|'idle', input:{left,right,jump}, reason }
const ACTIONS = ['right', 'left', 'jump', 'idle']

function chooseAction(view, policyRng) {
  // 정체/막힘 신호 합성.
  const stuck = view.blockedRight || view.staleFrames >= 4
  const longStuck = view.staleFrames >= 10

  // 검은화면(비정상 뷰) → idle 로 안전(① VU 활용: 화면 정보 0 이면 입력해도 의미 없음).
  if (view.blackScreen) {
    return { action: 'idle', input: {}, reason: 'black-screen(VU): 입력 보류' }
  }

  // 코앞 구덩이 감지(센서) + 지면 → 선제 도약(구덩이 직전 점프해 건넌다).
  //   "추락 후 반응" 이 아니라 "센서로 미리 본다" — 적응형 정책의 핵심.
  if (view.gapAhead >= 0 && view.onGround) {
    return { action: 'jump', input: { right: true, jump: true }, reason: `gap-ahead(${view.gapAhead}px): 선제 도약` }
  }

  // 막혔고 지면에 있으면 → 점프(벽 넘기/구덩이 건너기).
  if (stuck && view.onGround) {
    // 국소최적 탈출: 오래 막혔으면 시드 RNG 로 가끔 살짝 후퇴 후 점프 준비.
    if (longStuck && policyRng.bool(0.35)) {
      return { action: 'left', input: { left: true }, reason: 'long-stuck: 후퇴해 도약 거리 확보' }
    }
    return { action: 'jump', input: { right: true, jump: true }, reason: 'stuck+onGround: 점프 돌파' }
  }

  // 공중에 떠 있으면(점프 중) → 전진 유지하며 착지(점프 궤도 진행).
  if (!view.onGround) {
    return { action: 'right', input: { right: true }, reason: 'airborne: 전진 유지(점프 궤도)' }
  }

  // 기본 — 전진.
  return { action: 'right', input: { right: true }, reason: 'default: 전진' }
}

// ════════════════════════════════════════════════════════════════════════════
// 플레이 러너 — 정적 시퀀스 vs 적응형 루프
// ════════════════════════════════════════════════════════════════════════════

const FRAME = 1000 / 60

/**
 * 정적 시퀀스 플레이 — 미리 짠 입력을 프레임별로 그대로 주입(상태 안 봄).
 * staticInput(i) 가 i 프레임의 input 객체를 반환(예: 항상 {right:true}).
 * 반환: { finalState, seq(상태 직렬화 시퀀스), hash }
 */
function playStatic(seed, frames, staticInput) {
  const game = makeCorridorGame(seed)
  const seq = []
  let t = 0
  for (let i = 0; i < frames; i++) {
    const inp = staticInput(i)
    game.step(t, FRAME, inp)
    t += FRAME
    seq.push(serializeState(game.getState()))
  }
  return { finalState: game.getState(), seq, hash: hashSeq(seq) }
}

/**
 * 적응형 루프 플레이 — 매 decideEvery 프레임마다 상태요약→액션선택, 그 사이엔 유지.
 * 정책 RNG 는 시드에서 파생(같은 시드 → 같은 탐험 → 결정적 궤적).
 * 반환: { finalState, seq, hash, decisions(액션 결정 로그) }
 */
function playAdaptive(seed, frames, decideEvery) {
  decideEvery = decideEvery || 6
  const game = makeCorridorGame(seed)
  // 정책 전용 RNG 스트림(게임 내부 rng 와 독립 — 정책이 게임 무작위를 밀지 않음).
  const policyRng = RngForge.create(seed).stream('policy')
  const memo = {}
  const seq = []
  const decisions = []
  let t = 0
  let current = { action: 'right', input: { right: true }, reason: 'init' }

  for (let i = 0; i < frames; i++) {
    if (i % decideEvery === 0) {
      const view = summarizeView(game, memo)
      current = chooseAction(view, policyRng)
      if (TRACE) decisions.push({ frame: i, x: view.x, stale: view.staleFrames, blocked: view.blockedRight, onGround: view.onGround, action: current.action, reason: current.reason })
    }
    game.step(t, FRAME, current.input)
    t += FRAME
    seq.push(serializeState(game.getState()))
  }
  return { finalState: game.getState(), seq, hash: hashSeq(seq), decisions }
}

/** game.step 상태 → 결정적 직렬화 문자열(해시·비교 공용). 키 정렬로 순회순서 누수까지 잡음. */
function serializeState(state) {
  const snap = {
    tick: state.tick,
    x: q(state.hero.x),
    y: q(state.hero.y),
    vy: q(state.hero.vy),
    score: state.score,
    lives: state.lives,
    maxX: q(state.maxX),
    reachedGoal: state.reachedGoal,
    rngState: state.rngState
  }
  return JSON.stringify(snap, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted = {}
      for (const k of Object.keys(value).sort()) sorted[k] = value[k]
      return sorted
    }
    return value
  })
}

// ════════════════════════════════════════════════════════════════════════════
// 자기검증 — 적응형 > 정적 + 결정론 2회 재현
// ════════════════════════════════════════════════════════════════════════════

const SEED = 20260613
const FRAMES = 900            // 충분히 길게(코스 끝까지 갈 여지) — 적응형은 도달, 정적은 막힘
const DECIDE_EVERY = 6

const checks = []
function check(name, cond, detail) {
  const ok = !!cond
  checks.push({ name, ok, detail: detail || '' })
  if (!JSON_ONLY) console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
  return ok
}

// 정적 정책: "무작정 오른쪽" — 상태를 안 보므로 첫 벽/구덩이에서 막힌다.
const staticAlwaysRight = (_i) => ({ right: true })

// (A) 적응형 vs 정적 — 같은 시드/프레임수.
const stat = playStatic(SEED, FRAMES, staticAlwaysRight)
const adapt = playAdaptive(SEED, FRAMES, DECIDE_EVERY)

if (!JSON_ONLY) {
  console.log('— corridor-climb 적응형 입력 playtest —')
  console.log(`  정적(always-right):  maxX=${stat.finalState.maxX}  score=${stat.finalState.score}  reachedGoal=${stat.finalState.reachedGoal}  lives=${stat.finalState.lives}`)
  console.log(`  적응형(state→action): maxX=${adapt.finalState.maxX}  score=${adapt.finalState.score}  reachedGoal=${adapt.finalState.reachedGoal}  lives=${adapt.finalState.lives}`)
}

// (B) 결정론 — 같은 시드 2회 재생 → 해시 동일.
const adapt2 = playAdaptive(SEED, FRAMES, DECIDE_EVERY)

// ── 수용 기준 단언 ────────────────────────────────────────────────────────────
// 1) 적응형이 정적보다 더 멀리(maxX) 도달.
check('적응형 도달거리 > 정적(maxX)', adapt.finalState.maxX > stat.finalState.maxX + 50,
  `adaptive.maxX=${adapt.finalState.maxX} > static.maxX=${stat.finalState.maxX}`)

// 2) 적응형이 정적보다 더 높은 점수(전진 보상 + 골 보너스).
check('적응형 점수 > 정적(score)', adapt.finalState.score > stat.finalState.score,
  `adaptive.score=${adapt.finalState.score} > static.score=${stat.finalState.score}`)

// 3) 정적은 첫 벽에서 막혀 골에 못 닿고, 적응형은 골 도달(정적이 못 닿는 상태에 도달).
check('적응형 골 도달', adapt.finalState.reachedGoal === true,
  `reachedGoal=${adapt.finalState.reachedGoal} (정적=${stat.finalState.reachedGoal})`)
check('정적은 골 미도달(첫 장애물에서 막힘)', stat.finalState.reachedGoal === false,
  `static.reachedGoal=${stat.finalState.reachedGoal} maxX=${stat.finalState.maxX}`)

// 4) 결정론 — 같은 시드 적응형 2회 동일 궤적(상태 시퀀스 해시 동일).
check('결정론: 적응형 2회 동일 해시', adapt.hash === adapt2.hash,
  `hashA=${adapt.hash} ${adapt.hash === adapt2.hash ? '=' : '≠'} hashB=${adapt2.hash}`)

// 5) ① VU 휴리스틱 살아있음 — 적응형 진행 중 화면이 검은화면이 아니고 정보(엔트로피)>0.
//    (상태요약이 ① 코어를 실제로 호출해 의미 있는 값을 내는지 확인.)
{
  const probe = makeCorridorGame(SEED)
  // 몇 프레임 전진시켜 주인공이 움직인 뷰를 만든 뒤 요약.
  let t = 0
  for (let i = 0; i < 30; i++) { probe.step(t, FRAME, { right: true }); t += FRAME }
  const view = summarizeView(probe, {})
  check('① VU 휴리스틱: 진행 화면 엔트로피>0 & 검은화면 아님', view.entropy > 0 && view.blackScreen === false,
    `entropy=${view.entropy.toFixed(4)} blackScreen=${view.blackScreen}`)
}

// 6) 결정성 메타 — 정적도 2회 동일(게임 자체 결정성 sanity).
{
  const stat2 = playStatic(SEED, FRAMES, staticAlwaysRight)
  check('결정론: 정적 2회 동일 해시(게임 sanity)', stat.hash === stat2.hash,
    `${stat.hash} ${stat.hash === stat2.hash ? '=' : '≠'} ${stat2.hash}`)
}

if (TRACE && !JSON_ONLY) {
  console.log('— 적응형 액션 결정 로그(앞 24개) —')
  for (const d of adapt.decisions.slice(0, 24)) {
    console.log(`  f${String(d.frame).padStart(3)} x=${String(d.x).padStart(6)} stale=${String(d.stale).padStart(2)} blocked=${d.blocked?1:0} ground=${d.onGround?1:0} → ${d.action.padEnd(5)} (${d.reason})`)
  }
}

// ── 출력 계약: 마지막 줄 단일 JSON ───────────────────────────────────────────
const pass = checks.filter(c => c.ok).length
const fail = checks.length - pass
const okAll = fail === 0

if (!JSON_ONLY) console.log(`— pass ${pass} · fail ${fail}`)

const out = {
  ok: okAll,
  seed: SEED,
  frames: FRAMES,
  decideEvery: DECIDE_EVERY,
  adaptive: {
    maxX: adapt.finalState.maxX,
    score: adapt.finalState.score,
    reachedGoal: adapt.finalState.reachedGoal,
    lives: adapt.finalState.lives,
    hash: adapt.hash
  },
  static: {
    maxX: stat.finalState.maxX,
    score: stat.finalState.score,
    reachedGoal: stat.finalState.reachedGoal,
    lives: stat.finalState.lives,
    hash: stat.hash
  },
  reach: {
    maxXDelta: q(adapt.finalState.maxX - stat.finalState.maxX),
    scoreDelta: adapt.finalState.score - stat.finalState.score
  },
  determinism: {
    adaptiveReplayMatch: adapt.hash === adapt2.hash,
    adaptiveHashA: adapt.hash,
    adaptiveHashB: adapt2.hash
  },
  actions: ACTIONS,
  pass,
  fail,
  checks
}
console.log(JSON.stringify(out))
process.exit(okAll ? 0 : 1)
