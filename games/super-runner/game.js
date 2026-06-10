/* ============================================================================
 * SUPER RUNNER — web-game-builder 플래그십 데모 (마리오류 2D 플랫포머)
 * ----------------------------------------------------------------------------
 * 엔진: Phaser 4.1.0 (MIT) + PixelForge(절차적 스프라이트) + ChipAudio(절차적 사운드)
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
  // 레벨 소스 — 절차 LEVEL은 level.js에서 로드(변환기와 단일 소스 공유).
  // ?tiled=1 이면 같은 레벨을 .tmj(level.tmj.js)로 로드하는 경로로 전환한다.
  // 두 경로는 같은 엔티티 생성 헬퍼(makeCoin/makeBlockKind/makePipe/makeGoal/
  // spawnEnemy)를 공유하므로 행동 로직은 완전히 동일하다.
  // ===========================================================================
  var LEVEL = window.SUPER_RUNNER_LEVEL;
  var USE_TILED = /[?&]tiled=1/.test(location.search);

  // 절차 베이크 타일셋(?tiled=1 경로) — docs §2 계약 순서: ground·dirt·stone.
  // ground/dirt는 PixelForge 내장 타일, stone은 qblock '사용됨' 프레임(2)을 재사용.
  function terrainTileDefs() {
    var L = PixelForge.LIB;
    return [
      { name: 'ground', collides: true, frame: L.ground.frames[0] },
      { name: 'dirt',   collides: true, frame: L.dirt.frames[0] },
      { name: 'stone',  collides: true, frame: L.qblock.frames[2] }
    ];
  }

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
      // 하늘 그라데이션 텍스처 (1회 베이크) — 위는 깊은 파랑, 지평선은 옅게
      if (!this.textures.exists('sky')) {
        var sky = this.textures.createCanvas('sky', DESIGN_W, DESIGN_H);
        var sctx = sky.getContext();
        var grad = sctx.createLinearGradient(0, 0, 0, DESIGN_H);
        grad.addColorStop(0, '#3d7bd9');
        grad.addColorStop(0.45, '#5c9bef');
        grad.addColorStop(0.75, '#8ec4fa');
        grad.addColorStop(1, '#cfe9ff');
        sctx.fillStyle = grad; sctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
        sky.refresh();
      }
      // 부드러운 원형 글로우 (해 할로·파워업 플래시용, ADD 블렌드)
      if (!this.textures.exists('glow')) {
        var gl = this.textures.createCanvas('glow', 64, 64);
        var gctx = gl.getContext();
        var rg = gctx.createRadialGradient(32, 32, 2, 32, 32, 32);
        rg.addColorStop(0, 'rgba(255,250,220,0.9)');
        rg.addColorStop(0.5, 'rgba(255,240,180,0.35)');
        rg.addColorStop(1, 'rgba(255,240,180,0)');
        gctx.fillStyle = rg; gctx.fillRect(0, 0, 64, 64);
        gl.refresh();
      }
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
      var groundY = DESIGN_H - 32; // 바닥 윗면
      // 하늘 그라데이션 + 해
      this.add.image(0, 0, 'sky').setOrigin(0, 0).setDepth(-60);
      this.add.image(322, 38, 'glow').setScale(2.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(-56).setAlpha(0.85);
      this.add.image(322, 38, 'sun').setScale(1.6).setDepth(-55);
      // 원경 산 → 언덕 → 나무/덤불 (깊이 레이어)
      this.add.sprite(60, groundY, 'mountain').setOrigin(0.5, 1).setScale(2).setDepth(-40).setAlpha(0.9);
      this.add.sprite(250, groundY, 'mountain').setOrigin(0.5, 1).setScale(2.4).setDepth(-40).setAlpha(0.9).setFlipX(true);
      this.add.sprite(70, groundY, 'hill').setScale(3.2).setOrigin(0.5, 1).setDepth(-25);
      this.add.sprite(316, groundY, 'hill').setScale(2.4).setOrigin(0.5, 1).setDepth(-25);
      this.add.sprite(28, groundY, 'tree').setOrigin(0.5, 1).setScale(1.6).setDepth(-18);
      this.add.sprite(352, groundY, 'tree').setOrigin(0.5, 1).setScale(1.3).setDepth(-18).setFlipX(true);
      this.add.sprite(120, groundY, 'bush').setOrigin(0.5, 1).setScale(1.4).setDepth(-15);
      // 떠다니는 구름
      var c1 = this.add.sprite(80, 42, 'cloud').setScale(1.8).setDepth(-30).setAlpha(0.95);
      var c2 = this.add.sprite(240, 26, 'cloud2').setScale(1.6).setDepth(-30).setAlpha(0.9);
      var c3 = this.add.sprite(150, 64, 'cloud2').setScale(1.1).setDepth(-31).setAlpha(0.8);
      this.tweens.add({ targets: c1, x: '+=26', duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: c2, x: '-=30', duration: 11000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: c3, x: '+=18', duration: 7000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      // 바닥 띠 (잔디+흙) + 장식
      this.add.tileSprite(DESIGN_W / 2, groundY + 8, DESIGN_W, 16, 'ground').setDepth(-10);
      this.add.tileSprite(DESIGN_W / 2, groundY + 24, DESIGN_W, 16, 'dirt').setDepth(-10);
      var deco = [
        { k: 'grasstuft', a: 'grass-sway', x: 50 }, { k: 'flowerR', a: 'flowerR-sway', x: 95 },
        { k: 'flowerY', a: 'flowerY-sway', x: 150 }, { k: 'rock', a: null, x: 235 },
        { k: 'grasstuft', a: 'grass-sway', x: 285 }, { k: 'flowerR', a: 'flowerR-sway', x: 330 }
      ];
      for (var di = 0; di < deco.length; di++) {
        var d = this.add.sprite(deco[di].x, groundY, deco[di].k).setOrigin(0.5, 1).setDepth(-5);
        if (deco[di].a) d.play({ key: deco[di].a, startFrame: di % 2 });
      }
      // 주인공 미리보기 — 바닥에 서서 호흡 + 코인 한 닢
      var hero = this.add.sprite(DESIGN_W / 2 - 14, groundY, 'hero', 0).setOrigin(0.5, 1).setScale(3);
      hero.play('hero-idle');
      var coin = this.add.sprite(DESIGN_W / 2 + 26, groundY - 24, 'coin').setScale(2);
      coin.play('coin-spin');
      this.tweens.add({ targets: coin, y: groundY - 30, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      // 로고 — 그림자 레이어 + 본문 + 트윙클
      var ts = { fontFamily: 'Arial Black, Impact, monospace', fontSize: '34px', color: '#ffd23f', stroke: '#7d3a17', strokeThickness: 7 };
      var shadow = this.add.text(DESIGN_W / 2 + 2, 59, 'SUPER RUNNER', Object.assign({}, ts, { color: '#3a1408', stroke: '#3a1408' })).setOrigin(0.5).setAlpha(0.45);
      var title = this.add.text(DESIGN_W / 2, 56, 'SUPER RUNNER', ts).setOrigin(0.5);
      this.tweens.add({ targets: [title, shadow], scale: 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      var self0 = this;
      this.time.addEvent({
        delay: 700, loop: true, callback: function () {
          var sx = DESIGN_W / 2 + Phaser.Math.Between(-90, 90);
          var sy = 56 + Phaser.Math.Between(-16, 16);
          var sp = self0.add.sprite(sx, sy, 'sparkle').setScale(1.4).setDepth(5);
          sp.play('sparkle-pop');
          sp.once('animationcomplete', function () { sp.destroy(); });
        }
      });

      var tap = this.add.text(DESIGN_W / 2, 126, 'TAP / SPACE 로 시작', {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', stroke: '#1a1622', strokeThickness: 4
      }).setOrigin(0.5);
      this.tweens.add({ targets: tap, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

      this.add.text(DESIGN_W / 2, 212, '← → 이동 · A/↑/Space 점프 · 적을 밟으세요', {
        fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', stroke: '#46260f', strokeThickness: 3
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

    // ?tiled=1 경로: 변환된 .tmj(순수 JSON)를 Phaser 로더로 비동기 로드.
    // Tiled 앱에서 그대로 여는 파일이며, 로더가 첫 프레임 전 완료를 보장한다(http 서빙 필요).
    preload: function () {
      if (USE_TILED) this.load.tilemapTiledJSON('sr-map', 'level.tmj');
    },

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

    // --- 배경 (다층 패럴랙스: 하늘→해→산→구름→언덕→나무/덤불→지면 장식) ----
    // 각 레이어의 배치 폭 = 화면폭 + (월드폭-화면폭)×scrollFactor + 여유.
    // 카메라가 끝까지 가도 레이어가 비지 않는 최소 폭이다.
    buildBackground: function () {
      var sceneryY = LEVEL.groundTop * TILE;
      var span = function (sf) { return DESIGN_W + (LEVEL.width * TILE - DESIGN_W) * sf + 80; };

      // 하늘 그라데이션 + 해(글로우 할로) — 화면 고정
      this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0).setDepth(-60);
      this.add.image(322, 52, 'glow').setScale(2).setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0.02).setDepth(-56).setAlpha(0.6);
      this.add.image(322, 52, 'sun').setScale(1.5).setScrollFactor(0.02).setDepth(-55);

      // 원경 산 (아주 느림)
      for (var m = 0; m < span(0.12); m += 96) {
        this.add.sprite(m, sceneryY + 2, 'mountain').setOrigin(0.5, 1)
          .setScale(2).setScrollFactor(0.12).setDepth(-44)
          .setFlipX((m / 96) % 2 === 1).setAlpha(0.92);
      }

      // 구름 두 층 — 천천히 흘러가는 앰비언트 모션 (update 에서 드리프트)
      this.driftClouds = [];
      for (var c3 = 0; c3 < span(0.25); c3 += 88) {
        var small = (c3 / 88) % 3 === 1;
        var cl = this.add.sprite(c3, 18 + ((c3 * 7) % 46), small ? 'cloud2' : 'cloud')
          .setScale(small ? 1.2 : 1.7).setScrollFactor(small ? 0.2 : 0.25)
          .setDepth(small ? -36 : -34).setAlpha(small ? 0.8 : 0.95);
        this.driftClouds.push({ spr: cl, speed: small ? 5 : 8, max: span(0.25) });
      }

      // 중경 언덕
      for (var c = 0; c < span(0.45); c += 120) {
        this.add.sprite(c + 30, sceneryY + 1, 'hill').setOrigin(0.5, 1)
          .setScale(2 + ((c / 120) % 2) * 0.8).setScrollFactor(0.45).setDepth(-24);
      }

      // 근경 나무/덤불
      for (var c2 = 0; c2 < span(0.7); c2 += 150) {
        this.add.sprite(c2 + 60, sceneryY + 1, 'tree').setOrigin(0.5, 1)
          .setScale(1.4).setScrollFactor(0.7).setDepth(-18)
          .setFlipX((c2 / 150) % 2 === 0);
        this.add.sprite(c2 + 130, sceneryY + 3, 'bush').setOrigin(0.5, 1)
          .setScale(1.3).setScrollFactor(0.7).setDepth(-15);
      }

      // 지면 장식 (풀숲·꽃·바위) — 월드 좌표, 결정적 의사난수 배치
      var isPit = function (col) {
        for (var i = 0; i < LEVEL.pits.length; i++) {
          if (col >= LEVEL.pits[i][0] && col <= LEVEL.pits[i][1]) return true;
        }
        return false;
      };
      for (var col = 1; col < LEVEL.width - 1; col++) {
        if (isPit(col) || isPit(col - 1) || isPit(col + 1)) continue;
        var hsh = (col * 7919 + 31) % 100;
        var def = null;
        if (hsh < 13) def = { k: 'grasstuft', a: 'grass-sway' };
        else if (hsh < 20) def = { k: 'flowerR', a: 'flowerR-sway' };
        else if (hsh < 27) def = { k: 'flowerY', a: 'flowerY-sway' };
        else if (hsh < 32) def = { k: 'rock', a: null };
        if (!def) continue;
        var spr = this.add.sprite(cx(col), sceneryY, def.k).setOrigin(0.5, 1).setDepth(-4);
        if (def.a) spr.play({ key: def.a, startFrame: col % 2 });
      }
    },

    // --- 레벨(타일/블록/코인/적/파이프/깃발) --------------------------------
    // 그룹 생성 후 절차/Tiled 경로로 분기. 두 경로는 아래 공유 헬퍼를 쓴다.
    buildLevel: function () {
      this.solids = this.physics.add.staticGroup();
      this.blocks = this.physics.add.staticGroup();
      this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
      this.enemies = this.physics.add.group();
      this.items = this.physics.add.group();
      this.startPos = { x: cx(LEVEL.start.c), y: cy(LEVEL.start.r) }; // 기본(절차)

      if (USE_TILED) this.buildLevelTiled();
      else this.buildLevelProcedural();
    },

    // 절차 경로: 바닥 자동 생성 + 피처/파이프/골을 공유 헬퍼로 빌드.
    buildLevelProcedural: function () {
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
        if (f.t === 'o') self.makeCoin(x, y);
        else if (f.t === 'e') self.spawnEnemy(x, y);
        else if (f.t === 'S') { var s = self.solids.create(x, y, 'qblock', 2); s.refreshBody(); }
        else if (f.t === 'B') self.makeBlockKind(x, y, 'brick');
        else if (f.t === '?') self.makeBlockKind(x, y, 'coin');
        else if (f.t === 'M') self.makeBlockKind(x, y, 'mushroom');
      });

      // 파이프 + 골
      LEVEL.pipes.forEach(function (p) { self.makePipe(p.c, p.top, p.h); });
      this.makeGoal(LEVEL.goal.c);
    },

    // Tiled 경로: 절차 베이크 타일셋 + .tmj 로드. 정적 지형은 타일 레이어,
    // 행동하는 것(코인/적/블록/파이프/골/시작점)은 오브젝트 레이어 → 스포너 위임.
    buildLevelTiled: function () {
      var self = this;
      TiledForge.bakeTileset(this, terrainTileDefs(), {
        key: 'forge-tiles', name: 'forge', tileSize: TILE, columns: 3
      });
      // .tmj는 preload에서 로드됨. (file:// 폴백: level.tmj.js를 함께 로드하면 전역에서 주입)
      if (!this.cache.tilemap.exists('sr-map') && window.SUPER_RUNNER_TMJ) {
        TiledForge.injectMap(this, 'sr-map', window.SUPER_RUNNER_TMJ);
      }
      var res = TiledForge.loadTiledMap(this, 'sr-map', {
        tilesetKey: 'forge-tiles', tilesetName: 'forge',
        spawners: {
          player: function (s, o) { self.startPos = { x: o.x, y: o.y }; },
          coin:   function (s, o) { self.makeCoin(o.x, o.y); },
          enemy:  function (s, o) { self.spawnEnemy(o.x, o.y); },
          block:  function (s, o) { self.makeBlockKind(o.x, o.y, o.props.kind); },
          pipe:   function (s, o) { self.makePipe(Math.round(o.x / TILE), Math.round(o.y / TILE), o.props.height); },
          goal:   function (s, o) { self.makeGoal(Math.round(o.x / TILE)); }
        }
      });
      // 타일 레이어(충돌 설정됨)를 지형 콜라이더로 보관 → setupColliders에서 연결.
      this.terrainLayer = res.solids[0];
    },

    // --- 공유 엔티티 헬퍼 (절차·Tiled 경로 공통) ----------------------------
    makeCoin: function (x, y) {
      var coin = this.coins.create(x, y, 'coin').setDepth(2);
      // 스핀 시작 프레임을 위치 기반으로 흩뜨려 동기화 깨기(모두 같은 면이면 어색)
      coin.play({ key: 'coin-spin', startFrame: Math.floor(x / TILE) % 4 });
      coin.body.setSize(10, 10);
      return coin;
    },

    // kind: 'brick'|'coin'|'mushroom' → 적절한 텍스처로 makeBlock 호출
    makeBlockKind: function (x, y, kind) {
      var texKey = (kind === 'brick') ? 'brick' : 'qblock';
      return this.makeBlock(x, y, texKey, kind);
    },

    makePipe: function (col, top, h) {
      var self = this;
      var px = col * TILE; // 좌상단
      self.add.image(px, top * TILE, 'pipeTop').setOrigin(0, 0).setDepth(1);
      for (var k = 1; k < h; k++) {
        self.add.image(px, (top + k) * TILE, 'pipeBody').setOrigin(0, 0).setDepth(1);
      }
      // 충돌체 (2 x h 타일)
      for (var cc = 0; cc < 2; cc++) {
        for (var rr = 0; rr < h; rr++) {
          var body = self.solids.create((col + cc) * TILE + TILE / 2, (top + rr) * TILE + TILE / 2, null);
          body.setVisible(false); body.body.setSize(TILE, TILE); body.refreshBody();
        }
      }
    },

    makeGoal: function (col) {
      var gx = col * TILE;
      var poleTopRow = 4, poleBottomRow = LEVEL.groundTop;
      for (var pr = poleTopRow; pr < poleBottomRow; pr++) {
        this.add.image(gx + 6, pr * TILE, 'pole').setOrigin(0, 0).setDepth(1);
      }
      this.flagSpr = this.add.sprite(gx + 8, poleTopRow * TILE + 2, 'flag').setOrigin(0, 0).setDepth(2);
      this.flagSpr.play('flag-wave');
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
      e.body.setSize(11, 8); e.body.setOffset(1.5, 2);
      e.setVelocityX(-26);
      e.setBounceX(1);
      e.dir = -1; e.dead = false;
      e.setDepth(3);
      e.body.setCollideWorldBounds(false);
      return e;
    },

    buildHero: function () {
      var p = this.startPos || { x: cx(LEVEL.start.c), y: cy(LEVEL.start.r) };
      this.hero = this.physics.add.sprite(p.x, p.y, 'hero', 0).setDepth(5);
      this.hero.body.setSize(9, 15); this.hero.body.setOffset(2, 2);
      this.hero.setCollideWorldBounds(false);
      this.hero.big = false;
      this.hero.invuln = false;
      this.hero.facing = 1;
      this.hero.baseSX = 1; this.hero.baseSY = 1; // 스쿼시&스트레치 복귀 기준
      this.hero.play('hero-idle');
      // 점프 보정 변수 + 착지/달리기 먼지 상태
      this.coyote = 0; this.jumpBuffer = 0; this.prevJump = false;
      this.wasOnGround = true; this.peakFall = 0; this.runDustT = 0;
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
      // Tiled 경로: 정적 지형(ground/dirt/stone)은 타일 레이어에 있으므로 함께 충돌.
      if (this.terrainLayer) {
        this.physics.add.collider(this.hero, this.terrainLayer);
        this.physics.add.collider(this.enemies, this.terrainLayer);
        this.physics.add.collider(this.items, this.terrainLayer);
      }
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
      // 히트 플래시 (블록을 친 피드백)
      if (block.kind === 'coin' || block.kind === 'mushroom') {
        block.setTintFill(0xffffff);
        this.time.delayedCall(70, function () { if (block.active) block.clearTint(); });
      }
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

    // --- 게임필 FX 헬퍼 -------------------------------------------------------
    puff: function (x, y, scale) { // 먼지 퍼프 (점프/착지/달리기)
      var d = this.add.sprite(x, y, 'dust').setDepth(6).setScale(scale || 1);
      d.play('dust-puff');
      d.once('animationcomplete', function () { d.destroy(); });
    },

    sparkleAt: function (x, y, n) { // 반짝임 버스트 (코인/스톰프)
      var self = this;
      for (var i = 0; i < (n || 3); i++) {
        (function (idx) {
          self.time.delayedCall(idx * 50, function () {
            var sp = self.add.sprite(
              x + Phaser.Math.Between(-7, 7), y + Phaser.Math.Between(-7, 7), 'sparkle'
            ).setDepth(7).setScale(1 + (idx % 2) * 0.4);
            sp.play('sparkle-pop');
            sp.once('animationcomplete', function () { sp.destroy(); });
          });
        })(i);
      }
    },

    floatText: function (x, y, str, color) { // 떠오르는 점수 텍스트
      var t = this.add.text(x, y, str, {
        fontFamily: 'monospace', fontSize: '9px', color: color || '#fff7c0',
        stroke: '#1a1622', strokeThickness: 3
      }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 650, ease: 'Quad.out',
        onComplete: function () { t.destroy(); } });
    },

    squash: function (sx, sy, dur) { // 스쿼시&스트레치 (점프 0.8/1.2 · 착지 1.25/0.75)
      var h = this.hero;
      if (this.squashTween) this.squashTween.stop();
      var bx = h.baseSX || h.scaleX, by = h.baseSY || h.scaleY;
      h.setScale(bx, by);
      this.squashTween = this.tweens.add({
        targets: h, scaleX: bx * sx, scaleY: by * sy, duration: dur || 70,
        yoyo: true, ease: 'Quad.out',
        onComplete: function () { h.setScale(bx, by); }
      });
    },

    breakBrick: function (block) {
      var x = block.x, y = block.y;
      // 파편 6개 — 위로 튀었다 떨어지며 회전(Back.in 이징이 초기 상승을 만든다)
      for (var i = 0; i < 6; i++) {
        var p = this.add.image(x + (i % 3 - 1) * 4, y, 'spark')
          .setTint(i % 2 ? 0xc0612a : 0xe08a4a).setDepth(6)
          .setScale(0.8 + (i % 3) * 0.3);
        var vx = (i - 2.5) * 26;
        this.tweens.add({ targets: p, x: x + vx, angle: (i - 2.5) * 240, alpha: 0.2, duration: 700 });
        this.tweens.add({ targets: p, y: y + 190, duration: 700, ease: 'Back.in',
          onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
      this.puff(x, y, 1.2);
      block.destroy();
    },

    popCoin: function (x, y) {
      this.addScore(200); this.state.coins++; GAME_AUDIO.sfx('coin');
      var c = this.add.sprite(x, y, 'coin').setDepth(6); c.play('coin-spin');
      this.sparkleAt(x, y - 10, 2);
      this.floatText(x, y - 14, '+200');
      this.tweens.add({ targets: c, y: y - 22, duration: 260, ease: 'Quad.out',
        onComplete: function () { c.destroy(); } });
    },

    spawnMushroom: function (x, y) {
      var m = this.items.create(x, y, 'mushroom').setDepth(4);
      m.body.setSize(11, 9);
      m.setVelocityX(40); m.setBounceX(1);
      m.body.setCollideWorldBounds(false);
      // 블록 위로 살짝
      this.tweens.add({ targets: m, y: y - 2, duration: 200 });
    },

    onCoin: function (hero, coin) {
      var x = coin.x, y = coin.y;
      coin.destroy();
      this.addScore(100); this.state.coins++;
      GAME_AUDIO.sfx('coin');
      this.sparkleAt(x, y, 3);
      this.floatText(x, y - 8, '+100');
      this.maybe1up();
    },

    onItem: function (hero, item) {
      var x = item.x, y = item.y;
      item.destroy();
      this.addScore(1000);
      GAME_AUDIO.sfx('powerup');
      this.sparkleAt(x, y, 5);
      this.floatText(x, y - 10, '+1000', '#9fffb0');
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
        this.cameras.main.shake(60, 0.0045);
        this.puff(enemy.x, enemy.body.bottom, 1.1);
        this.floatText(enemy.x, enemy.y - 12, '+100');
        this.squash(1.15, 0.85, 60);
      } else if (!hero.invuln) {
        this.hurt(false);
      }
    },

    stompEnemy: function (enemy) {
      enemy.dead = true; enemy.setVelocityX(0); enemy.body.enable = false;
      enemy.anims.stop(); enemy.setFrame(4);
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
      this.hero.baseSX = this.hero.scaleX; this.hero.baseSY = this.hero.scaleY;
      this.hero.body.setSize(9, 15); this.hero.body.setOffset(2, 2);
      this.flashHero(700);
    },

    shrink: function () {
      this.hero.big = false;
      this.hero.setScale(1.0);
      this.hero.baseSX = 1; this.hero.baseSY = 1;
      this.hero.body.setSize(9, 15); this.hero.body.setOffset(2, 2);
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
      this.hero.anims.stop(); this.hero.setFrame(8);
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
      // 콘페티 — 깃대 주변에서 색색 파편이 흩날림
      var gx = LEVEL.goal.c * TILE + 8, gy = 5 * TILE;
      var tints = [0xffd23f, 0xff5a4d, 0x5bbf4a, 0x66c7ff, 0xffffff];
      for (var ci = 0; ci < 22; ci++) {
        var p = this.add.image(gx + Phaser.Math.Between(-14, 14), gy + Phaser.Math.Between(-10, 10), 'spark')
          .setTint(tints[ci % tints.length]).setDepth(8).setScale(0.7 + (ci % 3) * 0.3);
        this.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-30, 30), angle: Phaser.Math.Between(-360, 360), duration: 1400 });
        this.tweens.add({ targets: p, y: p.y + 130 + Phaser.Math.Between(0, 50), alpha: 0, duration: 1400,
          ease: 'Quad.in', onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
      this.sparkleAt(gx, gy, 6);
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
        this.puff(h.x, h.body.bottom, 0.9);          // 점프 먼지
        this.squash(0.8, 1.2, 90);                   // 스트레치(도약)
      }
      // 가변 점프 (버튼 떼면 상승 컷)
      if (!jumpHeld && h.body.velocity.y < -140) h.setVelocityY(-140);

      // 착지 감지 — 낙하 최고 속도 기준으로 먼지·스쿼시 강도 결정
      if (!onGround) {
        this.peakFall = Math.max(this.peakFall, h.body.velocity.y);
      } else if (!this.wasOnGround && this.peakFall > 160) {
        this.puff(h.x - 4, h.body.bottom, 1);
        this.puff(h.x + 4, h.body.bottom, 0.8);
        this.squash(1.25, 0.75, 80);                 // 스쿼시(착지)
        this.peakFall = 0;
      }
      if (onGround) this.peakFall = 0;
      this.wasOnGround = onGround;

      // 달리기 먼지 (지면에서 일정 속도 이상일 때 발 뒤꿈치)
      if (onGround && Math.abs(h.body.velocity.x) > 90) {
        this.runDustT += dt;
        if (this.runDustT > 170) {
          this.runDustT = 0;
          this.puff(h.x - h.facing * 6, h.body.bottom - 1, 0.7);
        }
      } else {
        this.runDustT = 0;
      }

      // 애니메이션 — 상승/낙하 분리
      if (!onGround) {
        h.play(h.body.velocity.y < -40 ? 'hero-jump' : 'hero-fall', true);
      } else if (Math.abs(h.body.velocity.x) > 12) {
        h.play('hero-run', true);
      } else {
        h.play('hero-idle', true);
      }

      // 구름 앰비언트 드리프트 (왼쪽으로 흐르고 레이어 폭에서 랩)
      if (this.driftClouds) {
        for (var dc = 0; dc < this.driftClouds.length; dc++) {
          var cl = this.driftClouds[dc];
          cl.spr.x -= cl.speed * dt / 1000;
          if (cl.spr.x < -50) cl.spr.x = cl.max + 30;
        }
      }

      // 적 AI (벽/월드끝에서 방향 전환)
      // Phaser 4: Group.children 는 네이티브 Set 이라 .iterate() 가 없다.
      // getChildren()(배열) + slice()(순회 중 destroy 안전) 로 대체.
      this.enemies.getChildren().slice().forEach(function (e) {
        if (!e || e.dead) return;
        if (e.body.blocked.left) { e.setVelocityX(26); e.setFlipX(true); }
        else if (e.body.blocked.right) { e.setVelocityX(-26); e.setFlipX(false); }
        if (e.x < 4 || e.x > (LEVEL.width * TILE - 4)) e.setVelocityX(-e.body.velocity.x);
        if (e.y > (LEVEL.rows * TILE + 40)) e.destroy();
      });

      // 아이템(버섯) 월드 끝 처리 (Phaser 4: getChildren() 배열 순회)
      this.items.getChildren().forEach(function (m) {
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
