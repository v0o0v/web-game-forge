/* ============================================================================
 * SUPER RUNNER — web-game-builder 플래그십 데모 (마리오류 2D 플랫포머)
 * ----------------------------------------------------------------------------
 * 엔진: Phaser 3.90 (MIT) + PixelForge(절차적 스프라이트) + ChipAudio(절차적 사운드)
 *       + MobileHarness(모바일 웹뷰 스케일/터치/오디오 언락)
 * 에셋: 100% 코드 생성 (CC0 / IP-safe). 닌텐도 마리오 에셋·이름·시그니처 미사용.
 * 캐릭터: '빨간 모자 러너'(오리지널) — 색 단서 1개(빨간 모자)만 남기고 나머지는 변경.
 * ==========================================================================*/
(function () {
  'use strict';

  // --- 상수 -----------------------------------------------------------------
  var TILE = 16;
  var DESIGN_W = 384;   // 24 타일
  var DESIGN_H = 224;   // 14 타일
  var GRAVITY = 1100;

  // 공유 입력 상태 (터치 컨트롤 ↔ 게임)
  var GAME_INPUT = { left: false, right: false, up: false };
  var GAME_AUDIO = new ChipAudio();
  window.GAME_AUDIO = GAME_AUDIO; // mobile.js 음소거 버튼이 참조

  function cx(col) { return col * TILE + TILE / 2; }
  function cy(row) { return row * TILE + TILE / 2; }

  // ===========================================================================
  // 레벨 정의 (타일 단위). 바닥은 자동 생성, 그 외 피처는 목록으로.
  // ===========================================================================
  var LEVEL = {
    width: 132,           // 전체 가로 타일 수
    rows: 14,             // 전체 세로 타일 수 (0..13)
    groundTop: 12,        // 바닥은 row 12(잔디)+13(흙)
    pits: [[27, 29], [58, 60], [88, 90], [104, 105]], // [시작,끝] 구덩이(바닥 없음)
    // 피처: t=종류, c=열, r=행
    features: [
      // 도입부 코인 + 물음표블록
      { t: '?', c: 8, r: 9 },
      { t: 'o', c: 6, r: 9 }, { t: 'o', c: 10, r: 9 },
      // 벽돌/블록 클러스터 (col 14~18, row 9)
      { t: 'B', c: 14, r: 9 }, { t: '?', c: 15, r: 9 }, { t: 'B', c: 16, r: 9 },
      { t: 'M', c: 17, r: 9 }, { t: 'B', c: 18, r: 9 },
      { t: 'o', c: 15, r: 6 }, { t: 'o', c: 16, r: 6 }, { t: 'o', c: 17, r: 6 },
      // 적 1
      { t: 'e', c: 21, r: 11 },
      // (파이프 col 23, 구덩이 27~29) — 구덩이 위 코인 아치
      { t: 'o', c: 27, r: 8 }, { t: 'o', c: 28, r: 7 }, { t: 'o', c: 29, r: 8 },
      // 적 2,3
      { t: 'e', c: 34, r: 11 }, { t: 'e', c: 36, r: 11 },
      // 돌계단 오르기 (col 39~42)
      { t: 'S', c: 39, r: 11 },
      { t: 'S', c: 40, r: 11 }, { t: 'S', c: 40, r: 10 },
      { t: 'S', c: 41, r: 11 }, { t: 'S', c: 41, r: 10 }, { t: 'S', c: 41, r: 9 },
      { t: 'S', c: 42, r: 11 }, { t: 'S', c: 42, r: 10 }, { t: 'S', c: 42, r: 9 }, { t: 'S', c: 42, r: 8 },
      // 공중 벽돌 플랫폼 (col 45~49, row 6) + 위 코인 + 숨은 버섯
      { t: 'B', c: 45, r: 6 }, { t: 'B', c: 46, r: 6 }, { t: 'M', c: 47, r: 6 }, { t: 'B', c: 48, r: 6 }, { t: 'B', c: 49, r: 6 },
      { t: 'o', c: 46, r: 4 }, { t: 'o', c: 47, r: 4 }, { t: 'o', c: 48, r: 4 },
      { t: 'e', c: 47, r: 5 },
      // (파이프 col 54 height 4)
      // 구덩이 58~60 위 코인
      { t: 'o', c: 57, r: 8 }, { t: 'o', c: 59, r: 7 }, { t: 'o', c: 61, r: 8 },
      // 적 무리
      { t: 'e', c: 66, r: 11 }, { t: 'e', c: 68, r: 11 },
      // 물음표 3연속
      { t: '?', c: 70, r: 9 }, { t: '?', c: 71, r: 9 }, { t: '?', c: 72, r: 9 },
      // 돌계단 (col 75~79)
      { t: 'S', c: 75, r: 11 },
      { t: 'S', c: 76, r: 11 }, { t: 'S', c: 76, r: 10 },
      { t: 'S', c: 77, r: 11 }, { t: 'S', c: 77, r: 10 }, { t: 'S', c: 77, r: 9 },
      { t: 'S', c: 78, r: 11 }, { t: 'S', c: 78, r: 10 }, { t: 'S', c: 78, r: 9 }, { t: 'S', c: 78, r: 8 },
      { t: 'S', c: 79, r: 11 }, { t: 'S', c: 79, r: 10 }, { t: 'S', c: 79, r: 9 }, { t: 'S', c: 79, r: 8 }, { t: 'S', c: 79, r: 7 },
      { t: 'o', c: 82, r: 6 }, { t: 'o', c: 83, r: 6 }, { t: 'o', c: 84, r: 6 },
      // (구덩이 88~90 위 코인)
      { t: 'o', c: 87, r: 8 }, { t: 'o', c: 89, r: 6 }, { t: 'o', c: 91, r: 8 },
      // 벽돌 + 적
      { t: 'B', c: 95, r: 9 }, { t: '?', c: 96, r: 9 }, { t: 'B', c: 97, r: 9 },
      { t: 'e', c: 99, r: 11 }, { t: 'e', c: 101, r: 11 },
      // 마지막 코인 길
      { t: 'o', c: 108, r: 9 }, { t: 'o', c: 109, r: 9 }, { t: 'o', c: 110, r: 9 },
      // 골 직전 돌계단
      { t: 'S', c: 113, r: 11 },
      { t: 'S', c: 114, r: 11 }, { t: 'S', c: 114, r: 10 },
      { t: 'S', c: 115, r: 11 }, { t: 'S', c: 115, r: 10 }, { t: 'S', c: 115, r: 9 },
      { t: 'S', c: 116, r: 11 }, { t: 'S', c: 116, r: 10 }, { t: 'S', c: 116, r: 9 }, { t: 'S', c: 116, r: 8 }
    ],
    pipes: [
      { c: 23, top: 10, h: 2 },
      { c: 54, top: 8, h: 4 }
    ],
    goal: { c: 124 },     // 깃대 위치
    start: { c: 2, r: 11 }
  };

  // ===========================================================================
  // Boot — 에셋 생성
  // ===========================================================================
  var BootScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BootScene() { Phaser.Scene.call(this, { key: 'Boot' }); },
    create: function () {
      PixelForge.buildAll(this);
      // 파티클용 흰 사각 텍스처
      var g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4);
      g.generateTexture('spark', 4, 4); g.destroy();
      // 터치 컨트롤 Scene 등록
      var TC = MobileHarness.TouchControlsClass(DESIGN_W, DESIGN_H, GAME_INPUT);
      if (!this.scene.get('TouchControls')) this.scene.add('TouchControls', TC, false);
      MobileHarness.installDomGuards();
      MobileHarness.onResume(function () { GAME_AUDIO.resume(); });
      this.scene.start('Title');
    }
  });

  // ===========================================================================
  // Title — 타이틀 + Tap to start (오디오 언락 지점)
  // ===========================================================================
  var TitleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function TitleScene() { Phaser.Scene.call(this, { key: 'Title' }); },
    create: function () {
      this.cameras.main.setBackgroundColor('#5c94fc');
      // 배경 장식
      this.add.sprite(70, 150, 'hill').setScale(4).setOrigin(0.5, 1);
      this.add.sprite(300, 140, 'hill').setScale(3).setOrigin(0.5, 1);
      this.add.sprite(80, 40, 'cloud').setScale(3);
      this.add.sprite(280, 30, 'cloud').setScale(2.5);
      // 주인공 미리보기
      var hero = this.add.sprite(DESIGN_W / 2, 120, 'hero', 0).setScale(4);
      hero.play('hero-idle');
      this.tweens.add({ targets: hero, y: 112, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      var title = this.add.text(DESIGN_W / 2, 56, 'SUPER RUNNER', {
        fontFamily: 'Arial Black, Impact, monospace', fontSize: '34px', color: '#ffd23f',
        stroke: '#7d3a17', strokeThickness: 7
      }).setOrigin(0.5);
      this.tweens.add({ targets: title, scale: 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      var tap = this.add.text(DESIGN_W / 2, 178, 'TAP / SPACE 로 시작', {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5);
      this.tweens.add({ targets: tap, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

      this.add.text(DESIGN_W / 2, 206, '← → 이동 · A/↑/Space 점프 · 적을 밟으세요', {
        fontFamily: 'monospace', fontSize: '10px', color: '#dfeaff'
      }).setOrigin(0.5);

      var self = this;
      var start = function () {
        // 첫 제스처 → 오디오 언락 + BGM (모바일 웹뷰 필수)
        GAME_AUDIO.unlock();
        GAME_AUDIO.startBgm();
        self.scene.start('Game');
        self.scene.launch('UI');
        self.scene.launch('TouchControls');
      };
      this.input.once('pointerdown', start);
      this.input.keyboard.once('keydown-SPACE', start);
      this.input.keyboard.once('keydown-ENTER', start);
      // 자동화/검증용: ?autostart=1 이면 탭 없이 시작 (오디오는 첫 제스처에 언락됨)
      if (/[?&]autostart=1/.test(location.search)) this.time.delayedCall(60, start);
    }
  });

  // ===========================================================================
  // Game — 플랫포머 본체
  // ===========================================================================
  var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function GameScene() { Phaser.Scene.call(this, { key: 'Game' }); },

    create: function () {
      var W = LEVEL.width * TILE, Hh = LEVEL.rows * TILE;
      this.worldW = W; this.worldH = Hh;
      this.physics.world.setBounds(0, 0, W, Hh + 80);
      this.cameras.main.setBounds(0, 0, W, Hh);
      this.cameras.main.setBackgroundColor('#5c94fc');

      // 목숨/점수/코인은 scene.restart() 를 가로질러 유지(registry 영속). time/cleared/dead 는 라이프별 리셋.
      var run = this.registry.get('run');
      if (!run) { run = { lives: 3, score: 0, coins: 0 }; this.registry.set('run', run); }
      this.run = run;
      this.state = { score: run.score, coins: run.coins, lives: run.lives, time: 300, world: '1-1', cleared: false, dead: false };

      this.buildBackground();
      this.buildLevel();
      this.buildHero();
      this.setupInput();
      this.setupColliders();

      // 카메라 추적 (히어로가 화면 좌측 1/3 지점)
      this.cameras.main.startFollow(this.hero, true, 0.14, 0.14);
      this.cameras.main.setDeadzone(60, 40);
      this.cameras.main.setFollowOffset(-60, 20);

      // 타임 카운트다운
      this.timeEvent = this.time.addEvent({
        delay: 1000, loop: true, callback: function () {
          if (this.state.cleared || this.state.dead) return;
          this.state.time--;
          if (this.state.time <= 0) { this.state.time = 0; this.hurt(true); }
        }, callbackScope: this
      });
    },

    // --- 배경 (패럴랙스) ----------------------------------------------------
    buildBackground: function () {
      var sceneryY = LEVEL.groundTop * TILE;
      // 언덕/덤불 (느린 패럴랙스)
      for (var c = 4; c < LEVEL.width; c += 17) {
        this.add.sprite(cx(c), sceneryY, 'hill').setOrigin(0.5, 1).setScale(2.4)
          .setScrollFactor(0.5).setDepth(-20);
      }
      for (var c2 = 9; c2 < LEVEL.width; c2 += 11) {
        this.add.sprite(cx(c2), sceneryY + 4, 'bush').setOrigin(0.5, 1).setScale(1.6)
          .setScrollFactor(0.7).setDepth(-15);
      }
      // 구름 (더 느리게)
      for (var c3 = 6; c3 < LEVEL.width; c3 += 13) {
        var cy2 = 20 + ((c3 * 7) % 40);
        this.add.sprite(cx(c3), cy2, 'cloud').setScale(2)
          .setScrollFactor(0.3).setDepth(-30);
      }
    },

    // --- 레벨(타일/블록/코인/적/파이프/깃발) --------------------------------
    buildLevel: function () {
      this.solids = this.physics.add.staticGroup();
      this.blocks = this.physics.add.staticGroup();
      this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
      this.enemies = this.physics.add.group();
      this.items = this.physics.add.group();

      var self = this;
      var isPit = function (col) {
        for (var i = 0; i < LEVEL.pits.length; i++) {
          if (col >= LEVEL.pits[i][0] && col <= LEVEL.pits[i][1]) return true;
        }
        return false;
      };

      // 바닥 (잔디+흙) 자동 생성
      for (var col = 0; col < LEVEL.width; col++) {
        if (isPit(col)) continue;
        var top = self.solids.create(cx(col), cy(LEVEL.groundTop), 'ground');
        top.refreshBody();
        var fill = self.solids.create(cx(col), cy(LEVEL.groundTop + 1), 'dirt');
        fill.refreshBody();
      }

      // 피처
      LEVEL.features.forEach(function (f) {
        var x = cx(f.c), y = cy(f.r);
        if (f.t === 'o') {
          var coin = self.coins.create(x, y, 'coin').setDepth(2);
          coin.play('coin-spin'); coin.body.setSize(10, 10);
        } else if (f.t === 'e') {
          self.spawnEnemy(x, y);
        } else if (f.t === 'S') {
          var s = self.solids.create(x, y, 'qblock', 2); s.refreshBody();
        } else if (f.t === 'B') {
          self.makeBlock(x, y, 'brick', 'brick');
        } else if (f.t === '?') {
          self.makeBlock(x, y, 'qblock', 'coin');
        } else if (f.t === 'M') {
          self.makeBlock(x, y, 'qblock', 'mushroom');
        }
      });

      // 파이프 (2타일 폭)
      LEVEL.pipes.forEach(function (p) {
        var px = p.c * TILE; // 좌상단
        // 입구
        var topSpr = self.add.image(px, p.top * TILE, 'pipeTop').setOrigin(0, 0).setDepth(1);
        for (var k = 1; k < p.h; k++) {
          self.add.image(px, (p.top + k) * TILE, 'pipeBody').setOrigin(0, 0).setDepth(1);
        }
        // 충돌체 (2 x h 타일)
        for (var cc = 0; cc < 2; cc++) {
          for (var rr = 0; rr < p.h; rr++) {
            var body = self.solids.create((p.c + cc) * TILE + TILE / 2, (p.top + rr) * TILE + TILE / 2, null);
            body.setVisible(false); body.body.setSize(TILE, TILE); body.refreshBody();
          }
        }
      });

      // 깃발 골인
      var gx = LEVEL.goal.c * TILE;
      var poleTopRow = 4, poleBottomRow = LEVEL.groundTop;
      for (var pr = poleTopRow; pr < poleBottomRow; pr++) {
        this.add.image(gx + 6, pr * TILE, 'pole').setOrigin(0, 0).setDepth(1);
      }
      this.flagSpr = this.add.sprite(gx + 8, poleTopRow * TILE + 2, 'flag').setOrigin(0, 0).setDepth(2);
      // 깃대 베이스 블록
      var base = this.solids.create(gx + 8, cy(LEVEL.groundTop - 1) + 8, 'qblock', 2); base.refreshBody();
      // 골 트리거 존
      this.goalZone = this.add.zone(gx + 8, (poleTopRow) * TILE, 14, (poleBottomRow - poleTopRow) * TILE).setOrigin(0, 0);
      this.physics.add.existing(this.goalZone, true);
    },

    makeBlock: function (x, y, texKey, kind) {
      var b = this.blocks.create(x, y, texKey, kind === 'brick' ? 0 : 0);
      b.kind = kind; b.used = false;
      if (kind === 'coin' || kind === 'mushroom') b.play('qblock-pulse');
      b.refreshBody();
      return b;
    },

    spawnEnemy: function (x, y) {
      var e = this.enemies.create(x, y, 'enemy', 0);
      e.play('enemy-walk');
      e.setSize ? e.body.setSize(11, 10) : null;
      e.body.setSize(11, 9); e.body.setOffset(0.5, 1);
      e.setVelocityX(-26);
      e.setBounceX(1);
      e.dir = -1; e.dead = false;
      e.setDepth(3);
      e.body.setCollideWorldBounds(false);
      return e;
    },

    buildHero: function () {
      var s = LEVEL.start;
      this.hero = this.physics.add.sprite(cx(s.c), cy(s.r), 'hero', 0).setDepth(5);
      this.hero.body.setSize(9, 15); this.hero.body.setOffset(1.5, 1);
      this.hero.setCollideWorldBounds(false);
      this.hero.big = false;
      this.hero.invuln = false;
      this.hero.facing = 1;
      this.hero.play('hero-idle');
      // 점프 보정 변수
      this.coyote = 0; this.jumpBuffer = 0; this.prevJump = false;
    },

    setupInput: function () {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({
        a: Phaser.Input.Keyboard.KeyCodes.A,
        d: Phaser.Input.Keyboard.KeyCodes.D,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE
      });
    },

    setupColliders: function () {
      this.physics.add.collider(this.hero, this.solids);
      this.physics.add.collider(this.enemies, this.solids);
      this.physics.add.collider(this.items, this.solids);
      this.physics.add.collider(this.hero, this.blocks, this.onHitBlock, null, this);
      this.physics.add.collider(this.enemies, this.blocks);
      this.physics.add.collider(this.items, this.blocks);
      this.physics.add.overlap(this.hero, this.coins, this.onCoin, null, this);
      this.physics.add.overlap(this.hero, this.enemies, this.onEnemy, null, this);
      this.physics.add.overlap(this.hero, this.items, this.onItem, null, this);
      this.physics.add.overlap(this.hero, this.goalZone, this.onGoal, null, this);
    },

    // --- 충돌 콜백 ----------------------------------------------------------
    onHitBlock: function (hero, block) {
      if (!hero.body.blocked.up) return;
      if (block.y > hero.y) return; // 위에서 친 게 아님
      if (block.used && block.kind !== 'brick') { GAME_AUDIO.sfx('bump'); this.bumpTween(block); return; }
      this.bumpTween(block);
      if (block.kind === 'coin') {
        block.used = true; block.anims.stop(); block.setFrame(2);
        this.popCoin(block.x, block.y - TILE);
        GAME_AUDIO.sfx('bump');
      } else if (block.kind === 'mushroom') {
        block.used = true; block.anims.stop(); block.setFrame(2);
        this.spawnMushroom(block.x, block.y - TILE);
        GAME_AUDIO.sfx('sprout');
      } else if (block.kind === 'brick') {
        if (hero.big) {
          this.breakBrick(block); GAME_AUDIO.sfx('brick');
          this.addScore(50);
        } else {
          GAME_AUDIO.sfx('bump');
        }
      }
    },

    bumpTween: function (block) {
      var oy = block.y;
      this.tweens.add({ targets: block, y: oy - 5, duration: 80, yoyo: true,
        onComplete: function () { block.y = oy; if (block.body) block.refreshBody(); } });
    },

    breakBrick: function (block) {
      var x = block.x, y = block.y;
      for (var i = 0; i < 5; i++) {
        var p = this.add.image(x, y, 'spark').setTint(0xc0612a).setDepth(6);
        var vx = (i - 2) * 30, vy = -120 - Math.abs(i - 2) * 20;
        this.tweens.add({ targets: p, x: x + vx, y: y + 200, alpha: 0, duration: 700,
          onComplete: function () { p.destroy(); } });
      }
      block.destroy();
    },

    popCoin: function (x, y) {
      this.addScore(200); this.state.coins++; GAME_AUDIO.sfx('coin');
      var c = this.add.sprite(x, y, 'coin').setDepth(6); c.play('coin-spin');
      this.tweens.add({ targets: c, y: y - 22, duration: 260, ease: 'Quad.out',
        onComplete: function () { c.destroy(); } });
    },

    spawnMushroom: function (x, y) {
      var m = this.items.create(x, y, 'mushroom').setDepth(4);
      m.body.setSize(12, 11);
      m.setVelocityX(40); m.setBounceX(1);
      m.body.setCollideWorldBounds(false);
      // 블록 위로 살짝
      this.tweens.add({ targets: m, y: y - 2, duration: 200 });
    },

    onCoin: function (hero, coin) {
      coin.destroy();
      this.addScore(100); this.state.coins++;
      GAME_AUDIO.sfx('coin');
      this.maybe1up();
    },

    onItem: function (hero, item) {
      item.destroy();
      this.addScore(1000);
      GAME_AUDIO.sfx('powerup');
      if (!hero.big) this.grow();
    },

    onEnemy: function (hero, enemy) {
      if (enemy.dead || this.state.dead || this.state.cleared) return;
      var stomped = hero.body.velocity.y > 20 && (hero.body.bottom <= enemy.body.top + 10);
      if (stomped) {
        this.stompEnemy(enemy);
        hero.setVelocityY(-260);
        this.addScore(100);
        GAME_AUDIO.sfx('stomp');
      } else if (!hero.invuln) {
        this.hurt(false);
      }
    },

    stompEnemy: function (enemy) {
      enemy.dead = true; enemy.setVelocityX(0); enemy.body.enable = false;
      enemy.anims.stop(); enemy.setFrame(2);
      var self = this;
      this.time.delayedCall(450, function () { enemy.destroy(); });
    },

    onGoal: function () {
      if (this.state.cleared) return;
      this.clearStage();
    },

    // --- 상태 변화 ----------------------------------------------------------
    addScore: function (n) { this.state.score += n; },

    maybe1up: function () {
      if (this.state.coins > 0 && this.state.coins % 50 === 0) {
        this.state.lives++; GAME_AUDIO.sfx('1up');
      }
    },

    grow: function () {
      this.hero.big = true;
      this.hero.setScale(1.0); // 스프라이트는 setDisplaySize 로
      this.hero.setDisplaySize(this.hero.width * 1.35, this.hero.height * 1.45);
      this.hero.body.setSize(9, 15); this.hero.body.setOffset(1.5, 1);
      this.flashHero(700);
    },

    shrink: function () {
      this.hero.big = false;
      this.hero.setDisplaySize(this.hero.width, this.hero.height);
      this.hero.body.setSize(9, 15); this.hero.body.setOffset(1.5, 1);
    },

    flashHero: function (dur) {
      this.hero.invuln = true;
      var self = this;
      var tw = this.tweens.add({ targets: this.hero, alpha: 0.3, duration: 90, yoyo: true, repeat: Math.floor(dur / 180) });
      this.time.delayedCall(dur, function () { self.hero.invuln = false; self.hero.alpha = 1; tw.stop(); });
    },

    hurt: function (instant) {
      if (this.state.dead || this.state.cleared) return;
      if (this.hero.invuln && !instant) return;
      if (this.hero.big && !instant) {
        this.shrink(); this.flashHero(1200); GAME_AUDIO.sfx('bump');
        return;
      }
      this.die();
    },

    die: function () {
      this.state.dead = true;
      this.hero.invuln = true;
      this.hero.body.enable = false;
      this.hero.anims.stop(); this.hero.setFrame(3);
      this.hero.setVelocity(0, -320);
      this.hero.body.enable = true; this.hero.body.checkCollision.none = true;
      GAME_AUDIO.sfx('die'); GAME_AUDIO.stopBgm();
      var self = this;
      this.time.delayedCall(1400, function () {
        self.state.lives--;
        // 영속 저장(restart 가 create 를 재실행해도 줄어든 목숨/점수 유지)
        self.run.lives = self.state.lives;
        self.run.score = self.state.score;
        self.run.coins = self.state.coins;
        if (self.state.lives <= 0) { self.registry.remove('run'); self.gameOver(); }
        else { self.scene.restart(); GAME_AUDIO.startBgm(); }
      });
    },

    clearStage: function () {
      this.state.cleared = true;
      this.hero.body.setVelocityX(0);
      GAME_AUDIO.sfx('flag'); GAME_AUDIO.stopBgm();
      // 깃발 내리기
      this.tweens.add({ targets: this.flagSpr, y: (LEVEL.groundTop - 2) * TILE, duration: 700, ease: 'Bounce.out' });
      this.events.emit('banner', 'STAGE CLEAR!');
      var self = this;
      // 남은 타임 → 점수
      this.time.addEvent({
        delay: 30, repeat: 100, callback: function () {
          if (self.state.time > 0) { self.state.time--; self.state.score += 50; }
        }
      });
      this.time.delayedCall(3600, function () {
        self.registry.remove('run'); // 스테이지 클리어 → 다음 게임은 목숨 3으로 새로 시작
        self.scene.stop('UI'); self.scene.stop('TouchControls'); self.scene.start('Title');
      });
    },

    gameOver: function () {
      this.events.emit('banner', 'GAME OVER');
      var self = this;
      this.time.delayedCall(3000, function () {
        self.scene.stop('UI'); self.scene.stop('TouchControls'); self.scene.start('Title');
      });
    },

    // --- 메인 루프 ----------------------------------------------------------
    update: function (t, dt) {
      var h = this.hero;
      if (this.state.dead || this.state.cleared) {
        // 클리어 시 자동 전진 연출
        if (this.state.cleared && h.x < LEVEL.goal.c * TILE + 4) { h.x += 0.6; h.play('hero-run', true); }
        return;
      }

      // 구덩이 추락
      if (h.y > this.worldH + 24) { this.die(); return; }

      var left = this.cursors.left.isDown || this.keys.a.isDown || GAME_INPUT.left;
      var right = this.cursors.right.isDown || this.keys.d.isDown || GAME_INPUT.right;
      var jumpHeld = this.cursors.up.isDown || this.keys.w.isDown || this.keys.space.isDown || GAME_INPUT.up;
      var onGround = h.body.blocked.down || h.body.touching.down;

      // 좌우 이동 (가속 + 마찰)
      var SPEED = 150, ACC = 900;
      if (left && !right) {
        h.setAccelerationX(-ACC); h.facing = -1; h.setFlipX(true);
      } else if (right && !left) {
        h.setAccelerationX(ACC); h.facing = 1; h.setFlipX(false);
      } else {
        h.setAccelerationX(0);
        h.setVelocityX(h.body.velocity.x * 0.8);
      }
      h.setMaxVelocity(SPEED, 600);

      // 코요테 타임 + 점프 버퍼
      if (onGround) this.coyote = 110; else this.coyote -= dt;
      var jumpPressed = jumpHeld && !this.prevJump;
      if (jumpPressed) this.jumpBuffer = 120; else this.jumpBuffer -= dt;
      this.prevJump = jumpHeld;

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        h.setVelocityY(-380);
        this.jumpBuffer = 0; this.coyote = 0;
        GAME_AUDIO.sfx('jump');
      }
      // 가변 점프 (버튼 떼면 상승 컷)
      if (!jumpHeld && h.body.velocity.y < -140) h.setVelocityY(-140);

      // 애니메이션
      if (!onGround) {
        h.play('hero-jump', true);
      } else if (Math.abs(h.body.velocity.x) > 12) {
        h.play('hero-run', true);
      } else {
        h.play('hero-idle', true);
      }

      // 적 AI (벽/월드끝에서 방향 전환)
      this.enemies.children.iterate(function (e) {
        if (!e || e.dead) return;
        if (e.body.blocked.left) { e.setVelocityX(26); e.setFlipX(true); }
        else if (e.body.blocked.right) { e.setVelocityX(-26); e.setFlipX(false); }
        if (e.x < 4 || e.x > (LEVEL.width * TILE - 4)) e.setVelocityX(-e.body.velocity.x);
        if (e.y > (LEVEL.rows * TILE + 40)) e.destroy();
      });

      // 아이템(버섯) 월드 끝 처리
      this.items.children.iterate(function (m) {
        if (!m) return;
        if (m.body.blocked.left) m.setVelocityX(40);
        else if (m.body.blocked.right) m.setVelocityX(-40);
      });
    }
  });

  // ===========================================================================
  // UI — HUD (별도 Scene, 스크롤 X)
  // ===========================================================================
  var UIScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function UIScene() { Phaser.Scene.call(this, { key: 'UI' }); },
    create: function () {
      var st = { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#000', strokeThickness: 4 };
      this.coinIcon = this.add.sprite(14, 14, 'coin').setScale(1.2); this.coinIcon.play('coin-spin');
      this.coinTxt = this.add.text(24, 8, 'x00', st);
      this.scoreTxt = this.add.text(96, 8, 'SCORE 000000', st);
      this.worldTxt = this.add.text(DESIGN_W - 8, 8, 'WORLD 1-1', st).setOrigin(1, 0);
      this.timeTxt = this.add.text(DESIGN_W - 8, 24, 'TIME 300', st).setOrigin(1, 0);
      this.livesIcon = this.add.sprite(10, 30, 'hero', 0).setOrigin(0, 0.5);
      this.livesTxt = this.add.text(22, 24, 'x3', st);

      // 배너 (클리어/게임오버)
      this.banner = this.add.text(DESIGN_W / 2, DESIGN_H / 2, '', {
        fontFamily: 'Arial Black, monospace', fontSize: '28px', color: '#ffd23f', stroke: '#7d3a17', strokeThickness: 6
      }).setOrigin(0.5).setAlpha(0);

      var self = this;
      var game = this.scene.get('Game');
      game.events.on('banner', function (msg) {
        self.banner.setText(msg).setAlpha(1).setScale(0.5);
        self.tweens.add({ targets: self.banner, scale: 1, duration: 400, ease: 'Back.out' });
      });
    },
    update: function () {
      var g = this.scene.get('Game');
      if (!g || !g.state) return;
      var s = g.state;
      this.coinTxt.setText('x' + String(s.coins).padStart(2, '0'));
      this.scoreTxt.setText('SCORE ' + String(s.score).padStart(6, '0'));
      this.timeTxt.setText('TIME ' + s.time);
      this.worldTxt.setText('WORLD ' + s.world);
      this.livesTxt.setText('x' + s.lives);
    }
  });

  // ===========================================================================
  // 부팅
  // ===========================================================================
  var config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#5c94fc',
    // pixelArt/roundPixels: 확대 시 또렷한 픽셀. preserveDrawingBuffer 는 ?capture=1 일 때만
    // 켜서 헤드리스 스크린샷이 또렷이 잡히게 한다(평상시엔 꺼서 성능 보존).
    render: {
      pixelArt: true,
      roundPixels: true,
      preserveDrawingBuffer: /[?&]capture=1/.test(location.search)
    },
    scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)),
    physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY }, debug: false } },
    scene: [BootScene, TitleScene, GameScene, UIScene]
  };
  var game = new Phaser.Game(config);
  // 외부 제어/임베드/자동화용 핸들 (해롭지 않음, 실게임 동작과 무관)
  window.SuperRunner = { game: game, input: GAME_INPUT, audio: GAME_AUDIO };
})();
