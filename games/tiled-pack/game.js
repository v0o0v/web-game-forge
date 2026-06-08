/* ============================================================================
 * FORGE PACK — 외부 CC0 Tiled 팩 임포트 + TilemapGPULayer 데모 (web-game-builder)
 * ----------------------------------------------------------------------------
 * 두 가지를 동시에 실증한다:
 *   1) 외부 CC0 팩 임포트 + assets.json 게이트
 *      - pack/tileset.png(실제 외부 이미지 파일) + pack/level.tmj + pack/pack.json
 *        을 Phaser 로더로 임포트. 절차 베이크가 아니라 진짜 파일 임포트 경로.
 *      - 루트 assets.json 의 policy 로 라이선스 게이트(TiledForge licenseGate).
 *        거부 라이선스면 로드 자체가 막힌다(throw).
 *      - 팩은 bake-tiled-pack.mjs 가 절차 저작한 CC0(저작자=WebGameForge, 제3자 0).
 *   2) TilemapGPULayer 최적화(Phaser 4)
 *      - 지형을 GPU 레이어로 렌더(WebGL 단일 quad, 셰이더). 직교 전용.
 *      - 애니메이션 타일(용암)도 GPU 레이어에서 재생.
 *      - arcade 충돌(벽)은 CPU/GPU 공통 TilemapLayerBase 로 동작.
 * 100% CC0/IP-safe. 4방향 이동 · 벽 충돌 · 골 도달 = 클리어.
 * ==========================================================================*/
