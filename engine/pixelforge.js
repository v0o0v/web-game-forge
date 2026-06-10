/* ============================================================================
 * PixelForge — 절차적 NES풍 픽셀아트 스프라이트 생성기 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * - 외부 에셋 다운로드 0. 모든 그래픽을 코드(문자 그리드)로 생성한다.
 * - 따라서 100% CC0 / IP-safe (닌텐도 등 어떤 저작물도 사용하지 않음).
 * - 각 스프라이트는 문자 그리드 프레임 배열로 정의하고, Phaser CanvasTexture 로 굽는다.
 * - "라가드(ragged) 행 자동 패딩": 행 길이를 직접 맞출 필요 없이, 가장 긴 행 기준으로
 *   오른쪽을 투명('.')으로 자동 패딩한다. → 픽셀 작업이 훨씬 덜 실수난다.
 *
 * 상업적 픽셀아트 원칙(이 라이브러리가 따르는 것):
 *   1) 외곽선(o) — 캐릭터·픽업은 어두운 외곽선으로 배경에서 분리(가독성).
 *   2) 3톤 셰이딩 — 재질마다 highlight/base/shadow 3색 램프(hue-shift 포함).
 *   3) 광원 일관성 — 좌상단 광원. 하이라이트는 좌상, 그림자는 우하.
 *   4) 애니메이션 — run 은 contact(낮음)→passing(1px 높음) 4프레임 바운스,
 *      idle 은 가끔 블링크, 적은 squash&stretch. 정지 2프레임보다 생동감이 핵심.
 *   5) 수직 바운스 구현: 모든 프레임 위에 빈 행 1개를 깔고(grounded),
 *      '높은' 프레임만 빈 행 없이 그려 1px 떠 보이게 한다(bake 가 아래를 패딩).
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
    // 모자(빨강) — 마리오 '느낌'을 위한 단 하나의 색 단서. E=하이라이트
    'r': '#e83b2e', 'R': '#a8231a', 'E': '#ff7a5c',
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
    // 코인(금) — 9=딥골드 외곽
    'y': '#ffd23f', 'Y': '#d9962a', 'w': '#fff3b0', '9': '#a06314',
    // 적(보라 슬라임) — P=하이라이트
    'p': '#9a52c7', 'q': '#6a2f96', 'Q': '#3c1a5c', 'm': '#ffe7c2', 'P': '#c08ae0',
    // 벽돌
    'k': '#c0612a', 'K': '#7d3a17', 'j': '#e08a4a',
    // 물음표 블록
    'z': '#f4b41a', 'Z': '#a8730a', 'x': '#ffe08a',
    // 땅(잔디+흙) — X=잔디 하이라이트, 8=자갈 밝은톤
    'n': '#5bbf4a', 'N': '#3f9233', 'X': '#8fe07a',
    'd': '#b5793f', 'D': '#7d4f25', '8': '#d9a05e',
    // 파이프(초록)
    't': '#3fb34f', 'T': '#1f7d37', 'u': '#8be88b',
    // 구름/하이라이트
    'l': '#ffffff', 'L': '#d4ebff',
    // 언덕
    'i': '#67c95a', 'I': '#43932f',
    // 깃발 / 회색(돌·깃대)
    'f': '#ff5a4d', 'F': '#c8342a', 'a': '#cfd6e0', 'A': '#8a96a8',
    // 원경 산(대기원근 — 하늘색으로 물러난 톤)
    'U': '#7fa8e0', 'V': '#5d86c4', 'W': '#b8d4f2'
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
  // 프레임: 0=idle, 1=idle-blink, 2=run-contact-L(낮음), 3=run-passing(높음),
  //         4=run-contact-R(낮음), 5=run-passing2(높음), 6=jump, 7=fall, 8=hurt
  // 머리(모자+얼굴)는 공통 블록으로 합성해 프레임 간 흔들림을 없앤다.
  var HERO_HEAD = [
    "...oooooo",
    "..orrrrrro",
    ".orEErrrrrro",
    ".oRRRRRRRRRRo",
    ".ossssssssso",
    ".oseessseeso",
    ".oseessseeso",
    "..osssssso"
  ];
  var HERO_HEAD_BLINK = [
    "...oooooo",
    "..orrrrrro",
    ".orEErrrrrro",
    ".oRRRRRRRRRRo",
    ".ossssssssso",
    ".ossssssssso",
    ".osSSsssSSso",
    "..osssssso"
  ];
  // 몸통(8행): 크림 셔츠 + 초록 멜빵 + 장화. 좌상광원(좌측 c/g 밝게, 우측 C/G 그림자).
  var HERO_BODY_IDLE = [
    "..occcccco",
    ".occgccgcco",
    ".ocggggggCo",
    ".oCgGggGgCo",
    "..ogGggGgo",
    "..oggooggo",
    "..obb..bbo",
    ".obBo..obBo"
  ];
  var HERO_BODY_RUN_A = [ // contact — 다리 크게 벌림(보폭), 앞발 왼쪽
    "..occcccco",
    ".occgccgcco",
    ".ocggggggCo",
    ".oCgGggGgCo",
    "..ogGggGgo",
    ".oggo..oggo",
    "obbo....obbo",
    "oBo......oBo"
  ];
  var HERO_BODY_RUN_B = [ // passing — 다리 모음(1px 높음과 결합해 바운스)
    "..occcccco",
    ".occgccgcco",
    ".ocggggggCo",
    ".oCgGggGgCo",
    "..ogGggGgo",
    "...oggggo",
    "...obbbbo",
    "...oBBBBo"
  ];
  var HERO_BODY_RUN_C = [ // contact — 앞발 오른쪽
    "..occcccco",
    ".occgccgcco",
    ".ocggggggCo",
    ".oCgGggGgCo",
    "..ogGggGgo",
    ".oggo..oggo",
    ".obbo...obbbo",
    ".oBo......oBo"
  ];
  var HERO_BODY_RUN_B2 = [ // passing2 — 부츠 음영만 1px 달리해 미세 변화
    "..occcccco",
    ".occgccgcco",
    ".ocggggggCo",
    ".oCgGggGgCo",
    "..ogGggGgo",
    "...oggggo",
    "...obbbbo",
    "...obBBbo"
  ];
  var HERO_BODY_JUMP = [ // 팔 위로(주먹 바깥), 다리 살짝 모음
    "oc.cccccc.co",
    "occcgccgccco",
    ".ocggggggCo",
    ".oCgGggGgCo",
    "..ogGggGgo",
    "..oggggggo",
    "..obbo.bbo",
    "..oBo..oBo"
  ];
  var HERO_BODY_FALL = [ // 팔 만세, 다리 벌림(낙하 대비)
    "oc..cccc..co",
    "occcgccgccco",
    ".ocggggggCo",
    ".oCgGggGgCo",
    "..ogGggGgo",
    ".oggo..oggo",
    ".obbo..obbo",
    ".oBo....oBo"
  ];
  var HERO_BODY_HURT = [ // 팔 휘저음, 다리 풀림
    "oc.cccccc.co",
    "occcgccgccco",
    ".ocggggggCo",
    ".oGgGggGgGo",
    "..ogGggGgo",
    ".oggo..oggo",
    ".obbo..obbo",
    ".oBo....oBo"
  ];
  // grounded(): 위 1px 패딩 → 바닥 정렬. 패딩 없는 프레임은 1px 떠 보인다(바운스).
  function grounded(rows) { return [''].concat(rows); }
  LIB.hero = {
    frames: [
      grounded(HERO_HEAD.concat(HERO_BODY_IDLE)),         // 0 idle
      grounded(HERO_HEAD_BLINK.concat(HERO_BODY_IDLE)),   // 1 idle-blink
      grounded(HERO_HEAD.concat(HERO_BODY_RUN_A)),        // 2 run contact-L (낮음)
      HERO_HEAD.concat(HERO_BODY_RUN_B),                  // 3 run passing (1px 높음)
      grounded(HERO_HEAD.concat(HERO_BODY_RUN_C)),        // 4 run contact-R (낮음)
      HERO_HEAD.concat(HERO_BODY_RUN_B2),                 // 5 run passing2 (1px 높음)
      grounded(HERO_HEAD.concat(HERO_BODY_JUMP)),         // 6 jump
      grounded(HERO_HEAD.concat(HERO_BODY_FALL)),         // 7 fall
      grounded(HERO_HEAD_BLINK.concat(HERO_BODY_HURT))    // 8 hurt
    ]
  };

  // --- 적: 보라 슬라임 워커 (오리지널) --------------------------------------
  // 프레임: 0=mid, 1=stretch(높음), 2=squash(넓음), 3=mid(발 전진), 4=밟힘
  LIB.enemy = {
    frames: [
      [ // 0 — mid
        "...oppppo",
        "..opPPpppo",
        ".opPpppppppo",
        ".opppppppppo",
        ".opmepppmepo",
        ".opmmpppmmpo",
        ".oppppppppqo",
        ".opQQQQQQqqo",
        "..oqqqqqqqo",
        "..omm...mmo"
      ],
      [ // 1 — stretch (좁고 높음)
        "...opppo",
        "..opPPppo",
        "..opPppppo",
        "..opppppppo",
        "..opmeppmepo",
        "..opmmppmmpo",
        "..oppppppqo",
        "..opQQQQqqo",
        "..oqqqqqqo",
        "..omm..mmo"
      ],
      [ // 2 — squash (낮고 넓음)
        "",
        "",
        "..opPPppppo",
        ".opPpppppppppo",
        "opmeppppmepppo",
        "opmmppppmmppqo",
        "oppppppppppqqo",
        "opQQQQQQQQqqqo",
        "oqqqqqqqqqqqqo",
        "omm........mmo"
      ],
      [ // 3 — mid (발 위치 변화)
        "...oppppo",
        "..opPPpppo",
        ".opPpppppppo",
        ".opppppppppo",
        ".opmepppmepo",
        ".opmmpppmmpo",
        ".oppppppppqo",
        ".opQQQQQQqqo",
        "..oqqqqqqqo",
        ".omm.....mmo"
      ],
      [ // 4 — 밟힘 (완전 납작, 감은 눈)
        "",
        "",
        "",
        "",
        "",
        "",
        ".oppppppppppo",
        "opPeppppppepo",
        "opQQQQQQQQqqo",
        "oqqqqqqqqqqqo"
      ]
    ]
  };

  // --- 코인: 회전 4프레임 (딥골드 외곽 + 스펙큘러 샤인, 8x8 중심 고정) -------
  LIB.coin = {
    frames: [
      [ // full
        "..9999..",
        ".9wwyy9.",
        "9ywwyyY9",
        "9wwyyYY9",
        "9wwyyYY9",
        "9ywyYYY9",
        ".9yYYY9.",
        "..9999.."
      ],
      [ // 3/4
        "...999..",
        "..9wyY9.",
        "..9wyY9.",
        "..9wyY9.",
        "..9wyY9.",
        "..9wyY9.",
        "..9yYY9.",
        "...999.."
      ],
      [ // edge
        "...99...",
        "...9w9..",
        "...9w9..",
        "...9w9..",
        "...9w9..",
        "...9w9..",
        "...9y9..",
        "...99..."
      ],
      [ // 3/4 (반대면 — 음영 반전)
        "...999..",
        "..9Ywy9.",
        "..9Ywy9.",
        "..9Ywy9.",
        "..9Ywy9.",
        "..9Ywy9.",
        "..9YYy9.",
        "...999.."
      ]
    ]
  };

  // --- 타일들 (16x16) --------------------------------------------------------
  LIB.ground = { // 잔디+흙 윗면 — 잔디 프린지 + 하이라이트 + 흙 전이
    frames: [[
      "XnXnnXnnnXnXnnXn",
      "nnnnnnnnnnnnnnnn",
      "nNnnNnnNnnnNnnNn",
      "NNdNNNdNNNdNNNdN",
      "ddddddddddddddd8",
      "dddDdddddd8ddddd",
      "dd8dddDddddddDdd",
      "dDdddddddDdddddd",
      "ddddD8dddddddD8d",
      "ddddddddDddddddd",
      "d8dDddddddd8dddd",
      "ddddddD8dDdddDdd",
      "dDddddddddddd8dd",
      "dddd8dDddDdddddd",
      "ddDddddddddddDdd",
      "DdddddD8ddDddddD"
    ]]
  };
  LIB.dirt = { // 흙 속 — 자갈(8 하이라이트 + D 그림자) 디테일
    frames: [[
      "dddddddddddddddd",
      "dDdddddDdddddDdd",
      "ddd8Dddddd8Ddddd",
      "ddDDdddddDDddddd",
      "dddddd8Dddddd8Dd",
      "dDddddDDdddddDDd",
      "dddddddddddddddd",
      "d8DdddddD8dddddd",
      "dDDdddddDDdd8Ddd",
      "ddddd8DddddddDdd",
      "dddddDDddddddddd",
      "dDddddddd8Dddddd",
      "ddd8DddddDDddd8D",
      "dddDDdddddddddDD",
      "dddddddd8Ddddddd",
      "ddDdddddDDdddddd"
    ]]
  };
  LIB.brick = { // 베벨 강화 — 각 단 윗변 j 하이라이트, 아랫변·우측 K 그림자
    frames: [[
      "jjjjjjjjjjjjjjjj",
      "jkkkkkkjkkkkkkkK",
      "jkkkkkkjkkkkkkkK",
      "kkkkkkkjkkkkkkkK",
      "KKKKKKKKKKKKKKKK",
      "jjjkkkkKkkkjjjkk",
      "kkkkkkkKkkkkkkkK",
      "kkkkkkkKkkkkkkkK",
      "KKKKKKKKKKKKKKKK",
      "kkkjkkkkkkkkjkkk",
      "kkkKkkkkkkkkKkkk",
      "kkkKkkkkkkkkKkkK",
      "KKKKKKKKKKKKKKKK",
      "jkkkkkkjkkkkkkkk",
      "kkkkkkkKkkkkkkkK",
      "KKKKKKKKKKKKKKKK"
    ]]
  };
  LIB.qblock = { // 0=밝게(활성), 1=조금 어둡게(애니), 2=사용됨(빈블록)
    frames: [
      [
        "xxxxxxxxxxxxxxxZ",
        "xzzzzzzzzzzzzzZZ",
        "xzzzzzzzzzzzzzZZ",
        "xzzzzzxxxxzzzzZZ",
        "xzzzzxzzzZxzzzZZ",
        "xzzzzZzzzZxzzzZZ",
        "xzzzzzzzzxzzzzZZ",
        "xzzzzzzzxZzzzzZZ",
        "xzzzzzzxZzzzzzZZ",
        "xzzzzzzxZzzzzzZZ",
        "xzzzzzzzzzzzzzZZ",
        "xzzzzzzxxzzzzzZZ",
        "xzzzzzzxxZzzzzZZ",
        "xzzzzzzzzzzzzzZZ",
        "xZzzzzzzzzzzzZZZ",
        "ZZZZZZZZZZZZZZZZ"
      ],
      [
        "ZxxxxxxxxxxxxxxZ",
        "ZzzzzzzzzzzzzzzZ",
        "ZzzzzzzzzzzzzzzZ",
        "ZzzzzzxxxxzzzzzZ",
        "ZzzzzxzzzZxzzzzZ",
        "ZzzzzZzzzZxzzzzZ",
        "ZzzzzzzzzxzzzzzZ",
        "ZzzzzzzzxZzzzzzZ",
        "ZzzzzzzxZzzzzzzZ",
        "ZzzzzzzxZzzzzzzZ",
        "ZzzzzzzzzzzzzzzZ",
        "ZzzzzzzxxzzzzzzZ",
        "ZzzzzzzxxZzzzzzZ",
        "ZzzzzzzzzzzzzzzZ",
        "ZZzzzzzzzzzzzZZZ",
        "ZZZZZZZZZZZZZZZZ"
      ],
      [
        "KKKKKKKKKKKKKKKK",
        "K8DDDDDDDDDDDD8K",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDdd8dddddd8ddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDdd8dddddd8ddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "KDddddddddddddDK",
        "K8DDDDDDDDDDDD8K",
        "KKKKKKKKKKKKKKKK"
      ]
    ]
  };
  LIB.pipeTop = { // 파이프 입구 (32 wide) — 좌측 스펙큘러 밴드 + 림 셰이딩
    frames: [[
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "TuulluutttttttttttttttttttttTTTT",
      "TuulluuttttttttttttttttttttttTTT",
      "TuulluutttttttttttttttttttttTTTT",
      "TuulluuttttttttttttttttttttttTTT",
      "TTulluuttttttttttttttttttttttTTT",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      ".TTulluutttttttttttttttttttttTT.",
      ".TuulluuttttttttttttttttttttTTT.",
      ".TuulluutttttttttttttttttttTTTT.",
      ".TuulluuttttttttttttttttttttTTT.",
      ".TTulluutttttttttttttttttttTTTT.",
      ".TTulluuttttttttttttttttttttTTT.",
      ".TTulluutttttttttttttttttttTTTT.",
      ".TTulluuttttttttttttttttttttTTT.",
      ".TTTTTTTTTTTTTTTTTTTTTTTTTTTTT."
    ]]
  };
  LIB.pipeBody = { // 파이프 몸통 (32 wide)
    frames: [[
      ".TuulluutttttttttttttttttttTTT.",
      ".TuulluuttttttttttttttttttTTTT.",
      ".TTulluutttttttttttttttttttTTT.",
      ".TTulluuttttttttttttttttttTTTT.",
      ".TTulluutttttttttttttttttttTTT.",
      ".TTulluuttttttttttttttttttTTTT.",
      ".TTulluutttttttttttttttttttTTT.",
      ".TTulluuttttttttttttttttttTTTT.",
      ".TTulluutttttttttttttttttttTTT.",
      ".TTulluuttttttttttttttttttTTTT.",
      ".TTulluutttttttttttttttttttTTT.",
      ".TTulluuttttttttttttttttttTTTT.",
      ".TTulluutttttttttttttttttttTTT.",
      ".TTulluuttttttttttttttttttTTTT.",
      ".TTulluutttttttttttttttttttTTT.",
      ".TTulluuttttttttttttttttttTTTT."
    ]]
  };

  // --- 파워업: 초록 버섯 (오리지널, 마리오 빨강 슈퍼버섯과 구분) -------------
  LIB.mushroom = {
    frames: [[
      "....ooooo",
      "...ogggggo",
      "..ogllgggggo",
      ".oglllgglllgo",
      ".oggggggggggo",
      ".oGGGGGGGGGGo",
      "..occcccccco",
      ".ocsessssesco",
      ".ocssssssssco",
      "..occcccccco"
    ]]
  };

  // --- 깃발 골인 지점 (2프레임 웨이브) ----------------------------------------
  LIB.flag = {
    frames: [
      [
        "..Alffff",
        "..Affffff",
        "..AfffFfff",
        "..AffFFff",
        "..AlfFff",
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
      ],
      [
        "..Alfff",
        "..Afffff",
        "..AffFfff",
        "..AfFFff",
        "..Alff",
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
      ]
    ]
  };
  LIB.pole = {
    frames: [[
      "la", "la", "la", "la", "la", "la", "la", "la",
      "la", "la", "la", "la", "la", "la", "la", "la"
    ]]
  };

  // --- 배경 장식 -------------------------------------------------------------
  LIB.cloud = { // 큰 뭉게구름 (3톤, 아랫면 그림자)
    frames: [[
      "......llll",
      "....llllllll..lll",
      "...llllllllllllllll",
      "..llllllllllllllllll",
      ".lllllllllllllllllll",
      "llllllllllllllllLlll",
      "llLLllllllllLLllllll",
      ".LLLLLLLLLLLLLLLLLL"
    ]]
  };
  LIB.cloud2 = { // 작은 구름
    frames: [[
      "....lll",
      "..llllllll",
      ".lllllllllll",
      "lllllLllllll",
      ".LLLLLLLLLL"
    ]]
  };
  LIB.hill = { // 텍스처 점 + 좌상 하이라이트
    frames: [[
      ".........XX",
      ".......XXiii",
      "......Xiiiiii",
      ".....Xiiiiiiii",
      "....Xiiiiiiiiii",
      "...Xiiiiiiiiiiii",
      "..XiiiiIIiiiiiii",
      ".XiiiiIIIiiiiiiii",
      ".iiiiIIIIIiiiiiii",
      "iiiiIIIIIIIiiiiii",
      "iiiIIIIIIIIIiiiii",
      "IIIIIIIIIIIIIIIII"
    ]]
  };
  LIB.bush = { // 3톤 클러스터 덤불
    frames: [[
      "....XXX....nnn",
      "..XXnnnXX.nnnnnn",
      ".XnnnnnnnnnnnnnnN",
      "XnnnnnnNnnnnnNnnn",
      "nnnNNnnnnnNnnnnnN",
      "nNNNNNNNNNNNNNNNN"
    ]]
  };
  LIB.mountain = { // 원경 산 두 봉우리 (대기원근 톤, 눈 덮인 봉우리)
    frames: [[
      ".................WW",
      "................WWWW",
      "...............WWUWW",
      "..............WUUUUWW",
      ".............UUUUUUVV",
      "............UUUUUUUVVV",
      "...........UUUUUUUUVVV.........WW",
      "..........UUUUUUUUUVVVV.......WWWW",
      ".........UUUUUUUUUUUVVVV.....WUUWW",
      "........UUUUUUUUUUUUVVVVV...UUUUVV",
      ".......UUUUUUUUUUUUUUVVVV..UUUUUVVV",
      "......UUUUUUUUUUUUUUUVVVVVUUUUUUVVV",
      ".....UUUUUUUUUUUUUUUUUVVVUUUUUUUVVVV",
      "....UUUUUUUUUUUUUUUUUUVVUUUUUUUUVVVV",
      "...UUUUUUUUUUUUUUUUUUUUUUUUUUUUUVVVVV",
      "..UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUVVVVV",
      ".UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUVVVVVV",
      "UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUVVVVVVV"
    ]]
  };
  LIB.tree = { // 배경 나무 (3톤 캐노피 + 줄기)
    frames: [[
      "......XXX",
      "....XXiiiXX",
      "...Xiiiiiiii",
      "..Xiiiiiiiiii",
      ".Xiiiiiiiiiiii",
      ".XiiiiIiiiiiiI",
      "XiiiiIIiiiiiiI",
      "XiiiIIiiiiiiII",
      "XiiiiiiiiiiiII",
      ".iiiIIiiiiiII",
      ".IiiIIIiiIIII",
      "..IIIIIIIIII",
      "....IIIIII",
      "......bb",
      "......bb",
      "......bb",
      ".....bBb",
      ".....bBbb"
    ]]
  };
  LIB.flowerR = { // 빨간 꽃 (2프레임 스웨이)
    frames: [
      [
        ".fof",
        "fywf",
        ".fof",
        "..G",
        ".XG",
        "..G"
      ],
      [
        "..fof",
        ".fywf",
        "..fof",
        "..G",
        "..GX",
        "..G"
      ]
    ]
  };
  LIB.flowerY = { // 노란 꽃 (2프레임 스웨이)
    frames: [
      [
        ".yoy",
        "ywfy",
        ".yoy",
        "..G",
        ".XG",
        "..G"
      ],
      [
        "..yoy",
        ".ywfy",
        "..yoy",
        "..G",
        "..GX",
        "..G"
      ]
    ]
  };
  LIB.grasstuft = { // 풀숲 (2프레임 스웨이)
    frames: [
      [
        "X..n..X",
        "Xn.nn.X",
        ".XnnnX",
        ".NnnnN"
      ],
      [
        ".X..n.X",
        ".Xn.nnX",
        ".XnnnX",
        ".NnnnN"
      ]
    ]
  };
  LIB.rock = { // 작은 바위 (좌상 하이라이트)
    frames: [[
      "..laa",
      ".laaaa",
      "laaaaAa",
      "aaaAAAAa",
      "AAAAAAAA"
    ]]
  };
  LIB.sun = { // 해 (코어 + 링)
    frames: [[
      "....yyyy",
      "..yywwwwyy",
      ".ywwwwwwwwy",
      ".ywwllllwwy",
      "ywwllllllwwy",
      "ywwllllllwwy",
      "ywwllllllwwy",
      "ywwllllllwwy",
      ".ywwllllwwy",
      ".ywwwwwwwwy",
      "..yywwwwyy",
      "....yyyy"
    ]]
  };
  LIB.dust = { // 먼지 퍼프 (4프레임 — 커지며 흩어짐)
    frames: [
      [
        "........",
        "...ll...",
        "..llll..",
        "...ll..."
      ],
      [
        "..lLll..",
        ".llllll.",
        ".lLllLl.",
        "..llll.."
      ],
      [
        ".lL..ll.",
        "l.llll.L",
        ".lL..Ll.",
        "..l..l.."
      ],
      [
        "L...l..L",
        "........",
        "l..L...l",
        "..L..l.."
      ]
    ]
  };
  LIB.sparkle = { // 반짝임 (4프레임 트윙클)
    frames: [
      [
        ".....",
        "..w..",
        ".www.",
        "..w..",
        "....."
      ],
      [
        "..y..",
        "..w..",
        "ywwwy",
        "..w..",
        "..y.."
      ],
      [
        "..w..",
        ".y.y.",
        "w.l.w",
        ".y.y.",
        "..w.."
      ],
      [
        ".....",
        "..y..",
        ".y.y.",
        "..y..",
        "....."
      ]
    ]
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
    // idle: 평소 0, 가끔 블링크(1) — 4fps × 6프레임 ≈ 1.5초 주기
    anim('hero-idle', 'hero', [0, 0, 0, 0, 0, 1], 4);
    // run: contact(낮음)→passing(높음) 4프레임 바운스 사이클
    anim('hero-run', 'hero', [2, 3, 4, 5], 12);
    anim('hero-jump', 'hero', [6], 1, 0);
    anim('hero-fall', 'hero', [7], 1, 0);
    anim('enemy-walk', 'enemy', [0, 1, 3, 2], 8);
    anim('coin-spin', 'coin', [0, 1, 2, 3], 10);
    anim('qblock-pulse', 'qblock', [0, 1], 3);
    anim('flag-wave', 'flag', [0, 1], 3);
    anim('flowerR-sway', 'flowerR', [0, 1], 2);
    anim('flowerY-sway', 'flowerY', [0, 1], 2);
    anim('grass-sway', 'grasstuft', [0, 1], 2);
    anim('dust-puff', 'dust', [0, 1, 2, 3], 18, 0);
    anim('sparkle-pop', 'sparkle', [0, 1, 2, 3], 14, 0);

    return manifest;
  }

  var PixelForge = { bake: bake, buildAll: buildAll, LIB: LIB, PALETTE: P };
  global.PixelForge = PixelForge;
  if (typeof module !== 'undefined' && module.exports) module.exports = PixelForge;
})(typeof window !== 'undefined' ? window : this);
