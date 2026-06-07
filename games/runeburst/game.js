/* ============================================================================
 * Runeburst — 별무리 매치 (web-game-builder 데모)
 * ----------------------------------------------------------------------------
 * 코어: 매치3 스왑 캐스케이드 (Bejeweled/Candy Crush류 — 메카닉만 차용, IP-safe).
 * 재미 조합 (사용자 주도):
 *   - FE-COMBO   : 스왑→소거→낙하→리필→재매치 캐스케이드 (음 높이가 쌓이는 피치 스택).
 *   - FE-RISK-REWARD : "콤보 배율 도박" — 점수는 잠재 점수(pot)에 쌓이고 ×배율로 불어난다.
 *                  '정산(BANK)'으로 안전하게 확정하거나, 더 키우려 밀어붙인다.
 *                  단, 과열(streak≥HOT) 상태에서 약한 한 수(연쇄 없는 3매치)를 두면
 *                  pot 절반이 붕괴(BUST) — '한 수 더 vs 지금 정산'의 떨림.
 *   - FE-CONSTRAINT+OPTIMIZE : 제한 이동 수 안에 목표 점수 달성 → 별 1~3 판정.
 *   - FE-PLANNING : 특수 타일 — 4매치=라인 블래스터(행/열 소거), 5매치=컬러 코어(색 전체 소거).
 *   - FE-JUST-ONE-MORE : 데일리 시드(오늘의 보드, 결과 이모지 클립보드 공유) + localStorage 베스트.
 * 엔진: Phaser 4.1.0 + VectorForge(네온 글로우 룬) + ChipAudio(콤보 피치 스택) + MobileHarness.
 * 보드모델/렌더 분리: board[r][c]={color,special} 또는 null 이 유일 상태원, spr[r][c] 컨테이너는 거울.
 * IP 안전: 'Bejeweled'/'Candy Crush' 명칭·보석 디자인·보이스 미사용 — 룬/별자리 전부 절차생성 오리지널.
 * ==========================================================================*/
