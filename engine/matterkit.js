/* ============================================================================
 * MatterKit — Matter.js 물리 헬퍼 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * Arcade 의 강체-물리 짝꿍. Phaser 4.1.0 에 번들된 Matter 플러그인(this.matter)
 * 위의 얇은 래퍼로, "물리 퍼즐(앵그리버드·컷더로프류)·래그돌·쌓기·차량" 류를
 * 쉽게 만든다. config 블록 · 바디 팩토리 · 상자 스택 · 슬링샷 발사를 한 곳에.
 *
 * 사용:
 *   // game config:  physics: MatterKit.config({ gravity:{x:0,y:1}, bounds:true })
 *   var ground = MatterKit.ground(scene, 240, 300, 480, 24, { texKey:'ground' });
 *   var crates = MatterKit.crateStack(scene, 360, 280, 3, 4, 22, 22, 'crate');
 *   MatterKit.slingshot(scene, 90, 240, { ammo: function(x,y){ return MatterKit.ball(scene,x,y,'orb',{radius:11}); }, onLaunch: fn });
 *
 * ⚠ Matter 주의(레퍼런스 physics-matter.md):
 *   - 위치는 "질량중심" 기준(Arcade 의 top-left 아님).
 *   - 속도 단위는 px/s 가 아니라 "스텝당"(보통 1~20). force 는 더 작다(0.01~0.1).
 *   - setRectangle/setCircle 은 바디 속성을 리셋한다 → 생성 시 options.shape 로 준다.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var MatterKit = {};

  // config.physics 에 넣을 matter 설정 블록을 반환.
  //  opts: { gravity?, bounds?, sleeping?(기본 true), debug? }
  MatterKit.config = function (opts) {
    opts = opts || {};
    return {
      default: 'matter',
      matter: {
        gravity: opts.gravity === undefined ? { x: 0, y: 1 } : opts.gravity,
        setBounds: opts.bounds === undefined ? false : opts.bounds,
        enableSleeping: opts.sleeping !== false,
        // 스택 안정성·고속 탄 접촉(터널링 완화)을 위해 기본 반복수를 올린다(레퍼 기본 6/4).
        positionIterations: opts.positionIterations == null ? 12 : opts.positionIterations,
        velocityIterations: opts.velocityIterations == null ? 8 : opts.velocityIterations,
        debug: opts.debug || false
      }
    };
  };

  // 동적 박스 (texKey 텍스처 = 사각 바디). 상자/벽돌/판자.
  MatterKit.box = function (scene, x, y, texKey, o) {
    o = o || {};
    var cfg = {
      restitution: o.bounce == null ? 0.04 : o.bounce,
      friction: o.friction == null ? 0.55 : o.friction,
      frictionStatic: o.frictionStatic == null ? 1 : o.frictionStatic,
      density: o.density == null ? 0.0016 : o.density
    };
    if (o.chamfer) cfg.chamfer = { radius: o.chamfer };
    if (o.w && o.h) cfg.shape = { type: 'rectangle', width: o.w, height: o.h };
    var img = scene.matter.add.image(x, y, texKey, null, cfg);
    if (o.label) img.body.label = o.label;
    return img;
  };

  // 동적 공 (원형 바디). 슬링샷 탄·구슬·볼.
  MatterKit.ball = function (scene, x, y, texKey, o) {
    o = o || {};
    var r = o.radius || 12;
    var img = scene.matter.add.image(x, y, texKey, null, {
      shape: { type: 'circle', radius: r },
      restitution: o.bounce == null ? 0.35 : o.bounce,
      friction: o.friction == null ? 0.05 : o.friction,
      frictionAir: o.frictionAir == null ? 0.006 : o.frictionAir,
      density: o.density == null ? 0.004 : o.density
    });
    if (o.label) img.body.label = o.label;
    return img;
  };

  // 정적 바닥/벽. texKey 주면 보이는 이미지, 없으면 보이지 않는 사각 바디.
  MatterKit.ground = function (scene, x, y, w, h, o) {
    o = o || {};
    var fr = o.friction == null ? 1 : o.friction;
    if (o.texKey) {
      return scene.matter.add.image(x, y, o.texKey, null, { isStatic: true, friction: fr, restitution: o.bounce || 0 });
    }
    return scene.matter.add.rectangle(x, y, w, h, { isStatic: true, friction: fr, restitution: o.bounce || 0 });
  };

  // 상자 스택 (그리드, 위로 쌓기). 반환: Matter Image 배열.
  MatterKit.crateStack = function (scene, baseX, baseY, cols, rows, cellW, cellH, texKey, o) {
    o = o || {};
    var crates = [];
    for (var r = 0; r < rows; r++) {
      var cols2 = (o.pyramid ? cols - r : cols);
      var inset = (o.pyramid ? (r * cellW) / 2 : 0);
      for (var c = 0; c < cols2; c++) {
        var cx = baseX + inset + c * cellW;
        var cy = baseY - r * cellH;
        var crate = MatterKit.box(scene, cx, cy, texKey, o);
        crate._homeX = cx; crate._homeY = cy;       // 토폴 판정용 시작 위치
        crates.push(crate);
      }
    }
    return crates;
  };

  // 상자가 "쓰러졌는지" 판정 (시작 위치에서 충분히 벗어남 또는 크게 기울어짐).
  MatterKit.isToppled = function (crate, distThresh, angleThresh) {
    if (!crate || !crate.body) return false;
    distThresh = distThresh == null ? 26 : distThresh;
    angleThresh = angleThresh == null ? 0.6 : angleThresh;
    var dx = crate.x - (crate._homeX == null ? crate.x : crate._homeX);
    var dy = crate.y - (crate._homeY == null ? crate.y : crate._homeY);
    var moved = Math.sqrt(dx * dx + dy * dy) > distThresh;
    var tilted = Math.abs(Math.atan2(Math.sin(crate.rotation), Math.cos(crate.rotation))) > angleThresh;
    return moved || tilted;
  };

  // 슬링샷: 포인터로 당겨 놓으면 발사. ammo() 가 새 탄을 만들어 반환.
  //  opts: { ammo:fn(x,y)->MatterImage, onLaunch?:fn(ammo), power?, maxPull?, maxVel?, reloadMs?, depth? }
  MatterKit.slingshot = function (scene, anchorX, anchorY, opts) {
    opts = opts || {};
    var power = opts.power == null ? 0.12 : opts.power;
    var maxPull = opts.maxPull == null ? 110 : opts.maxPull;
    var maxVel = opts.maxVel == null ? 15 : opts.maxVel;   // Matter 속도 단위(스텝당). 너무 크면 터널링.
    var ammo = opts.ammo;
    var onLaunch = opts.onLaunch || function () {};
    var aimG = scene.add.graphics().setDepth(opts.depth == null ? 50 : opts.depth);

    var current = ammo(anchorX, anchorY);
    current.setStatic(true);
    var aiming = false, sx = 0, sy = 0;

    function reload() {
      current = ammo(anchorX, anchorY);
      current.setStatic(true);
    }

    function pull(px, py) {
      var dx = sx - px, dy = sy - py;               // 당긴 반대 방향으로 발사
      var len = Math.min(Math.sqrt(dx * dx + dy * dy), maxPull);
      var ang = Math.atan2(dy, dx);
      return { len: len, ang: ang, v: Math.min(len * power, maxVel) };
    }

    scene.input.on('pointerdown', function (p) {
      if (!current || !current.body || !current.body.isStatic) return;
      aiming = true; sx = p.worldX; sy = p.worldY;
    });
    scene.input.on('pointermove', function (p) {
      if (!aiming || !current) return;
      var s = pull(p.worldX, p.worldY);
      aimG.clear();
      // 조준선 + 파워에 비례한 점선
      aimG.lineStyle(2, 0xffffff, 0.5);
      aimG.lineBetween(current.x, current.y, current.x + Math.cos(s.ang) * s.len, current.y + Math.sin(s.ang) * s.len);
      aimG.fillStyle(0xffe6a8, 0.85);
      for (var i = 1; i <= 5; i++) {
        var d = (s.len / 5) * i * 1.4;
        aimG.fillCircle(current.x + Math.cos(s.ang) * d, current.y + Math.sin(s.ang) * d, 3.2 - i * 0.35);
      }
    });
    scene.input.on('pointerup', function (p) {
      if (!aiming) return;
      aiming = false; aimG.clear();
      if (!current || !current.body) return;
      var s = pull(p.worldX, p.worldY);
      if (s.len < 8) return;                          // 너무 약하면 무시
      current.setStatic(false);
      current.setVelocity(Math.cos(s.ang) * s.v, Math.sin(s.ang) * s.v);
      var launched = current;
      current = null;
      onLaunch(launched);
      scene.time.delayedCall(opts.reloadMs == null ? 850 : opts.reloadMs, reload);
    });

    return {
      reload: reload,
      getCurrent: function () { return current; },
      isAiming: function () { return aiming; },
      aimGraphics: aimG
    };
  };

  global.MatterKit = MatterKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = MatterKit;
})(typeof window !== 'undefined' ? window : this);
