---
name: wgf-game-qa
description: "게임을 실제 실행해 테스트·검증합니다 — 헤드리스 step 하니스로 이동·충돌·메카닉을 결정적 검증하고 콘솔 에러를 점검. 게임 테스트/QA/버그 확인/동작 검증 요청 시 사용. test, QA, verify, debug, playtest."
allowed-tools: Read, Write, Edit, Bash
---

# game-qa — 게임 결정적 검증 스킬

로컬 서버 기동 → `?autostart=1` 로드 → `game.step()` 수동 반복으로 시뮬레이션을
결정적으로 전진시켜 이동·점프·충돌·점수 등 메카닉을 검증한다. web-game-builder의 전문 스킬.

## 언제 사용
- "게임이 제대로 동작하는지 확인해줘", "이 버그 재현해봐"
- "충돌이 안 잡혀", "점수가 오르지 않아", "죽어도 목숨이 안 줄어"
- PR 전 회귀 검증, 신규 메카닉 동작 확인

## 전제: 테스트 가능성 패턴

게임 파일에 아래 전역 노출과 autostart 지원을 **반드시** 심어두어야 헤드리스 검증이 가능하다.

```js
// game.js 또는 main.js
const game = new Phaser.Game(config);
window.MyGame = { game, input: GAME_INPUT, audio, rng };

// ?autostart=1 처리 (Boot 또는 Preload 씬)
if (new URLSearchParams(location.search).get('autostart') === '1') {
  // splash/tap-to-start 스킵하고 바로 Game 씬 진입
  this.scene.start('Game');
}
```

- `window.SuperRunner = { game, input, audio }` 는 super-runner의 실제 노출 패턴
- 신규 게임은 `window.<GameName> = { game, input, audio, rng }` 형식 준수
- `rng`(RngForge 인스턴스)를 노출하면 QA가 시드·상태를 읽어 결정성을 검증할 수 있다(아래 6단계)

## 결정론: 시드 RNG (RngForge)

헤드리스 step 하니스는 **시간**을 통제하지만(수동 `game.step`), **무작위**를 통제하지 못하면
재현성이 깨진다. 게임 내 모든 무작위는 `engine/rngforge.js`(`RngForge`)로만 다룬다 — `Math.random()`
직접 호출 금지. 시간은 `game.step(time, delta)` 주입 인자만 쓰고 `Date.now()/performance.now()`를
게임 로직에 쓰지 않는다.

```js
// index.html: <script src="../../engine/rngforge.js"></script>  (phaser 다음, game.js 이전)
this.rng = RngForge.fromUrl(20260613);   // ?seed=N 있으면 그 값, 없으면 기본 시드
if (this.rng() < 0.3) dropCoin();        // rng() = Math.random() 드롭인
var dmg = this.rng.int(8, 12);
this.rng.stream('particles');            // 시각 효과는 별도 스트림(게임플레이 RNG 불변)
```

