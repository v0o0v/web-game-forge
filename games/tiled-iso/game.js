/* ============================================================================
 * FORGE ISO — 등각/육각(isometric/hexagonal) Tiled 맵 데모 (web-game-builder)
 * ----------------------------------------------------------------------------
 * Tiled 컨벤션이 직교를 넘어 **등각/육각 맵**에도 일반화됨을 보이는 데모.
 *   - orientation: 기본 isometric, ?orient=hex 면 hexagonal.
 *   - 지형: 절차 베이크 타일셋(다이아몬드/육각 draw 콜백) 타일 레이어.
 *   - 물 타일: **애니메이션 타일**(3프레임, Tiled animation 배열을 Phaser 가 자동 재생).
 *   - 이동: arcade(AABB)는 등각/육각 타일 모양과 맞지 않으므로 **타일 좌표 논리 이동**
 *     (worldToTileXY/getTileAt/tileToWorldXY 좌표 변환 시연). 정석 접근.
 *   - GPU 레이어는 직교 전용이라 여기선 CPU 레이어(엔진이 자동 가드).
 * 100% 절차 생성(CC0/IP-safe). 방향키/WASD 로 칸 이동, 물 위는 못 감(징검다리로).
 * ==========================================================================*/
(function () {
  'use strict';

  var IS_HEX = /[?&]orient=hex/.test(location.search);
  var TW = 32, TH = IS_HEX ? 32 : 16;
  var MAP_KEY = 'iso-map';
  var MAP_URL = IS_HEX ? 'level-hex.tmj' : 'level-iso.tmj';
  var START = IS_HEX ? { col: 2, row: 2 } : { col: 2, row: 2 };
  var GOAL = IS_HEX ? { col: 9, row: 8 } : { col: 11, row: 9 };
  var DESIGN_W = 360, DESIGN_H = 300;
  var FLOOR_GID = 1; // docs §GID 계약: floor=1, water=2(애니), wall=5
  var GAME_INPUT = { up: false, down: false, left: false, right: false };

  // --- 타일 모양 그리기 ------------------------------------------------------
  function isoDiamond(ctx, cx, cy, tw, th, fill, edge) {
    var mx = cx + tw / 2, my = cy + th / 2;
    ctx.beginPath();
    ctx.moveTo(mx, cy); ctx.lineTo(cx + tw, my); ctx.lineTo(mx, cy + th); ctx.lineTo(cx, my);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function hexShape(ctx, cx, cy, tw, th, fill, edge) {
    var sx = tw / 32, sy = th / 32;
    var pts = [[16, 0], [32, 8], [32, 24], [16, 32], [0, 24], [0, 8]];
    ctx.beginPath();
    pts.forEach(function (p, i) {
      var x = cx + p[0] * sx, y = cy + p[1] * sy;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); }
  }
  var SHAPE = IS_HEX ? hexShape : isoDiamond;

  function solid(fill, edge, deco) {
    return function (ctx, cx, cy, tw, th) { SHAPE(ctx, cx, cy, tw, th, fill, edge); if (deco) deco(ctx, cx, cy, tw, th); };
  }
  function waterFrame(spark) {
    return function (ctx, cx, cy, tw, th) {
      SHAPE(ctx, cx, cy, tw, th, '#2b6fd0', '#1d4a8a');
      ctx.fillStyle = '#a9e0ff';
      spark.forEach(function (p) { ctx.fillRect(cx + p[0], cy + p[1], 2, 1); });
    };
  }

  function tileDefs() {
    return [
      { name: 'floor', collides: false, draw: solid('#8fae6a', '#5f7d44') },                 // GID 1
      { name: 'water', collides: false, animDuration: 240, animFrames: [                      // GID 2 (3칸)
        { draw: waterFrame([[10, 6], [20, 9], [14, 11]]) },
        { draw: waterFrame([[15, 7], [9, 10], [23, 8]]) },
        { draw: waterFrame([[19, 6], [12, 10], [16, 12]]) }
      ] },
      { name: 'wall', collides: true, draw: solid('#7b7f99', '#3f4256', function (ctx, cx, cy, tw, th) {
        // 윗면 하이라이트(살짝 입체)
        ctx.fillStyle = '#a7adca'; var mx = cx + tw / 2;
        ctx.beginPath(); ctx.moveTo(mx, cy + (IS_HEX ? 2 : 1)); ctx.lineTo(cx + tw - 3, cy + th / 2); ctx.lineTo(mx, cy + th / 2); ctx.closePath(); ctx.fill();
      }) }                                                                                     // GID 5
    ];
  }

  // ===========================================================================
  // Boot
  // ===========================================================================
  var BootScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BootScene() { Phaser.Scene.call(this, { key: 'Boot' }); },
    preload: function () { this.load.tilemapTiledJSON(MAP_KEY, MAP_URL); },
    create: function () {
      // 플레이어 토큰(절차)
      var token = this.make.graphics({ x: 0, y: 0, add: false });
      token.fillStyle(0x16361f, 1); token.fillCircle(7, 7, 7);
      token.fillStyle(0x46c86e, 1); token.fillCircle(7, 7, 5);
      token.fillStyle(0xffffff, 1); token.fillCircle(5, 6, 1); token.fillCircle(9, 6, 1);
      token.generateTexture('iso-player', 14, 14); token.destroy();
      MobileHarness.installDomGuards();
      this.scene.start('Game'); this.scene.launch('UI');
    }
  });

  // ===========================================================================
  // Game
  // ===========================================================================
  var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function GameScene() { Phaser.Scene.call(this, { key: 'Game' }); },

    create: function () {
      this.cameras.main.setBackgroundColor('#10131a');
      this.state = { won: false, moving: false, cooldown: 0, tile: { col: START.col, row: START.row } };

      // 절차 타일셋 베이크 → .tmj 로드(CPU 레이어; iso/hex 는 GPU 미지원).
      TiledForge.bakeTileset(this, tileDefs(), {
        key: 'iso-tiles', name: 'forge', tileWidth: TW, tileHeight: TH, columns: 5
      });
      // 등각/육각은 TilemapGPULayer 미지원 → CPU 레이어. (gpu:true 를 줘도 엔진이 자동 가드한다.)
      var res = TiledForge.loadTiledMap(this, MAP_KEY, {
        tilesetKey: 'iso-tiles', tilesetName: 'forge', gpu: false
      });
      this.mapRes = res;
      this.layer = res.solids[0] || res.layers[Object.keys(res.layers)[0]];

      // 카메라: 맵 중앙으로.
      var c = this.tileCenter(Math.floor((IS_HEX ? 12 : 14) / 2), Math.floor((IS_HEX ? 11 : 12) / 2));
      this.cameras.main.centerOn(c.x, c.y);

      // 플레이어 배치(시작 타일 중심)
      var s = this.tileCenter(START.col, START.row);
      this.player = this.add.sprite(s.x, s.y, 'iso-player').setDepth(10000);
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

      // 골 마커
      var gp = this.tileCenter(GOAL.col, GOAL.row);
      this.goalMarker = this.add.star(gp.x, gp.y, 5, 5, 10, 0xffd23f).setDepth(9000);
      this.tweens.add({ targets: this.goalMarker, angle: 360, duration: 3000, repeat: -1 });
      this.tweens.add({ targets: this.goalMarker, scale: 1.25, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

      var summary = {
        orientation: res.orientation, gpuActual: res.gpu,
        renderer: this.sys.renderer.type,
        tileLayers: Object.keys(res.layers).length,
        animatedTiles: res.map.tilesets[0].tileData ? Object.keys(res.map.tilesets[0].tileData).length : 'n/a',
        startTile: START, goalTile: GOAL
      };
      window.TiledIso.summary = summary;
      console.log('[FORGE ISO] ' + JSON.stringify(summary));
    },

    // 타일 (col,row) → 월드 중심 좌표(등각/육각 좌표 변환).
    tileCenter: function (col, row) {
      var v = this.layer.tileToWorldXY(col, row);
      return { x: v.x + TW / 2, y: v.y + TH / 2 };
    },

    walkable: function (col, row) {
      var t = this.layer.getTileAt(col, row);
      return !!(t && t.index === FLOOR_GID); // 바닥만 통행(물·벽 불가)
    },

    tryMove: function (dc, dr) {
      if (this.state.moving || this.state.won) return;
      var nc = this.state.tile.col + dc, nr = this.state.tile.row + dr;
      if (!this.walkable(nc, nr)) return;
      this.state.tile = { col: nc, row: nr };
      var w = this.tileCenter(nc, nr);
      this.state.moving = true;
      var self = this;
      this.player.setDepth(10000 + w.y);
      this.tweens.add({
        targets: this.player, x: w.x, y: w.y, duration: 130, ease: 'Sine.inOut',
        onComplete: function () {
          self.state.moving = false;
          if (self.state.tile.col === GOAL.col && self.state.tile.row === GOAL.row) self.win();
        }
      });
    },

    win: function () {
      this.state.won = true;
      this.events.emit('banner', 'CLEAR!');
      window.TiledIso.won = true;
    },

    update: function (time, delta) {
      if (this.state.cooldown > 0) this.state.cooldown -= delta;
      if (this.state.moving || this.state.cooldown > 0) return;
      var left = this.cursors.left.isDown || this.keys.a.isDown || GAME_INPUT.left;
      var right = this.cursors.right.isDown || this.keys.d.isDown || GAME_INPUT.right;
      var up = this.cursors.up.isDown || this.keys.w.isDown || GAME_INPUT.up;
      var down = this.cursors.down.isDown || this.keys.s.isDown || GAME_INPUT.down;
      var dc = (right ? 1 : 0) - (left ? 1 : 0);
      var dr = (down ? 1 : 0) - (up ? 1 : 0);
      if (dc || dr) {
        // 한 축씩(대각 금지) — 격자 칸 이동 명확.
        if (dc && dr) dr = 0;
        this.tryMove(dc, dr);
        this.state.cooldown = 150;
      }
    }
  });

  // ===========================================================================
  // UI
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
      this.add.text(DESIGN_W / 2, DESIGN_H - 10, '방향키/WASD 칸 이동 · 물은 징검다리로 · 별=골', {
        fontFamily: 'monospace', fontSize: '9px', color: '#c8d2e8'
      }).setOrigin(0.5, 1);

      var self = this, game = this.scene.get('Game');
      game.events.on('banner', function (msg) {
        self.banner.setText(msg).setAlpha(1).setScale(0.5);
        self.tweens.add({ targets: self.banner, scale: 1, duration: 400, ease: 'Back.out' });
      });
      this.buildDpad();
    },
    buildDpad: function () {
      var cxp = 46, cyp = DESIGN_H - 56, R = 20;
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
      if (g && g.state) this.info.setText((g.mapRes ? g.mapRes.orientation.toUpperCase() : '') + '  LAYER ' + (g.mapRes && g.mapRes.gpu ? 'GPU' : 'CPU') + '  TILE ' + g.state.tile.col + ',' + g.state.tile.row);
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
  window.TiledIso = { won: false };
  var config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#10131a',
    render: { pixelArt: true, roundPixels: true, preserveDrawingBuffer: /[?&]capture=1/.test(location.search) },
    scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)),
    scene: [BootScene, GameScene, UIScene]
  };
  window.TiledIso.game = new Phaser.Game(config);
})();
