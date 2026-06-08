/* ============================================================================
 * NOCTURNE — 야간 물리 슬링볼 (web-game-builder 데모)
 * ----------------------------------------------------------------------------
 * Phaser 고급 4종 킷을 한 화면에 통합한 쇼케이스:
 *   A) Matter 물리 (matterkit)  — 슬링샷 구슬 발사 · 상자 스택 무너뜨리기
 *   B) 포스트FX   (screenfx)    — 카메라 블룸 · 비네트 · 컬러 그레이딩
 *   C) 라이팅      (lightingkit) — 구슬/등불 점광원 · Simplex 안개 · 앰비언트
 *   D) 경로·모션   (pathkit)     — 등불이 스플라인 루프를 따라 떠다님(맞히면 점수)
 *
 * 렌더 스타일: 스무스/벡터(VectorForge, pixelArt:false). 어두운 밤 정원.
 * 조작: 구슬을 당겨(드래그) 놓으면 발사. 등불을 맞히고 상자를 무너뜨려라.
 * 검증: ?autostart=1 로 탭 없이 시작. window.Nocturne.api 로 헤드리스 구동.
 * ==========================================================================*/
(function () {
  'use strict';

  var DESIGN_W = 480, DESIGN_H = 320;
  var LITE = /[?&]lite=1/.test(location.search);      // 저사양: 무거운 FX 끔
  var GROUND_TOP = 284;
  var ANCHOR = { x: 86, y: 248 };
  var GOAL_CRATES = 6;

  var GAME_AUDIO = new ChipAudio();
  window.GAME_AUDIO = GAME_AUDIO;
  function sfx(n) { try { GAME_AUDIO.sfx(n); } catch (e) { /* noop */ } }

  // 씬 간 공유 상태(UI 가 읽음)
  var SHARED = { score: 0, shots: 0, lanternsLeft: 0, toppled: 0, goal: GOAL_CRATES, won: false };

  // ---- 텍스처 굽기 (VectorForge 절차 생성, 외부 파일 0) ---------------------
  function bakeTextures(scene) {
    var VF = VectorForge.helpers;

    VectorForge.gradientBackground(scene, 'sky', DESIGN_W, DESIGN_H,
      [[0, '#0a0e26'], [0.55, '#141a3c'], [1, '#241c44']]);

    VectorForge.bake(scene, 'orb', { w: 22, h: 22, draw: function (ctx, w, h, t, VF) {
      var cx = w / 2, cy = h / 2;
      VF.glow(ctx, 'rgba(120,230,255,0.9)', 7, function () {
        VF.circle(ctx, cx, cy, 7);
        ctx.fillStyle = VF.radial(ctx, cx, cy, 7, [[0, '#f0ffff'], [0.4, '#7fe8ff'], [1, '#2bb6e0']]);
        ctx.fill();
      });
      VF.circle(ctx, cx - 2, cy - 2, 1.8); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    } });

    VectorForge.bake(scene, 'crate', { w: 22, h: 22, draw: function (ctx, w, h, t, VF) {
      VF.rr(ctx, 2, 2, w - 4, h - 4, 3);
      ctx.fillStyle = VF.lin(ctx, 0, 2, 0, h, [[0, '#8a5a32'], [1, '#5c3a1e']]); ctx.fill();
      ctx.strokeStyle = 'rgba(28,15,6,0.65)'; ctx.lineWidth = 1.2; VF.rr(ctx, 2, 2, w - 4, h - 4, 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, h / 2); ctx.lineTo(w - 2, h / 2);
      ctx.moveTo(w / 2, 2); ctx.lineTo(w / 2, h - 2);
      ctx.strokeStyle = 'rgba(40,22,8,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      VF.rr(ctx, 3, 3, w - 6, 4, 2); ctx.fillStyle = 'rgba(255,220,170,0.22)'; ctx.fill();
    } });

    VectorForge.bake(scene, 'lantern', { w: 20, h: 24, draw: function (ctx, w, h, t, VF) {
      var cx = w / 2;
      VF.glow(ctx, 'rgba(255,180,80,0.95)', 8, function () {
        VF.rr(ctx, 4, 5, w - 8, h - 9, 5);
        ctx.fillStyle = VF.radial(ctx, cx, h / 2, 9, [[0, '#fff3c0'], [0.5, '#ffc24d'], [1, '#e8761f']]); ctx.fill();
      });
      ctx.fillStyle = '#3a2a18'; VF.rr(ctx, cx - 4, 1, 8, 4, 1.5); ctx.fill(); VF.rr(ctx, cx - 4, h - 4, 8, 3, 1.5); ctx.fill();
    } });

    VectorForge.bake(scene, 'ground', { w: DESIGN_W, h: 32, ss: 1, draw: function (ctx, w, h) {
      ctx.fillStyle = VectorForge.helpers.lin(ctx, 0, 0, 0, h, [[0, '#20243e'], [1, '#0c0e1c']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(120,150,220,0.22)'; ctx.fillRect(0, 0, w, 2);
    } });
  }

  // ============================ Boot ========================================
  var BootScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BootScene() { Phaser.Scene.call(this, { key: 'Boot' }); },
    create: function () {
      bakeTextures(this);
      MobileHarness.installDomGuards();
      this.scene.start('Title');
    }
  });

  // ============================ Title =======================================
  var TitleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function TitleScene() { Phaser.Scene.call(this, { key: 'Title' }); },
    create: function () {
      this.add.image(DESIGN_W / 2, DESIGN_H / 2, 'sky').setDepth(-100);
      var n1 = this.add.image(140, 150, 'lantern').setScale(1.4);
      var n2 = this.add.image(360, 110, 'lantern').setScale(1.1);
      this.tweens.add({ targets: [n1, n2], y: '+=8', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      this.add.text(DESIGN_W / 2, 110, 'NOCTURNE', {
        fontFamily: 'Georgia, serif', fontSize: '44px', color: '#cfe6ff'
      }).setOrigin(0.5);
      this.add.text(DESIGN_W / 2, 150, '야간 물리 슬링볼', {
        fontFamily: 'monospace', fontSize: '14px', color: '#8aa0d0'
      }).setOrigin(0.5);
      var tip = this.add.text(DESIGN_W / 2, 220, '탭하여 시작', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffd9a0'
      }).setOrigin(0.5);
      this.tweens.add({ targets: tip, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
      this.add.text(DESIGN_W / 2, 264, '구슬을 당겨 놓아 발사 · 등불을 맞히고 상자를 무너뜨려라', {
        fontFamily: 'monospace', fontSize: '11px', color: '#6678a8'
      }).setOrigin(0.5);

      if (!LITE && ScreenFX.supported(this.cameras.main)) {
        ScreenFX.bloom(this.cameras.main, { threshold: 0.5, amount: 0.7 });
        ScreenFX.vignette(this.cameras.main, { radius: 0.7, strength: 0.45 });
      }

      var self = this;
      function start() {
        GAME_AUDIO.unlock(); GAME_AUDIO.startBgm();
        self.scene.start('Game');
        self.scene.launch('UI');
      }
      this.input.once('pointerdown', start);
      if (/[?&]autostart=1/.test(location.search)) this.time.delayedCall(80, start);
    }
  });

  // ============================ Game ========================================
  var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function GameScene() { Phaser.Scene.call(this, { key: 'Game' }); },

    create: function () {
      var self = this;
      SHARED.score = 0; SHARED.shots = 0; SHARED.toppled = 0; SHARED.won = false;

      // --- 배경(스카이 + 별 + 절차 안개 + 앰비언트 어둠) ---
      this.add.image(DESIGN_W / 2, DESIGN_H / 2, 'sky').setDepth(-100).setScrollFactor(0);
      var starG = this.add.graphics().setDepth(-90);
      for (var s = 0; s < 18; s++) {
        var sxp = 18 + (s * 53) % (DESIGN_W - 30);
        var syp = 18 + (s * 37) % 150;
        starG.fillStyle(0xffffff, 0.25 + ((s % 3) * 0.18));
        starG.fillCircle(sxp, syp, (s % 4 === 0) ? 1.6 : 1);
      }
      if (!LITE) {
        LightingKit.fog(this, DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, { alpha: 0.12, depth: -80, speed: 0.00016 });
        LightingKit.ambient(this, DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, 0x0a0e22, 0.35).setDepth(40).setScrollFactor(0);
      }

      // --- Matter 월드: 바닥 + 상자 스택(A) ---
      this.matter.world.setBounds(0, 0, DESIGN_W, DESIGN_H, 64, true, true, true, true);
      MatterKit.ground(this, DESIGN_W / 2, 300, DESIGN_W, 32, { texKey: 'ground', friction: 1 }).setDepth(10);

      // 잘 쓰러지도록 가볍고 미끄럽게(라이브 튜닝으로 검증한 값) — 한 발 잘 맞으면 6개+ 토폴.
      this.crates = MatterKit.crateStack(this, 320, GROUND_TOP - 12, 4, 4, 24, 24, 'crate',
        { pyramid: true, bounce: 0.06, friction: 0.32, frictionStatic: 0.4, density: 0.0009 });
      this.crates.forEach(function (c) { c.setDepth(12); });

      // 슬링샷 받침대(장식)
      var post = this.add.graphics().setDepth(11);
      post.lineStyle(4, 0x2a3350, 1);
      post.lineBetween(ANCHOR.x, ANCHOR.y + 6, ANCHOR.x, GROUND_TOP);
      post.lineBetween(ANCHOR.x - 8, ANCHOR.y - 4, ANCHOR.x, ANCHOR.y + 6);
      post.lineBetween(ANCHOR.x + 8, ANCHOR.y - 4, ANCHOR.x, ANCHOR.y + 6);

      // --- 등불: 스플라인 루프를 따라 떠다님(D) + 점광원(C) ---
      var loops = [
        [[60, 70], [180, 44], [300, 74], [200, 124]],
        [[300, 52], [424, 92], [330, 150], [232, 92]],
        [[110, 150], [258, 128], [400, 158], [250, 196]],
        [[200, 40], [384, 62], [300, 128], [150, 100]]
      ];
      this.lanterns = [];
      loops.forEach(function (pts, i) {
        var path = PathKit.loop(self, pts);
        if (!LITE) PathKit.draw(self, path, { color: 0x33407a, alpha: 0.22, depth: -70 });
        var lan = PathKit.follower(self, path, 'lantern', { duration: 8000 + i * 1700, startAt: (i * 0.23) % 1 });
        lan.setDepth(15);
        lan._light = LightingKit.attach(self, lan, { color: 0xffc46a, radius: 64, intensity: 0.85, depth: 14 });
        lan._popped = false;
        self.lanterns.push(lan);
      });
      SHARED.lanternsLeft = this.lanterns.length;

      // --- 슬링샷 발사(A) ---
      this.launched = [];
      function makeOrb(x, y) {
        var o = MatterKit.ball(self, x, y, 'orb', { radius: 11, bounce: 0.42, frictionAir: 0.005 });
        o.setDepth(20);
        o._light = LightingKit.attach(self, o, { color: 0x8fe9ff, radius: 78, intensity: 0.9, depth: 19 });
        return o;
      }
      function handleLaunch(ammo) {
        SHARED.shots++; sfx('jump');
        self.launched.push(ammo);
        self.time.delayedCall(4500, function () { if (ammo && ammo.active) fadeDestroy(self, ammo); });
      }
      this.sling = MatterKit.slingshot(this, ANCHOR.x, ANCHOR.y, {
        ammo: makeOrb, onLaunch: handleLaunch, power: 0.13, maxVel: 15, depth: 50
      });
      this._makeOrb = makeOrb; this._handleLaunch = handleLaunch;

      // 상자끼리/구슬-상자 충돌음
      this.matter.world.on('collisionstart', function (ev) {
        for (var i = 0; i < ev.pairs.length; i++) {
          if (ev.pairs[i].collision && ev.pairs[i].collision.depth > 1.4) { sfx('bump'); break; }
        }
      });

      // --- 카메라 포스트FX(B) ---
      if (!LITE && ScreenFX.supported(this.cameras.main)) {
        ScreenFX.bloom(this.cameras.main, { threshold: 0.46, amount: 0.85, strength: 1.3 });
        ScreenFX.vignette(this.cameras.main, { radius: 0.62, strength: 0.5 });
        ScreenFX.colorGrade(this.cameras.main, function (m) { m.brightness(0.02); m.saturate(0.1); });
      }

      // --- 헤드리스/QA 구동 API ---
      window.Nocturne.api = {
        state: function () { return { score: SHARED.score, shots: SHARED.shots, lanternsLeft: SHARED.lanternsLeft, toppled: SHARED.toppled, won: SHARED.won }; },
        fire: function (vx, vy) {
          var a = self.sling.getCurrent();
          if (!a || !a.body || !a.body.isStatic) return false;
          a.setStatic(false); a.setVelocity(vx, vy);
          self._handleLaunch(a);
          self.time.delayedCall(850, self.sling.reload);
          return true;
        },
        aimFire: function (deg, power) {
          var r = deg * Math.PI / 180;
          return window.Nocturne.api.fire(Math.cos(r) * power, Math.sin(r) * power);
        }
      };
    },

    update: function () {
      var self = this;
      // 등불 명중 판정 (날아가는 구슬 vs 등불)
      this.launched.forEach(function (orb) {
        if (!orb || !orb.active) return;
        self.lanterns.forEach(function (lan) {
          if (lan._popped || !lan.active) return;
          var dx = orb.x - lan.x, dy = orb.y - lan.y;
          if (dx * dx + dy * dy < 22 * 22) popLantern(self, lan);
        });
      });
      // 상자 토폴 판정
      this.crates.forEach(function (c) {
        if (c._scored || !c.body) return;
        if (MatterKit.isToppled(c)) { c._scored = true; SHARED.toppled++; SHARED.score += 50; }
      });
      // 승리 판정
      if (!SHARED.won && SHARED.lanternsLeft === 0 && SHARED.toppled >= SHARED.goal) {
        SHARED.won = true; sfx('flag');
        winBanner(this);
      }
    }
  });

  function popLantern(scene, lan) {
    lan._popped = true; lan.stopFollow();
    SHARED.lanternsLeft--; SHARED.score += 150; sfx('coin');
    // 명중 링 플래시
    var ring = scene.add.circle(lan.x, lan.y, 6, 0xffe6a8, 0).setStrokeStyle(2, 0xffe6a8, 0.9).setDepth(30);
    scene.tweens.add({ targets: ring, radius: 28, alpha: 0, duration: 380, onComplete: function () { ring.destroy(); } });
    if (lan._light) scene.tweens.add({ targets: lan._light, intensity: 0, duration: 300, onComplete: function () { lan._light.destroy(); } });
    scene.tweens.add({ targets: lan, alpha: 0, scale: 1.5, duration: 320, onComplete: function () { lan.destroy(); } });
  }

  function fadeDestroy(scene, obj) {
    scene.tweens.add({ targets: obj, alpha: 0, duration: 280, onComplete: function () {
      if (obj._light) obj._light.destroy();
      obj.destroy();
    } });
  }

  function winBanner(scene) {
    var g = scene.add.rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, 90, 0x0a0e22, 0.72).setScrollFactor(0).setDepth(60);
    scene.add.text(DESIGN_W / 2, DESIGN_H / 2 - 12, '정원이 깨어났다 ✦', {
      fontFamily: 'Georgia, serif', fontSize: '26px', color: '#ffe6a8'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    scene.add.text(DESIGN_W / 2, DESIGN_H / 2 + 18, '탭하여 다시 플레이', {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfe6ff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    scene.input.once('pointerdown', function () { scene.scene.stop('UI'); scene.scene.start('Title'); });
  }

  // ============================ UI / HUD ====================================
  var UIScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function UIScene() { Phaser.Scene.call(this, { key: 'UI', active: false }); },
    create: function () {
      this.scoreT = this.add.text(12, 10, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffffff' }).setScrollFactor(0);
      this.goalT = this.add.text(12, 30, '', { fontFamily: 'monospace', fontSize: '12px', color: '#9fb4e0' }).setScrollFactor(0);

      // 음소거 버튼
      var mute = this.add.text(DESIGN_W - 14, 10, '♪', {
        fontFamily: 'monospace', fontSize: '20px', color: '#ffffff'
      }).setOrigin(1, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
      mute.on('pointerdown', function () {
        var m = GAME_AUDIO.toggleMute();
        mute.setText(m ? '♪̸' : '♪').setAlpha(m ? 0.5 : 1);
      });
    },
    update: function () {
      this.scoreT.setText('점수 ' + SHARED.score + '   발사 ' + SHARED.shots);
      this.goalT.setText('등불 남음 ' + SHARED.lanternsLeft + '   상자 ' + SHARED.toppled + '/' + SHARED.goal);
    }
  });

  // ============================ Boot config =================================
  var config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#05060f',
    render: { pixelArt: false, antialias: true, roundPixels: false },
    scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)),
    physics: MatterKit.config({ gravity: { x: 0, y: 1 }, bounds: false }),
    scene: [BootScene, TitleScene, GameScene, UIScene]
  };

  window.Nocturne = { game: null, audio: GAME_AUDIO, shared: SHARED, api: null };
  window.Nocturne.game = new Phaser.Game(config);
})();