**정적 검증 — `Math.random`/월클럭 린트** (PR 전 필수):
```bash
node skills/wgf-game-qa/tools/lint-rng.mjs games/<slug>/game.js
# error 0 이어야 통과. 불가피한 시각 전용 라인은 끝에 `// rng-ok` 주석으로 억제.
```

**런타임 검증 — 시드 주입 재현**:
```
URL: http://localhost:8766/index.html?autostart=1&seed=12345
```
같은 `seed`로 두 번 로드 → 같은 step 시퀀스 → 상태 동일이어야 한다.

## 6단계: 값-스냅샷 회귀 (선택)

시드 고정 후 N프레임 전진한 직렬화 상태를 값으로 박아 회귀를 잡는다(이미지 캡처보다 가볍고
디프가 읽히며 `preserveDrawingBuffer` 정지프레임 함정을 회피).

```js
const m = window.MyGame;
const scene = m.game.scene.getScene('Game');
const FRAME = 1000 / 60; let t = 0;
for (let i = 0; i < 120; i++) { m.game.step(t, FRAME); t += FRAME; }
// 좌표는 양자화(부동소수 지터 흡수)
const snap = {
  x: Math.round(scene.hero?.x), y: Math.round(scene.hero?.y),
  score: scene.registry.get('score'), lives: scene.registry.get('lives'),
  rng: m.rng ? m.rng.state() : null      // RngForge 상태까지 포함하면 무작위 경로도 고정 검증
};
console.log(JSON.stringify(snap));        // 기준값과 비교(불일치 = 회귀)
```

## 7단계: 결정성 회귀 하니스 (replay-determinism)

`game.step` 게임상태를 직렬화해 **비결정성 누수(Date.now/Math.random/순회순서)** 를 두 방식으로
자동 검출한다. 좌표는 양자화(`round(x*1000)/1000`)로 부동소수 노이즈를 흡수하고, `score`/`lives`/
엔티티수/`rng.state()` 를 함께 박는다.

```bash
node skills/wgf-game-qa/tools/replay-determinism.mjs --update  # golden 생성·갱신
node skills/wgf-game-qa/tools/replay-determinism.mjs           # golden 비교 + 2회 재생 해시 검사
# 전부 통과 0 / 하나라도 실패 1. 마지막 줄 단일 JSON {"ok",...}.
```

- (a) **상태 스냅샷 회귀**: 시드 고정 N프레임 후 직렬화 상태를 `golden/replay-*.json` 으로 박아 비교
  (`snapshot.mjs` 와 동일한 golden 디렉터리/diff/`--update` 패턴).
- (b) **2회 재생 해시**: 같은 시드 + 같은 입력 타임라인을 2회 독립 재생 → 상태 시퀀스 해시(djb2+FNV)
  **불일치 시 비결정성 누수**로 판정. 음성 fixture(Date.now/Math.random 주입)는 도구가 불일치를
  **검출하면 통과**하는 메타 테스트로 구성.
- 한계: runeburst 등 실제 게임의 `resolveStep` 은 Phaser scene/tween/`time.delayedCall` 에 묶여 Node
  헤드리스 step 이 불가하므로, 실제 `engine/rngforge.js` 를 유일 엔트로피원으로 쓰는 **합성 step**
  (시드 RNG 가 스폰·이동·충돌·점수를 구동 — runeburst 의 "rng 하나가 진실" 모델과 동형)으로 실증한다.

## 8단계: BH/VU/IA 3축 QA 점수 (qa-score)

게임 하나의 품질을 **세 축**으로 정량화한다. 통과/실패 이분이 아니라 *어디가 약한지*를
0~100 점수로 드러내, 회귀·개선 추적과 PR 게이트에 쓴다.

- **BH (Build Health)** — 빌드/렌더 무오류. `lint-rng`(게임 `game.js` 대상)·`lint-juice`·
  `lint-particles`·`lint-kit-deps`(엔진 대상)를 자식 프로세스로 돌려 마지막 줄 JSON 을 회수 +
  게임 로드 콘솔 에러 수 + `game.step` N프레임 무크래시(`--runtime` 주입)를 가중 합.
- **VU (Visual Usability)** — 프레임 **엔트로피**(휘도 히스토그램 샤논 엔트로피 — 검은화면·
  단색은 0)·**프레임간 모션**(휘도 평균절대차 — 정지는 0) 휴리스틱으로 **검은화면·정지**를
  감지. ⚠ 외부 VLM 미사용, 순수 통계만. 픽셀은 canvas 에서 추출.
- **IA (Intent Alignment)** — 요구사항 스펙 vs 산출물 대조. 스펙을 `--require`/`--spec`(JSON)으로
  주입하거나, 게임 디렉터리에 바이블(STORY/STYLE/AUDIO.md)이 있으면 헤딩·강조를 파싱해 요구
  요소를 뽑아 `game.js`+`index.html` 텍스트와 대조한 충족 비율.

```bash
# 인라인 요구 스펙으로 의도 대조(가장 흔한 사용)
node skills/wgf-game-qa/tools/qa-score.mjs games/<slug> --require "coin,jump,score,goal"
# JSON 스펙 파일 / 외부 캡처 프레임 / 런타임 결과 주입
node skills/wgf-game-qa/tools/qa-score.mjs <slug> --spec spec.json --frames frames.json --runtime runtime.json
# 사람용 라인 생략, JSON 만(마지막 줄 계약 동일)
node skills/wgf-game-qa/tools/qa-score.mjs <slug> --json
# 전부 임계(기본 60) 이상이면 exit 0, 하나라도 미달이면 exit 1.
# 마지막 줄 단일 JSON: {"ok":bool,"bh":n,"vu":n,"ia":n,...}
```

- **순수 코어 + 캡처 어댑터 분리**: 점수 계산은 `qa-score-core.mjs`(Phaser/DOM 무의존, ESM
  export, `Math.random`/`Date.now` 미사용 — 같은 입력→같은 점수)가 담당하고, `qa-score.mjs`
  는 lint·픽셀·스펙을 *뽑아오는* 어댑터다. 코어는 `test-qa-score.mjs` 합성 fixture 로
  **점수 차등을 실증**(정상=고점 ↔ 검은화면=VU 저점 ↔ 정지=VU 저점 ↔ 의도누락=IA 저점).
- **VU 헤드리스 캡처 한계(정직)**: Node 헤드리스에는 WebGL/canvas 픽셀을 신뢰성 있게 뽑을
  경로가 없다(스크린샷이 진실·CDP `evaluate` 컨텍스트 플래핑·프로브 고정값 함정). 따라서
  실게임 픽셀 VU 는 *외부 캡처 단계*(chrome-devtools `take_screenshot` 또는 브라우저에서
  `canvas.getImageData()`)에서 프레임을 떠 JSON 으로 저장하고 `--frames` 로 먹인다
  (`juicekit`/`screenfx` 가 WebGL 시각을 한계로 둔 것과 동형 — 코어는 완전 검증, 어댑터
  경계만 한계). `--frames` 없이 실행하면 VU 는 `skipped` 로 표시되고 ok 게이트에서 중립
  처리된다(거짓 통과·거짓 실패 방지).

```bash
node skills/wgf-game-qa/tools/test-qa-score.mjs   # 순수 코어 단위테스트(전부 통과 0 / 실패 1)
```

## QA 절차

### 1단계: 로컬 서버 기동
```bash
cd games/<game-folder>
python -m http.server 8766
```

### 2단계: chrome-devtools 또는 preview MCP로 로드
```
URL: http://localhost:8766/index.html?autostart=1
```
- `?autostart=1` 로 tap-to-start 스플래시 스킵
- 주의: `preserveDrawingBuffer:false` + 비가시 탭 rAF 정지로 **라이브 스크린샷은 정지 프레임**일 수 있음
  → 시각 검증보다 **eval 상태 읽기**로 검증

### 3단계: step 하니스로 결정적 시뮬
```js
// 브라우저 콘솔 또는 MCP evaluate_script 로 실행
const g = window.SuperRunner.game;   // 또는 window.MyGame.game
const scene = g.scene.getScene('Game');

