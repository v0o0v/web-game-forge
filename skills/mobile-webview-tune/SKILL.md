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
- [ ] Phaser config `resolution: Math.min(window.devicePixelRatio, 2)` 설정
- [ ] 또는 MobileHarness `scaleConfig` 반환값에 포함되는지 확인

### 6. visibilitychange 오디오 재개
- [ ] `MobileHarness.onResume(fn)` 또는 직접 `document.addEventListener('visibilitychange', ...)` 등록
- [ ] 탭 전환·홈 복귀 후 오디오가 자동 재개되는지 확인

### 7. 렌더러
- [ ] Phaser config `type: Phaser.AUTO` (WebGL 우선, Canvas 폴백)
- [ ] `backgroundColor` 설정으로 투명 캔버스 피하기

## 짧은 스니펫

```js
// index.html <head>
// <meta name="viewport" content="width=device-width, initial-scale=1,
//   maximum-scale=1, user-scalable=no, viewport-fit=cover">

// game.js — Phaser config 예시
import { scaleConfig, installDomGuards, TouchControls, onResume } from '../engine/mobile.js';

const W = 400, H = 600;
installDomGuards();

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  scale: scaleConfig(W, H),               // Scale.FIT + CENTER
  resolution: Math.min(devicePixelRatio, 2),
  scene: [Boot, Game],
};
const game = new Phaser.Game(config);

// Boot 씬 — 오디오 언락 + 멀티터치
class Boot extends Phaser.Scene {
  create() {
    this.input.addPointer(2);
    this.input.once('pointerdown', () => audio.unlock());
    onResume(() => audio.resume());
    new TouchControls(W, H, GAME_INPUT);
    this.scene.start('Game');
  }
}
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