(function () {
  'use strict';

  var TILE = 16;
  var MAP_W = 40, MAP_H = 26;
  var WORLD_W = MAP_W * TILE, WORLD_H = MAP_H * TILE; // 640 x 416
  var DESIGN_W = 320, DESIGN_H = 240;
  var SPEED = 96;
  var GAME_INPUT = { up: false, down: false, left: false, right: false };

  // --- 플레이어 스프라이트(절차, 탑다운 기사) --------------------------------
  var PPAL = {
    '.': null, ' ': null,
    p: '#46c86e', P: '#6fe890', o: '#16361f', l: '#ffffff', e: '#1a2233'
  };
  var PLAYER_FRAMES = [
    ['...oooooo...', '..opPPPPpo..', '.opPPPPPPpo.', 'opPPPPPPPPpo', 'opPllPPllPpo',
     'opPlePPlePpo', 'opPPPPPPPPpo', '.opPPPPPPpo.', '..opPPPPpo..', '...oooooo...'],
    ['............', '...oooooo...', '..opPPPPpo..', '.opPPPPPPpo.', 'opPllPPllPpo',
     'opPlePPlePpo', 'opPPPPPPPPpo', '.opPPPPPPpo.', '..opPPPPpo..', '...oooooo...']
  ];

  // ===========================================================================
  // Boot — 외부 팩(이미지/맵/매니페스트) + 루트 정책 임포트
  // ===========================================================================
  var BootScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BootScene() { Phaser.Scene.call(this, { key: 'Boot' }); },
    preload: function () {
      // 실제 외부 파일 임포트(절차 베이크 아님).
      this.load.image('forge-pack', 'pack/tileset.png');
      this.load.tilemapTiledJSON('pack-map', 'pack/level.tmj');
      this.load.json('pack-manifest', 'pack/pack.json');
      // 라이선스 게이트의 단일 소스 = 루트 assets.json 의 policy.
      this.load.json('assets-policy', '../../assets.json');
    },
    create: function () {
      PixelForge.bake(this, 'pp-player', { frames: PLAYER_FRAMES, palette: PPAL });
      if (!this.anims.exists('pp-walk')) {
        this.anims.create({ key: 'pp-walk', frames: [{ key: 'pp-player', frame: 0 }, { key: 'pp-player', frame: 1 }], frameRate: 8, repeat: -1 });
      }
      if (!this.anims.exists('pp-idle')) {
        this.anims.create({ key: 'pp-idle', frames: [{ key: 'pp-player', frame: 0 }], frameRate: 1 });
      }
      MobileHarness.installDomGuards();
      this.scene.start('Game');
      this.scene.launch('UI');
    }
  });

  // ===========================================================================
  // Game
  // ===========================================================================
  var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function GameScene() { Phaser.Scene.call(this, { key: 'Game' }); },

    create: function () {
      this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
      this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
      this.cameras.main.setBackgroundColor('#241c2e');
      this.state = { won: false, gateOk: false, gpu: false, start: { x: TILE * 2.5, y: TILE * 2.5 }, goal: null };

      this.buildMap();
      this.buildPlayer();
      this.setupInput();
      this.physics.add.collider(this.player, this.terrain);

      this.cameras.main.startFollow(this.player, true, 0.16, 0.16);

      // 검증용 요약을 콘솔/전역에 노출.
      var summary = {
        gateOk: this.state.gateOk, gpu: this.state.gpu, renderer: this.sys.renderer.type,
        orientation: this.mapResult.orientation,
        tileLayers: Object.keys(this.mapResult.layers).length,
        objects: this.mapResult.objects.length,
        animatedTiles: (this.mapResult.map.tilesets[0].tileData ? Object.keys(this.mapResult.map.tilesets[0].tileData).length : 'n/a')
      };
      window.TiledPack.summary = summary;
      console.log('[FORGE PACK] ' + JSON.stringify(summary));
    },

    buildMap: function () {
      var manifest = this.cache.json.get('pack-manifest');
      var assets = this.cache.json.get('assets-policy');
      var policy = (assets && assets.policy) || {};
      // 라이선스 게이트를 먼저 검사(거부면 throw → 로드 차단). 통과 표시.
      var verdict = TiledForge.assertPackLicense(policy, manifest);
      this.state.gateOk = verdict.allowed;
      window.TiledPack.gateVerdict = verdict;

      var useGpu = !/[?&]gpu=0/.test(location.search); // 기본 GPU, ?gpu=0 으로 CPU 비교
      var res = TiledForge.loadTiledMap(this, 'pack-map', {
        tilesetKey: 'forge-pack',
        tilesetName: manifest.tilesetName || 'forge',
        gpu: useGpu,
        licenseGate: { policy: policy, manifest: manifest },
        spawners: {
          player: function (s, o) { s.state.start = { x: o.x, y: o.y }; },
          goal: function (s, o) { s.state.goal = { x: o.x, y: o.y }; }
        }
      });
      this.mapResult = res;
      this.terrain = res.solids[0];
      this.state.gpu = res.gpu;

      // 골 마커(절차 그래픽)
      if (this.state.goal) {
        var g = this.add.star(this.state.goal.x, this.state.goal.y, 5, 5, 9, 0xffd23f).setDepth(2);
        this.tweens.add({ targets: g, angle: 360, duration: 3000, repeat: -1 });
        this.tweens.add({ targets: g, scale: 1.3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.goalMarker = g;
      }
    },

    buildPlayer: function () {
      this.player = this.physics.add.sprite(this.state.start.x, this.state.start.y, 'pp-player', 0).setDepth(5);
      this.player.body.setSize(9, 9);
      this.player.body.setCollideWorldBounds(true);
      this.player.play('pp-idle');
    },

    setupInput: function () {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });
    },

    update: function () {
      if (this.state.won) return;
      var p = this.player;
      var left = this.cursors.left.isDown || this.keys.a.isDown || GAME_INPUT.left;
      var right = this.cursors.right.isDown || this.keys.d.isDown || GAME_INPUT.right;
      var up = this.cursors.up.isDown || this.keys.w.isDown || GAME_INPUT.up;
      var down = this.cursors.down.isDown || this.keys.s.isDown || GAME_INPUT.down;
      var vx = (right ? 1 : 0) - (left ? 1 : 0);
      var vy = (down ? 1 : 0) - (up ? 1 : 0);
      if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
      p.setVelocity(vx * SPEED, vy * SPEED);
      if (vx < 0) p.setFlipX(true); else if (vx > 0) p.setFlipX(false);
      if (vx || vy) p.play('pp-walk', true); else p.play('pp-idle', true);

      if (this.state.goal && Phaser.Math.Distance.Between(p.x, p.y, this.state.goal.x, this.state.goal.y) < 12) {
        this.state.won = true;
        this.events.emit('banner', 'CLEAR!');
        window.TiledPack.won = true;
      }
    }
  });

  // ===========================================================================
  // UI — HUD + D-패드 + 배너
  // ===========================================================================
  var UIScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function UIScene() { Phaser.Scene.call(this, { key: 'UI' }); },
    create: function () {
      var st = { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 4 };
      this.info = this.add.text(8, 8, '', st);
      this.banner = this.add.text(DESIGN_W / 2, DESIGN_H / 2, '', {
        fontFamily: 'Arial Black, monospace', fontSize: '24px', color: '#ffd23f', stroke: '#3a2a08', strokeThickness: 6
      }).setOrigin(0.5).setAlpha(0);
      this.hint = this.add.text(DESIGN_W / 2, DESIGN_H - 12, '방향키/WASD 이동 · 별(골)로', {
        fontFamily: 'monospace', fontSize: '9px', color: '#c8d2e8'
      }).setOrigin(0.5, 1);

      var self = this;
      var game = this.scene.get('Game');
      game.events.on('banner', function (msg) {
        self.banner.setText(msg).setAlpha(1).setScale(0.5);
        self.tweens.add({ targets: self.banner, scale: 1, duration: 400, ease: 'Back.out' });
      });
      this.buildDpad();
    },
    buildDpad: function () {
      var cxp = 46, cyp = DESIGN_H - 46, R = 20;
      var dirs = [{ k: 'up', dx: 0, dy: -1 }, { k: 'down', dx: 0, dy: 1 }, { k: 'left', dx: -1, dy: 0 }, { k: 'right', dx: 1, dy: 0 }];
      this.dpadBtns = dirs.map(function (d) {
        var bx = cxp + d.dx * R, by = cyp + d.dy * R;
        var g = this.add.circle(bx, by, 13, 0xffffff, 0.18).setScrollFactor(0).setDepth(30);
        g.dir = d.k; g.bx = bx; g.by = by; return g;
      }, this);
      this.input.addPointer(2);
    },
    update: function () {
      var g = this.scene.get('Game');
      if (g && g.state) {
        this.info.setText('GATE ' + (g.state.gateOk ? 'OK' : 'DENY') + '  LAYER ' + (g.state.gpu ? 'GPU' : 'CPU'));
      }
      GAME_INPUT.up = GAME_INPUT.down = GAME_INPUT.left = GAME_INPUT.right = false;
      var pointers = [this.input.pointer1, this.input.pointer2, this.input.activePointer];
      var btns = this.dpadBtns || [];
      pointers.forEach(function (pt) {
        if (!pt || !pt.isDown) return;
        btns.forEach(function (b) { var dx = pt.x - b.bx, dy = pt.y - b.by; if (dx * dx + dy * dy <= 18 * 18) GAME_INPUT[b.dir] = true; });
      });
    }
  });

  // ===========================================================================
  // 부팅
  // ===========================================================================
  window.TiledPack = { won: false };
  var config = {
    type: Phaser.AUTO, // WebGL 선호 → GPU 레이어 가능. WebGL 불가 시 엔진이 CPU 폴백.
    parent: 'game',
    backgroundColor: '#241c2e',
    render: { pixelArt: true, roundPixels: true, preserveDrawingBuffer: /[?&]capture=1/.test(location.search) },
    scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)),
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: /[?&]debug=1/.test(location.search) } },
    scene: [BootScene, GameScene, UIScene]
  };
  window.TiledPack.game = new Phaser.Game(config);
})();