// 60fps 기준 1프레임 = ~16.67ms
const FRAME = 1000 / 60;
let t = 0;

// 100프레임 전진 (약 1.67초)
for (let i = 0; i < 100; i++) {
  g.step(t, FRAME);
  t += FRAME;
}

// 상태 확인
console.log('hero x:', scene.hero?.x);
console.log('score:', scene.registry.get('score'));
console.log('lives:', scene.registry.get('lives'));
console.log('state:', scene.state);
```

### 4단계: 메카닉별 검증 패턴

**이동 검증**
```js
window.SuperRunner.input.right = true;
for (let i = 0; i < 30; i++) { g.step(t, FRAME); t += FRAME; }
window.SuperRunner.input.right = false;
console.assert(scene.hero.x > startX, '오른쪽 이동 실패');
```

**점프 검증**
```js
const beforeY = scene.hero.y;
window.SuperRunner.input.jump = true;
g.step(t, FRAME); t += FRAME;
window.SuperRunner.input.jump = false;
for (let i = 0; i < 20; i++) { g.step(t, FRAME); t += FRAME; }
console.assert(scene.hero.y < beforeY, '점프 상승 실패');
```

**충돌/피해 검증**
```js
// 적에게 의도적으로 충돌시킨 뒤 목숨 감소 확인
const livesBefore = scene.registry.get('lives');
// ... hero를 적 위치로 강제 이동 후 step ...
const livesAfter = scene.registry.get('lives');
console.assert(livesAfter < livesBefore, '충돌 피해 미적용');
```

### 5단계: 콘솔 에러 점검
```js
// 실행 후 콘솔 에러 0건 확인
// chrome-devtools MCP: list_console_messages 또는 get_console_message
// TypeError, ReferenceError, Uncaught 없어야 함
```

## 실제 버그 교훈

| 버그 | 원인 | 수정 |
|------|------|------|
| 멀티터치 D-패드 미동작 | `scene.input.pointers` (씬-로컬) 사용 | `game.input.manager.pointers` 로 변경 |
| scene.restart 후 목숨 리셋 | `this.lives` 를 씬 로컬 변수로 관리 | `scene.registry` 영속화로 변경 |
| 점프 중 재점프 가능 | isGrounded 체크 누락 | Arcade body.blocked.down 체크 추가 |

## 연계 / 원칙
- 예제 테스트 대상: `games/super-runner/` (window.SuperRunner 패턴 참조)
- 성능 이슈 발견 시 → `perf-60fps` 스킬 연계
- 모바일 동작 이슈 → `mobile-webview-tune` 스킬 연계
- web-game-builder 워크플로의 품질 게이트. 배포 전 필수 통과.
- Phaser 4 API 참고: [scenes](../wgf-web-game-builder/reference/phaser/scenes.md), [time-and-timers](../wgf-web-game-builder/reference/phaser/time-and-timers.md), [events-system](../wgf-web-game-builder/reference/phaser/events-system.md). 전체 색인은 [reference/phaser/INDEX.md](../wgf-web-game-builder/reference/phaser/INDEX.md).
