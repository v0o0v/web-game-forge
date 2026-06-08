/* ============================================================================
 * TILED TOPDOWN — Tiled(.tmj) 연동 탑다운 데모 (web-game-builder)
 * ----------------------------------------------------------------------------
 * Tiled 컨벤션이 플랫포머 외 장르(탑다운)에도 일반화됨을 보이는 최소 데모.
 *   - 맵: games/tiled-topdown/level.tmj (ascii-to-tmj.mjs로 저작 → Phaser 로더 로드)
 *   - 지형: 절차 베이크 타일셋(floor/wall) 타일 레이어 + setCollisionByProperty
 *   - 엔티티: 오브젝트 레이어(player/enemy/pickup/goal) → 스포너 레지스트리 위임
 * 엔진: Phaser 4.1.0 + PixelForge + ChipAudio + MobileHarness + TiledForge.
 * 4방향 이동 · 벽 충돌 · 보석 수집 · 적 회피 · 전 보석 수집 후 출구 = 클리어.
 * 100% 절차 생성(CC0/IP-safe).
 * ==========================================================================*/
(function () {
  'use strict';

  var TILE = 16;
  var MAP_W = 30, MAP_H = 20;
  var WORLD_W = MAP_W * TILE, WORLD_H = MAP_H * TILE; // 480 x 320
  var DESIGN_W = 320, DESIGN_H = 256;                 // 뷰포트(카메라 추적)
  var SPEED = 96, ENEMY_SPEED = 42;

  var GAME_INPUT = { up: false, down: false, left: false, right: false };
  var GAME_AUDIO = new ChipAudio();
  window.GAME_AUDIO = GAME_AUDIO;

  // --- 공유 팔레트 -----------------------------------------------------------
  var TPAL = {
    '.': null, ' ': null,
    // 바닥(따뜻한 돌)
    f: '#c9b48f', F: '#b6a079', d: '#9c855f',
    // 벽(청회색 벽돌)
    w: '#5d6b8c', W: '#3f4c6b', x: '#7c8cad',
    // 플레이어(초록 기사)
    p: '#46c86e', P: '#6fe890', o: '#16361f', l: '#ffffff', e: '#1a2233',
    // 적(붉은 슬라임)
    r: '#e8556b', R: '#a8334e', y: '#ffd23f',
    // 보석(시안)
    c: '#5fe0ff', C: '#2b9fd0', h: '#eaffff',
    // 출구(보라 포털)
    m: '#b06bff', M: '#6a2fb0', n: '#e6c2ff'
  };

  // --- 타일셋 (bakeTileset 입력; docs §2 GID=index+1: 1 floor, 2 wall) -------
  function tileDefs() {
    return [
      { name: 'floor', collides: false, frame: [
        'ffffffffffffffff',
        'fFffffdfffffFfff',
        'ffffffffffffffff',
        'fffdffffffFfffff',
        'ffffffffdfffffff',
        'fFfffffffffffdff',
        'ffffffFfffffffff',
        'ffdfffffffffffff',
        'ffffffffFfffffff',
        'fffffdffffffffFf',
        'fFffffffffdfffff',
        'ffffffffffffffff',
        'ffFfffdfffffffff',
        'ffffffffffFfffff',
        'fdffffffffffffdf',
        'ffffffFfffffffff'
      ] },
      { name: 'wall', collides: true, frame: [
        'xxxxxxxxxxxxxxxx',
        'xWwwwwwWwwwwwwWx',
        'xwwwwwwwwwwwwwwx',
        'xwwwwwwwwwwwwwwx',
        'WWWWWWWWWWWWWWWW',
        'wwwwwwxwwwwwwwww',
        'wwwwwwxwwwwwwwww',
        'wwwwwwxwwwwwwwww',
        'WWWWWWWWWWWWWWWW',
        'wwwxwwwwwwwxwwww',
        'wwwxwwwwwwwxwwww',
        'wwwxwwwwwwwxwwww',
        'WWWWWWWWWWWWWWWW',
        'wwwwwwwwxwwwwwww',
        'wwwwwwwwxwwwwwww',
        'xWwwwwwwxwwwwWxx'
      ] }
    ];
  }

  // --- 스프라이트 (PixelForge 베이크) ----------------------------------------
  var SPRITES = {
    // 플레이어: 둥근 초록 기사(탑다운). 2프레임(걷기 바운스)
    player: { frames: [
      [
        '...oooooo...',
        '..opPPPPpo..',
        '.opPPPPPPpo.',
        'opPPPPPPPPpo',
        'opPllPPllPpo',
        'opPlePPlePpo',
        'opPPPPPPPPpo',
        '.opPPPPPPpo.',
        '..opPPPPpo..',
        '...oooooo...'
      ],
      [
        '............',
        '...oooooo...',
        '..opPPPPpo..',
        '.opPPPPPPpo.',
        'opPllPPllPpo',
        'opPlePPlePpo',
        'opPPPPPPPPpo',
        '.opPPPPPPpo.',
        '..opPPPPpo..',
        '...oooooo...'
      ]
    ] },
    // 적: 붉은 슬라임. 2프레임
    enemy: { frames: [
      [
        '...rrrrrr...',
        '..rrrrrrrr..',
        '.rrrrrrrrrr.',
        'rrRyrrrryRrr',
        'rrRerrrreRrr',
        'rrrrrrrrrrrr',
        'rRRRRRRRRRRr',
        '.RR.RR.RR.R.'
      ],
      [
        '............',
        '...rrrrrr...',
        '..rrrrrrrr..',
        '.rrRyrrryRr.',
        '.rrRerrreRr.',
        '.rrrrrrrrrr.',
        'rRRRRRRRRRRr',
        'R.RR.RR.RR.R'
      ]
    ] },
    // 보석: 시안 다이아. 회전 3프레임
    gem: { frames: [
      [ '....cc....', '...cCCc...', '..cChhCc..', '.cChhhhCc.', 'cChhhhhhCc', '.CChhhhCC.', '..CChhCC..', '...CCCC...', '....CC....', '..........' ],
      [ '....c.....', '...cc.....', '..cCc.....', '.cChc.....', 'cChhc.....', '.CChc.....', '..CCc.....', '...Cc.....', '....c.....', '..........' ],
      [ '....cc....', '...hCCh...', '..cChhCc..', '.chChhcCc.', 'cChhCChhCc', '.CChhhhCC.', '..CCCCCC..', '...CCCC...', '....CC....', '..........' ]
    ] },
    // 출구: 보라 포털. 펄스 2프레임
    goal: { frames: [
      [ '..mmmmmmmm..', '.mMnnnnnnMm.', 'mMnmmmmmmnMm', 'mnmMMMMMMmnm', 'mnmMnnnnMmnm', 'mnmMnnnnMmnm', 'mnmMMMMMMmnm', 'mMnmmmmmmnMm', '.mMnnnnnnMm.', '..mmmmmmmm..' ],
      [ '..mMMMMMMm..', '.mMnnnnnnMm.', 'mMnmmmmmmnMm', 'mnmmMMMMmmnm', 'mnmMnnnnMmnm', 'mnmMnnnnMmnm', 'mnmmMMMMmmnm', 'mMnmmmmmmnMm', '.mMnnnnnnMm.', '..mMMMMMMm..' ]
    ] }
  };

  // ===========================================================================
  // Boot — 맵 로드 + 에셋 베이크
  // ===========================================================================
  var BootScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BootScene() { Phaser.Scene.call(this, { key: 'Boot' }); },
    preload: function () {
      this.load.tilemapTiledJSON('td-map', 'level.tmj');
    },
    create: function () {
      // 스프라이트 베이크
      Object.keys(SPRITES).forEach(function (k) {
        PixelForge.bake(this, k, { frames: SPRITES[k].frames, palette: TPAL });
      }, this);
      // 파티클용 흰 사각
      var g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4); g.generateTexture('spark', 4, 4); g.destroy();
      // 애니메이션
      var mk = function (k, fr, frames, rate, rep) {
        if (this.anims.exists(k)) return;
        this.anims.create({ key: k, frames: frames.map(function (f) { return { key: fr, frame: f }; }), frameRate: rate, repeat: rep == null ? -1 : rep });
      }.bind(this);
      mk('player-idle', 'player', [0], 1);
      mk('player-walk', 'player', [0, 1], 8);
      mk('enemy-walk', 'enemy', [0, 1], 5);
      mk('gem-spin', 'gem', [0, 1, 2], 8);
      mk('goal-pulse', 'goal', [0, 1], 3);
      // 모바일
      MobileHarness.installDomGuards();
      MobileHarness.onResume(function () { GAME_AUDIO.resume(); });
      this.scene.start('Title');
    }
  });

  // ===========================================================================
  // Title — Tap to start (오디오 언락)
  // ===========================================================================
  var TitleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function TitleScene() { Phaser.Scene.call(this, { key: 'Title' }); },
    create: function () {
      this.cameras.main.setBackgroundColor('#2a2438');
      this.add.text(DESIGN_W / 2, 70, 'GEM DUNGEON', {
        fontFamily: 'Arial Black, Impact, monospace', fontSize: '30px', color: '#5fe0ff', stroke: '#1d3a4a', strokeThickness: 6
      }).setOrigin(0.5);
      var hero = this.add.sprite(DESIGN_W / 2, 130, 'player', 0).setScale(3);
      hero.play('player-idle');
      this.tweens.add({ targets: hero, y: 122, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      var tap = this.add.text(DESIGN_W / 2, 180, 'TAP / SPACE 로 시작', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5);
      this.tweens.add({ targets: tap, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
      this.add.text(DESIGN_W / 2, 212, '방향키/WASD 이동 · 보석 모두 줍고 포털로', {
        fontFamily: 'monospace', fontSize: '10px', color: '#c8d2e8'
      }).setOrigin(0.5);

      var self = this;
      var start = function () {
        GAME_AUDIO.unlock(); GAME_AUDIO.startBgm();
        self.scene.start('Game'); self.scene.launch('UI');
      };
      this.input.once('pointerdown', start);
      this.input.keyboard.once('keydown-SPACE', start);
      this.input.keyboard.once('keydown-ENTER', start);
      if (/[?&]autostart=1/.test(location.search)) this.time.delayedCall(60, start);
    }
  });

  // ===========================================================================
  // Game — 탑다운 본체
  // ===========================================================================
  var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function GameScene() { Phaser.Scene.call(this, { key: 'Game' }); },

    create: function () {
      this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
      this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
      this.cameras.main.setBackgroundColor('#1a1622');

      this.state = { score: 0, hp: 3, gemsLeft: 0, won: false, dead: false };
      this.enemies = this.physics.add.group();
      this.gems = this.physics.add.group({ allowGravity: false });
      this.goalSpr = null;
      this.startPos = { x: TILE * 1.5, y: TILE * 1.5 };

      this.buildMap();
      this.buildPlayer();
      this.setupInput();
      this.setupColliders();

      this.cameras.main.startFollow(this.player, true, 0.16, 0.16);
    },

    // Tiled 맵: 타일 레이어(벽 충돌) + 오브젝트 스포너
    buildMap: function () {
      var self = this;
      TiledForge.bakeTileset(this, tileDefs(), { key: 'td-tiles', name: 'forge', tileSize: TILE, columns: 2, palette: TPAL });
      var res = TiledForge.loadTiledMap(this, 'td-map', {
        tilesetKey: 'td-tiles', tilesetName: 'forge',
        spawners: {
          player: function (s, o) { self.startPos = { x: o.x, y: o.y }; },
          enemy: function (s, o) { self.spawnEnemy(o.x, o.y); },
          pickup: function (s, o) { self.spawnGem(o.x, o.y); },
          goal: function (s, o) { self.makeGoal(o.x, o.y); }
        }
      });
      this.wallLayer = res.solids[0];
    },

    spawnEnemy: function (x, y) {
      var e = this.enemies.create(x, y, 'enemy', 0).setDepth(4);
      e.play('enemy-walk');
      e.body.setSize(11, 9); e.body.setCollideWorldBounds(true); e.body.setBounce(1);
      e.setData('dir', Phaser.Math.Between(0, 3));
      this.aimEnemy(e);
      return e;
    },

    aimEnemy: function (e) {
      var d = e.getData('dir');
      var v = [[ENEMY_SPEED, 0], [-ENEMY_SPEED, 0], [0, ENEMY_SPEED], [0, -ENEMY_SPEED]][d];
      e.setVelocity(v[0], v[1]);
    },

    spawnGem: function (x, y) {
      var gm = this.gems.create(x, y, 'gem').setDepth(3);
      gm.play('gem-spin'); gm.body.setSize(8, 8);
      this.state.gemsLeft++;
      return gm;
    },

    makeGoal: function (x, y) {
      this.goalSpr = this.add.sprite(x, y, 'goal', 0).setDepth(2);
      this.goalSpr.play('goal-pulse');
      this.physics.add.existing(this.goalSpr, true);
      this.goalSpr.body.setSize(14, 14);
    },

    buildPlayer: function () {
      this.player = this.physics.add.sprite(this.startPos.x, this.startPos.y, 'player', 0).setDepth(5);
      this.player.body.setSize(9, 9);
      this.player.body.setCollideWorldBounds(true);
      this.player.body.setDrag(700, 700); // 넉백 자연 감쇠
      this.player.invuln = false;
      this.player.play('player-idle');
    },

    setupInput: function () {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });
    },

    setupColliders: function () {
      this.physics.add.collider(this.player, this.wallLayer);
      this.physics.add.collider(this.enemies, this.wallLayer, this.onEnemyWall, null, this);
      this.physics.add.overlap(this.player, this.gems, this.onGem, null, this);
      this.physics.add.overlap(this.player, this.enemies, this.onEnemy, null, this);
    },

    onEnemyWall: function (e) {
      // 벽에 막히면 새 방향 선택
      e.setData('dir', Phaser.Math.Between(0, 3));
      this.aimEnemy(e);
    },

    onGem: function (player, gem) {
      gem.destroy();
      this.state.score += 100; this.state.gemsLeft--;
      GAME_AUDIO.sfx('coin');
      this.popText(gem.x, gem.y, '+100', '#5fe0ff');
      if (this.state.gemsLeft <= 0 && this.goalSpr) {
        this.goalSpr.setTint(0x9affb0);
        this.popText(this.goalSpr.x, this.goalSpr.y - 12, '포털 열림!', '#b0ffb0');
      }
    },

    onEnemy: function (player, enemy) {
      if (player.invuln || this.state.dead || this.state.won) return;
      this.state.hp--;
      GAME_AUDIO.sfx('bump');
      // 넉백
      var ang = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
      player.setVelocity(Math.cos(ang) * 180, Math.sin(ang) * 180);
      this.flashPlayer(900);
      if (this.state.hp <= 0) this.die();
    },

    flashPlayer: function (dur) {
      this.player.invuln = true;
      var self = this;
      var tw = this.tweens.add({ targets: this.player, alpha: 0.3, duration: 90, yoyo: true, repeat: Math.floor(dur / 180) });
      this.time.delayedCall(dur, function () { self.player.invuln = false; self.player.alpha = 1; tw.stop(); });
    },

    popText: function (x, y, msg, color) {
      var t = this.add.text(x, y, msg, { fontFamily: 'monospace', fontSize: '10px', color: color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 600, onComplete: function () { t.destroy(); } });
    },

    die: function () {
      this.state.dead = true;
      GAME_AUDIO.sfx('die'); GAME_AUDIO.stopBgm();
      this.player.setVelocity(0, 0); this.player.body.enable = false;
      this.events.emit('banner', 'GAME OVER');
      var self = this;
      this.time.delayedCall(2200, function () { self.scene.stop('UI'); self.scene.start('Title'); });
    },

    win: function () {
      this.state.won = true;
      GAME_AUDIO.sfx('powerup'); GAME_AUDIO.stopBgm();
      this.player.setVelocity(0, 0);
      this.events.emit('banner', 'CLEAR!');
      var self = this;
      this.time.delayedCall(2600, function () { self.scene.stop('UI'); self.scene.start('Title'); });
    },

    update: function () {
      if (this.state.dead || this.state.won) return;
      var p = this.player;
      var left = this.cursors.left.isDown || this.keys.a.isDown || GAME_INPUT.left;
      var right = this.cursors.right.isDown || this.keys.d.isDown || GAME_INPUT.right;
      var up = this.cursors.up.isDown || this.keys.w.isDown || GAME_INPUT.up;
      var down = this.cursors.down.isDown || this.keys.s.isDown || GAME_INPUT.down;

      var vx = (right ? 1 : 0) - (left ? 1 : 0);
      var vy = (down ? 1 : 0) - (up ? 1 : 0);
      // 넉백(무적) 중에는 입력 속도를 덮어쓰지 않고 drag로 자연 감쇠시킨다.
      if (!p.invuln) {
        if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
        p.setVelocity(vx * SPEED, vy * SPEED);
      }
      if (vx < 0) p.setFlipX(true); else if (vx > 0) p.setFlipX(false);
      if (vx || vy) p.play('player-walk', true); else p.play('player-idle', true);

      // 골 도달 (전 보석 수집 시)
      if (this.goalSpr && this.state.gemsLeft <= 0) {
        if (Phaser.Math.Distance.Between(p.x, p.y, this.goalSpr.x, this.goalSpr.y) < 12) this.win();
      }
    }
  });

  // ===========================================================================
  // UI — HUD + 터치 D-패드
  // ===========================================================================
  var UIScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function UIScene() { Phaser.Scene.call(this, { key: 'UI' }); },
    create: function () {
      var st = { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#000', strokeThickness: 4 };
      this.scoreTxt = this.add.text(8, 8, 'SCORE 0', st);
      this.gemTxt = this.add.text(8, 24, 'GEMS 0', st);
      this.hpTxt = this.add.text(DESIGN_W - 8, 8, 'HP 3', st).setOrigin(1, 0);

      this.banner = this.add.text(DESIGN_W / 2, DESIGN_H / 2, '', {
        fontFamily: 'Arial Black, monospace', fontSize: '26px', color: '#5fe0ff', stroke: '#1d3a4a', strokeThickness: 6
      }).setOrigin(0.5).setAlpha(0);

      var self = this;
      var game = this.scene.get('Game');
      game.events.on('banner', function (msg) {
        self.banner.setText(msg).setAlpha(1).setScale(0.5);
        self.tweens.add({ targets: self.banner, scale: 1, duration: 400, ease: 'Back.out' });
      });

      this.buildDpad();
    },

    // 간단 4방향 터치 D-패드(좌하단). 멀티터치 안전: 매 프레임 포인터로 재계산.
    buildDpad: function () {
      var cxp = 52, cyp = DESIGN_H - 52, R = 22;
      var dirs = [
        { k: 'up', dx: 0, dy: -1 }, { k: 'down', dx: 0, dy: 1 },
        { k: 'left', dx: -1, dy: 0 }, { k: 'right', dx: 1, dy: 0 }
      ];
      this.dpadBtns = dirs.map(function (d) {
        var bx = cxp + d.dx * R, by = cyp + d.dy * R;
        var g = this.add.circle(bx, by, 15, 0xffffff, 0.18).setScrollFactor(0).setDepth(30);
        g.dir = d.k; g.bx = bx; g.by = by;
        return g;
      }, this);
      this.input.addPointer(2);
    },

    update: function () {
      var g = this.scene.get('Game');
      if (g && g.state) {
        this.scoreTxt.setText('SCORE ' + g.state.score);
        this.gemTxt.setText('GEMS ' + g.state.gemsLeft);
        this.hpTxt.setText('HP ' + Math.max(0, g.state.hp));
      }
      // D-패드: 눌린 포인터들이 어떤 버튼 위에 있는지로 GAME_INPUT 세팅
      GAME_INPUT.up = GAME_INPUT.down = GAME_INPUT.left = GAME_INPUT.right = false;
      var pointers = [this.input.pointer1, this.input.pointer2, this.input.activePointer];
      var btns = this.dpadBtns || [];
      pointers.forEach(function (pt) {
        if (!pt || !pt.isDown) return;
        btns.forEach(function (b) {
          var dx = pt.x - b.bx, dy = pt.y - b.by;
          if (dx * dx + dy * dy <= 20 * 20) GAME_INPUT[b.dir] = true;
        });
      });
    }
  });

  // ===========================================================================
  // 부팅
  // ===========================================================================
  var config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a1622',
    render: { pixelArt: true, roundPixels: true, preserveDrawingBuffer: /[?&]capture=1/.test(location.search) },
    scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)),
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [BootScene, TitleScene, GameScene, UIScene]
  };
  var game = new Phaser.Game(config);
  window.TiledTopdown = { game: game, input: GAME_INPUT, audio: GAME_AUDIO };
})();
