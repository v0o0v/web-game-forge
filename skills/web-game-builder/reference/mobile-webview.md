# 모바일 웹뷰 체크리스트 (리서치 검증)

생성하는 모든 게임이 **항상** 적용해야 하는 모바일 웹뷰(Android WebView / iOS WKWebView /
카카오·인스타 등 인앱 브라우저) 베스트프랙티스. `engine/mobile.js` 와 `index.html` 이 이미
대부분 구현하고 있다.

## 필수 (반드시)
- [ ] **'Tap to start' 스플래시**의 첫 `touchend/click` 에서 `ChipAudio.unlock()` 호출
      (AudioContext.resume + iOS 무음버퍼). 인앱 브라우저는 autoplay 휴리스틱을 끄므로
      암묵적 언락에 의존 금지.
- [ ] **뷰포트 meta**: `width=device-width, initial-scale=1, maximum-scale=1,
      user-scalable=no, viewport-fit=cover`.
- [ ] **CSS 리셋**: `html,body { margin:0; overflow:hidden; position:fixed; inset:0;
      overscroll-behavior:none; touch-action:none; -webkit-tap-highlight-color:transparent;
      -webkit-touch-callout:none; user-select:none; }`, 컨테이너 높이 `100dvh/100svh`.
- [ ] **iOS JS 가드**: `gesturestart`/멀티터치 `touchstart`/더블탭/`touchmove`(passive:false)
      `preventDefault`. (`MobileHarness.installDomGuards()`)
- [ ] **`type: Phaser.AUTO`**: WebGL → Canvas 폴백(불안정한 인앱 브라우저 대비).
      단, Phaser 4에서 Canvas 렌더러는 deprecated — 가급적 WebGL 유지. 폴백 시에도 동작은 하나 향후 제거 예정.
- [ ] **Scale.FIT + CENTER_BOTH**, 고정 디자인 해상도 1개. (`MobileHarness.scaleConfig`)
- [ ] **멀티터치**: `this.input.addPointer(2+)` — D-패드 + 점프 동시 입력.
      (`MobileHarness.TouchControlsClass` 가 처리)

## 성능 (60fps 목표)
- [ ] update() 루프에서 **프레임당 할당 금지**(객체/배열 리터럴·클로저·문자열 연결 X) — GC
      스톨이 모바일 웹뷰 끊김의 1위 원인.
- [ ] 자주 생성/파괴되는 것(총알·적·파티클·플로팅 텍스트)은 **오브젝트 풀링**.
- [ ] 스프라이트는 **텍스처 아틀라스**로 묶어 드로우콜 배칭(PixelForge 는 스프라이트당 1
      스트립 텍스처를 굽는다 — 작은 게임엔 충분).
- [ ] 플랫포머는 **Arcade Physics**(Matter 아님). 화면 밖 바디는 컬링/비활성.
- [ ] **devicePixelRatio ≤ 2** 로 제한. 픽셀아트는 `pixelArt:true, roundPixels:true`.
      Phaser 4에는 game config `resolution` 옵션이 없다 — DPR 처리는 ScaleManager가 담당.
      고해상도 제어가 필요하면 `scale.zoom` 또는 `scale.max`로 조정할 것(`resolution: Math.min(devicePixelRatio,2)` 패턴은 v4 미적용).
- [ ] 동적 `Text` 남발 금지(매 변경 시 재래스터화). HUD 숫자는 변경 시에만 갱신.
- [ ] 전체화면 알파 오버레이/과도한 파티클(필레이트 킬러) 자제.

## 플랫폼 quirk
- iOS WKWebView 는 `user-scalable=no` 를 무시 → JS 가드 필수. 입력 폰트 ≥16px(포커스 줌 방지).
- iOS 18 WKWebView 는 무거운 WebGL 에서 크래시 보고 → VRAM/아틀라스 작게, DPR≤2.
- `100vh` 대신 `100dvh/100svh`(인앱 브라우저 툴바 보임/숨김 대응). resize 핸들러 디바운스.
- 인앱 브라우저는 백그라운드 시 오디오 재정지 → `visibilitychange` 에서 `audio.resume()`.
- **실제 대상 앱(카카오톡/인스타/페이스북 인앱브라우저 + 실기기 iOS/Android)에서 테스트** —
  모바일 Safari/Chrome 만으로는 부족.
