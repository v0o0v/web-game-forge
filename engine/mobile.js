/* ============================================================================
 * MobileHarness — 모바일 웹뷰 대응 하니스 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * 리서치(검증)에 기반한 모바일 웹뷰 베스트프랙티스를 한 곳에 묶는다:
 *  - scaleConfig(): Phaser.Scale.FIT + CENTER_BOTH 고정 16:9 디자인 해상도
 *  - installDomGuards(): iOS WKWebView 가 user-scalable=no 를 무시하는 것 대비
 *    (gesturestart / 멀티터치 / 더블탭 줌 / 러버밴드 스크롤 preventDefault)
 *  - installSafeAreaVars(): env(safe-area-inset-*) 를 CSS 변수로 노출
 *    viewport-fit=cover 가 있어야 실제 inset 값이 들어옴(index.html 에서 설정).
 *  - TouchControls: 멀티터치 가상 D-패드 + 점프 버튼 (별도 최상단 Scene)
 *    safe-area-inset 을 반영해 노치·다이내믹아일랜드·가로모드 dead zone 회피.
 *  - 오디오 언락: 'Tap to start' 제스처에서 ChipAudio.unlock() 호출 (게임 코드에서 연결)
 * ==========================================================================*/
(function (global) {
  'use strict';

  // -------------------------------------------------------------------------
  // 순수 계산 함수 — Phaser/DOM 없이 호출 가능(헤드리스 테스트 지원)
  // -------------------------------------------------------------------------

  /**
   * computeSafeAreaLayout
   * TouchControls 버튼 좌표를 safe-area-inset 만큼 오프셋해 반환한다.
   *
   * @param {Array<{id:string, x:number, y:number, r:number, label:string}>} buttons
   *   원본 버튼 배열 (수정하지 않음)
   * @param {{top:number, right:number, bottom:number, left:number}} inset
   *   각 방향의 safe-area-inset (픽셀, 숫자)
   * @param {number} designW  디자인 너비
   * @param {number} designH  디자인 높이
   * @returns {Array<{id:string, x:number, y:number, r:number, label:string}>}
   *   오프셋이 적용된 새 버튼 배열
   */
  function computeSafeAreaLayout(buttons, inset, designW, designH) {
    var safeL = inset.left   || 0;
    var safeR = inset.right  || 0;
    var safeB = inset.bottom || 0;
    var safeT = inset.top    || 0;

    return buttons.map(function (b) {
      var nx = b.x;
      var ny = b.y;
      // 좌측 버튼: x 가 중앙 절반 미만 → left-inset 만큼 우측으로
      if (b.x < designW / 2) {
        nx = b.x + safeL;
      } else {
        // 우측 버튼(jump 포함): right-inset 만큼 좌측으로
        nx = b.x - safeR;
      }
      // 하단 버튼: y 가 중앙 절반 초과 → bottom-inset 만큼 위로
      if (b.y > designH / 2) {
        ny = b.y - safeB;
      } else {
        // 상단 요소: top-inset 만큼 아래로
        ny = b.y + safeT;
      }
      return { id: b.id, x: nx, y: ny, r: b.r, label: b.label };
    });
  }

  /**
   * computeMutePosition
   * 음소거 버튼(우상단 고정) 좌표를 safe-area-inset 만큼 오프셋해 반환한다.
   *
   * @param {number} baseX  원본 x (우상단 기준, origin(1,0) 사용)
   * @param {number} baseY  원본 y
   * @param {{top:number, right:number, bottom:number, left:number}} inset
   * @returns {{x:number, y:number}}
   */
  function computeMutePosition(baseX, baseY, inset) {
    return {
      x: baseX - (inset.right || 0),
      y: baseY + (inset.top   || 0)
    };
  }

  var MobileHarness = {};

  // 순수 계산 함수를 MobileHarness 네임스페이스에도 노출 (브라우저 환경 접근 편의)
  MobileHarness.computeSafeAreaLayout = computeSafeAreaLayout;
  MobileHarness.computeMutePosition   = computeMutePosition;

  // Phaser scale config (게임 config.scale 에 펼쳐 넣기)
  MobileHarness.scaleConfig = function (width, height) {
    return {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: width,
      height: height,
      min: { width: Math.round(width / 2), height: Math.round(height / 2) },
      max: { width: width * 2, height: height * 2 }
    };
  };

  // 터치 디바이스 여부
  MobileHarness.isTouch = function () {
    return ('ontouchstart' in global) ||
      (global.navigator && global.navigator.maxTouchPoints > 0) ||
      /[?&]touch=1/.test(global.location ? global.location.search : '');
  };

  // iOS/웹뷰용 DOM 가드 (index.html 의 viewport meta + CSS 리셋과 함께 사용)
  MobileHarness.installDomGuards = function () {
    var doc = global.document;
    if (!doc) return;
    // 더블탭/제스처 줌 차단
    doc.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
    doc.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
    var lastTouch = 0;
    doc.addEventListener('touchend', function (e) {
      var now = Date.now(); // kitdep-ok: DOM touchend 핸들러(헤드리스 step 루프 밖) — 더블탭 줌 차단 전용, 결정성 무관
      if (now - lastTouch <= 300) e.preventDefault(); // 더블탭 줌
      lastTouch = now;
    }, { passive: false });
    // 멀티터치 줌 차단
    doc.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    // 러버밴드/페이지 스크롤 차단
    doc.addEventListener('touchmove', function (e) {
      e.preventDefault();
    }, { passive: false });
    // 가시성 변화: 화면이 가려지면 사운드 정지(suspend), 복귀하면 재개(resume).
    //  - 게임이 onHide/onResume 을 지정하면 그것을 우선 사용.
    //  - 미지정 시 전역 GAME_AUDIO 를 자동 suspend/resume → 백그라운드에서 소리가 지속되는 것 방지.
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) {
        if (MobileHarness._onHide) MobileHarness._onHide();
        else if (global.GAME_AUDIO && global.GAME_AUDIO.suspend) global.GAME_AUDIO.suspend();
      } else {
        if (MobileHarness._onResume) MobileHarness._onResume();
        else if (global.GAME_AUDIO && global.GAME_AUDIO.resume) global.GAME_AUDIO.resume();
      }
    });
    // 페이지 이탈/언로드(bfcache·탭 종료 직전) 시에도 사운드 정지
    if (global.addEventListener) {
      global.addEventListener('pagehide', function () {
        if (global.GAME_AUDIO && global.GAME_AUDIO.suspend) global.GAME_AUDIO.suspend();
      });
    }
  };
  MobileHarness.onResume = function (fn) { MobileHarness._onResume = fn; };
  MobileHarness.onHide   = function (fn) { MobileHarness._onHide   = fn; };

  // -------------------------------------------------------------------------
  // safe-area-inset 지원
  // -------------------------------------------------------------------------

  /**
   * installSafeAreaVars
   * env(safe-area-inset-top/right/bottom/left) 를 CSS 변수(--sai-*) 로 :root 에 주입한다.
   *
   * ⚠ viewport-fit=cover 가 viewport meta 에 있어야 실제 inset 값이 노출된다.
   *   index.html 에 아래 meta 가 포함돼 있는지 확인:
   *   <meta name="viewport" content="..., viewport-fit=cover">
   *   (games/super-runner/index.html 등 기존 파일에 이미 viewport-fit=cover 가 포함됨)
   *
   * 브라우저 미지원 시 0px 로 폴백(회귀 없음).
   */
  MobileHarness.installSafeAreaVars = function () {
    var doc = global.document;
    if (!doc || !doc.head) return;
    // 이미 주입됐으면 중복 실행 방지
    if (doc.getElementById('__mh-sai-style')) return;
    var style = doc.createElement('style');
    style.id = '__mh-sai-style';
    style.textContent = [
      ':root {',
      '  --sai-top:    env(safe-area-inset-top,    0px);',
      '  --sai-right:  env(safe-area-inset-right,  0px);',
      '  --sai-bottom: env(safe-area-inset-bottom, 0px);',
      '  --sai-left:   env(safe-area-inset-left,   0px);',
      '}'
    ].join('\n');
    doc.head.appendChild(style);
  };

  /**
   * readSafeAreaInset
   * :root 에 주입된 --sai-* CSS 변수를 getComputedStyle 로 읽어 숫자 객체로 반환한다.
   * DOM 이 없는 환경(헤드리스)에서는 모두 0 인 객체를 반환한다.
   *
   * @returns {{top:number, right:number, bottom:number, left:number}}
   */
  MobileHarness.readSafeAreaInset = function () {
    var zero = { top: 0, right: 0, bottom: 0, left: 0 };
    var doc = global.document;
    if (!doc) return zero;
    var style = global.getComputedStyle ? global.getComputedStyle(doc.documentElement) : null;
    if (!style) return zero;
    function px(varName) {
      var raw = style.getPropertyValue(varName).trim();
      var n = parseFloat(raw);
      return isNaN(n) ? 0 : n;
    }
    return {
      top:    px('--sai-top'),
      right:  px('--sai-right'),
      bottom: px('--sai-bottom'),
      left:   px('--sai-left')
    };
  };

  // ===========================================================================
  // TouchControls — 멀티터치 가상 컨트롤 (항상 최상단 Scene)
  //  - 매 프레임 활성 포인터 위치로 버튼 상태를 재계산(슬라이드/멀티터치에 견고).
  //  - 공유 입력 상태 객체(inputState)에 left/right/jump 를 기록한다.
  //  - create() 시 safe-area-inset 을 읽어 버튼·음소거 좌표를 오프셋한다.
  // ===========================================================================
  function makeTouchScene(designW, designH, inputState) {
    return new Phaser.Class({
      Extends: Phaser.Scene,
      initialize: function TouchControls() { Phaser.Scene.call(this, { key: 'TouchControls', active: false }); },
      create: function () {
        var show = MobileHarness.isTouch();
        // 멀티터치 활성화 (D패드 + 점프 동시 입력)
        this.input.addPointer(3);

        var H = designH, W = designW;
        var pad = 18;
        var r = 34;

        // 원본 버튼 좌표 정의
        var baseButtons = [
          { id: 'left',  x: pad + r + 6,         y: H - pad - r,      r: r,     label: '◀' },
          { id: 'right', x: pad + r * 3 + 16,     y: H - pad - r,      r: r,     label: '▶' },
          { id: 'jump',  x: W - pad - r,          y: H - pad - r,      r: r + 6, label: 'A' }
        ];

        // safe-area-inset 읽기 → 순수 함수로 오프셋 계산
        var inset = MobileHarness.readSafeAreaInset();
        this.buttons = computeSafeAreaLayout(baseButtons, inset, W, H);

        var g = this.add.graphics();
        g.setScrollFactor(0);
        this._g = g;

        // 라벨
        this._labels = [];
        var self = this;
        this.buttons.forEach(function (b) {
          var t = self.add.text(b.x, b.y, b.label, {
            fontFamily: 'monospace', fontSize: (b.r) + 'px', color: '#ffffff'
          }).setOrigin(0.5).setScrollFactor(0).setAlpha(show ? 0.9 : 0);
          self._labels.push(t);
        });

        this._show = show;
        if (!show) g.setAlpha(0);

        // 음소거 토글 버튼 (우상단) — safe-area-inset 적용
        if (global.GAME_AUDIO) {
          var mutePos = computeMutePosition(W - 14, 12, inset);
          var mute = this.add.text(mutePos.x, mutePos.y, '♪', {
            fontFamily: 'monospace', fontSize: '20px', color: '#ffffff'
          }).setOrigin(1, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
          mute.on('pointerdown', function () {
            var m = global.GAME_AUDIO.toggleMute();
            mute.setText(m ? '♪̸' : '♪').setAlpha(m ? 0.5 : 1);
          });
        }
      },
      update: function () {
        var st = inputState;
        st.left = false; st.right = false; st.up = false;
        // Phaser Scene InputPlugin 에는 .pointers 배열이 없음 → InputManager 의 것을 사용
        var ptrs = this.input.manager.pointers; // mousePointer + pointer1..N
        for (var i = 0; i < ptrs.length; i++) {
          var p = ptrs[i];
          if (!p.isDown) continue;
          for (var b = 0; b < this.buttons.length; b++) {
            var btn = this.buttons[b];
            var dx = p.x - btn.x, dy = p.y - btn.y;
            if (dx * dx + dy * dy <= (btn.r + 8) * (btn.r + 8)) {
              if (btn.id === 'left') st.left = true;
              else if (btn.id === 'right') st.right = true;
              else if (btn.id === 'jump') st.up = true;
            }
          }
        }
        // 시각 갱신
        if (this._show) {
          var g = this._g; g.clear();
          for (var k = 0; k < this.buttons.length; k++) {
            var btn2 = this.buttons[k];
            var active = (btn2.id === 'left' && st.left) || (btn2.id === 'right' && st.right) || (btn2.id === 'jump' && st.up);
            g.fillStyle(0xffffff, active ? 0.35 : 0.16);
            g.lineStyle(2, 0xffffff, active ? 0.9 : 0.5);
            g.fillCircle(btn2.x, btn2.y, btn2.r);
            g.strokeCircle(btn2.x, btn2.y, btn2.r);
          }
        }
      }
    });
  }
  MobileHarness.TouchControlsClass = makeTouchScene;

  global.MobileHarness = MobileHarness;
  if (typeof module !== 'undefined' && module.exports) module.exports = MobileHarness;
})(typeof window !== 'undefined' ? window : this);
