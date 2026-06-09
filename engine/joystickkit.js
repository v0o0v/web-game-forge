/* ============================================================================
 * JoystickKit — 가상 조이스틱 (싱글/트윈스틱) 아날로그 터치 컨트롤 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * Phaser 4 의 멀티터치 포인터를 읽어 360° 방향 + 세기(force) 벡터를 만드는 선택적 킷.
 * MobileHarness 의 디지털 D-패드(좌/우/점프 binary)와 달리 가변 방향·가변 세기를 준다.
 * 탑다운·트윈스틱 슈터·러너처럼 아날로그 입력이 어울리는 장르에 쓰고, 플랫포머의
 * 디지털 입력엔 기존 MobileHarness.TouchControls 를 그대로 쓰면 된다(둘은 공존한다).
 *
 * 특징:
 *  - 싱글 스틱(이동) 또는 트윈스틱(이동+조준) — opts.twin
 *  - 플로팅(터치한 곳에 베이스 생성) 또는 고정 위치 — stick.mode: 'floating'|'fixed'
 *  - 멀티터치 안전: game.input.manager.pointers 를 스틱별 포인터 id 로 바인딩한다.
 *    (씬-로컬 input.pointers 가 아니라 InputManager 의 것을 쓴다 — game-qa 버그 교훈)
 *  - 상태 객체 state.{move,aim} = {x,y,angle,force,active}, x·y ∈ [-1,1] (게임이 읽음)
 *  - 헤드리스 검증: controller.inject({move:{x,y}, aim:{x,y,fire}}) 로 포인터 없이 벡터
 *    주입 → game-qa step 하니스로 결정적 검증 (clearInject() 로 실 포인터 복귀)
 *
 * 사용:
 *   // index.html: phaser 다음에  <script src="../../engine/joystickkit.js"></script>
 *   // HUD/최상단(스크롤 안 되는) 씬의 create() 안에서:
 *   var joy = JoystickKit.create(this, { twin: true });
 *   // 게임 업데이트에서 읽기:
 *   var m = joy.state.move;                 // {x,y,angle,force,active}
 *   player.setVelocity(m.x * SPEED, m.y * SPEED);
 *   var a = joy.state.aim;
 *   if (joy.state.fire) fireToward(a.angle); // 조준 스틱이 임계 이상이면 발사
 *
 * ⚠ 주의:
 *  - 반드시 카메라가 스크롤/줌 되지 않는 씬(HUD/UI)에서 생성한다. 카메라가 따라가는
 *    게임 씬에서 만들면 포인터 좌표(월드)와 베이스 좌표(스크롤0)가 어긋난다.
 *  - 마우스는 포인터 1개라 데스크톱에선 한 번에 한 스틱만 구동된다(트윈은 멀티터치 필요).
 *    데스크톱/헤드리스 트윈 검증은 inject() 로 한다.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var JoystickKit = {};
  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function defStick(over, fallback) {
    over = over || {};
    return {
      mode: over.mode || fallback.mode,          // 'floating' | 'fixed'
      x: over.x == null ? fallback.x : over.x,   // 고정/플로팅 홈 위치(디자인 px)
      y: over.y == null ? fallback.y : over.y,
      zone: over.zone || fallback.zone,          // 'left'|'right'|'all'|{x,y,w,h}
      color: over.color == null ? fallback.color : over.color,
      fireThreshold: over.fireThreshold == null ? fallback.fireThreshold : over.fireThreshold
    };
  }

  // 새 스틱 상태 슬롯
  function newSlot(cfg) {
    return {
      cfg: cfg,
      // 출력 (게임이 읽음)
      x: 0, y: 0, angle: 0, force: 0, active: false,
      // 내부: 바인딩된 포인터 + 현재 베이스 위치
      ptr: null, pid: -1,
      baseX: cfg.x, baseY: cfg.y,
      homeX: cfg.x, homeY: cfg.y
    };
  }

  /* JoystickKit.create(scene, opts) → controller
   *  opts: {
   *    twin:false, show:<isTouch||mouse>, radius:42, deadzone:0.16, autoUpdate:true,
   *    move:{mode,x,y,zone,color}, aim:{mode,x,y,zone,color,fireThreshold}
   *  }
   */
  JoystickKit.create = function (scene, opts) {
    opts = opts || {};
    var W = scene.scale.width, H = scene.scale.height;
    var twin = !!opts.twin;
    var R = opts.radius == null ? Math.round(Math.min(W, H) * 0.16) : opts.radius;
    if (R < 24) R = 24;
    var deadzone = opts.deadzone == null ? 0.16 : opts.deadzone;

    var moveCfg = defStick(opts.move, {
      mode: 'floating', x: Math.round(R + 22), y: Math.round(H - R - 22),
      zone: twin ? 'left' : 'all', color: 0x6ea0ff, fireThreshold: 0
    });
    var aimCfg = defStick(opts.aim, {
      mode: 'floating', x: Math.round(W - R - 22), y: Math.round(H - R - 22),
      zone: 'right', color: 0xff8a6b, fireThreshold: 0.35
    });

    var show = opts.show;
    if (show == null) {
      show = (global.MobileHarness && global.MobileHarness.isTouch && global.MobileHarness.isTouch()) || true;
    }

    var ctrl = {
      scene: scene,
      radius: R,
      deadzone: deadzone,
      twin: twin,
      show: show,
      _inject: null,
      _destroyed: false,
      state: {
        move: { x: 0, y: 0, angle: 0, force: 0, active: false },
        aim: { x: 0, y: 0, angle: 0, force: 0, active: false },
        fire: false
      }
    };

    var move = newSlot(moveCfg);
    var aim = twin ? newSlot(aimCfg) : null;
    ctrl._move = move;
    ctrl._aim = aim;

    // 멀티터치 보장 (이동 + 조준 + 여유)
    scene.input.addPointer(3);

    // 그래픽 레이어 (스크롤 0, 최상단)
    var g = scene.add.graphics();
    g.setScrollFactor(0).setDepth(opts.depth == null ? 1000 : opts.depth);
    ctrl._g = g;

    // ---- 포인터 헬퍼 -------------------------------------------------------
    function pointers() { return scene.input.manager.pointers; }
    function findById(id) {
      var ps = pointers();
      for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
      return null;
    }
    function inZone(zone, p) {
      if (zone === 'all' || !zone) return true;
      if (zone === 'left') return p.x < W / 2;
      if (zone === 'right') return p.x >= W / 2;
      if (typeof zone === 'object') {
        return p.x >= zone.x && p.x <= zone.x + zone.w && p.y >= zone.y && p.y <= zone.y + zone.h;
      }
      return true;
    }
    function fixedHit(slot, p) {
      var dx = p.x - slot.homeX, dy = p.y - slot.homeY;
      return dx * dx + dy * dy <= (R * 1.6) * (R * 1.6);
    }

    function release(slot, out) {
      slot.ptr = null; slot.pid = -1;
      slot.baseX = slot.homeX; slot.baseY = slot.homeY;
      out.x = 0; out.y = 0; out.force = 0; out.angle = 0; out.active = false;
    }

    function computeVector(slot, p, out) {
      var dx = p.x - slot.baseX, dy = p.y - slot.baseY;
      var nx = dx / R, ny = dy / R;
      var mag = Math.sqrt(nx * nx + ny * ny);
      if (mag > 1) { nx /= mag; ny /= mag; mag = 1; }
      out.active = true;
      out.angle = (mag > 0.0001) ? Math.atan2(ny, nx) : out.angle;
      if (mag < deadzone) { out.x = 0; out.y = 0; out.force = 0; return; }
      // 데드존 바깥을 0..1 로 재정규화 (부드러운 시작)
      var f = (mag - deadzone) / (1 - deadzone);
      out.force = f;
      out.x = Math.cos(out.angle) * f;
      out.y = Math.sin(out.angle) * f;
    }

    // ---- 한 스틱의 포인터 폴링 --------------------------------------------
    function pollSlot(slot, out) {
      if (!slot) return;
      // 기존 바인딩 유지 검증
      if (slot.pid >= 0) {
        var bound = findById(slot.pid);
        if (bound && bound.isDown && bound.id === slot.pid) {
          if (slot.cfg.mode === 'fixed') { slot.baseX = slot.homeX; slot.baseY = slot.homeY; }
          computeVector(slot, bound, out);
          slot.ptr = bound;
          return;
        }
        release(slot, out);
      }
    }

    function takenBy(id) {
      return (move.pid === id) || (aim && aim.pid === id);
    }

    function tryBind(slot, out) {
      if (!slot || slot.pid >= 0) return;
      var ps = pointers();
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        if (!p.isDown || takenBy(p.id)) continue;
        if (!inZone(slot.cfg.zone, p)) continue;
        if (slot.cfg.mode === 'fixed' && !fixedHit(slot, p)) continue;
        // 바인딩
        slot.pid = p.id; slot.ptr = p;
        if (slot.cfg.mode === 'floating') { slot.baseX = p.x; slot.baseY = p.y; }
        else { slot.baseX = slot.homeX; slot.baseY = slot.homeY; }
        computeVector(slot, p, out);
        return;
      }
    }

    // ---- 그리기 ------------------------------------------------------------
    function drawStick(slot, out, color) {
      if (!slot) return;
      var bx, by;
      if (out.active) { bx = slot.baseX; by = slot.baseY; }
      else if (slot.cfg.mode === 'fixed') { bx = slot.homeX; by = slot.homeY; }
      else return; // 플로팅 + 비활성 → 안 그림
      g.fillStyle(color, out.active ? 0.16 : 0.10);
      g.lineStyle(2, color, out.active ? 0.7 : 0.4);
      g.fillCircle(bx, by, R);
      g.strokeCircle(bx, by, R);
      var tx = bx + out.x * R, ty = by + out.y * R;
      g.fillStyle(color, 0.85);
      g.lineStyle(2, 0xffffff, 0.6);
      g.fillCircle(tx, ty, R * 0.46);
      g.strokeCircle(tx, ty, R * 0.46);
    }

    // ---- inject (헤드리스/프로그램 구동) ----------------------------------
    function applyInjectSlot(spec, out) {
      if (!spec) { out.x = 0; out.y = 0; out.force = 0; out.active = false; return; }
      var x = clamp(spec.x || 0, -1, 1), y = clamp(spec.y || 0, -1, 1);
      var mag = Math.sqrt(x * x + y * y);
      if (mag > 1) { x /= mag; y /= mag; mag = 1; }
      out.active = true;
      out.angle = (mag > 0.0001) ? Math.atan2(y, x) : 0;
      out.force = mag;
      out.x = x; out.y = y;
    }

    // ---- 매 프레임 업데이트 ------------------------------------------------
    ctrl.update = function () {
      if (ctrl._destroyed) return;
      var st = ctrl.state;
      if (ctrl._inject) {
        applyInjectSlot(ctrl._inject.move, st.move);
        if (aim) applyInjectSlot(ctrl._inject.aim, st.aim);
        st.fire = !!(aim && ctrl._inject.aim && ctrl._inject.aim.fire);
      } else {
        pollSlot(move, st.move);
        tryBind(move, st.move);
        if (aim) {
          pollSlot(aim, st.aim);
          tryBind(aim, st.aim);
          st.fire = st.aim.active && st.aim.force >= aim.cfg.fireThreshold;
        } else {
          st.fire = false;
        }
      }
      // 렌더
      g.clear();
      if (ctrl.show && g.visible) {
        drawStick(move, st.move, move.cfg.color);
        if (aim) drawStick(aim, st.aim, aim.cfg.color);
      }
    };

    // 주입: spec = {move:{x,y}, aim:{x,y,fire}} (둘 다 선택). null 이면 해제.
    ctrl.inject = function (spec) { ctrl._inject = spec || null; ctrl.update(); return ctrl; };
    ctrl.clearInject = function () { ctrl._inject = null; return ctrl; };

    ctrl.setVisible = function (v) { ctrl.show = !!v; g.setVisible(!!v); return ctrl; };

    ctrl.destroy = function () {
      ctrl._destroyed = true;
      if (ctrl._autoFn) scene.events.off('update', ctrl._autoFn);
      g.destroy();
    };

    // 자동 업데이트 (기본): 씬 update 이벤트에 훅. game.step() 시에도 발화.
    if (opts.autoUpdate !== false) {
      ctrl._autoFn = function () { ctrl.update(); };
      scene.events.on('update', ctrl._autoFn);
      scene.events.once('shutdown', function () { ctrl.destroy(); });
    }

    return ctrl;
  };

  /* JoystickKit.SceneClass(opts) → Phaser.Scene 클래스
   * MobileHarness.TouchControlsClass 처럼 독립 최상단 씬으로 쓰고 싶을 때.
   * 생성된 씬 인스턴스의 .joy 로 컨트롤러에 접근한다. opts.onReady(joy) 콜백 지원.
   */
  JoystickKit.SceneClass = function (opts) {
    opts = opts || {};
    return new Phaser.Class({
      Extends: Phaser.Scene,
      initialize: function JoystickScene() {
        Phaser.Scene.call(this, { key: opts.key || 'Joystick', active: false });
      },
      create: function () {
        this.joy = JoystickKit.create(this, opts);
        if (opts.onReady) opts.onReady(this.joy);
      }
    });
  };

  global.JoystickKit = JoystickKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = JoystickKit;
})(typeof window !== 'undefined' ? window : this);
