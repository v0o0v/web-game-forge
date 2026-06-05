---
name: game-qa
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
window.MyGame = { game, input: GAME_INPUT, audio };

// ?autostart=1 처리 (Boot 또는 Preload 씬)
if (new URLSearchParams(location.search).get('autostart') === '1') {
  // splash/tap-to-start 스킵하고 바로 Game 씬 진입
  this.scene.start('Game');
}
```

- `window.SuperRunner = { game, input, audio }` 는 super-runner의 실제 노출 패턴
- 신규 게임은 `window.<GameName> = { game, input, audio }` 형식 준수

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
