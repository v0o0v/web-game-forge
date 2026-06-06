---
name: mobile-webview-tune
description: "게임을 모바일 웹뷰(iOS WKWebView·Android WebView·카카오/인스타 인앱 브라우저)에 최적화·감사합니다 — Scale.FIT, 오디오 언락, 멀티터치 컨트롤, 뷰포트/줌 가드. 모바일/웹뷰/터치/세로화면 대응 요청 시 사용. mobile, webview, touch."
allowed-tools: Read, Write, Edit, Bash
---

# mobile-webview-tune — 모바일 웹뷰 최적화 감사 스킬

게임이 iOS WKWebView·Android WebView·카카오/인스타 인앱 브라우저에서 올바르게 동작하는지
`reference/mobile-webview.md` 체크리스트를 기준으로 점검·적용한다. web-game-builder의 전문 스킬.

## 언제 사용
- "모바일에서 안 돌아가요", "터치가 안 먹혀요", "인앱 브라우저에서 깨져요"
- "세로화면 대응", "웹뷰 최적화", "iOS 줌 막아줘" 요청 시
- 신규 게임 첫 모바일 QA 전 사전 감사

## 점검 항목

### 1. index.html — 뷰포트 & CSS 리셋
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">` 존재
- [ ] `<body>` CSS: `margin:0; padding:0; overflow:hidden; overscroll-behavior:none; touch-action:none; background:#000`
- [ ] `<canvas>` CSS: `display:block; touch-action:none`

### 2. MobileHarness 3종 호출 확인
`engine/mobile.js`의 MobileHarness를 게임 초기화 시 반드시 호출한다.

- [ ] `scaleConfig(W, H)` — Phaser Scale.FIT + CENTER 설정 반환값을 config.scale에 전달
- [ ] `installDomGuards()` — iOS 줌/스크롤 preventDefault 가드 설치
- [ ] `new TouchControlsClass(W, H, GAME_INPUT)` — 멀티터치 D-패드 + 점프 버튼 생성

### 3. Tap-to-start 오디오 언락
- [ ] 첫 사용자 인터랙션(tap/click) 콜백에서 `audioCtx.resume()` 또는 ChipAudio unlock 호출
- [ ] Phaser `input.once('pointerdown', ...)` 또는 별도 splash 씬에서 처리

### 4. 멀티터치 addPointer 설정
- [ ] Phaser config 또는 preload/create에서 `this.input.addPointer(2)` (최소 3포인터)
- [ ] TouchControlsClass 내부에서 `game.input.manager.pointers` 배열로 접근하는지 확인
  (주의: `scene.input.pointers`는 씬-로컬이라 멀티터치 누락 버그 발생 가능)

### 5. DPR 제한
- [ ] Phaser 4에는 game config `resolution`이 없다. DPR은 ScaleManager가 처리하며, 과도한 렌더 해상도가 문제면 `scale.zoom` 또는 `scale.max`로 캡한다.
- [ ] MobileHarness `scaleConfig(W, H)` 반환값이 `scale` 블록을 포함하는지 확인 — `resolution` 키가 있으면 제거

### 6. visibilitychange 오디오 정지/재개 (백그라운드 소리 차단)
- [ ] `MobileHarness.installDomGuards()` 호출 시 자동: 탭이 가려지면 `GAME_AUDIO.suspend()`(BGM 타이머 정지 + ctx suspend), 복귀하면 `resume()`(BGM 자동 재가동). `pagehide` 에서도 suspend.
- [ ] 탭 전환·홈 복귀·페이지 이탈 후 **소리가 멈췄다가 복귀 시 재개**되는지 확인 (로컬 서버를 내려도 열린 탭이 계속 소리 내면 안 됨)
- [ ] 커스텀이 필요하면 `MobileHarness.onHide(fn)` / `onResume(fn)` 으로 덮어쓰기

### 7. 렌더러
- [ ] Phaser config `type: Phaser.AUTO` (WebGL 우선, Canvas 폴백)
- [ ] `backgroundColor` 설정으로 투명 캔버스 피하기

## 짧은 스니펫

```js
// index.html <head>
// <meta name="viewport" content="width=device-width, initial-scale=1,
//   maximum-scale=1, user-scalable=no, viewport-fit=cover">

// game.js — Phaser config 예시 (UMD 전역, ESM import 아님)
// engine/mobile.js 는 window.MobileHarness 로 노출됨
var W = 400, H = 600;
MobileHarness.installDomGuards();

var config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  scale: MobileHarness.scaleConfig(W, H),  // Scale.FIT + CENTER
  // Phaser 4: resolution config 없음 — DPR은 ScaleManager가 처리
  scene: [Boot, Game],
};
var game = new Phaser.Game(config);

// Boot 씬 — 오디오 언락 + 멀티터치
var Boot = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () { Phaser.Scene.call(this, { key: 'Boot' }); },
  create: function () {
    this.input.addPointer(2);
    this.input.once('pointerdown', function () { GAME_AUDIO.unlock(); });
    MobileHarness.onResume(function () { GAME_AUDIO.resume(); });
    new (MobileHarness.TouchControlsClass(W, H, GAME_INPUT));
    this.scene.start('Game');
  }
});
```

## 확인 방법
1. `python -m http.server 8766` 로컬 서버 기동
2. 실기기 또는 브라우저 DevTools 모바일 에뮬로 접속
3. 카카오/인스타 인앱 브라우저는 실기기 직접 테스트 권고 (에뮬 한계)
4. 오디오: 첫 tap 후 사운드 재생 → 탭 전환 후 복귀 → 사운드 재개 확인

## 연계 / 원칙
- 상세 체크리스트: `skills/web-game-builder/reference/mobile-webview.md`
- MobileHarness API: `skills/web-game-builder/reference/engine-api.md`
- 예제 구현: `games/super-runner/` (TouchControls, onResume 실제 사용 사례)
- web-game-builder 워크플로의 품질 게이트. 모바일 배포 전 필수 통과.
- Phaser 4 API 참고: [scale-and-responsive](../web-game-builder/reference/phaser/scale-and-responsive.md), [game-setup-and-config](../web-game-builder/reference/phaser/game-setup-and-config.md), [input-keyboard-mouse-touch](../web-game-builder/reference/phaser/input-keyboard-mouse-touch.md). 전체 색인은 [reference/phaser/INDEX.md](../web-game-builder/reference/phaser/INDEX.md).
