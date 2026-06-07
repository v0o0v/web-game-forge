/* ============================================================================
 * IS — 규칙을 다시 쓰는 퍼즐 (web-game-builder 데모)
 * ----------------------------------------------------------------------------
 * 코어: 규칙조작(Baba Is You류) — 단어블록 'NOUN IS PROPERTY'를 밀어 규칙을 다시 쓴다.
 * 재미: 규칙 발견(RULE-DISCOVERY) + 통찰(AHA) + 창발(EMERGENCE). undo 무제한(가설검증).
 * 엔진: Phaser 4.1.0 + VectorForge(미니멀 플랫 파스텔) + ChipAudio(미니멀 SFX) + MobileHarness.
 * 규칙 속성(소수 깊게): YOU / WIN / PUSH / STOP / SINK + 정체성 변환(NOUN IS NOUN).
 * IP 안전: 'Baba Is You' 이름·스프라이트·레벨 미사용 — 메카닉만 차용, 전부 절차생성 오리지널.
 * ==========================================================================*/
(function () {
  'use strict';

  var DESIGN_W = 540, DESIGN_H = 960;
  var ENT = 64; // 베이크 논리 크기

  // 전역 오디오 (MobileHarness 음소거/가시성 가드가 참조)
  var audio = new ChipAudio();
  window.GAME_AUDIO = audio;

  // --- 어휘 ----------------------------------------------------------------
  var NOUNS = ['BLOB', 'ROCK', 'WALL', 'FLAG', 'WATER'];
  var PROPS = ['YOU', 'WIN', 'PUSH', 'STOP', 'SINK'];
  function wordCat(w) {
    if (w === 'IS') return 'verb';
    if (NOUNS.indexOf(w) >= 0) return 'noun';
    if (PROPS.indexOf(w) >= 0) return 'prop';
    return 'noun';
  }

  // 엔티티/단어 색 (파스텔)
  var ENT_COL = {
    BLOB: ['#c9a4f5', '#a878e6'], ROCK: ['#e6c089', '#cf9a52'],
    WALL: ['#9aa3ba', '#737d98'], FLAG: ['#ffdf7a', '#f0c23a'],
    WATER: ['#9bd2f0', '#5fa9dc']
  };
  var WORD_COL = {
    BLOB: 0xb98cf0, ROCK: 0xd8a86a, WALL: 0x7f88a0, FLAG: 0xf0c23a, WATER: 0x6fb9e6,
    IS: 0xb3aac6, YOU: 0xec6fa6, WIN: 0xefb93a, PUSH: 0xe0954f, STOP: 0x6f7da0, SINK: 0x5aa6da
  };

  // ===========================================================================
  // 레벨 데이터 — ent: 각 행 문자열(.공백 #벽 r바위 b블롭 f깃발 w물), texts:[[r,c,'WORD']]
  // 한 규칙씩 가르치는 학습 곡선(12레벨). 전부 손검증된 풀이 존재.
  // ===========================================================================
  var LEVELS = [
    // 1) 이동 + 승리
    { name: '첫 걸음', par: 6, cols: 9, rows: 7,
      ent: ['.........', '.........', '.........', '.b.....f.', '.........', '.........', '.........'],
      texts: [[1, 1, 'BLOB'], [1, 2, 'IS'], [1, 3, 'YOU'], [1, 5, 'FLAG'], [1, 6, 'IS'], [1, 7, 'WIN']] },

    // 2) STOP — 벽은 막는다 (돌아가기)
    { name: '벽은 막는다', par: 16, cols: 9, rows: 9,
      ent: ['.........', '....#....', '....#....', '....#....', '.b..#..f.', '....#....', '....#....', '....#....', '....#....'],
      texts: [[6, 1, 'BLOB'], [7, 1, 'IS'], [8, 1, 'YOU'], [6, 7, 'FLAG'], [7, 7, 'IS'], [8, 7, 'WIN'], [6, 3, 'WALL'], [7, 3, 'IS'], [8, 3, 'STOP']] },

    // 3) PUSH — 바위를 밀어 길을 연다
    { name: '밀어내기', par: 8, cols: 9, rows: 7,
      ent: ['.........', '.........', '#########', '.b.r...f.', '#########', '.........', '.........'],
      texts: [[0, 1, 'BLOB'], [0, 2, 'IS'], [0, 3, 'YOU'], [0, 5, 'FLAG'], [0, 6, 'IS'], [0, 7, 'WIN'], [6, 1, 'ROCK'], [6, 2, 'IS'], [6, 3, 'PUSH'], [6, 5, 'WALL'], [6, 6, 'IS'], [6, 7, 'STOP']] },

    // 4) 규칙 끊기 — WALL IS STOP 를 깨고 통과
    { name: '규칙을 끊다', par: 12, cols: 9, rows: 7,
      ent: ['....#....', '....#....', '....#....', '.b..#..f.', '....#....', '....#....', '....#....'],
      texts: [[0, 0, 'BLOB'], [0, 1, 'IS'], [0, 2, 'YOU'], [0, 6, 'FLAG'], [0, 7, 'IS'], [0, 8, 'WIN'], [5, 0, 'WALL'], [5, 1, 'IS'], [5, 2, 'STOP']] },

    // 5) 규칙 짓기 — WIN 단어를 밀어 FLAG IS WIN 완성
    { name: '규칙을 짓다', par: 18, cols: 9, rows: 8,
      ent: ['.........', '.........', '.........', '.b.....f.', '.........', '.........', '.........', '.........'],
      texts: [[1, 1, 'BLOB'], [1, 2, 'IS'], [1, 3, 'YOU'], [6, 3, 'FLAG'], [6, 4, 'IS'], [6, 7, 'WIN']] },

    // 6) YOU 바꾸기 — ROCK IS YOU 로 바위를 조종해 깃발에
    { name: '내가 바뀐다', par: 8, cols: 9, rows: 8,
      ent: ['....#....', '....#....', '....#....', '.b..#.rf.', '....#....', '....#....', '....#....', '....#....'],
      texts: [[0, 1, 'BLOB'], [0, 2, 'IS'], [0, 3, 'YOU'], [5, 1, 'ROCK'], [5, 2, 'IS'], [4, 3, 'YOU'], [0, 5, 'FLAG'], [0, 6, 'IS'], [0, 7, 'WIN'], [6, 5, 'WALL'], [6, 6, 'IS'], [6, 7, 'STOP']] },

    // 7) 무엇이든 목표로 — ROCK IS WIN 만들어 바위에 닿기
    { name: '돌이 목표로', par: 8, cols: 9, rows: 8,
      ent: ['......#..', '......#..', '......#..', '.b..r.#f.', '......#..', '......#..', '......#..', '......#..'],
      texts: [[0, 1, 'BLOB'], [0, 2, 'IS'], [0, 3, 'YOU'], [5, 1, 'ROCK'], [5, 2, 'IS'], [4, 3, 'WIN'], [0, 7, 'FLAG'], [1, 7, 'IS'], [2, 7, 'WIN'], [5, 7, 'WALL'], [6, 7, 'IS'], [7, 7, 'STOP']] },

    // 8) SINK — 바위를 물에 밀어넣어 길을 메운다
    { name: '물은 삼킨다', par: 10, cols: 9, rows: 8,
      ent: ['.........', '.........', '#########', '.b.r.w.f.', '#########', '.........', '.........', '.........'],
      texts: [[0, 1, 'BLOB'], [0, 2, 'IS'], [0, 3, 'YOU'], [0, 5, 'FLAG'], [0, 6, 'IS'], [0, 7, 'WIN'], [5, 1, 'ROCK'], [5, 2, 'IS'], [5, 3, 'PUSH'], [6, 1, 'WATER'], [6, 2, 'IS'], [6, 3, 'SINK'], [7, 1, 'WALL'], [7, 2, 'IS'], [7, 3, 'STOP']] },

    // 9) SINK 응용 — 먼 바위를 밀어 메우기 (선계획)
    { name: '돌로 메우기', par: 12, cols: 9, rows: 9,
      ent: ['.........', '.........', '#########', '.b.r..w.f', '#########', '.........', '.........', '.........', '.........'],
      texts: [[0, 1, 'BLOB'], [0, 2, 'IS'], [0, 3, 'YOU'], [0, 5, 'FLAG'], [0, 6, 'IS'], [0, 7, 'WIN'], [6, 1, 'ROCK'], [6, 2, 'IS'], [6, 3, 'PUSH'], [7, 1, 'WATER'], [7, 2, 'IS'], [7, 3, 'SINK'], [6, 5, 'WALL'], [6, 6, 'IS'], [6, 7, 'STOP']] },

    // 10) YOU IS WIN 메타 — 나 자신을 승리로
    { name: '나는 곧 목표', par: 12, cols: 9, rows: 8,
      ent: ['.........', '.........', '.........', '.b.......', '.........', '.........', '.........', '.........'],
      texts: [[0, 1, 'BLOB'], [0, 2, 'IS'], [0, 3, 'YOU'], [6, 2, 'BLOB'], [6, 3, 'IS'], [6, 5, 'WIN']] },

    // 11) 복합 — 밀기 + 물 메우기 + 벽 (긴 통로)
    { name: '뒤엉킨 규칙', par: 18, cols: 11, rows: 9,
      ent: ['...........', '...........', '###########', '.b..r..w.f.', '###########', '...........', '...........', '...........', '...........'],
      texts: [[0, 1, 'BLOB'], [0, 2, 'IS'], [0, 3, 'YOU'], [0, 7, 'FLAG'], [0, 8, 'IS'], [0, 9, 'WIN'], [6, 1, 'ROCK'], [6, 2, 'IS'], [6, 3, 'PUSH'], [7, 1, 'WATER'], [7, 2, 'IS'], [7, 3, 'SINK'], [6, 7, 'WALL'], [6, 8, 'IS'], [6, 9, 'STOP']] },

    // 12) 캡스톤 — 넓은 통로에서 바위를 밀어 깃발로
    { name: '마지막 한 수', par: 18, cols: 11, rows: 10,
      ent: ['...........', '...........', '#####.#####', '.b...r...f.', '#####.#####', '.....w.....', '...........', '...........', '...........', '...........'],
      texts: [[0, 1, 'BLOB'], [0, 2, 'IS'], [0, 3, 'YOU'], [0, 7, 'FLAG'], [0, 8, 'IS'], [0, 9, 'WIN'], [6, 1, 'ROCK'], [6, 2, 'IS'], [6, 3, 'PUSH'], [6, 5, 'WATER'], [6, 6, 'IS'], [6, 7, 'SINK'], [7, 1, 'WALL'], [7, 2, 'IS'], [7, 3, 'STOP']] }
  ];

  // ===========================================================================
  // VectorForge 아트 베이크 (미니멀 플랫 파스텔)
  // ===========================================================================
  function bakeArt(scene) {
    var VF = VectorForge.helpers;
    function shadow(ctx, fn) { VF.shadow(ctx, { blur: 5, y: 3, color: 'rgba(70,55,100,0.22)' }, fn); }
    function body(ctx, w, h, name) {
      shadow(ctx, function () {
        VF.rr(ctx, w * 0.12, h * 0.14, w * 0.76, h * 0.76, w * 0.22);
        ctx.fillStyle = VF.lin(ctx, 0, h * 0.14, 0, h * 0.9, [[0, ENT_COL[name][0]], [1, ENT_COL[name][1]]]);
        ctx.fill();
      });
    }

    VectorForge.bake(scene, 'e-BLOB', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      body(ctx, w, h, 'BLOB');
      VF.ellipse(ctx, w / 2, h * 0.64, w * 0.2, h * 0.2); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
      [[-1, 0], [1, 0]].forEach(function (e) {
        var ex = w / 2 + e[0] * w * 0.16, ey = h * 0.46;
        VF.circle(ctx, ex, ey, w * 0.095); ctx.fillStyle = '#fff'; ctx.fill();
        VF.circle(ctx, ex + w * 0.02, ey + h * 0.012, w * 0.045); ctx.fillStyle = '#3a2b52'; ctx.fill();
      });
      ctx.beginPath(); ctx.arc(w / 2, h * 0.58, w * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.lineWidth = w * 0.03; ctx.strokeStyle = '#5b3f86'; ctx.stroke();
    } });

    VectorForge.bake(scene, 'e-ROCK', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      body(ctx, w, h, 'ROCK');
      VF.ellipse(ctx, w * 0.4, h * 0.42, w * 0.16, h * 0.12); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
      ctx.lineWidth = w * 0.03; ctx.strokeStyle = 'rgba(120,80,30,0.3)';
      ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.62); ctx.lineTo(w * 0.5, h * 0.6); ctx.lineTo(w * 0.68, h * 0.66); ctx.stroke();
    } });

    VectorForge.bake(scene, 'e-WALL', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      shadow(ctx, function () {
        VF.rr(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.84, w * 0.12);
        ctx.fillStyle = VF.lin(ctx, 0, 0, 0, h, [[0, ENT_COL.WALL[0]], [1, ENT_COL.WALL[1]]]); ctx.fill();
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = w * 0.025;
      ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.5); ctx.lineTo(w * 0.9, h * 0.5);
      ctx.moveTo(w * 0.5, h * 0.1); ctx.lineTo(w * 0.5, h * 0.5);
      ctx.moveTo(w * 0.3, h * 0.5); ctx.lineTo(w * 0.3, h * 0.9);
      ctx.moveTo(w * 0.7, h * 0.5); ctx.lineTo(w * 0.7, h * 0.9); ctx.stroke();
    } });

    VectorForge.bake(scene, 'e-FLAG', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      shadow(ctx, function () {
        ctx.lineWidth = w * 0.06; ctx.strokeStyle = '#b98a1e'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.18); ctx.lineTo(w * 0.3, h * 0.84); ctx.stroke();
        VF.poly(ctx, [[w * 0.3, h * 0.2], [w * 0.82, h * 0.34], [w * 0.3, h * 0.5]]);
        ctx.fillStyle = VF.lin(ctx, w * 0.3, 0, w * 0.82, 0, [[0, ENT_COL.FLAG[0]], [1, ENT_COL.FLAG[1]]]); ctx.fill();
      });
      VF.star(ctx, w * 0.46, h * 0.34, w * 0.07, w * 0.03, 5, -Math.PI / 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    } });

    VectorForge.bake(scene, 'e-WATER', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      VF.rr(ctx, w * 0.08, h * 0.12, w * 0.84, h * 0.78, w * 0.16);
      ctx.fillStyle = VF.lin(ctx, 0, 0, 0, h, [[0, ENT_COL.WATER[0]], [1, ENT_COL.WATER[1]]]); ctx.fill();
      ctx.save(); VF.rr(ctx, w * 0.08, h * 0.12, w * 0.84, h * 0.78, w * 0.16); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = w * 0.035;
      for (var i = 0; i < 3; i++) {
        var yy = h * (0.36 + i * 0.2);
        ctx.beginPath();
        for (var x = 0; x <= w; x += 4) ctx.lineTo(x, yy + Math.sin((x / w) * Math.PI * 3) * h * 0.04);
        ctx.stroke();
      }
      ctx.restore();
    } });
  }

  // ===========================================================================
  // 규칙 엔진 (순수 — board 2D 스택 배열에서 동작)
  // ===========================================================================
  function firstText(cell) {
    for (var i = 0; i < cell.length; i++) if (cell[i].t === 't') return cell[i];
    return null;
  }
  function parseRules(board, rows, cols) {
    var props = {}; var transforms = []; var active = {};
    function add(name, p) { (props[name] = props[name] || {})[p] = true; }
    function consider(a, b, cc, coords) {
      if (!a || !b || !cc) return;
      if (a.cat === 'noun' && b.w === 'IS' && (cc.cat === 'prop' || cc.cat === 'noun')) {
        if (cc.cat === 'prop') add(a.w, cc.w); else transforms.push([a.w, cc.w]);
        coords.forEach(function (k) { active[k] = true; });
      }
    }
    var r, c;
    for (r = 0; r < rows; r++) for (c = 0; c <= cols - 3; c++)
      consider(firstText(board[r][c]), firstText(board[r][c + 1]), firstText(board[r][c + 2]),
        [r + ',' + c, r + ',' + (c + 1), r + ',' + (c + 2)]);
    for (c = 0; c < cols; c++) for (r = 0; r <= rows - 3; r++)
      consider(firstText(board[r][c]), firstText(board[r + 1][c]), firstText(board[r + 2][c]),
        [r + ',' + c, (r + 1) + ',' + c, (r + 2) + ',' + c]);
    return { props: props, transforms: transforms, active: active };
  }

  // ===========================================================================
  // Boot — 아트 베이크 후 Title 로
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

  // ===========================================================================
  // Title — Tap to start (오디오 언락)
  // ===========================================================================
  var Title = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Title() { Phaser.Scene.call(this, { key: 'Title' }); },
    create: function () {
      var cx = DESIGN_W / 2;
      this.add.text(cx, DESIGN_H * 0.28, 'IS', {
        fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '120px', color: '#7a5fb0', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(cx, DESIGN_H * 0.28 + 96, '규칙을 다시 쓰는 퍼즐', {
        fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '26px', color: '#9a86c0'
      }).setOrigin(0.5);
      this.drawDemoSentence(cx, DESIGN_H * 0.5);
      var hint = this.add.text(cx, DESIGN_H * 0.72, '탭하여 시작', {
        fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '30px', color: '#7a5fb0', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.tweens.add({ targets: hint, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
      this.add.text(cx, DESIGN_H * 0.88, '단어블록을 밀어 규칙을 바꾸세요\n← → ↑ ↓ / 스와이프 · Z 되돌리기 · R 재시작', {
        fontFamily: 'Segoe UI, Arial', fontSize: '18px', color: '#a99bc4', align: 'center'
      }).setOrigin(0.5);

      var self = this;
      function go() { audio.unlock(); self.scene.start('Game', { level: 0 }); }
      this.input.once('pointerdown', go);
      this.input.keyboard.once('keydown', go);
    },
    drawDemoSentence: function (cx, y) {
      var words = ['BLOB', 'IS', 'YOU'];
      var s = 64, gap = 8, total = words.length * s + (words.length - 1) * gap;
      var x0 = cx - total / 2;
      for (var i = 0; i < words.length; i++) {
        var x = x0 + i * (s + gap) + s / 2;
        var g = this.add.graphics();
        g.fillStyle(WORD_COL[words[i]], 1); g.fillRoundedRect(x - s / 2, y - s / 2, s, s, s * 0.18);
        this.add.text(x, y, words[i], { fontFamily: 'Segoe UI, Arial', fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      }
    }
  });

  // ===========================================================================
  // Game — 보드/규칙/입력/HUD
  // ===========================================================================
  var Game = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Game() { Phaser.Scene.call(this, { key: 'Game' }); },

    init: function (data) {
      this.levelIndex = (data && data.level) || 0;
      this.moves = 0;
      this.won = false;
      this.undoStack = [];
      this.tiles = [];
      this.prevActiveCount = 0;
    },

    create: function () {
      var L = LEVELS[this.levelIndex];
      this.rows = L.rows; this.cols = L.cols;
      this.loadLevel(L);

      var areaX = 20, areaY = 132, areaW = DESIGN_W - 40, areaH = 700;
      this.TILE = Math.floor(Math.min(areaW / this.cols, areaH / this.rows));
      this.boardW = this.TILE * this.cols; this.boardH = this.TILE * this.rows;
      this.boardX = (DESIGN_W - this.boardW) / 2;
      this.boardY = areaY + (areaH - this.boardH) / 2;

      var g = this.add.graphics();
      g.fillStyle(0xffffff, 0.45);
      g.fillRoundedRect(this.boardX - 10, this.boardY - 10, this.boardW + 20, this.boardH + 20, 16);
      g.lineStyle(1, 0x8f7fb5, 0.12);
      for (var i = 0; i <= this.cols; i++) g.lineBetween(this.boardX + i * this.TILE, this.boardY, this.boardX + i * this.TILE, this.boardY + this.boardH);
      for (var j = 0; j <= this.rows; j++) g.lineBetween(this.boardX, this.boardY + j * this.TILE, this.boardX + this.boardW, this.boardY + j * this.TILE);

      this.rules = parseRules(this.board, this.rows, this.cols);
      this.prevActiveCount = Object.keys(this.rules.active).length;
      this.buildHUD();
      this.renderBoard();
      this.setupInput();

      // 디버그/검증 API
      var self = this;
      window.IS = {
        scene: this,
        move: function (d) { return self.tryInputDir(d); },
        undo: function () { return self.undo(); },
        restart: function () { self.scene.start('Game', { level: self.levelIndex }); },
        state: function () { return { level: self.levelIndex, name: LEVELS[self.levelIndex].name, moves: self.moves, won: self.won, rules: self.rules.props }; }
      };
    },

    loadLevel: function (L) {
      var ENTMAP = { '#': 'WALL', 'r': 'ROCK', 'b': 'BLOB', 'f': 'FLAG', 'w': 'WATER' };
      this.board = [];
      for (var r = 0; r < this.rows; r++) {
        var row = [];
        for (var c = 0; c < this.cols; c++) row.push([]);
        this.board.push(row);
      }
      for (var rr = 0; rr < this.rows; rr++) {
        var line = L.ent[rr] || '';
        for (var cc = 0; cc < this.cols; cc++) {
          var ch = line[cc] || '.';
          if (ENTMAP[ch]) this.board[rr][cc].push({ t: 'e', name: ENTMAP[ch] });
        }
      }
      (L.texts || []).forEach(function (t) {
        this.board[t[0]][t[1]].push({ t: 't', w: t[2], cat: wordCat(t[2]) });
      }, this);
    },

    // --- 규칙 질의 헬퍼 ---
    hasProp: function (name, p) { return !!(this.rules.props[name] && this.rules.props[name][p]); },
    isYou: function (o) { return o.t === 'e' && this.hasProp(o.name, 'YOU'); },
    isWinE: function (o) { return o.t === 'e' && this.hasProp(o.name, 'WIN'); },
    isStop: function (o) { return o.t === 'e' && this.hasProp(o.name, 'STOP'); },
    isPush: function (o) { return o.t === 't' ? true : this.hasProp(o.name, 'PUSH'); },
    isSink: function (o) { return o.t === 'e' && this.hasProp(o.name, 'SINK'); },

    findObj: function (obj) {
      for (var r = 0; r < this.rows; r++) for (var c = 0; c < this.cols; c++)
        if (this.board[r][c].indexOf(obj) >= 0) return { r: r, c: c };
      return null;
    },
    removeObj: function (r, c, obj) {
      var i = this.board[r][c].indexOf(obj);
      if (i >= 0) this.board[r][c].splice(i, 1);
    },

    // 한 칸 이동(밀기 캐스케이드). 성공 시 true.
    tryMove: function (obj, r, c, dr, dc) {
      var nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) return false;
      var occ = this.board[nr][nc];
      var k;
      for (k = 0; k < occ.length; k++) if (this.isStop(occ[k]) && !this.isPush(occ[k])) return false;
      var pushables = occ.filter(this.isPush, this);
      for (k = 0; k < pushables.length; k++) if (!this.tryMove(pushables[k], nr, nc, dr, dc)) return false;
      this.removeObj(r, c, obj);
      this.board[nr][nc].push(obj);
      return true;
    },

    snapshot: function () { return JSON.stringify(this.board); },
    restore: function (s) { this.board = JSON.parse(s); },

    tryInputDir: function (dir) {
      if (this.won) return false;
      var D = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
      if (!D) return false;
      return this.handleMove(D[0], D[1]);
    },

    handleMove: function (dr, dc) {
      this.rules = parseRules(this.board, this.rows, this.cols);
      var snap = this.snapshot();
      var yous = [];
      for (var r = 0; r < this.rows; r++) for (var c = 0; c < this.cols; c++)
        this.board[r][c].forEach(function (o) { if (this.isYou(o)) yous.push({ o: o, r: r, c: c }); }, this);
      yous.sort(function (a, b) { return (b.r * dr + b.c * dc) - (a.r * dr + a.c * dc); });

      var moved = false;
      for (var i = 0; i < yous.length; i++) {
        var pos = this.findObj(yous[i].o);
        if (!pos) continue;
        if (this.tryMove(yous[i].o, pos.r, pos.c, dr, dc)) moved = true;
      }
      if (!moved) { audio.tone({ freq: 150, to: 110, dur: 0.06, vol: 0.1, type: 'sine' }); return false; }

      this.undoStack.push(snap);
      this.moves++;
      this.rules = parseRules(this.board, this.rows, this.cols);
      this.applyTransforms();
      this.applySink();
      this.rules = parseRules(this.board, this.rows, this.cols);

      var ac = Object.keys(this.rules.active).length;
      audio.tone({ freq: 300, dur: 0.05, vol: 0.1, type: 'sine' });
      if (ac !== this.prevActiveCount) audio.tone({ freq: 660, to: 920, dur: 0.13, vol: 0.16, type: 'triangle' });
      this.prevActiveCount = ac;

      this.renderBoard();
      this.updateHUD();

      if (this.checkWin()) this.onWin();
      return true;
    },

    applyTransforms: function () {
      if (!this.rules.transforms.length) return;
      var map = {};
      this.rules.transforms.forEach(function (t) { if (t[0] !== t[1] && !map[t[0]]) map[t[0]] = t[1]; });
      for (var r = 0; r < this.rows; r++) for (var c = 0; c < this.cols; c++)
        this.board[r][c].forEach(function (o) { if (o.t === 'e' && map[o.name]) o.name = map[o.name]; });
    },

    applySink: function () {
      for (var r = 0; r < this.rows; r++) for (var c = 0; c < this.cols; c++) {
        var cell = this.board[r][c];
        var hasSink = cell.some(this.isSink, this);
        if (!hasSink) continue;
        var others = cell.filter(function (o) { return o.t === 'e' && !this.isSink(o); }, this);
        if (others.length > 0) this.board[r][c] = cell.filter(function (o) { return o.t === 't'; });
      }
    },

    checkWin: function () {
      for (var r = 0; r < this.rows; r++) for (var c = 0; c < this.cols; c++) {
        var cell = this.board[r][c];
        if (cell.some(this.isWinE, this) && cell.some(this.isYou, this)) return true;
      }
      return false;
    },

    undo: function () {
      if (this.won || !this.undoStack.length) return;
      this.restore(this.undoStack.pop());
      this.moves++;
      this.rules = parseRules(this.board, this.rows, this.cols);
      this.prevActiveCount = Object.keys(this.rules.active).length;
      audio.tone({ freq: 320, to: 220, dur: 0.08, vol: 0.12, type: 'sine' });
      this.renderBoard();
      this.updateHUD();
    },

    // --- 렌더 ---
    renderBoard: function () {
      this.tiles.forEach(function (t) { t.destroy(); });
      this.tiles = [];
      var T = this.TILE;
      for (var r = 0; r < this.rows; r++) for (var c = 0; c < this.cols; c++) {
        var cell = this.board[r][c];
        var x = this.boardX + c * T + T / 2, y = this.boardY + r * T + T / 2;
        for (var k = 0; k < cell.length; k++) {
          var o = cell[k];
          if (o.t === 'e') {
            this.tiles.push(this.add.sprite(x, y, 'e-' + o.name).setDisplaySize(T * 0.86, T * 0.86));
          } else {
            this.drawTextTile(x, y, T * 0.9, o.w, !!this.rules.active[r + ',' + c]);
          }
        }
      }
    },

    drawTextTile: function (x, y, s, word, active) {
      var col = WORD_COL[word] != null ? WORD_COL[word] : 0xb3aac6;
      var g = this.add.graphics();
      g.fillStyle(col, active ? 1 : 0.5);
      g.fillRoundedRect(x - s / 2, y - s / 2, s, s, s * 0.18);
      if (active) { g.lineStyle(Math.max(2, s * 0.06), 0xffffff, 0.95); g.strokeRoundedRect(x - s / 2, y - s / 2, s, s, s * 0.18); }
      this.tiles.push(g);
      var fs = Math.max(10, Math.round(s * (word.length > 4 ? 0.26 : 0.32)));
      this.tiles.push(this.add.text(x, y, word, {
        fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: fs + 'px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setAlpha(active ? 1 : 0.7));
    },

    // --- HUD ---
    buildHUD: function () {
      var L = LEVELS[this.levelIndex];
      this.add.text(24, 24, (this.levelIndex + 1) + ' / ' + LEVELS.length, {
        fontFamily: 'Segoe UI, Arial', fontSize: '20px', color: '#9a86c0', fontStyle: 'bold' });
      this.add.text(DESIGN_W / 2, 30, L.name, {
        fontFamily: 'Segoe UI, Arial', fontSize: '30px', color: '#6b4fa0', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
      this.movesText = this.add.text(DESIGN_W / 2, 70, '', {
        fontFamily: 'Segoe UI, Arial', fontSize: '18px', color: '#9a86c0' }).setOrigin(0.5);

      var mute = this.add.text(DESIGN_W - 22, 22, '♪', {
        fontFamily: 'monospace', fontSize: '26px', color: '#9a86c0' }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      mute.on('pointerdown', function () { var m = audio.toggleMute(); mute.setText(m ? '♪̸' : '♪').setAlpha(m ? 0.5 : 1); });

      this.mkButton(DESIGN_W / 2 - 96, DESIGN_H - 56, '↶ 되돌리기', function () { this.undo(); });
      this.mkButton(DESIGN_W / 2 + 96, DESIGN_H - 56, '↺ 재시작', function () { this.scene.start('Game', { level: this.levelIndex }); });

      this.updateHUD();
    },

    mkButton: function (x, y, label, fn) {
      var w = 170, h = 56;
      var g = this.add.graphics();
      g.fillStyle(0xffffff, 0.6); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
      g.lineStyle(2, 0x9a86c0, 0.4); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
      this.add.text(x, y, label, { fontFamily: 'Segoe UI, Arial', fontSize: '22px', color: '#6b4fa0', fontStyle: 'bold' }).setOrigin(0.5);
      var zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', fn, this);
      return zone;
    },

    updateHUD: function () {
      var best = this.getBest();
      this.movesText.setText('이동 ' + this.moves + (best != null ? '   ·   베스트 ' + best : ''));
    },

    getBest: function () {
      try { var v = localStorage.getItem('is-rule-best-' + this.levelIndex); return v == null ? null : parseInt(v, 10); } catch (e) { return null; }
    },
    setBest: function (m) {
      try { var b = this.getBest(); if (b == null || m < b) localStorage.setItem('is-rule-best-' + this.levelIndex, String(m)); } catch (e) { /* noop */ }
    },

    starsFor: function (moves, par) { return moves <= par ? 3 : (moves <= Math.ceil(par * 1.5) ? 2 : 1); },

    onWin: function () {
      this.won = true;
      this.setBest(this.moves);
      audio.sfx('flag');
      var stars = this.starsFor(this.moves, LEVELS[this.levelIndex].par);
      var cx = DESIGN_W / 2;

      var ov = this.add.graphics(); ov.fillStyle(0x2a2040, 0.55); ov.fillRect(0, 0, DESIGN_W, DESIGN_H);
      var panel = this.add.graphics(); panel.fillStyle(0xffffff, 0.96);
      panel.fillRoundedRect(cx - 200, DESIGN_H * 0.32, 400, 300, 24);
      this.add.text(cx, DESIGN_H * 0.32 + 56, '맞췄어요!', { fontFamily: 'Segoe UI, Arial', fontSize: '40px', color: '#6b4fa0', fontStyle: 'bold' }).setOrigin(0.5);
      var starStr = '';
      for (var i = 0; i < 3; i++) starStr += (i < stars ? '★' : '☆');
      this.add.text(cx, DESIGN_H * 0.32 + 120, starStr, { fontFamily: 'Arial', fontSize: '52px', color: '#f0c23a' }).setOrigin(0.5);
      this.add.text(cx, DESIGN_H * 0.32 + 168, '이동 ' + this.moves + ' (목표 ' + LEVELS[this.levelIndex].par + ')', {
        fontFamily: 'Segoe UI, Arial', fontSize: '20px', color: '#9a86c0' }).setOrigin(0.5);

      var last = this.levelIndex >= LEVELS.length - 1;
      this.mkButton(cx, DESIGN_H * 0.32 + 240, last ? '🎉 전부 클리어! 처음으로' : '다음 레벨 →', function () {
        if (last) this.scene.start('Title');
        else this.scene.start('Game', { level: this.levelIndex + 1 });
      });
    },

    // --- 입력 ---
    setupInput: function () {
      var kb = this.input.keyboard, self = this;
      kb.on('keydown-LEFT', function () { self.tryInputDir('left'); });
      kb.on('keydown-RIGHT', function () { self.tryInputDir('right'); });
      kb.on('keydown-UP', function () { self.tryInputDir('up'); });
      kb.on('keydown-DOWN', function () { self.tryInputDir('down'); });
      kb.on('keydown-A', function () { self.tryInputDir('left'); });
      kb.on('keydown-D', function () { self.tryInputDir('right'); });
      kb.on('keydown-W', function () { self.tryInputDir('up'); });
      kb.on('keydown-S', function () { self.tryInputDir('down'); });
      kb.on('keydown-Z', function () { self.undo(); });
      kb.on('keydown-R', function () { self.scene.start('Game', { level: self.levelIndex }); });
      kb.on('keydown-ENTER', function () { if (self.won) self.advance(); });

      this.input.on('pointerdown', function (p) { self._sx = p.x; self._sy = p.y; self._sw = true; });
      this.input.on('pointerup', function (p) {
        if (!self._sw) return; self._sw = false;
        var dx = p.x - self._sx, dy = p.y - self._sy, TH = 24;
        if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
        if (Math.abs(dx) > Math.abs(dy)) self.tryInputDir(dx > 0 ? 'right' : 'left');
        else self.tryInputDir(dy > 0 ? 'down' : 'up');
      });
    },

    advance: function () {
      if (this.levelIndex >= LEVELS.length - 1) this.scene.start('Title');
      else this.scene.start('Game', { level: this.levelIndex + 1 });
    }
  });

  // ===========================================================================
  window.__GAME = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#efe7fb',
    render: { pixelArt: false, antialias: true, roundPixels: false },
    scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)),
    scene: [Boot, Title, Game]
  });
})();