(function () {
  'use strict';

  var DESIGN_W = 540, DESIGN_H = 960;
  var COLS = 7, ROWS = 7;
  var TILE = 68;
  var BOARD_W = TILE * COLS;
  var BOARD_X = Math.round((DESIGN_W - BOARD_W) / 2);
  var BOARD_Y = 232;
  var ENT = 72;               // 룬 베이크 논리 크기
  var HOT = 4;                // 이 streak 이상이면 '과열' — 약한 수는 BUST
  var MULT_CAP = 9;

  // 특수 타일 종류
  var SP_NONE = 0, SP_LINE_H = 1, SP_LINE_V = 2, SP_CORE = 3;

  // 전역 오디오 (MobileHarness 음소거/가시성 가드가 참조)
  var audio = new ChipAudio();
  window.GAME_AUDIO = audio;

  // --- 룬 팔레트 (네온 글로우 / 우주 별자리·룬) ----------------------------
  // 각 색: 그라데이션 2색 + 글로우 색 + 심볼 종류
  var RUNES = [
    { g: ['#ff8aa6', '#e8345f'], glow: 'rgba(255,90,130,0.9)',  sym: 'star' },     // 0 홍성
    { g: ['#ffe08a', '#f0a01f'], glow: 'rgba(255,195,70,0.9)',  sym: 'diamond' },  // 1 금성
    { g: ['#8af0b4', '#2fd07a'], glow: 'rgba(95,240,160,0.9)',  sym: 'triangle' }, // 2 녹성
    { g: ['#8ae8ff', '#2bb6e0'], glow: 'rgba(90,220,255,0.95)', sym: 'orb' },      // 3 청성
    { g: ['#9fb0ff', '#4a5fee'], glow: 'rgba(120,140,255,0.9)', sym: 'hex' },      // 4 남성
    { g: ['#cf9fff', '#7a3fd0'], glow: 'rgba(175,110,255,0.9)', sym: 'crescent' }  // 5 자성
  ];

  // --- 레벨 데이터 (8레벨 — 기본기 → 특수 → 도박 → 종합) -------------------
  // colors: 사용 색 수, moves: 이동 수, goal: 목표(정산된) 점수, seed: 결정적 보드 시드
  var LEVELS = [
    { name: '첫 별빛',   colors: 5, moves: 20, goal: 1000, seed: 1001 },
    { name: '연쇄의 맛', colors: 5, moves: 18, goal: 1600, seed: 1002 },
    { name: '라인 블래스터', colors: 6, moves: 18, goal: 2200, seed: 1003 },
    { name: '컬러 코어', colors: 6, moves: 16, goal: 2800, seed: 1004 },
    { name: '정산의 도박', colors: 6, moves: 15, goal: 3400, seed: 1005 },
    { name: '과열 주의', colors: 6, moves: 14, goal: 4000, seed: 1006 },
    { name: '별무리 폭발', colors: 6, moves: 13, goal: 4600, seed: 1007 },
    { name: '마지막 한 수', colors: 6, moves: 12, goal: 5200, seed: 1008 }
  ];

  // 결정적 시드 RNG (mulberry32) — 같은 시드 = 같은 보드/리필 (데일리·베스트 비교용)
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ===========================================================================
  // VectorForge 아트 베이크 (네온 글로우 룬 + 컬러 코어)
  // ===========================================================================
  function drawSymbol(ctx, w, h, sym, VF) {
    var cx = w / 2, cy = h / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    switch (sym) {
      case 'star':     VF.star(ctx, cx, cy, w * 0.30, w * 0.13, 5, -Math.PI / 2); ctx.fill(); break;
      case 'diamond':  VF.poly(ctx, [[cx, cy - w * 0.30], [cx + w * 0.26, cy], [cx, cy + w * 0.30], [cx - w * 0.26, cy]]); ctx.fill(); break;
      case 'triangle': VF.poly(ctx, [[cx, cy - w * 0.28], [cx + w * 0.28, cy + w * 0.22], [cx - w * 0.28, cy + w * 0.22]]); ctx.fill(); break;
      case 'orb':      VF.circle(ctx, cx, cy, w * 0.24); ctx.fill(); break;
      case 'hex':      VF.star(ctx, cx, cy, w * 0.28, w * 0.28, 6, -Math.PI / 2); ctx.fill(); break;
      case 'crescent':
        ctx.save();
        VF.circle(ctx, cx, cy, w * 0.28); ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        VF.circle(ctx, cx + w * 0.14, cy - w * 0.06, w * 0.24); ctx.fill();
        ctx.restore();
        break;
    }
  }

  function bakeArt(scene) {
    var VF = VectorForge.helpers;
    RUNES.forEach(function (R, idx) {
      // 일반 룬
      VectorForge.bake(scene, 'rune-' + idx, { w: ENT, h: ENT, draw: function (ctx, w, h) {
        VF.glow(ctx, R.glow, 10, function () {
          VF.rr(ctx, w * 0.12, h * 0.12, w * 0.76, h * 0.76, w * 0.26);
          ctx.fillStyle = VF.lin(ctx, 0, h * 0.12, 0, h * 0.9, [[0, R.g[0]], [1, R.g[1]]]);
          ctx.fill();
        });
        // 안쪽 어두운 패싯 + 상단 하이라이트
        ctx.save(); VF.rr(ctx, w * 0.12, h * 0.12, w * 0.76, h * 0.76, w * 0.26); ctx.clip();
        ctx.fillStyle = VF.lin(ctx, 0, h * 0.12, 0, h * 0.6, [[0, 'rgba(255,255,255,0.32)'], [1, 'rgba(255,255,255,0)']]);
        ctx.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.4);
        ctx.restore();
        drawSymbol(ctx, w, h, R.sym, VF);
      } });
    });

    // 컬러 코어 — 무지개 펄스 오브 (색 무관 와일드)
    VectorForge.bake(scene, 'core', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      var cx = w / 2, cy = h / 2;
      VF.glow(ctx, 'rgba(255,255,255,0.95)', 16, function () {
        VF.circle(ctx, cx, cy, w * 0.34);
        var g = ctx.createConicGradient ? ctx.createConicGradient(0, cx, cy) : null;
        if (g) {
          ['#ff5f8a', '#ffd34a', '#5ff0a0', '#5fd0ff', '#8a8aff', '#c66bff', '#ff5f8a'].forEach(function (c, i, a) {
            g.addColorStop(i / (a.length - 1), c);
          });
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = VF.radial(ctx, cx, cy, w * 0.34, [[0, '#ffffff'], [1, '#8a8aff']]);
        }
        ctx.fill();
      });
      VF.circle(ctx, cx, cy, w * 0.14); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
    } });

    // 배경 성운 그라데이션
    VectorForge.gradientBackground(scene, 'space-bg', DESIGN_W, DESIGN_H, [
      [0, '#171339'], [0.45, '#0f0b2a'], [1, '#06051a']
    ]);
  }

  // ===========================================================================
  // Boot — 아트 베이크 후 Title
  // ===========================================================================
  var Boot = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Boot() { Phaser.Scene.call(this, { key: 'Boot' }); },
    create: function () {
      MobileHarness.installDomGuards();
      bakeArt(this);
      this.scene.start('Title');
    }
  });

  // 별 배경 그리기 (시드 고정 — 깜빡임 tween)
  function drawStarfield(scene) {
    scene.add.image(DESIGN_W / 2, DESIGN_H / 2, 'space-bg').setDepth(-10);
    var rng = mulberry32(777);
    for (var i = 0; i < 70; i++) {
      var x = rng() * DESIGN_W, y = rng() * DESIGN_H, r = 0.6 + rng() * 1.8;
      var s = scene.add.circle(x, y, r, 0xffffff, 0.4 + rng() * 0.5).setDepth(-9);
      scene.tweens.add({ targets: s, alpha: 0.15, duration: 900 + rng() * 1600, yoyo: true, repeat: -1, delay: rng() * 1500 });
    }
  }

  // ===========================================================================
  // Title — Tap to start (오디오 언락) + 모드 선택
  // ===========================================================================
  var Title = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Title() { Phaser.Scene.call(this, { key: 'Title' }); },
    create: function () {
      drawStarfield(this);
      var cx = DESIGN_W / 2;
      this.add.text(cx, DESIGN_H * 0.20, 'RUNEBURST', {
        fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '64px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setShadow(0, 0, '#8a6bff', 22, true, true);
      this.add.text(cx, DESIGN_H * 0.20 + 58, '별무리 매치 · 콤보를 쌓고 정산하라', {
        fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '22px', color: '#b9a9ff'
      }).setOrigin(0.5);

      // 데모 룬 한 줄
      for (var i = 0; i < 6; i++) {
        var s = this.add.image(cx - 6 * 30 + i * 60 + 30, DESIGN_H * 0.40, 'rune-' + i).setDisplaySize(52, 52);
        this.tweens.add({ targets: s, y: s.y - 8, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }

      var self = this;
      this.bigButton(cx, DESIGN_H * 0.56, 300, 72, '모험 시작', '#6ea0ff', function () {
        audio.unlock(); audio.startBgm();
        self.scene.start('Game', { mode: 'levels', level: loadProgress() });
      });
      this.bigButton(cx, DESIGN_H * 0.56 + 96, 300, 64, '오늘의 도전 (데일리)', '#c66bff', function () {
        audio.unlock(); audio.startBgm();
        self.scene.start('Game', { mode: 'daily' });
      });

      this.add.text(cx, DESIGN_H * 0.86,
        '인접한 룬을 스와이프해 같은 색 3개 이상을 맞추세요\n4매치=라인 블래스터 · 5매치=컬러 코어 · 정산으로 점수 확정',
        { fontFamily: 'Segoe UI, Arial', fontSize: '17px', color: '#8c7fc4', align: 'center', lineSpacing: 6 }
      ).setOrigin(0.5);

      // 첫 제스처 오디오 언락 (버튼을 안 눌러도 대비)
      this.input.once('pointerdown', function () { audio.unlock(); });
    },
    bigButton: function (x, y, w, h, label, hex, fn) {
      var col = Phaser.Display.Color.HexStringToColor(hex).color;
      var g = this.add.graphics();
      g.fillStyle(col, 0.22); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      g.lineStyle(2, col, 0.9); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      var t = this.add.text(x, y, label, { fontFamily: 'Segoe UI, Arial', fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      var zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
      var self = this;
      zone.on('pointerdown', function () { self.tweens.add({ targets: t, scale: 0.94, duration: 80, yoyo: true }); fn(); });
      this.tweens.add({ targets: g, alpha: 0.7, duration: 1100, yoyo: true, repeat: -1 });
      return zone;
    }
  });

  // ===========================================================================
  // Game — 보드/매치/콤보/HUD
  // ===========================================================================
  var Game = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Game() { Phaser.Scene.call(this, { key: 'Game' }); },

    init: function (data) {
      data = data || {};
      this.mode = data.mode || 'levels';
      if (this.mode === 'daily') {
        var d = new Date();
        this.dateKey = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        var seed = parseInt(this.dateKey.replace(/-/g, ''), 10);
        this.cfg = { name: '데일리 ' + this.dateKey, colors: 6, moves: 22, goal: 4500, seed: seed };
        this.levelIndex = -1;
      } else {
        this.levelIndex = Math.min(data.level || 0, LEVELS.length - 1);
        this.cfg = LEVELS[this.levelIndex];
      }
      this.rng = mulberry32(this.cfg.seed);
      this.movesLeft = this.cfg.moves;
      this.score = 0;        // 정산(확정)된 점수 — 목표 판정 기준
      this.pot = 0;          // 잠재 점수 (정산 전)
      this.streak = 0;       // 연속 득점 수 → 배율 = min(CAP, 1+streak)
      this.busy = false;
      this.over = false;
      this.board = [];
      this.spr = [];
      this.sel = null;       // 탭-탭 선택 셀
      this.t0 = 0;
    },

    create: function () {
      drawStarfield(this);
      this.initBoard();

      // 보드 배경 패널
      var g = this.add.graphics();
      g.fillStyle(0x1a1640, 0.55); g.fillRoundedRect(BOARD_X - 12, BOARD_Y - 12, BOARD_W + 24, TILE * ROWS + 24, 18);
      g.lineStyle(1.5, 0x8a6bff, 0.35); g.strokeRoundedRect(BOARD_X - 12, BOARD_Y - 12, BOARD_W + 24, TILE * ROWS + 24, 18);
      this.hotGlow = this.add.graphics().setDepth(5); // 과열 테두리

      this.renderInit();
      this.buildHUD();
      this.setupInput();
      this.updateHUD();

      // 디버그/검증 API
      var self = this;
      window.RUNEBURST = {
        scene: this,
        game: this.game,
        swipe: function (r, c, dir) { return self.inputSwipe(r, c, dir); },
        bank: function () { return self.bank(); },
        state: function () {
          return { mode: self.mode, level: self.levelIndex, moves: self.movesLeft,
                   score: self.score, pot: self.pot, mult: self.mult(), goal: self.cfg.goal,
                   over: self.over, busy: self.busy };
        },
        board: function () { return self.board.map(function (row) { return row.map(function (t) { return t ? t.color : -9; }); }); }
      };
    },

    mult: function () { return Math.min(MULT_CAP, 1 + this.streak); },

    // --- 보드 초기화 (초기 매치 없도록) -------------------------------------
    initBoard: function () {
      var n = this.cfg.colors;
      for (var r = 0; r < ROWS; r++) {
        this.board[r] = []; this.spr[r] = [];
        for (var c = 0; c < COLS; c++) {
          var col;
          var guard = 0;
          do {
            col = Math.floor(this.rng() * n);
            guard++;
          } while (guard < 30 && (
            (c >= 2 && this.board[r][c - 1] && this.board[r][c - 2] && this.board[r][c - 1].color === col && this.board[r][c - 2].color === col) ||
            (r >= 2 && this.board[r - 1][c] && this.board[r - 2][c] && this.board[r - 1][c].color === col && this.board[r - 2][c].color === col)
          ));
          this.board[r][c] = { color: col, special: SP_NONE };
          this.spr[r][c] = null;
        }
      }
    },

    cellX: function (c) { return BOARD_X + c * TILE + TILE / 2; },
    cellY: function (r) { return BOARD_Y + r * TILE + TILE / 2; },

    // --- 타일 컨테이너 생성 (룬 + 특수 오버레이) ----------------------------
    makeTile: function (r, c) {
      var t = this.board[r][c];
      if (!t) return null;
      var cont = this.add.container(this.cellX(c), this.cellY(r));
      var key = (t.special === SP_CORE) ? 'core' : 'rune-' + t.color;
      var img = this.add.image(0, 0, key).setDisplaySize(TILE * 0.92, TILE * 0.92);
      cont.add(img);
      if (t.special === SP_LINE_H || t.special === SP_LINE_V) {
        var bar = this.add.graphics();
        bar.fillStyle(0xffffff, 0.92);
        if (t.special === SP_LINE_H) bar.fillRoundedRect(-TILE * 0.42, -3, TILE * 0.84, 6, 3);
        else bar.fillRoundedRect(-3, -TILE * 0.42, 6, TILE * 0.84, 3);
        cont.add(bar);
      }
      if (t.special === SP_CORE) {
        this.tweens.add({ targets: cont, angle: 360, duration: 4000, repeat: -1 });
      }
      cont.setData('rc', r + ',' + c);
      cont.setSize(TILE, TILE);
      return cont;
    },

    renderInit: function () {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) this.spr[r][c] = this.makeTile(r, c);
    },

    // 특정 셀의 스프라이트를 보드 상태에 맞게 재생성
    refreshTile: function (r, c) {
      if (this.spr[r][c]) { this.spr[r][c].destroy(); this.spr[r][c] = null; }
      this.spr[r][c] = this.makeTile(r, c);
    },

    // ===========================================================================
    // 입력
    // ===========================================================================
    setupInput: function () {
      var self = this;
      this.input.on('pointerdown', function (p) {
        if (self.busy || self.over) return;
        var rc = self.cellAt(p.x, p.y);
        self._down = rc; self._dx = p.x; self._dy = p.y;
      });
      this.input.on('pointerup', function (p) {
        if (self.busy || self.over || !self._down) { self._down = null; return; }
        var from = self._down; self._down = null;
        var dx = p.x - self._dx, dy = p.y - self._dy, TH = 18;
        if (Math.abs(dx) > TH || Math.abs(dy) > TH) {
          // 스와이프 → 방향
          var dir = (Math.abs(dx) > Math.abs(dy)) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          self.clearSel();
          self.inputSwipe(from.r, from.c, dir);
        } else {
          // 탭 → 선택 / 두 번째 탭으로 인접 스왑
          self.tapCell(from.r, from.c);
        }
      });

      // 키보드(데스크톱 디버그): 화살표는 마지막 선택 셀 기준
      var kb = this.input.keyboard;
      function arrow(dir) { if (self.sel) self.inputSwipe(self.sel.r, self.sel.c, dir); }
      kb.on('keydown-LEFT', function () { arrow('left'); });
      kb.on('keydown-RIGHT', function () { arrow('right'); });
      kb.on('keydown-UP', function () { arrow('up'); });
      kb.on('keydown-DOWN', function () { arrow('down'); });
      kb.on('keydown-SPACE', function () { self.bank(); });
    },

    cellAt: function (x, y) {
      var c = Math.floor((x - BOARD_X) / TILE), r = Math.floor((y - BOARD_Y) / TILE);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      return { r: r, c: c };
    },

    tapCell: function (r, c) {
      if (this.sel && this.sel.r === r && this.sel.c === c) { this.clearSel(); return; }
      if (this.sel && Math.abs(this.sel.r - r) + Math.abs(this.sel.c - c) === 1) {
        var a = this.sel; this.clearSel();
        this.trySwap(a.r, a.c, r, c);
      } else {
        this.clearSel();
        this.sel = { r: r, c: c };
        if (this.spr[r][c]) this.selTween = this.tweens.add({ targets: this.spr[r][c], scale: 1.12, duration: 300, yoyo: true, repeat: -1 });
      }
    },
    clearSel: function () {
      if (this.selTween) { this.selTween.stop(); this.selTween = null; }
      if (this.sel && this.spr[this.sel.r] && this.spr[this.sel.r][this.sel.c]) this.spr[this.sel.r][this.sel.c].setScale(1);
      this.sel = null;
    },

    inputSwipe: function (r, c, dir) {
      var D = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
      if (!D) return false;
      var nr = r + D[0], nc = c + D[1];
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
      return this.trySwap(r, c, nr, nc);
    },

    // --- 스왑 시도 -----------------------------------------------------------
    trySwap: function (r1, c1, r2, c2) {
      if (this.busy || this.over) return false;
      if (!this.board[r1][c1] || !this.board[r2][c2]) return false;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
      this.busy = true;
      var self = this;

      // 모델 스왑
      this.swapCells(r1, c1, r2, c2);
      this.lastSwap = { r: r2, c: c2 };

      // 스프라이트 트윈
      this.animSwap(r1, c1, r2, c2, function () {
        var t1 = self.board[r1][c1], t2 = self.board[r2][c2];
        // 컬러 코어가 끼면 즉시 발동 (매치 불필요)
        if ((t1 && t1.special === SP_CORE) || (t2 && t2.special === SP_CORE)) {
          self.consumeMove();
          self.activateCoreSwap(r1, c1, r2, c2);
          return;
        }
        var info = self.findMatches();
        if (info.matched.size === 0) {
          // 무효 스왑 → 되돌림 (이동 소모 없음)
          self.swapCells(r1, c1, r2, c2);
          self.animSwap(r1, c1, r2, c2, function () { self.busy = false; });
          audio.tone({ freq: 170, to: 110, dur: 0.09, vol: 0.18, type: 'sine' });
          self.cameras.main.shake(80, 0.003);
        } else {
          self.consumeMove();
          self.cascadeDepth = 0;
          self.clearedThisMove = 0;
          self.resolveStep();
        }
      });
      return true;
    },

    swapCells: function (r1, c1, r2, c2) {
      var tb = this.board[r1][c1]; this.board[r1][c1] = this.board[r2][c2]; this.board[r2][c2] = tb;
      var ts = this.spr[r1][c1]; this.spr[r1][c1] = this.spr[r2][c2]; this.spr[r2][c2] = ts;
    },

    animSwap: function (r1, c1, r2, c2, done) {
      var a = this.spr[r1][c1], b = this.spr[r2][c2], n = 0;
      function fin() { if (++n >= 2 && done) done(); }
      if (a) this.tweens.add({ targets: a, x: this.cellX(c1), y: this.cellY(r1), duration: 130, ease: 'Quad.out', onComplete: fin }); else fin();
      if (b) this.tweens.add({ targets: b, x: this.cellX(c2), y: this.cellY(r2), duration: 130, ease: 'Quad.out', onComplete: fin }); else fin();
    },

    consumeMove: function () { this.movesLeft--; this.updateHUD(); },

    // ===========================================================================
    // 매치 탐색 / 특수 생성 / 캐스케이드
    // ===========================================================================
    findMatches: function () {
      var matched = new Set();
      var runs = [];
      var r, c, k;
      // 가로
      for (r = 0; r < ROWS; r++) {
        c = 0;
        while (c < COLS) {
          var t = this.board[r][c];
          if (!t || t.special === SP_CORE) { c++; continue; }
          k = c + 1;
          while (k < COLS && this.board[r][k] && this.board[r][k].special !== SP_CORE && this.board[r][k].color === t.color) k++;
          if (k - c >= 3) { var cellsH = []; for (var i = c; i < k; i++) { matched.add(r + ',' + i); cellsH.push([r, i]); } runs.push({ dir: 'h', cells: cellsH }); }
          c = k;
        }
      }
      // 세로
      for (c = 0; c < COLS; c++) {
        r = 0;
        while (r < ROWS) {
          var t2 = this.board[r][c];
          if (!t2 || t2.special === SP_CORE) { r++; continue; }
          k = r + 1;
          while (k < ROWS && this.board[k][c] && this.board[k][c].special !== SP_CORE && this.board[k][c].color === t2.color) k++;
          if (k - r >= 3) { var cellsV = []; for (var j = r; j < k; j++) { matched.add(j + ',' + c); cellsV.push([j, c]); } runs.push({ dir: 'v', cells: cellsV }); }
          r = k;
        }
      }
      return { matched: matched, runs: runs };
    },

    // 한 캐스케이드 단계 처리
    resolveStep: function () {
      var self = this;
      var info = this.findMatches();
      if (info.matched.size === 0) { this.afterMove(); return; }

      this.cascadeDepth++;
      var depth = this.cascadeDepth;

      // 특수 생성 결정 (런 길이 ≥4)
      var creates = [];      // {r,c,special,color}
      var createKeys = {};
      info.runs.forEach(function (run) {
        if (run.cells.length < 4) return;
        var pick = self.pickSpecialCell(run.cells);
        var color = self.board[pick[0]][pick[1]] ? self.board[pick[0]][pick[1]].color : 0;
        var sp = (run.cells.length >= 5) ? SP_CORE : (run.dir === 'h' ? SP_LINE_H : SP_LINE_V);
        var key = pick[0] + ',' + pick[1];
        // 코어 우선
        if (createKeys[key] != null) { if (sp === SP_CORE) { creates[createKeys[key]].special = SP_CORE; } return; }
        createKeys[key] = creates.length;
        creates.push({ r: pick[0], c: pick[1], special: sp, color: color });
      });

      // 소거 집합 = 매치 셀 - 생성 셀, + 라인 블래스터 연쇄 확장
      var clear = new Set(info.matched);
      creates.forEach(function (cr) { clear.delete(cr.r + ',' + cr.c); });
      this.expandSpecials(clear);

      // 점수: 칸당 10 × 캐스케이드 깊이
      var pts = clear.size * 10 * depth;
      this.pot += pts;
      this.clearedThisMove += clear.size;

      // 사운드: 캐스케이드 깊이로 음 높이 상승 (피치 스택)
      this.comboTone(depth);
      // 연출
      var shook = clear.size >= 7 || depth >= 3;
      if (shook) this.cameras.main.shake(140, Math.min(0.012, 0.004 + depth * 0.002));

      // 팝 애니메이션
      var sparkBudget = 6;
      clear.forEach(function (key) {
        var p = key.split(','), r = +p[0], c = +p[1];
        var sp = self.spr[r][c];
        if (sp) {
          self.tweens.add({ targets: sp, scale: 0, alpha: 0, angle: 90, duration: 130, ease: 'Back.in',
            onComplete: function () { sp.destroy(); } });
          self.spr[r][c] = null;
        }
        if (sparkBudget-- > 0 && self.board[r][c]) self.sparkle(self.cellX(c), self.cellY(r), self.board[r][c].color);
        self.board[r][c] = null; // 모델 소거
      });

      // 생성 특수 타일 반영
      creates.forEach(function (cr) {
        self.board[cr.r][cr.c] = { color: cr.color, special: cr.special };
        self.refreshTile(cr.r, cr.c);
        var sp = self.spr[cr.r][cr.c];
        if (sp) { sp.setScale(0.2); self.tweens.add({ targets: sp, scale: 1, duration: 200, ease: 'Back.out' }); }
        audio.sfx('powerup');
      });

      // 낙하 + 리필 후 다음 단계
      this.time.delayedCall(150, function () {
        var maxFall = self.applyGravityAndRefill();
        self.time.delayedCall(120 + maxFall * 26, function () { self.resolveStep(); });
      });
    },

    pickSpecialCell: function (cells) {
      // 마지막 스왑 위치가 런에 있으면 그곳, 아니면 가운데
      if (this.lastSwap) {
        for (var i = 0; i < cells.length; i++) if (cells[i][0] === this.lastSwap.r && cells[i][1] === this.lastSwap.c) return cells[i];
      }
      return cells[Math.floor(cells.length / 2)];
    },

    // 소거 집합에 라인 블래스터 행/열 연쇄 확장
    expandSpecials: function (clear) {
      var queue = [];
      clear.forEach(function (k) { queue.push(k); });
      while (queue.length) {
        var key = queue.pop();
        var p = key.split(','), r = +p[0], c = +p[1];
        var t = this.board[r][c];
        if (!t) continue;
        if (t.special === SP_LINE_H) {
          for (var cc = 0; cc < COLS; cc++) { var kk = r + ',' + cc; if (this.board[r][cc] && !clear.has(kk)) { clear.add(kk); queue.push(kk); } }
        } else if (t.special === SP_LINE_V) {
          for (var rr = 0; rr < ROWS; rr++) { var kk2 = rr + ',' + c; if (this.board[rr][c] && !clear.has(kk2)) { clear.add(kk2); queue.push(kk2); } }
        }
      }
    },

    // 컬러 코어가 스왑으로 발동 — 짝 타일의 색(또는 코어+코어=전체) 일괄 소거
    activateCoreSwap: function (r1, c1, r2, c2) {
      var self = this;
      var a = this.board[r1][c1], b = this.board[r2][c2];
      var clear = new Set();
      var targetColor = -1;
      if (a && a.special === SP_CORE && b && b.special === SP_CORE) {
        // 코어+코어 = 보드 전체
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (this.board[r][c]) clear.add(r + ',' + c);
      } else {
        var core = (a && a.special === SP_CORE) ? { r: r1, c: c1 } : { r: r2, c: c2 };
        var other = (core.r === r1 && core.c === c1) ? { r: r2, c: c2 } : { r: r1, c: c1 };
        var ot = this.board[other.r][other.c];
        targetColor = ot ? ot.color : -1;
        clear.add(core.r + ',' + core.c);
        for (var rr = 0; rr < ROWS; rr++) for (var cc = 0; cc < COLS; cc++) {
          var t = this.board[rr][cc];
          if (t && (t.color === targetColor || t.special === SP_CORE)) clear.add(rr + ',' + cc);
        }
      }
      this.expandSpecials(clear);

      this.cascadeDepth = 1;
      this.clearedThisMove = clear.size;
      this.pot += clear.size * 14;       // 코어는 보너스 가중
      this.comboTone(2);
      this.cameras.main.shake(220, 0.012);

      var spark = 8;
      clear.forEach(function (key) {
        var p = key.split(','), r = +p[0], c = +p[1];
        var sp = self.spr[r][c];
        if (sp) { self.tweens.add({ targets: sp, scale: 0, alpha: 0, duration: 160, ease: 'Back.in', onComplete: function () { sp.destroy(); } }); self.spr[r][c] = null; }
        if (spark-- > 0 && self.board[r][c]) self.sparkle(self.cellX(c), self.cellY(r), self.board[r][c].color < 0 ? 3 : self.board[r][c].color);
        self.board[r][c] = null;
      });

      this.time.delayedCall(180, function () {
        var maxFall = self.applyGravityAndRefill();
        self.time.delayedCall(140 + maxFall * 26, function () { self.resolveStep(); });
      });
    },

    // 중력 낙하 + 상단 리필. 최대 낙하 칸 수 반환(애니 타이밍용)
    applyGravityAndRefill: function () {
      var n = this.cfg.colors, maxFall = 0, self = this;
      for (var c = 0; c < COLS; c++) {
        // 아래에서 위로 채우기
        var write = ROWS - 1;
        for (var r = ROWS - 1; r >= 0; r--) {
          if (this.board[r][c]) {
            if (write !== r) {
              this.board[write][c] = this.board[r][c];
              this.board[r][c] = null;
              var sp = this.spr[r][c]; this.spr[write][c] = sp; this.spr[r][c] = null;
              if (sp) this.tweens.add({ targets: sp, y: this.cellY(write), duration: 90 + (write - r) * 26, ease: 'Quad.in' });
              if (write - r > maxFall) maxFall = write - r;
            }
            write--;
          }
        }
        // 남은 상단 = 새 타일 리필
        for (var w = write; w >= 0; w--) {
          var col = Math.floor(this.rng() * n);
          this.board[w][c] = { color: col, special: SP_NONE };
          var fall = (write - w) + 1;
          var cont = this.makeTile(w, c);
          this.spr[w][c] = cont;
          if (cont) {
            cont.y = this.cellY(w) - (write + 2) * TILE;
            this.tweens.add({ targets: cont, y: this.cellY(w), duration: 120 + fall * 30, ease: 'Quad.in' });
          }
          if (fall > maxFall) maxFall = fall;
        }
      }
      return maxFall;
    },

    // 한 수 마무리 — 콤보 streak/배율/BUST 판정
    afterMove: function () {
      var extra = Math.max(0, this.cascadeDepth - 1);
      var weak = (this.clearedThisMove <= 3 && this.cascadeDepth <= 1);

      if (this.streak >= HOT && weak) {
        // 과열 상태에서 약한 한 수 → 콤보 붕괴(BUST), pot 절반
        var lost = Math.floor(this.pot / 2);
        this.pot -= lost;
        this.streak = 0;
        this.flashCenter('콤보 붕괴!  -' + lost, '#ff5f7a');
        audio.sfx('die');
        this.cameras.main.shake(200, 0.01);
      } else {
        this.streak = Math.min(MULT_CAP - 1, this.streak + 1 + extra);
        if (extra >= 1) this.flashCenter('연쇄 ×' + this.cascadeDepth + '!', '#ffd34a');
      }

      this.updateHUD();
      this.checkEnd();
      if (!this.over) this.busy = false;
    },

    // 정산 — pot × 배율을 점수로 확정
    bank: function () {
      if (this.busy || this.over || this.pot <= 0) return false;
      var gain = Math.round(this.pot * this.mult());
      this.score += gain;
      this.pot = 0; this.streak = 0;
      this.flashCenter('정산 +' + gain, '#5ff0a0');
      audio.sfx('coin'); audio.sfx('1up');
      this.updateHUD();
      this.pulse(this.bankG);
      return true;
    },

    checkEnd: function () {
      if (this.movesLeft > 0) return;
      // 남은 잠재 점수 자동 정산
      if (this.pot > 0) { this.score += Math.round(this.pot * this.mult()); this.pot = 0; this.streak = 0; }
      this.updateHUD();
      this.over = true;
      this.time.delayedCall(400, this.showResult, [], this);
    },

    // ===========================================================================
    // 사운드 / 연출 헬퍼
    // ===========================================================================
    comboTone: function (depth) {
      // 캐스케이드 깊이마다 반음씩 상승하는 피치 스택
      var base = 523.25; // C5
      var freq = base * Math.pow(2, Math.min(18, depth - 1) / 12);
      audio.tone({ freq: freq, dur: 0.10, vol: 0.22, type: 'square' });
      audio.tone({ freq: freq * 1.5, dur: 0.08, vol: 0.10, type: 'triangle', delay: 0.02 });
    },

    sparkle: function (x, y, colorIdx) {
      var hex = Phaser.Display.Color.HexStringToColor(RUNES[colorIdx] ? RUNES[colorIdx].g[0] : '#ffffff').color;
      for (var i = 0; i < 4; i++) {
        var a = (i / 4) * Math.PI * 2 + this.rng() * 0.8;
        var d = 16 + this.rng() * 16;
        var dot = this.add.circle(x, y, 2 + this.rng() * 2, hex, 0.95).setDepth(20);
        this.tweens.add({ targets: dot, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2,
          duration: 320 + this.rng() * 160, ease: 'Quad.out', onComplete: function () { dot.destroy(); } });
      }
    },

    flashCenter: function (text, hex) {
      var t = this.add.text(DESIGN_W / 2, BOARD_Y + TILE * ROWS / 2, text, {
        fontFamily: 'Segoe UI, Arial', fontSize: '40px', color: hex, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(30).setShadow(0, 0, '#000000', 8, true, true);
      this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, scale: 1.3, duration: 800, ease: 'Quad.out', onComplete: function () { t.destroy(); } });
    },

    pulse: function (obj) { if (obj) this.tweens.add({ targets: obj, scale: 1.06, duration: 110, yoyo: true }); },

    // ===========================================================================
    // HUD
    // ===========================================================================
    buildHUD: function () {
      this.add.text(20, 18, (this.mode === 'daily' ? '데일리' : (this.levelIndex + 1) + ' / ' + LEVELS.length), {
        fontFamily: 'Segoe UI, Arial', fontSize: '18px', color: '#b9a9ff', fontStyle: 'bold' });
      this.add.text(DESIGN_W / 2, 24, this.cfg.name, {
        fontFamily: 'Segoe UI, Arial', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

      var mute = this.add.text(DESIGN_W - 18, 16, '♪', {
        fontFamily: 'monospace', fontSize: '24px', color: '#b9a9ff' }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      mute.on('pointerdown', function () { var m = audio.toggleMute(); mute.setText(m ? '♪̸' : '♪').setAlpha(m ? 0.5 : 1); });

      // 목표 진행 바
      this.goalBarBg = this.add.graphics();
      this.goalBarBg.fillStyle(0xffffff, 0.10); this.goalBarBg.fillRoundedRect(40, 64, DESIGN_W - 80, 20, 10);
      this.goalBarFill = this.add.graphics();
      this.goalText = this.add.text(DESIGN_W / 2, 74, '', {
        fontFamily: 'Segoe UI, Arial', fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

      // 이동 수 / 콤보 배율
      this.add.text(140, 116, '남은 이동', { fontFamily: 'Segoe UI, Arial', fontSize: '15px', color: '#9a8fd0' }).setOrigin(0.5);
      this.movesText = this.add.text(140, 150, '', { fontFamily: 'Segoe UI, Arial', fontSize: '42px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

      this.add.text(400, 116, '콤보 배율', { fontFamily: 'Segoe UI, Arial', fontSize: '15px', color: '#9a8fd0' }).setOrigin(0.5);
      this.multText = this.add.text(400, 150, '×1', { fontFamily: 'Segoe UI, Arial', fontSize: '42px', color: '#ffd34a', fontStyle: 'bold' }).setOrigin(0.5).setShadow(0, 0, '#ff9a3a', 12, true, true);

      this.scoreText = this.add.text(DESIGN_W / 2, 200, '', { fontFamily: 'Segoe UI, Arial', fontSize: '17px', color: '#b9a9ff' }).setOrigin(0.5);

      // 정산 버튼 (글로우)
      var by = BOARD_Y + TILE * ROWS + 48;
      this.bankG = this.add.container(DESIGN_W / 2, by);
      var bg = this.add.graphics();
      bg.fillStyle(0x2fd07a, 0.22); bg.fillRoundedRect(-180, -34, 360, 68, 16);
      bg.lineStyle(2.5, 0x5ff0a0, 0.95); bg.strokeRoundedRect(-180, -34, 360, 68, 16);
      this.bankG.add(bg);
      this.bankLabel = this.add.text(0, 0, '정산하기', { fontFamily: 'Segoe UI, Arial', fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      this.bankG.add(this.bankLabel);
      var zone = this.add.zone(DESIGN_W / 2, by, 360, 68).setInteractive({ useHandCursor: true });
      var self = this;
      zone.on('pointerdown', function () { self.bank(); });

      this.hintText = this.add.text(DESIGN_W / 2, by + 64, '인접 룬을 스와이프 · 정산으로 점수 확정', {
        fontFamily: 'Segoe UI, Arial', fontSize: '15px', color: '#7c70b8', align: 'center' }).setOrigin(0.5);
    },

    updateHUD: function () {
      this.movesText.setText(String(Math.max(0, this.movesLeft)));
      this.multText.setText('×' + this.mult());
      this._shownScore = this.score;
      this.scoreText.setText('점수 ' + this.score + '   ·   잠재 ' + this.pot + (this.getBest() != null ? '   ·   베스트 ' + this.getBest() : ''));

      // 목표 바
      var ratio = Math.max(0, Math.min(1, this.score / this.cfg.goal));
      this.goalBarFill.clear();
      var col = ratio >= 1 ? 0x5ff0a0 : 0x8a6bff;
      this.goalBarFill.fillStyle(col, 0.95);
      this.goalBarFill.fillRoundedRect(40, 64, Math.max(2, (DESIGN_W - 80) * ratio), 20, 10);
      this.goalText.setText('목표 ' + this.cfg.goal + (ratio >= 1 ? '  달성!' : ''));

      // 정산 버튼 라벨 + 과열 표시
      if (this.bankLabel) {
        if (this.pot > 0) this.bankLabel.setText('정산  +' + Math.round(this.pot * this.mult()));
        else this.bankLabel.setText('정산하기');
      }
      this.renderHot();
    },

    renderHot: function () {
      if (!this.hotGlow) return;
      this.hotGlow.clear();
      var hot = this.streak >= HOT;
      if (hot) {
        this.hotGlow.lineStyle(4, 0xff5f7a, 0.85);
        this.hotGlow.strokeRoundedRect(BOARD_X - 14, BOARD_Y - 14, BOARD_W + 28, TILE * ROWS + 28, 20);
        if (!this._hotTween) {
          this._hotTween = this.tweens.add({ targets: this.hotGlow, alpha: 0.3, duration: 360, yoyo: true, repeat: -1 });
          this.hintText.setText('🔥 과열! 정산하거나 큰 수를 노리세요');
          this.hintText.setColor('#ff8a9a');
        }
      } else {
        this.hotGlow.alpha = 1;
        if (this._hotTween) { this._hotTween.stop(); this._hotTween = null; this.hotGlow.alpha = 1;
          this.hintText.setText('인접 룬을 스와이프 · 정산으로 점수 확정'); this.hintText.setColor('#7c70b8'); }
      }
    },

    // --- 베스트 / 진행 저장 -------------------------------------------------
    bestKey: function () { return this.mode === 'daily' ? 'rb-daily-' + this.dateKey : 'rb-best-' + this.levelIndex; },
    getBest: function () { try { var v = localStorage.getItem(this.bestKey()); return v == null ? null : parseInt(v, 10); } catch (e) { return null; } },
    setBest: function (s) { try { var b = this.getBest(); if (b == null || s > b) localStorage.setItem(this.bestKey(), String(s)); } catch (e) { } },

    starsFor: function (score, goal) { return score >= goal * 2.2 ? 3 : (score >= goal * 1.5 ? 2 : (score >= goal ? 1 : 0)); },

    // ===========================================================================
    // 결과 오버레이
    // ===========================================================================
    showResult: function () {
      this.setBest(this.score);
      var win = this.score >= this.cfg.goal;
      var stars = this.starsFor(this.score, this.cfg.goal);
      if (win && this.mode === 'levels' && this.levelIndex >= loadProgress()) saveProgress(this.levelIndex + 1);
      audio.sfx(win ? 'flag' : 'die');

      var cx = DESIGN_W / 2;
      this.add.graphics().fillStyle(0x05041a, 0.72).fillRect(0, 0, DESIGN_W, DESIGN_H).setDepth(40);
      var panel = this.add.graphics().setDepth(41);
      panel.fillStyle(0x1a1640, 0.98); panel.fillRoundedRect(cx - 210, DESIGN_H * 0.28, 420, 360, 24);
      panel.lineStyle(2, 0x8a6bff, 0.8); panel.strokeRoundedRect(cx - 210, DESIGN_H * 0.28, 420, 360, 24);

      this.add.text(cx, DESIGN_H * 0.28 + 54, win ? '클리어!' : '아쉬워요', {
        fontFamily: 'Segoe UI, Arial', fontSize: '44px', color: win ? '#5ff0a0' : '#ff8a9a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(42);

      var starStr = '';
      for (var i = 0; i < 3; i++) starStr += (i < stars ? '★' : '☆');
      this.add.text(cx, DESIGN_H * 0.28 + 122, starStr, { fontFamily: 'Arial', fontSize: '56px', color: '#ffd34a' }).setOrigin(0.5).setDepth(42);

      this.add.text(cx, DESIGN_H * 0.28 + 180, '점수 ' + this.score + '  /  목표 ' + this.cfg.goal, {
        fontFamily: 'Segoe UI, Arial', fontSize: '20px', color: '#cdbfff' }).setOrigin(0.5).setDepth(42);
      var best = this.getBest();
      this.add.text(cx, DESIGN_H * 0.28 + 210, '베스트 ' + (best != null ? best : this.score), {
        fontFamily: 'Segoe UI, Arial', fontSize: '16px', color: '#9a8fd0' }).setOrigin(0.5).setDepth(42);

      var self = this;
      if (this.mode === 'daily') {
        this.resultButton(cx, DESIGN_H * 0.28 + 262, 360, 56, 0xc66bff, function () { self.copyShare(stars); }, '결과 복사 (공유)');
        this.resultButton(cx, DESIGN_H * 0.28 + 326, 360, 52, 0x6ea0ff, function () { self.scene.start('Title'); }, '타이틀로');
      } else {
        var last = this.levelIndex >= LEVELS.length - 1;
        if (win && !last) {
          this.resultButton(cx, DESIGN_H * 0.28 + 268, 360, 60, 0x2fd07a, function () { self.scene.start('Game', { mode: 'levels', level: self.levelIndex + 1 }); }, '다음 레벨 →');
        } else if (win && last) {
          this.resultButton(cx, DESIGN_H * 0.28 + 268, 360, 60, 0x2fd07a, function () { self.scene.start('Title'); }, '🎉 전부 클리어! 타이틀로');
        } else {
          this.resultButton(cx, DESIGN_H * 0.28 + 268, 360, 60, 0x6ea0ff, function () { self.scene.start('Game', { mode: 'levels', level: self.levelIndex }); }, '다시 도전');
        }
        this.resultButton(cx, DESIGN_H * 0.28 + 332, 360, 48, 0x5a5288, function () { self.scene.start('Title'); }, '타이틀로');
      }
    },

    copyShare: function (stars) {
      var starStr = '';
      for (var i = 0; i < 3; i++) starStr += (i < stars ? '⭐' : '▫️');
      var text = 'Runeburst 데일리 ' + this.dateKey + '\n' + starStr + '  점수 ' + this.score + '\n#runeburst';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
      } catch (e) { }
      this.flashCenter('복사됨!', '#5ff0a0');
    }
  });

  // 결과 버튼 라벨을 깔끔히 처리하기 위해 resultButton 재정의 (라벨 포함)
  Game.prototype.resultButton = function (x, y, w, h, col, fn, label) {
    var g = this.add.graphics().setDepth(42);
    g.fillStyle(col, 0.25); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    g.lineStyle(2, col, 0.9); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    var hexStr = '#' + ('000000' + col.toString(16)).slice(-6);
    this.add.text(x, y, label || '', { fontFamily: 'Segoe UI, Arial', fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(43);
    var zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    var self = this;
    zone.on('pointerdown', function () { fn(); });
    return g;
  };

  // ===========================================================================
  // 진행/유틸
  // ===========================================================================
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function loadProgress() { try { var v = localStorage.getItem('rb-progress'); return v == null ? 0 : Math.min(LEVELS.length - 1, parseInt(v, 10)); } catch (e) { return 0; } }
  function saveProgress(i) { try { localStorage.setItem('rb-progress', String(Math.min(LEVELS.length - 1, i))); } catch (e) { } }

  // ===========================================================================
  window.__GAME = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#07061a',
    render: { pixelArt: false, antialias: true, roundPixels: false },
    scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)),
    scene: [Boot, Title, Game]
  });
})();
