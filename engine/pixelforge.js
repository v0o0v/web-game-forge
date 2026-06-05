/* ============================================================================
 * PixelForge — 절차적 NES풍 픽셀아트 스프라이트 생성기 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * - 외부 에셋 다운로드 0. 모든 그래픽을 코드(문자 그리드)로 생성한다.
 * - 따라서 100% CC0 / IP-safe (닌텐도 등 어떤 저작물도 사용하지 않음).
 * - 각 스프라이트는 문자 그리드 프레임 배열로 정의하고, Phaser CanvasTexture 로 굽는다.
 * - "라가드(ragged) 행 자동 패딩": 행 길이를 직접 맞출 필요 없이, 가장 긴 행 기준으로
 *   오른쪽을 투명('.')으로 자동 패딩한다. → 픽셀 작업이 훨씬 덜 실수난다.
 *
 * 사용:
 *   PixelForge.buildAll(scene)        // 모든 내장 스프라이트 + 애니메이션 등록
 *   scene.add.sprite(x, y, 'hero', 0) // 이후 일반 Phaser 스프라이트로 사용
 *
 * 게임 config 에 render.pixelArt:true 를 켜면 확대해도 또렷한 픽셀로 보인다.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // --- 공유 팔레트 (단일 문자 키 → 색). '.' / ' ' = 투명 -------------------
  var P = {
    '.': null, ' ': null,
    // 모자(빨강) — 마리오 '느낌'을 위한 단 하나의 색 단서
    'r': '#e83b2e', 'R': '#a8231a',
    // 피부
    's': '#ffce9e', 'S': '#e0a06c',
    // 눈/외곽
    'e': '#2a2438', 'o': '#1a1622',
    // 셔츠(크림색) — 마리오의 빨강 셔츠와 다르게
    'c': '#fdf1dd', 'C': '#d7c6a6',
    // 멜빵바지(초록) — 마리오의 파랑 멜빵과 다르게
    'g': '#33ad4f', 'G': '#1f7d37',
    // 장화/갈색
    'b': '#7a4a22', 'B': '#46260f',
    // 머리카락
    'h': '#4a2f17',
    // 코인(금)
    'y': '#ffd23f', 'Y': '#d9962a', 'w': '#fff3b0',
    // 적(보라 슬라임)
    'p': '#9a52c7', 'q': '#6a2f96', 'Q': '#3c1a5c', 'm': '#ffe7c2',
    // 벽돌
    'k': '#c0612a', 'K': '#7d3a17', 'j': '#e08a4a',
    // 물음표 블록
    'z': '#f4b41a', 'Z': '#a8730a', 'x': '#ffe08a',
    // 땅(잔디+흙)
    'n': '#5bbf4a', 'N': '#3f9233', 'd': '#b5793f', 'D': '#7d4f25',
    // 파이프(초록)
    't': '#3fb34f', 'T': '#1f7d37', 'u': '#8be88b',
    // 구름/하이라이트
    'l': '#ffffff', 'L': '#d4ebff',
    // 언덕
    'i': '#67c95a', 'I': '#43932f',
    // 깃발
    'f': '#ff5a4d', 'F': '#c8342a', 'a': '#cfd6e0', 'A': '#8a96a8'
  };

  // ---------------------------------------------------------------------------
  // 핵심: 문자 그리드 프레임 배열 → CanvasTexture(가로 스트립) 로 굽기
  // def = { frames: [ [ "row", "row", ... ], ... ], palette?:{} }
  // ---------------------------------------------------------------------------
  function bake(scene, key, def) {
    var pal = def.palette || P;
    var frames = def.frames;
    if (!frames || !frames.length) throw new Error('PixelForge: ' + key + ' frames 비어있음');

    // 폭/높이 = 모든 프레임/행 중 최대값
    var fw = 0, fh = 0;
    frames.forEach(function (f) {
      fh = Math.max(fh, f.length);
      f.forEach(function (row) { fw = Math.max(fw, row.length); });
    });

    var canvas = document.createElement('canvas');
    canvas.width = fw * frames.length;
    canvas.height = fh;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    frames.forEach(function (frame, fi) {
      var ox = fi * fw;
      for (var y = 0; y < frame.length; y++) {
        var row = frame[y];
        for (var x = 0; x < row.length; x++) {
          var ch = row.charAt(x);
          var col = pal[ch];
          if (!col) continue; // 투명/미정의
          ctx.fillStyle = col;
          ctx.fillRect(ox + x, y, 1, 1);
        }
      }
    });

    if (scene.textures.exists(key)) scene.textures.remove(key);
    var tex = scene.textures.addCanvas(key, canvas);
    for (var fi2 = 0; fi2 < frames.length; fi2++) {
      tex.add(fi2, 0, fi2 * fw, 0, fw, fh);
    }
    return { key: key, frameWidth: fw, frameHeight: fh, frameCount: frames.length };
  }

  // ===========================================================================
  // 내장 스프라이트 라이브러리 (문자 그리드)
  // ===========================================================================
  var LIB = {};

  // --- 주인공: 빨간 모자 러너 (오리지널, IP-safe) ----------------------------
  // 프레임: 0=idle, 1=run1, 2=run2, 3=jump
  LIB.hero = {
    frames: [
      // idle
      [
        "....rrrrr",
        "..rrrrrrrrr",
        ".RrrrrrrrrR",
        ".RsssssssS",
        ".hsesssesS",
        ".hssssssss",
        "..sSSSSSs",
        "...cccc",
        "..ccggcc cc",
        ".ccgggggccc",
        ".ccgGGGGgcc",
        ".cggGGGGggc",
        "..gggGGggg",
        "..gg...gg",
        "..bb...bb",
        ".bbb...bbb"
      ],
      // run1 (왼발 앞)
      [
        "....rrrrr",
        "..rrrrrrrrr",
        ".RrrrrrrrrR",
        ".RsssssssS",
        ".hsesssesS",
        ".hssssssss",
        "..sSSSSSs",
        "...cccc",
        "..ccggcc cc",
        ".ccgggggccc",
        ".ccgGGGGgcc",
        ".cggGGGGggc",
        "..gggGGggg",
        "...ggg.gg",
        "..bbb..gg",
        ".bbb...bbb"
      ],
      // run2 (오른발 앞)
      [
        "....rrrrr",
        "..rrrrrrrrr",
        ".RrrrrrrrrR",
        ".RsssssssS",
        ".hsesssesS",
        ".hssssssss",
        "..sSSSSSs",
        "...cccc",
        "..ccggcc cc",
        ".ccgggggccc",
        ".ccgGGGGgcc",
        ".cggGGGGggc",
        "..gggGGggg",
        "..gg.ggg",
        "..gg..bbb",
        ".bbb...bbb"
      ],
      // jump (팔 위로, 다리 모음)
      [
        "....rrrrr..c",
        "..rrrrrrrrrc",
        ".RrrrrrrrrRc",
        ".RsssssssSc",
        ".hsesssesS",
        ".hssssssss",
        "..sSSSSSs",
        "c..cccc",
        "ccccggccc",
        ".ccgggggcc",
        ".ccgGGGGgc",
        ".cggGGGGgc",
        "..ggGGGGg",
        "..gg..gg",
        "..bb..bb",
        "..bb...bb"
      ]
    ]
  };

  // --- 적: 보라 슬라임 워커 (오리지널) --------------------------------------
  // 프레임: 0=walk1, 1=walk2, 2=squashed(밟힘)
  LIB.enemy = {
    frames: [
      [
        "...ppppp",
        "..pppppppp",
        ".pppppppppp",
        ".pqpppppqp",
        ".peqpppqep",   // 눈
        ".pppppppp p",
        ".pQpppppQp",   // 찡그린 입
        "..QQQQQQQQ",
        "..mm....mm",
        ".mmm....mmm"
      ],
      [
        "...ppppp",
        "..pppppppp",
        ".pppppppppp",
        ".pqpppppqp",
        ".peqpppqep",
        ".pppppppp p",
        ".pQpppppQp",
        "..QQQQQQQQ",
        "...mm..mm",
        "..mmm..mmm"
      ],
      [
        "",
        "",
        "",
        "",
        "..pppppppp",
        ".pppppppppp",
        ".pQpeppeqp",
        ".pppppppppp",
        "mmQQQQQQQQmm"
      ]
    ]
  };

  // --- 코인: 회전 4프레임 ----------------------------------------------------
  LIB.coin = {
    frames: [
      [
        "..yyyy",
        ".ywwwYy",
        "yywwYYy",
        "ywwYYYy",
        "ywwYYYy",
        "yywYYYy",
        ".yYYYy",
        "..yyyy"
      ],
      [
        "..yyy",
        "..ywYy",
        "..ywYy",
        "..ywYy",
        "..ywYy",
        "..ywYy",
        "..yYy",
        "..yyy"
      ],
      [
        "...yy",
        "...yY",
        "...yY",
        "...yY",
        "...yY",
        "...yY",
        "...yY",
        "...yy"
      ],
      [
        "..yyy",
        ".yYwy",
        ".yYwy",
        ".yYwy",
        ".yYwy",
        ".yYwy",
        ".yYy",
        "..yyy"
      ]
    ]
  };

  // --- 타일들 (16x16) --------------------------------------------------------
  LIB.ground = { // 잔디+흙 윗면 타일
    frames: [[
      "nnnnnnnnnnnnnnnn",
      "nNnNnNnNnNnNnNnN",
      "NdddddddddddddN",
      "dddDddddddDdddd",
      "ddddddDddddddDd",
      "dDddddddddDdddd",
      "ddddDddddddddDd",
      "dddddddDdddddDd",
      "DdddddddddDdddd",
      "ddddDdddddddddd",
      "dddddddddDddddd",
      "dDdddddDdddddDd",
      "ddddddddddDdddd",
      "ddDddddddddddDd",
      "ddddddDdddddddd",
      "DddddddddDddddD"
    ]]
  };
  LIB.dirt = { // 흙 속 타일
    frames: [[
      "dddddddddddddddd",
      "dDdddddDddddddDd",
      "ddddDddddddDdddd",
      "dddddddddDdddddd",
      "dDdddDddddddddDd",
      "ddddddddDddddddd",
      "dddDddddddddDddd",
      "ddddddddDdddddDd",
      "DddddddddddDdddd",
      "ddddDdddddddddDd",
      "dddddddDdddddddd",
      "dDdddddddddDdddd",
      "dddddDdddddddddd",
      "ddddddddDdddddDd",
      "dDddddddddddDddd",
      "ddddDddddDdddddd"
    ]]
  };
  LIB.brick = {
    frames: [[
      "jjjjjjjjjjjjjjjj",
      "jkkkkkkkkkkkkkkj",
      "jkkkkkkkkkkkkkkj",
      "jkkkkkkkkkkkkkkj",
      "KKKKKKKKKKKKKKKK",
      "kkkkkkkjkkkkkkkk",
      "kkkkkkkjkkkkkkkk",
      "kkkkkkkjkkkkkkkk",
      "KKKKKKKKKKKKKKKK",
      "kkkjkkkkkkkkjkkk",
      "kkkjkkkkkkkkjkkk",
      "kkkjkkkkkkkkjkkk",
      "KKKKKKKKKKKKKKKK",
      "kkkkkkkjkkkkkkkk",
      "kkkkkkkjkkkkkkkk",
      "KKKKKKKKKKKKKKKK"
    ]]
  };
  LIB.qblock = { // 0=밝게(활성), 1=조금 어둡게(애니), 2=사용됨(빈블록)
    frames: [
      [
        "ZZZZZZZZZZZZZZZZ",
        "ZxxxxxxxxxxxxxxZ",
        "ZxzzzzzzzzzzzzxZ",
        "Zxzzzzxxxzzzz zZ",
        "ZxzzzxzZZxzzzxZ",
        "ZxzzzzZZxzzzzxZ",
        "ZxzzzzzZxzzzzxZ",
        "ZxzzzzxxxzzzzxZ",
        "ZxzzzzxzzzzzzxZ",
        "ZxzzzzzzzzzzzxZ",
        "ZxzzzzxzzzzzxZ",
        "ZxzzzzxxzzzzzxZ",
        "ZxzzzzzzzzzzzxZ",
        "ZxxxxxxxxxxxxxZ",
        "ZZZZZZZZZZZZZZZZ",
        "ZZZZZZZZZZZZZZZZ"
      ],
      [
        "ZZZZZZZZZZZZZZZZ",
        "ZZxxxxxxxxxxxxZZ",
        "ZZzzzzzzzzzzzzZZ",
        "ZZzzzzxxxzzzz ZZ",
        "ZZzzzxzZZxzzzzZZ",
        "ZZzzzzZZxzzzzzZZ",
        "ZZzzzzzZxzzzzzZZ",
        "ZZzzzzxxxzzzzzZZ",
        "ZZzzzzxzzzzzzZZZ",
        "ZZzzzzzzzzzzzZZZ",
        "ZZzzzzxzzzzzzZZZ",
        "ZZzzzzxxzzzzzZZZ",
        "ZZzzzzzzzzzzzZZZ",
        "ZZxxxxxxxxxxxxZZ",
        "ZZZZZZZZZZZZZZZZ",
        "ZZZZZZZZZZZZZZZZ"
      ],
      [
        "KKKKKKKKKKKKKKKK",
        "KDDDDDDDDDDDDDDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDDDDDDDDDDDDDDK",
        "KKKKKKKKKKKKKKKK",
        "KKKKKKKKKKKKKKKK"
      ]
    ]
  };
  LIB.pipeTop = { // 파이프 입구 (32 wide)
    frames: [[
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "TuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuT",
      "TuttttttttttttttttttttttttttttT",
      "TuttttttttttttttttttttttttttttT",
      "TutttttttttttttttttttttttttttTT",
      "TTtttttttttttttttttttttttttttTT",
      "TTtttttttttttttttttttttttttttTT",
      ".TTttttttttttttttttttttttttttT.",
      ".TuttttttttttttttttttttttttttT.",
      ".TutttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTTTTTTTTTTTTTTTTTTTTTTTTTTTT."
    ]]
  };
  LIB.pipeBody = { // 파이프 몸통 (32 wide)
    frames: [[
      ".TuttttttttttttttttttttttttttT.",
      ".TutttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT.",
      ".TTtttttttttttttttttttttttttTT."
    ]]
  };

  // --- 파워업: 초록 버섯 (오리지널, 마리오 빨강 슈퍼버섯과 구분) -------------
  LIB.mushroom = {
    frames: [[
      "...gggggg",
      "..ggggggggg",
      ".gglgggglggg",
      ".glllgglllgg",
      "gglllgggllggg",
      "gggggggggggg",
      "gGGGGGGGGGGg",
      "..ccccccc",
      ".ccsscsscc",
      ".cssssssssc",
      ".cseessees c",
      ".cssssssssc",
      "..ccccccc"
    ]]
  };

  // --- 깃발 골인 지점 --------------------------------------------------------
  LIB.flag = {
    frames: [[
      "..Affff",
      "..Affffff",
      "..Afffffff",
      "..Affffff",
      "..Affff",
      "..A",
      "..A",
      "..A",
      "..A",
      "..A",
      "..A",
      "..A",
      "..A",
      "..A",
      "..A",
      "..A"
    ]]
  };
  LIB.pole = {
    frames: [[
      "aA", "aA", "aA", "aA", "aA", "aA", "aA", "aA",
      "aA", "aA", "aA", "aA", "aA", "aA", "aA", "aA"
    ]]
  };

  // --- 배경 장식 -------------------------------------------------------------
  LIB.cloud = {
    frames: [[
      ".....llll",
      "...llllllll",
      "..llllllllll l",
      ".lllllllllllll",
      "llllllllllllLll",
      ".LLLLLLLLLLLLLL"
    ]]
  };
  LIB.hill = {
    frames: [[
      ".......ii",
      ".....iiiiii",
      "....iiiiiiii",
      "...iiiiiiiiii",
      "..iiiiiiiiiiii",
      ".iiiiiiIiiiiiii",
      ".iiiiiIIiiiiiii",
      "iiiiiIIIiiiiiiii",
      "iiiiIIIIIiiiiiii",
      "IIIIIIIIIIIIIIII"
    ]]
  };
  LIB.bush = {
    frames: [[
      "...nnn....nnn",
      ".nnnnnnnnnnnnn",
      "nnnnnnnnnnnnnnn",
      "nNNNNNNNNNNNNNn"
    ]]
  };

  // ===========================================================================
  // 등록 + 애니메이션 정의
  // ===========================================================================
  function buildAll(scene) {
    var manifest = {};
    Object.keys(LIB).forEach(function (key) {
      manifest[key] = bake(scene, key, LIB[key]);
    });

    // 애니메이션 (이미 있으면 건너뜀)
    function anim(key, frameKey, frames, rate, repeat) {
      if (scene.anims.exists(key)) return;
      scene.anims.create({
        key: key,
        frames: frames.map(function (f) { return { key: frameKey, frame: f }; }),
        frameRate: rate,
        repeat: (repeat === undefined ? -1 : repeat)
      });
    }
    anim('hero-idle', 'hero', [0], 1);
    anim('hero-run', 'hero', [1, 2], 10);
    anim('hero-jump', 'hero', [3], 1, 0);
    anim('enemy-walk', 'enemy', [0, 1], 4);
    anim('coin-spin', 'coin', [0, 1, 2, 3], 10);
    anim('qblock-pulse', 'qblock', [0, 1], 3);

    return manifest;
  }

  var PixelForge = { bake: bake, buildAll: buildAll, LIB: LIB, PALETTE: P };
  global.PixelForge = PixelForge;
  if (typeof module !== 'undefined' && module.exports) module.exports = PixelForge;
})(typeof window !== 'undefined' ? window : this);
